const form = document.querySelector("#searchForm");
const statusEl = document.querySelector("#status");
const offersList = document.querySelector("#offersList");
const countEl = document.querySelector("#count");
const postText = document.querySelector("#postText");
const copyPost = document.querySelector("#copyPost");
const sendPost = document.querySelector("#sendPost");
const sendTop = document.querySelector("#sendTop");
const marketForm = document.querySelector("#marketForm");
const marketList = document.querySelector("#marketList");
const marketCount = document.querySelector("#marketCount");
const connectWhatsapp = document.querySelector("#connectWhatsapp");
const loadGroups = document.querySelector("#loadGroups");
const saveTargets = document.querySelector("#saveTargets");
const whatsappConnect = document.querySelector("#whatsappConnect");
const groupsList = document.querySelector("#groupsList");
const saveSchedules = document.querySelector("#saveSchedules");
const schedulesList = document.querySelector("#schedulesList");
const loadHistory = document.querySelector("#loadHistory");
const historyList = document.querySelector("#historyList");
const template = document.querySelector("#offerTemplate");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

let currentOffers = [];
let marketOffers = [];
let whatsappStatusTimer;

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", type === "error");
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatSearchSummary(data, filterLabel) {
  const terms = data.searchTerms || [];
  const termsText = terms.length
    ? ` ${terms.length} termo${terms.length === 1 ? "" : "s"} usado${terms.length === 1 ? "" : "s"}.`
    : "";

  return `${data.totalFound} encontrados, ${data.totalFiltered} passaram pelos ${filterLabel}.${termsText}`;
}

function activateTab(tabName) {
  for (const button of tabButtons) {
    button.classList.toggle("active", button.dataset.tab === tabName);
  }

  for (const panel of tabPanels) {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  }
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

function getPrice(offer) {
  return offer.price || offer.priceMin || offer.priceMax || "";
}

function renderMarketOffers(offers) {
  marketList.innerHTML = "";
  marketCount.textContent = `${offers.length} oferta${offers.length === 1 ? "" : "s"}`;

  if (!offers.length) {
    marketList.innerHTML = '<p class="shop">Nenhum produto passou pelos critérios da pesquisa.</p>';
    return;
  }

  for (const [index, offer] of offers.entries()) {
    const card = document.createElement("article");
    const image = document.createElement("img");
    const info = document.createElement("div");
    const rank = document.createElement("div");
    const title = document.createElement("h3");
    const shop = document.createElement("p");
    const metrics = document.createElement("div");
    const actions = document.createElement("div");
    const postButton = document.createElement("button");
    const sendButton = document.createElement("button");
    const copyButton = document.createElement("button");
    const openLink = document.createElement("a");

    card.className = "market-card";
    image.src = offer.imageUrl || "";
    image.alt = offer.productName || "Produto Shopee";
    info.className = "market-info";
    rank.className = "offer-rank";
    rank.textContent = index === 0 ? "Melhor oportunidade" : `#${index + 1}`;
    title.textContent = offer.productName || "Produto Shopee";
    shop.className = "shop";
    shop.textContent = offer.shopName || "Loja Shopee";
    metrics.className = "metrics";
    metrics.innerHTML = [
      `<span class="metric score">Score ${offer.marketScore || offer.score}</span>`,
      `<span class="metric">R$ ${getPrice(offer)}</span>`,
      `<span class="metric">${offer.sales || 0} vendas</span>`,
      `<span class="metric">⭐ ${offer.ratingStar || 0}</span>`,
      `<span class="metric">Comissão ${formatPercent(offer.commissionRate)}</span>`,
      offer.priceDiscountRate ? `<span class="metric">${offer.priceDiscountRate}% off</span>` : ""
    ].filter(Boolean).join("");

    actions.className = "market-actions";
    postButton.type = "button";
    postButton.textContent = "Gerar post";
    postButton.addEventListener("click", () => {
      postText.value = offer.post;
      activateTab("manual");
      setStatus("Post gerado na aba Manual para revisão.");
    });

    sendButton.type = "button";
    sendButton.className = "send-market-offer";
    sendButton.textContent = "Enviar WhatsApp";
    sendButton.addEventListener("click", async () => {
      setStatus(`Enviando "${offer.productName}" para o WhatsApp...`);

      try {
        const response = await fetch("/api/whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ texto: offer.post })
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Nao foi possivel enviar a oferta para o WhatsApp.");
        }

        setStatus(data.message);
      } catch (error) {
        setStatus(error.message, "error");
      }
    });

    copyButton.type = "button";
    copyButton.textContent = "Copiar link";
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(offer.offerLink);
      setStatus("Link copiado.");
    });

    openLink.className = "open-offer";
    openLink.href = offer.offerLink;
    openLink.target = "_blank";
    openLink.rel = "noreferrer";
    openLink.textContent = "Abrir oferta";

    info.append(rank, title, shop, metrics);
    actions.append(postButton, sendButton, copyButton, openLink);
    card.append(image, info, actions);
    marketList.appendChild(card);
  }
}

