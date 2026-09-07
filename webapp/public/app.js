const form = document.querySelector("#searchForm");
const statusEl = document.querySelector("#status");
const offersList = document.querySelector("#offersList");
const countEl = document.querySelector("#count");
const postText = document.querySelector("#postText");
const copyPost = document.querySelector("#copyPost");
const template = document.querySelector("#offerTemplate");

let currentOffers = [];

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", type === "error");
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function renderOffers(offers) {
  offersList.innerHTML = "";
  countEl.textContent = `${offers.length} oferta${offers.length === 1 ? "" : "s"}`;

  if (!offers.length) {
    offersList.innerHTML = '<p class="shop">Nenhuma oferta passou pelos filtros.</p>';
    return;
  }

  for (const [index, offer] of offers.entries()) {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".offer-card");
    const image = node.querySelector(".offer-image");
    const rank = node.querySelector(".offer-rank");
    const title = node.querySelector("h3");
    const shop = node.querySelector(".shop");
    const metrics = node.querySelector(".metrics");
    const select = node.querySelector(".select-offer");
    const link = node.querySelector(".open-offer");

    image.src = offer.imageUrl || "";
    image.alt = offer.productName || "Produto Shopee";
    rank.textContent = index === 0 ? "Produto do dia" : `#${index + 1}`;
    title.textContent = offer.productName;
    shop.textContent = offer.shopName || "Loja Shopee";
    metrics.innerHTML = [
      `<span class="metric score">Score ${offer.score}</span>`,
      `<span class="metric">R$ ${offer.price}</span>`,
      `<span class="metric">${offer.sales || 0} vendas</span>`,
      `<span class="metric">⭐ ${offer.ratingStar || 0}</span>`,
      `<span class="metric">Comissão ${formatPercent(offer.commissionRate)}</span>`
    ].join("");
    select.addEventListener("click", () => {
      postText.value = offer.post;
      card.scrollIntoView({ block: "nearest" });
    });
    link.href = offer.offerLink;

    offersList.appendChild(node);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const params = new URLSearchParams(new FormData(form));
  setStatus("Buscando ofertas na Shopee...");
  offersList.innerHTML = "";
  postText.value = "";

  try {
    const response = await fetch(`/api/offers?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel buscar ofertas.");
    }

    currentOffers = data.offers || [];
    renderOffers(currentOffers);
    setStatus(`Ranking gerado com ${data.totalFound} produtos encontrados.`);

    if (currentOffers[0]) {
      postText.value = currentOffers[0].post;
    }
  } catch (error) {
    currentOffers = [];
    renderOffers([]);
    setStatus(error.message, "error");
  }
});

copyPost.addEventListener("click", async () => {
  if (!postText.value.trim()) {
    setStatus("Gere um post antes de copiar.", "error");
    return;
  }

  await navigator.clipboard.writeText(postText.value);
  setStatus("Post copiado.");
});
