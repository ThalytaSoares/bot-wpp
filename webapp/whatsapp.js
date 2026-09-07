import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import qrcode from "qrcode-terminal";
import { config } from "./config.js";
import { carregarDestinosWhatsapp } from "./targets.js";

let socket;
let connectionState = "disconnected";
let connectionPromise;
let currentQr;
let currentQrDataUrl;

function normalizarDestino(destino) {
  const value = String(destino || "").trim();

  if (value.endsWith("@g.us") || value.endsWith("@s.whatsapp.net")) {
    return value;
  }

  const digits = value.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function conectarWhatsapp() {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const { state, saveCreds } = await useMultiFileAuthState(config.whatsappAuthDir);
    const { version } = await fetchLatestBaileysVersion();

    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      version
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        currentQr = qr;
        QRCode.toDataURL(qr)
          .then((dataUrl) => {
            currentQrDataUrl = dataUrl;
          })
          .catch((error) => {
            console.error("Erro ao gerar QR Code para a tela:", error);
          });

        console.log("Escaneie este QR Code no WhatsApp para conectar:");
        qrcode.generate(qr, { small: true });
      }

      if (connection) {
        connectionState = connection;
      }

      if (connection === "open") {
        currentQr = undefined;
        currentQrDataUrl = undefined;
      }

      if (connection === "close") {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        socket = undefined;
        connectionPromise = undefined;
        connectionState = "disconnected";

        if (shouldReconnect) {
          conectarWhatsapp().catch((error) => {
            console.error("Erro ao reconectar WhatsApp:", error);
          });
        }
      }
    });

    return socket;
  })();

  return connectionPromise;
}

export async function getWhatsappStatus() {
  await conectarWhatsapp();
  const targets = await carregarDestinosWhatsapp();

  return {
    state: connectionState,
    qr: currentQr,
    qrDataUrl: currentQrDataUrl,
    targets: targets.map(normalizarDestino)
  };
}

export async function listarGruposWhatsapp() {
  const client = await conectarWhatsapp();

  if (connectionState !== "open") {
    throw new Error("WhatsApp ainda nao esta conectado. Escaneie o QR Code nos logs do servidor.");
  }

  const groups = await client.groupFetchAllParticipating();

  return Object.values(groups)
    .map((group) => ({
      id: group.id,
      name: group.subject || "Grupo sem nome",
      participants: group.participants?.length || 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function enviarMensagemWhatsapp(texto) {
  const mensagem = String(texto || "").trim();
  const targets = await carregarDestinosWhatsapp();

  if (!targets.length) {
    throw new Error("Selecione e salve pelo menos um grupo ou contato para envio.");
  }

  if (!mensagem) {
    throw new Error("Informe uma mensagem para enviar no WhatsApp.");
  }

  const client = await conectarWhatsapp();

  if (connectionState !== "open") {
    throw new Error("WhatsApp ainda nao esta conectado. Escaneie o QR Code nos logs do servidor.");
  }

  const results = [];

  for (const destino of targets.map(normalizarDestino)) {
    const result = await client.sendMessage(destino, { text: mensagem });
    results.push({ to: destino, result });
  }

  return results;
}
