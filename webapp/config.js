import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

export const config = {
  port: Number(process.env.PORT || 3000),
  shopeeAppId: process.env.SHOPEE_APP_ID || "",
  shopeeSecret: process.env.SHOPEE_SECRET || ""
};

export function assertShopeeConfig() {
  if (!config.shopeeAppId || !config.shopeeSecret) {
    throw new Error("Configure SHOPEE_APP_ID e SHOPEE_SECRET no arquivo .env.");
  }
}
