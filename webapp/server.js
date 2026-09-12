import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { buscarProdutos } from "./shopee.js";
import { analisarMercado, gerarPost, montarTopDoDia } from "./ranking.js";
import {
  enviarMensagemWhatsapp,
  getWhatsappStatus,
  listarGruposWhatsapp
} from "./whatsapp.js";
import { carregarDestinosWhatsapp, salvarDestinosWhatsapp } from "./targets.js";
import {
  carregarHistoricoDisparos,
  carregarAgendamentos,
  executarAgendamentoManual,
  iniciarAgendador,
  salvarAgendamentos,
  verificarAgendamentos
} from "./scheduler.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function montarMensagemEnvio(posts, destinos) {
  const totalMensagens = posts.length * destinos.length;
  return `${totalMensagens} mensagens enviadas para ${destinos.length} destino${destinos.length === 1 ? "" : "s"}.`;
}

async function getDestinosEnvio() {
  return carregarDestinosWhatsapp();
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8").trim();
  return body ? JSON.parse(body) : {};
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/offers" && request.method === "GET") {
    try {
      const keyword = url.searchParams.get("keyword") || "";
      const listType = Number(url.searchParams.get("listType") || 0);
      const limit = Number(url.searchParams.get("limit") || 20);
      const minRating = Number(url.searchParams.get("minRating") || 4.0);
      const produtos = await buscarProdutos({ keyword, listType });
      const offers = montarTopDoDia(produtos, { limit, minRating }).map((produto) => ({
        ...produto,
        post: gerarPost(produto)
      }));

      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        totalFound: produtos.length,
        totalFiltered: offers.length,
        offers
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/market" && request.method === "GET") {
    try {
      const keyword = url.searchParams.get("keyword") || "";
      const orderBy = url.searchParams.get("orderBy") || "opportunity";
      const sortTypeByOrder = {
        sales: 2,
        commission: 5,
        price: 4,
        rating: 2,
        opportunity: 2
      };
      const limit = Number(url.searchParams.get("limit") || 20);
      const minRating = Number(url.searchParams.get("minRating") || 4.0);
      const minSales = Number(url.searchParams.get("minSales") || 20);
      const onlyExtraCommission = url.searchParams.get("onlyExtraCommission") === "on";
      const produtos = await buscarProdutos({
        keyword,
        listType: 0,
        sortType: sortTypeByOrder[orderBy] || 2,
        limit: Math.max(limit, 20),
        isAMSOffer: onlyExtraCommission ? true : undefined
      });
      const offers = analisarMercado(produtos, {
        limit,
        minRating,
        minSales,
        orderBy
      }).map((produto) => ({
        ...produto,
        post: gerarPost(produto)
      }));

      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        totalFound: produtos.length,
        totalFiltered: offers.length,
        offers
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/whatsapp" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const result = await enviarMensagemWhatsapp(payload.texto);
      const destinos = await getDestinosEnvio();

      sendJson(response, 200, {
        message: montarMensagemEnvio([payload.texto], destinos),
        result
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/whatsapp/top" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const textos = Array.isArray(payload.textos) ? payload.textos : [];
      const limit = Math.max(1, Number(payload.limit || 3));
      const posts = textos.slice(0, limit);

      if (!posts.length) {
        sendJson(response, 400, { error: "Nenhum post foi informado para envio." });
        return;
      }

      const results = [];

      for (const texto of posts) {
        results.push(await enviarMensagemWhatsapp(texto));
      }
      const destinos = await getDestinosEnvio();

      sendJson(response, 200, {
        message: montarMensagemEnvio(posts, destinos),
        results
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/dispatch/offers" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const keyword = payload.keyword || "";
      const listType = Number(payload.listType || 0);
      const limit = Math.max(1, Number(payload.limit || 3));
      const minRating = Number(payload.minRating || 4.0);
      const produtos = await buscarProdutos({ keyword, listType });
      const posts = montarTopDoDia(produtos, { limit, minRating }).map(gerarPost);
      const results = [];

      if (!posts.length) {
        sendJson(response, 400, { error: "Nenhuma oferta passou pelos filtros." });
        return;
      }

      for (const post of posts) {
        results.push(await enviarMensagemWhatsapp(post));
      }
      const destinos = await getDestinosEnvio();

      sendJson(response, 200, {
        message: montarMensagemEnvio(posts, destinos),
        totalFound: produtos.length,
        totalFiltered: posts.length,
        results
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/whatsapp/status" && request.method === "GET") {
    try {
      sendJson(response, 200, await getWhatsappStatus());
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/whatsapp/groups" && request.method === "GET") {
    try {
      sendJson(response, 200, {
        groups: await listarGruposWhatsapp(),
        targets: await carregarDestinosWhatsapp()
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/whatsapp/targets" && request.method === "GET") {
    try {
      sendJson(response, 200, {
        targets: await carregarDestinosWhatsapp()
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/whatsapp/targets" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const targets = await salvarDestinosWhatsapp(payload.targets);

      sendJson(response, 200, {
        message: `${targets.length} destino${targets.length === 1 ? "" : "s"} salvo${targets.length === 1 ? "" : "s"}.`,
        targets
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/schedules" && request.method === "GET") {
    try {
      sendJson(response, 200, {
        timezone: config.timezone,
        schedules: await carregarAgendamentos()
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/schedules/history" && request.method === "GET") {
    try {
      sendJson(response, 200, {
        history: await carregarHistoricoDisparos()
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (
    url.pathname === "/api/schedules/check" &&
    (request.method === "GET" || request.method === "POST")
  ) {
    try {
      await verificarAgendamentos();
      sendJson(response, 200, {
        message: "Agendamentos verificados."
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/schedules" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const schedules = await salvarAgendamentos(payload.schedules);

      sendJson(response, 200, {
        message: "Agendamentos salvos.",
        timezone: config.timezone,
        schedules
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname === "/api/schedules/run" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const result = await executarAgendamentoManual(payload.scheduleId);
      const destinos = await getDestinosEnvio();

      sendJson(response, 200, {
        message: montarMensagemEnvio(result.offers.map((offer) => offer.productName), destinos),
        totalFound: result.totalFound,
        totalFiltered: result.totalFiltered
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }

    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Rota nao encontrada." });
    return;
  }
}

async function handleStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Nao encontrado");
    return;
  }

  const body = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
  });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith("/api/")) {
    await handleApi(request, response);
    return;
  }

  await handleStatic(request, response);
});

server.listen(config.port, () => {
  console.log(`Hub Afiliados Shopee rodando em http://localhost:${config.port}`);
  iniciarAgendador();
  verificarAgendamentos().catch((error) => {
    console.error("Erro ao verificar agendamentos na inicializacao:", error);
  });
});
