import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { config, assertWhatsappConfig } from "./config.js";

let socket;
let connectionState = "disconnected";
let connectionPromise;

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
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const { version } = await fetchLatestBaileysVersion();

    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      version
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log("Escaneie este QR Code no WhatsApp para conectar:");
        qrcode.generate(qr, { small: true });
      }

      if (connection) {
        connectionState = connection;
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

  return {
    state: connectionState,
    targets: config.whatsappTargets.map(normalizarDestino)
  };
}

export async function enviarMensagemWhatsapp(texto) {
  assertWhatsappConfig();

  const mensagem = String(texto || "").trim();

  if (!mensagem) {
    throw new Error("Informe uma mensagem para enviar no WhatsApp.");
  }

  const client = await conectarWhatsapp();

  if (connectionState !== "open") {
    throw new Error("WhatsApp ainda nao esta conectado. Escaneie o QR Code nos logs do servidor.");
  }

  const results = [];

  for (const destino of config.whatsappTargets.map(normalizarDestino)) {
    const result = await client.sendMessage(destino, { text: mensagem });
    results.push({ to: destino, result });
  }

  return results;
}