function renderGroups(groups, targets = []) {
  groupsList.innerHTML = "";
  const selectedTargets = new Set(targets);

  if (!groups.length) {
    groupsList.innerHTML = '<p class="shop">Nenhum grupo encontrado.</p>';
    return;
  }

  for (const group of groups) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const item = document.createElement("div");
    const info = document.createElement("div");
    const name = document.createElement("strong");
    const id = document.createElement("code");

    label.className = "group-choice";
    checkbox.type = "checkbox";
    checkbox.value = group.id;
    checkbox.checked = selectedTargets.has(group.id);
    item.className = "group-item";
    name.textContent = group.name;
    id.textContent = group.id;

    info.append(name, id);
    item.append(info);
    label.append(checkbox, item);
    groupsList.appendChild(label);
  }
}

function renderWhatsappStatus(data) {
  whatsappConnect.innerHTML = "";

  const state = document.createElement("p");
  state.className = "shop";
  state.textContent = `Status: ${data.state || "desconhecido"}`;
  whatsappConnect.appendChild(state);

  if (data.qrDataUrl) {
    const qr = document.createElement("img");
    qr.className = "qr-code";
    qr.src = data.qrDataUrl;
    qr.alt = "QR Code para conectar WhatsApp";
    whatsappConnect.appendChild(qr);
    return;
  }

  if (data.state === "open") {
    const ok = document.createElement("p");
    ok.className = "shop";
    ok.textContent = "WhatsApp conectado.";
    whatsappConnect.appendChild(ok);
    return;
  }

  const waiting = document.createElement("p");
  waiting.className = "shop";
  waiting.textContent = "Clique em Conectar e aguarde o QR Code aparecer.";
  whatsappConnect.appendChild(waiting);
}

