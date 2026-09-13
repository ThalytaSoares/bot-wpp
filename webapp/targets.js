import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { config } from "./config.js";

function resolveDataPath(path) {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(config.dataDir || process.cwd(), path);
}

const targetsPath = resolveDataPath(config.whatsappTargetsFile);

function normalizeTargets(targets) {
  return [...new Set((targets || []).map((target) => String(target || "").trim()).filter(Boolean))];
}

export async function carregarDestinosWhatsapp() {
  try {
    const data = JSON.parse(await readFile(targetsPath, "utf8"));
    const savedTargets = normalizeTargets(data.targets);

    if (savedTargets.length) {
      return savedTargets;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return config.whatsappTargets;
}

export async function salvarDestinosWhatsapp(targets) {
  const normalizedTargets = normalizeTargets(targets);

  await writeFile(
    targetsPath,
    JSON.stringify({ targets: normalizedTargets }, null, 2),
    "utf8"
  );

  return normalizedTargets;
}
