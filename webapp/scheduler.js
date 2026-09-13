import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { config } from "./config.js";
import { gerarPost, montarTopDoDia } from "./ranking.js";
import { buscarProdutosComExpansao } from "./search-expansion.js";
import { enviarMensagemWhatsapp } from "./whatsapp.js";
import { carregarDestinosWhatsapp } from "./targets.js";

function resolveDataPath(path) {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(config.dataDir || process.cwd(), path);
}

const schedulesPath = resolveDataPath(config.schedulesFile);
const historyPath = resolveDataPath(config.dispatchHistoryFile);
const defaultSchedules = [
  {
    id: "manha-dentistas",
    enabled: true,
    time: "10:00",
    keyword: "achadinhos shopee dentistas",
    expandSearch: true,
    limit: 3,
    minRating: 4.0,
    lastRunDate: "",
    lastRunKey: ""
  },
  {
    id: "noite-dentistas",
    enabled: true,
    time: "20:00",
    keyword: "ofertas do dia dentistas",
    expandSearch: true,
    limit: 3,
    minRating: 4.0,
    lastRunDate: "",
    lastRunKey: ""
  }
];

let isRunning = false;

function compactErrorMessage(error) {
  return String(error?.message || error || "Erro desconhecido").slice(0, 500);
}

