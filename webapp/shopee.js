import crypto from "node:crypto";
import { config, assertShopeeConfig } from "./config.js";

const SHOPEE_URL = "https://open-api.affiliate.shopee.com.br/graphql";

export async function buscarProdutos({ keyword = "", listType = 0 } = {}) {
  assertShopeeConfig();

  const safeKeyword = String(keyword).replaceAll('"', '\\"');
  const query = `
    {
      productOfferV2(
        keyword: "${safeKeyword}",
        listType: ${Number(listType)}
      ) {
        nodes {
          itemId
          productName
          price
          sales
          ratingStar
          commissionRate
          imageUrl
          offerLink
          shopName
        }
      }
    }
  `;

  const payload = JSON.stringify({ query });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHash("sha256")
    .update(config.shopeeAppId + timestamp + payload + config.shopeeSecret)
    .digest("hex");

  const response = await fetch(SHOPEE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: [
        `SHA256 Credential=${config.shopeeAppId}`,
        `Timestamp=${timestamp}`,
        `Signature=${signature}`
      ].join(", ")
    },
    body: payload,
    signal: AbortSignal.timeout(30000)
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}: ${body}`);
  }

  const data = JSON.parse(body);

  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data?.data?.productOfferV2?.nodes || [];
}
