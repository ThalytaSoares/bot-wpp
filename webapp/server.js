import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { buscarProdutos } from "./shopee.js";
import { gerarPost, montarTopDoDia } from "./ranking.js";

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

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname !== "/api/offers") {
    sendJson(response, 404, { error: "Rota nao encontrada." });
    return;
  }

  try {
    const keyword = url.searchParams.get("keyword") || "";
    const listType = Number(url.searchParams.get("listType") || 0);
    const limit = Number(url.searchParams.get("limit") || 20);
    const minRating = Number(url.searchParams.get("minRating") || 4.5);
    const produtos = await buscarProdutos({ keyword, listType });
    const offers = montarTopDoDia(produtos, { limit, minRating }).map((produto) => ({
      ...produto,
      post: gerarPost(produto)
    }));

    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      totalFound: produtos.length,
      offers
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
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
