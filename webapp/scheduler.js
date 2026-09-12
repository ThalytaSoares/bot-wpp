import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "./config.js";
import { buscarProdutos } from "./shopee.js";
import { gerarPost, montarTopDoDia } from "./ranking.js";
import { enviarMensagemWhatsapp } from "./whatsapp.js";
import { carregarDestinosWhatsapp } from "./targets.js";

const schedulesPath = resolve(process.cwd(), config.schedulesFile);
const historyPath = resolve(process.cwd(), config.dispatchHistoryFile);
const defaultSchedules = [
  {
    id: "manha-dentistas",
    enabled: true,
    time: "10:00",
    keyword: "achadinhos shopee dentistas",
    limit: 3,
    minRating: 4.0,
    lastRunDate: ""
  },
  {
    id: "noite-dentistas",
    enabled: true,
    time: "20:00",
    keyword: "ofertas do dia dentistas",
    limit: 3,
    minRating: 4.0,
    lastRunDate: ""
  }
];

let isRunning = false;

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
    limit: Math.max(1, Number(schedule.limit || 3)),
    minRating: Number(schedule.minRating || 4.0),
    lastRunDate: schedule.lastRunDate || ""
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
  const produtos = await buscarProdutos({ keyword: schedule.keyword, listType: 0 });
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

export async function verificarAgendamentos() {
  if (isRunning) {
    return;
  }

  const now = getNowParts();
  const schedules = await carregarAgendamentos();
  let changed = false;

  for (const schedule of schedules) {
    if (!schedule.enabled || !isScheduleDue(schedule, now) || schedule.lastRunDate === now.date) {
      continue;
    }

    isRunning = true;

    try {
      console.log(`Executando agendamento ${schedule.id}: ${schedule.keyword}`);
      const result = await executarAgendamento(schedule);
      const targets = await carregarDestinosWhatsapp();

      await registrarHistoricoDisparo({
        scheduleId: schedule.id,
        status: "success",
        scheduledTime: schedule.time,
        keyword: schedule.keyword,
        limit: schedule.limit,
        minRating: schedule.minRating,
        targets,
        totalFound: result.totalFound,
        totalFiltered: result.totalFiltered,
        offers: result.offers
      });

      console.log(
        `Agendamento ${schedule.id} enviado: ${result.totalFiltered}/${result.totalFound} ofertas.`
      );
    } catch (error) {
      await registrarHistoricoDisparo({
        scheduleId: schedule.id,
        status: "error",
        scheduledTime: schedule.time,
        keyword: schedule.keyword,
        limit: schedule.limit,
        minRating: schedule.minRating,
        targets: await carregarDestinosWhatsapp().catch(() => []),
        totalFound: 0,
        totalFiltered: 0,
        offers: [],
        error: error.message
      });

      console.error(`Erro no agendamento ${schedule.id}:`, error);
    } finally {
      schedule.lastRunDate = now.date;
      changed = true;
      isRunning = false;
    }
  }

  if (changed) {
    await salvarAgendamentos(schedules);
  }
}

export function iniciarAgendador() {
  setInterval(() => {
    verificarAgendamentos().catch((error) => {
      console.error("Erro ao verificar agendamentos:", error);
    });
  }, 30000);
}
