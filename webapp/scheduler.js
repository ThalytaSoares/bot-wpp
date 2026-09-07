import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "./config.js";
import { buscarProdutos } from "./shopee.js";
import { gerarPost, montarTopDoDia } from "./ranking.js";
import { enviarMensagemWhatsapp } from "./whatsapp.js";

const schedulesPath = resolve(process.cwd(), config.schedulesFile);
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
  const posts = montarTopDoDia(produtos, {
    limit: schedule.limit,
    minRating: schedule.minRating
  }).map(gerarPost);

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
    results
  };
}

export async function verificarAgendamentos() {
  if (isRunning) {
    return;
  }

  const now = getNowParts();
  const schedules = await carregarAgendamentos();
  let changed = false;

  for (const schedule of schedules) {
    if (!schedule.enabled || schedule.time !== now.time || schedule.lastRunDate === now.date) {
      continue;
    }

    isRunning = true;

    try {
      console.log(`Executando agendamento ${schedule.id}: ${schedule.keyword}`);
      const result = await executarAgendamento(schedule);
      console.log(
        `Agendamento ${schedule.id} enviado: ${result.totalFiltered}/${result.totalFound} ofertas.`
      );
    } catch (error) {
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