function toMinutes(time) {
  const [hours, minutes] = String(time || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function isScheduleDue(schedule, now) {
  const scheduledMinutes = toMinutes(schedule.time);
  const nowMinutes = toMinutes(now.time);
  const minutesLate = nowMinutes - scheduledMinutes;

  return minutesLate >= 0 && minutesLate <= 15;
}

function getNowParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

function normalizeSchedule(schedule, index) {
  return {
    id: schedule.id || `schedule-${index + 1}`,
    enabled: schedule.enabled !== false,
    time: String(schedule.time || "10:00").slice(0, 5),
    keyword: String(schedule.keyword || "").trim(),
    expandSearch: schedule.expandSearch !== false,
    limit: Math.max(1, Number(schedule.limit || 3)),
    minRating: Number(schedule.minRating || 4.0),
    lastRunDate: schedule.lastRunDate || "",
    lastRunKey: schedule.lastRunKey || ""
  };
}

export async function carregarAgendamentos() {
  try {
    const data = JSON.parse(await readFile(schedulesPath, "utf8"));
    const schedules = Array.isArray(data.schedules) ? data.schedules : [];
    return schedules.map(normalizeSchedule);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await salvarAgendamentos(defaultSchedules);
  return defaultSchedules;
}

export async function salvarAgendamentos(schedules) {
  const normalized = (schedules || []).map(normalizeSchedule);

  await writeFile(
    schedulesPath,
    JSON.stringify({ schedules: normalized }, null, 2),
    "utf8"
  );

  return normalized;
}

async function executarAgendamento(schedule) {
  const { terms, produtos } = await buscarProdutosComExpansao({
    keyword: schedule.keyword,
    listType: 0,
    expandSearch: schedule.expandSearch,
    maxTerms: 3,
    delayMs: schedule.expandSearch ? 3000 : 0,
    shouldStop: (produtosEncontrados) =>
      montarTopDoDia(produtosEncontrados, {
        limit: schedule.limit,
        minRating: schedule.minRating
      }).length >= schedule.limit
  });
  const offers = montarTopDoDia(produtos, {
    limit: schedule.limit,
    minRating: schedule.minRating
  });
  const posts = offers.map(gerarPost);

  if (!posts.length) {
    throw new Error(`Nenhuma oferta passou pelos filtros para "${schedule.keyword}".`);
  }

  const results = [];

  for (const post of posts) {
    results.push(await enviarMensagemWhatsapp(post));
  }

  return {
    totalFound: produtos.length,
    totalFiltered: posts.length,
    searchTerms: terms,
    offers: offers.map((offer) => ({
      itemId: offer.itemId,
      productName: offer.productName,
      price: offer.price,
      ratingStar: offer.ratingStar,
      sales: offer.sales,
      shopName: offer.shopName,
      offerLink: offer.offerLink,
      imageUrl: offer.imageUrl,
      score: offer.score
    })),
    results
  };
}

export async function carregarHistoricoDisparos() {
  try {
    const data = JSON.parse(await readFile(historyPath, "utf8"));
    return Array.isArray(data.history) ? data.history : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return [];
}

async function registrarHistoricoDisparo(entry) {
  const history = await carregarHistoricoDisparos();
  const nextHistory = [
    {
      id: `${Date.now()}-${entry.scheduleId}`,
      createdAt: new Date().toISOString(),
      ...entry
    },
    ...history
  ].slice(0, 30);

  await writeFile(
    historyPath,
    JSON.stringify({ history: nextHistory }, null, 2),
    "utf8"
  );
}

async function registrarExecucao(schedule, result, mode = "scheduled") {
  const targets = await carregarDestinosWhatsapp();

  await registrarHistoricoDisparo({
    scheduleId: schedule.id,
    status: "success",
    mode,
    scheduledTime: schedule.time,
    keyword: schedule.keyword,
    limit: schedule.limit,
    minRating: schedule.minRating,
    expandSearch: schedule.expandSearch,
    targets,
    totalFound: result.totalFound,
    totalFiltered: result.totalFiltered,
    searchTerms: result.searchTerms,
    offers: result.offers
  });
}

async function registrarFalha(schedule, error, mode = "scheduled") {
  const errorMessage = compactErrorMessage(error);

  await registrarHistoricoDisparo({
    scheduleId: schedule.id,
    status: "error",
    mode,
    scheduledTime: schedule.time,
    keyword: schedule.keyword,
    limit: schedule.limit,
    minRating: schedule.minRating,
    expandSearch: schedule.expandSearch,
    targets: await carregarDestinosWhatsapp().catch(() => []),
    totalFound: 0,
    totalFiltered: 0,
    offers: [],
    error: errorMessage
  });
}

export async function executarAgendamentoManual(scheduleId) {
  const schedules = await carregarAgendamentos();
  const schedule = schedules.find((item) => item.id === scheduleId);

  if (!schedule) {
    throw new Error("Agendamento nao encontrado.");
  }

  const result = await executarAgendamento(schedule);
  await registrarExecucao(schedule, result, "manual");

  return {
    schedule,
    ...result
  };
}

export async function verificarAgendamentos() {
  if (isRunning) {
    return {
      checkedAt: new Date().toISOString(),
      timezone: config.timezone,
      running: true,
      due: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      results: []
    };
  }

  isRunning = true;

  try {
    const now = getNowParts();
    const schedules = await carregarAgendamentos();
    let changed = false;

    const summary = {
      checkedAt: new Date().toISOString(),
      timezone: config.timezone,
      due: 0,
      sent: 0,
      failed: 0,
      skipped: schedules.length,
      results: []
    };

    for (const schedule of schedules) {
      const runKey = `${now.date}-${schedule.time}`;

      if (
        !schedule.enabled ||
        !isScheduleDue(schedule, now) ||
        schedule.lastRunKey === runKey ||
        (!schedule.lastRunKey && schedule.lastRunDate === now.date)
      ) {
        continue;
      }

      summary.due += 1;
      summary.skipped -= 1;
      schedule.lastRunKey = runKey;
      schedule.lastRunDate = now.date;
      changed = true;
      await salvarAgendamentos(schedules);

      try {
        console.log(`Executando agendamento ${schedule.id}: ${schedule.keyword}`);
        const result = await executarAgendamento(schedule);
        await registrarExecucao(schedule, result);
        summary.sent += 1;
        summary.results.push({
          scheduleId: schedule.id,
          status: "success",
          keyword: schedule.keyword,
          totalFound: result.totalFound,
          totalFiltered: result.totalFiltered
        });

        console.log(
          `Agendamento ${schedule.id} enviado: ${result.totalFiltered}/${result.totalFound} ofertas.`
        );
      } catch (error) {
        const errorMessage = compactErrorMessage(error);

        await registrarFalha(schedule, error);
        summary.failed += 1;
        summary.results.push({
          scheduleId: schedule.id,
          status: "error",
          keyword: schedule.keyword,
          error: errorMessage
        });

        console.error(`Erro no agendamento ${schedule.id}:`, error);
      }
    }

    if (changed) {
      await salvarAgendamentos(schedules);
    }

    return summary;
  } finally {
    isRunning = false;
  }
}

export function iniciarAgendador() {
  setInterval(() => {
    verificarAgendamentos().catch((error) => {
      console.error("Erro ao verificar agendamentos:", error);
    });
  }, 30000);
}
