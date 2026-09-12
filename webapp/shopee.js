import crypto from "node:crypto";
import { config, assertShopeeConfig } from "./config.js";

const SHOPEE_URL = "https://open-api.affiliate.shopee.com.br/graphql";

export async function buscarProdutos({
  keyword = "",
  listType = 0,
  sortType,
  page = 1,
  limit = 20,
  isAMSOffer,
  isKeySeller
} = {}) {
  assertShopeeConfig();

  const safeKeyword = String(keyword).replaceAll('"', '\\"');
  const args = [
    `keyword: "${safeKeyword}"`,
    `listType: ${Number(listType)}`,
    `page: ${Math.max(1, Number(page || 1))}`,
    `limit: ${Math.max(1, Number(limit || 20))}`
  ];

  if (sortType) {
    args.push(`sortType: ${Number(sortType)}`);
  }

  if (typeof isAMSOffer === "boolean") {
    args.push(`isAMSOffer: ${isAMSOffer}`);
  }

  if (typeof isKeySeller === "boolean") {
    args.push(`isKeySeller: ${isKeySeller}`);
  }

  const query = `
    {
      productOfferV2(
        ${args.join(",\n        ")}
      ) {
        nodes {
          itemId
          productName
          productLink
          price
          priceMin
          priceMax
          priceDiscountRate
          sales
          ratingStar
          commissionRate
          sellerCommissionRate
          shopeeCommissionRate
          commission
          imageUrl
          offerLink
          shopId
          shopName
          shopType
          periodStartTime
          periodEndTime
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
