const form = document.querySelector("#searchForm");
const statusEl = document.querySelector("#status");
const offersList = document.querySelector("#offersList");
const countEl = document.querySelector("#count");
const postText = document.querySelector("#postText");
const copyPost = document.querySelector("#copyPost");
const sendPost = document.querySelector("#sendPost");
const sendTop = document.querySelector("#sendTop");
const connectWhatsapp = document.querySelector("#connectWhatsapp");
const loadGroups = document.querySelector("#loadGroups");
const saveTargets = document.querySelector("#saveTargets");
const whatsappConnect = document.querySelector("#whatsappConnect");
const groupsList = document.querySelector("#groupsList");
const saveSchedules = document.querySelector("#saveSchedules");
const schedulesList = document.querySelector("#schedulesList");
const template = document.querySelector("#offerTemplate");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

let currentOffers = [];
let whatsappStatusTimer;

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", type === "error");
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
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

    row.className = "schedule-row";
    row.dataset.id = schedule.id;

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

    row.append(enabledLabel, timeLabel, keywordLabel, limitLabel);
    schedulesList.appendChild(row);
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
    setStatus(`${data.totalFound} encontrados, ${data.totalFiltered} passaram pelos filtros.`);

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
    setStatus("Busque ofertas antes de enviar o Top.", "error");
    return;
  }

  setStatus("Enviando Top para o WhatsApp...");

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
      throw new Error(data.error || "Nao foi possivel enviar o Top para o WhatsApp.");
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
  } catch (error) {
    setStatus(error.message, "error");
  }
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
}

loadSchedules();