function renderSchedules(schedules = []) {
  schedulesList.innerHTML = "";

  for (const schedule of schedules) {
    const row = document.createElement("div");
    const enabledLabel = document.createElement("label");
    const enabled = document.createElement("input");
    const timeLabel = document.createElement("label");
    const time = document.createElement("input");
    const keywordLabel = document.createElement("label");
    const keyword = document.createElement("input");
    const limitLabel = document.createElement("label");
    const limit = document.createElement("input");
    const expandLabel = document.createElement("label");
    const expand = document.createElement("input");
    const meta = document.createElement("div");
    const fields = document.createElement("div");
    const actions = document.createElement("div");
    const runButton = document.createElement("button");

    row.className = "schedule-row";
    row.dataset.id = schedule.id;
    meta.className = "schedule-meta";
    fields.className = "schedule-fields";
    actions.className = "schedule-actions";

    enabledLabel.textContent = "Ativo";
    enabled.type = "checkbox";
    enabled.name = "enabled";
    enabled.checked = schedule.enabled !== false;
    enabledLabel.appendChild(enabled);

    timeLabel.textContent = "Horario";
    time.type = "time";
    time.name = "time";
    time.value = schedule.time || "10:00";
    timeLabel.appendChild(time);

    keywordLabel.textContent = "Busca";
    keyword.name = "keyword";
    keyword.value = schedule.keyword || "";
    keywordLabel.appendChild(keyword);

    limitLabel.textContent = "Qtd.";
    limit.type = "number";
    limit.name = "limit";
    limit.min = "1";
    limit.max = "10";
    limit.value = schedule.limit || 3;
    limitLabel.appendChild(limit);

    expandLabel.textContent = "Busca expandida";
    expand.type = "checkbox";
    expand.name = "expandSearch";
    expand.checked = schedule.expandSearch !== false;
    expandLabel.className = "check-control";
    expandLabel.prepend(expand);

    runButton.type = "button";
    runButton.className = "run-schedule";
    runButton.textContent = "Disparar agora";
    runButton.addEventListener("click", async () => {
      setStatus(`Disparando agendamento "${keyword.value}" agora...`);

      try {
        const response = await fetch("/api/schedules/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ scheduleId: row.dataset.id })
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Nao foi possivel disparar o agendamento.");
        }

        setStatus(data.message);
        loadScheduleHistory();
      } catch (error) {
        setStatus(error.message, "error");
        loadScheduleHistory();
      }
    });

    meta.append(enabledLabel);
    fields.append(timeLabel, keywordLabel, limitLabel, expandLabel);
    actions.append(runButton);
    row.append(meta, fields, actions);
    schedulesList.appendChild(row);
  }
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderHistory(history = []) {
  historyList.innerHTML = "";

  if (!history.length) {
    historyList.innerHTML = '<p class="shop">Nenhum envio agendado registrado ainda.</p>';
    return;
  }

  for (const entry of history) {
    const item = document.createElement("article");
    const title = document.createElement("div");
    const heading = document.createElement("h3");
    const meta = document.createElement("p");
    const offers = document.createElement("div");

    item.className = `history-item ${entry.status === "error" ? "history-error" : ""}`;
    title.className = "history-title";
    offers.className = "history-offers";
    heading.textContent = `${entry.scheduledTime} - ${entry.keyword}`;
    meta.className = "shop";
    meta.textContent = entry.status === "error"
      ? `Falhou em ${formatDateTime(entry.createdAt)}: ${entry.error}`
      : `${entry.totalFiltered} ofertas enviadas em ${formatDateTime(entry.createdAt)} para ${entry.targets?.length || 0} destino(s).`;

    title.append(heading, meta);
    item.appendChild(title);

    for (const offer of entry.offers || []) {
      const offerRow = document.createElement("a");
      const image = document.createElement("img");
      const info = document.createElement("div");
      const name = document.createElement("strong");
      const detail = document.createElement("span");

      offerRow.className = "history-offer";
      offerRow.href = offer.offerLink;
      offerRow.target = "_blank";
      offerRow.rel = "noreferrer";
      image.src = offer.imageUrl || "";
      image.alt = offer.productName || "Produto Shopee";
      name.textContent = offer.productName || "Oferta enviada";
      detail.textContent = `R$ ${offer.price} | ${offer.ratingStar || 0} estrelas | ${offer.shopName || "Shopee"}`;

      info.append(name, detail);
      offerRow.append(image, info);
      offers.appendChild(offerRow);
    }

    item.appendChild(offers);
    historyList.appendChild(item);
  }
}

async function loadScheduleHistory() {
  try {
    const response = await fetch("/api/schedules/history");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel carregar o historico.");
    }

    renderHistory(data.history || []);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadSchedules() {
  try {
    const response = await fetch("/api/schedules");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel carregar os agendamentos.");
    }

    renderSchedules(data.schedules || []);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function atualizarStatusWhatsapp({ keepPolling = false } = {}) {
  const response = await fetch("/api/whatsapp/status");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nao foi possivel iniciar o WhatsApp.");
  }

  renderWhatsappStatus(data);

  if (whatsappStatusTimer) {
    clearTimeout(whatsappStatusTimer);
  }

  if (keepPolling && data.state !== "open" && !data.qrDataUrl) {
    whatsappStatusTimer = setTimeout(() => {
      atualizarStatusWhatsapp({ keepPolling: true }).catch((error) => {
        setStatus(error.message, "error");
      });
    }, 1500);
  }

  return data;
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
    setStatus(formatSearchSummary(data, "filtros"));

    if (currentOffers[0]) {
      postText.value = currentOffers[0].post;
    }
  } catch (error) {
    currentOffers = [];
    renderOffers([]);
    setStatus(error.message, "error");
  }
});

marketForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const params = new URLSearchParams(new FormData(marketForm));
  setStatus("Analisando produtos na Shopee...");
  marketList.innerHTML = "";

  try {
    const response = await fetch(`/api/market?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel analisar os produtos.");
    }

    marketOffers = data.offers || [];
    renderMarketOffers(marketOffers);
    setStatus(formatSearchSummary(data, "critérios"));
  } catch (error) {
    marketOffers = [];
    renderMarketOffers([]);
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

sendPost.addEventListener("click", async () => {
  if (!postText.value.trim()) {
    setStatus("Selecione uma oferta antes de enviar.", "error");
    return;
  }

  setStatus("Enviando post para o WhatsApp...");

  try {
    const response = await fetch("/api/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ texto: postText.value })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel enviar para o WhatsApp.");
    }

    setStatus(data.message);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

sendTop.addEventListener("click", async () => {
  if (!currentOffers.length) {
    setStatus("Busque ofertas antes de enviar o Top 3 agora.", "error");
    return;
  }

  setStatus("Enviando Top 3 agora para o WhatsApp...");

  try {
    const response = await fetch("/api/whatsapp/top", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        textos: currentOffers.map((offer) => offer.post),
        limit: 3
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel enviar o Top 3 para o WhatsApp.");
    }

    setStatus(data.message);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

loadGroups.addEventListener("click", async () => {
  setStatus("Buscando grupos do WhatsApp...");

  try {
    const response = await fetch("/api/whatsapp/groups");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel listar os grupos.");
    }

    renderGroups(data.groups || [], data.targets || []);
    setStatus(`${(data.groups || []).length} grupos encontrados.`);
  } catch (error) {
    renderGroups([]);
    setStatus(error.message, "error");
  }
});

saveTargets.addEventListener("click", async () => {
  const targets = [...groupsList.querySelectorAll('input[type="checkbox"]:checked')]
    .map((checkbox) => checkbox.value);

  if (!targets.length) {
    setStatus("Selecione pelo menos um grupo antes de salvar.", "error");
    return;
  }

  setStatus("Salvando destinos do WhatsApp...");

  try {
    const response = await fetch("/api/whatsapp/targets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targets })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel salvar os destinos.");
    }

    setStatus(data.message);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

connectWhatsapp.addEventListener("click", async () => {
  setStatus("Preparando conexao com o WhatsApp...");

  try {
    const data = await atualizarStatusWhatsapp({ keepPolling: true });
    setStatus(data.state === "open" ? "WhatsApp conectado." : "Aguardando QR Code do WhatsApp.");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

saveSchedules.addEventListener("click", async () => {
  const schedules = [...schedulesList.querySelectorAll(".schedule-row")].map((row) => ({
    id: row.dataset.id,
    enabled: row.querySelector('[name="enabled"]').checked,
    time: row.querySelector('[name="time"]').value,
    keyword: row.querySelector('[name="keyword"]').value,
    expandSearch: row.querySelector('[name="expandSearch"]').checked,
    limit: Number(row.querySelector('[name="limit"]').value || 3),
    minRating: 4.0
  }));

  setStatus("Salvando agendamentos...");

  try {
    const response = await fetch("/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ schedules })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel salvar a agenda.");
    }

    renderSchedules(data.schedules || []);
    setStatus(data.message);
    loadScheduleHistory();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

loadHistory.addEventListener("click", async () => {
  setStatus("Atualizando historico de envios...");
  await loadScheduleHistory();
  setStatus("Historico atualizado.");
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
}

loadSchedules();
loadScheduleHistory();
