export function scoreOferta(produto) {
  const vendas = Number(produto.sales || 0);
  const nota = Number(produto.ratingStar || 0);
  const comissao = Number(produto.commissionRate || 0);

  const scoreVendas = Math.min(vendas / 1000, 1) * 100;
  const scoreNota = nota * 20;
  const scoreComissao = comissao * 1000;

  return Number(
    (scoreVendas * 0.4 + scoreNota * 0.3 + scoreComissao * 0.3).toFixed(2)
  );
}

export function montarTopDoDia(produtos, { limit = 20, minRating = 4.5 } = {}) {
  return produtos
    .filter((produto) => Number(produto.ratingStar || 0) >= Number(minRating))
    .map((produto) => ({
      ...produto,
      score: scoreOferta(produto)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(limit));
}

function scorePesquisaMercado(produto) {
  const vendas = Number(produto.sales || 0);
  const nota = Number(produto.ratingStar || 0);
  const comissao = Number(produto.commissionRate || 0);
  const desconto = Number(produto.priceDiscountRate || 0);

  const scoreVendas = Math.min(vendas / 1000, 1) * 100;
  const scoreNota = nota * 20;
  const scoreComissao = comissao * 1000;
  const scoreDesconto = Math.min(desconto, 80);

  return Number(
    (scoreVendas * 0.38 + scoreNota * 0.24 + scoreComissao * 0.28 + scoreDesconto * 0.1).toFixed(2)
  );
}

export function analisarMercado(
  produtos,
  { limit = 20, minRating = 4.0, minSales = 20, orderBy = "opportunity" } = {}
) {
  const filtered = produtos
    .filter((produto) => Number(produto.ratingStar || 0) >= Number(minRating))
    .filter((produto) => Number(produto.sales || 0) >= Number(minSales))
    .map((produto) => ({
      ...produto,
      score: scoreOferta(produto),
      marketScore: scorePesquisaMercado(produto)
    }));

  const sorters = {
    sales: (a, b) => Number(b.sales || 0) - Number(a.sales || 0),
    commission: (a, b) => Number(b.commissionRate || 0) - Number(a.commissionRate || 0),
    price: (a, b) => Number(a.price || a.priceMin || 0) - Number(b.price || b.priceMin || 0),
    rating: (a, b) => Number(b.ratingStar || 0) - Number(a.ratingStar || 0),
    opportunity: (a, b) => Number(b.marketScore || 0) - Number(a.marketScore || 0)
  };

  return filtered.sort(sorters[orderBy] || sorters.opportunity).slice(0, Number(limit));
}

export function gerarPost(produto) {
  return [
    "🔥 ACHADINHO SHOPEE",
    "",
    `📦 ${produto.productName}`,
    "",
    `⭐ ${produto.ratingStar}/5`,
    `💰 R$ ${produto.price}`,
    "",
    `🏪 ${produto.shopName}`,
    "",
    "👉 Confira:",
    produto.offerLink
  ].join("\n");
}
