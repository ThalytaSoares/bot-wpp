import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { buscarProdutos } from "./shopee.js";
import { gerarPost, montarTopDoDia } from "./ranking.js";
import { enviarMensagemWhatsapp, getWhatsappStatus } from "./whatsapp.js";

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

  if (url.pathname === "/api/whatsapp" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const result = await enviarMensagemWhatsapp(payload.texto);

      sendJson(response, 200, {
        message: montarMensagemEnvio([payload.texto], config.whatsappTargets),
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

      sendJson(response, 200, {
        message: montarMensagemEnvio(posts, config.whatsappTargets),
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

      sendJson(response, 200, {
        message: montarMensagemEnvio(posts, config.whatsappTargets),
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
});
