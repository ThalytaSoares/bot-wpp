import { buscarProdutos } from "./shopee.js";

const synonymGroups = [
  ["fone de ouvido", "fone bluetooth", "fone sem fio", "headset", "headset bluetooth", "earphone", "earphone bluetooth", "fone tws", "airpods"],
  ["dentista", "odontologia", "odontologico", "consultorio odontologico", "consultorio dentista"],
  ["achadinhos shopee dentistas", "achadinhos odontologia", "produtos para dentistas", "itens para consultorio odontologico"],
  ["ofertas do dia dentistas", "promocao odontologia", "ofertas odontologia", "achados para dentistas"],
  ["jaleco", "jaleco dentista", "jaleco odontologico", "scrub", "pijama cirurgico"],
  ["organizador", "organizador consultorio", "organizador dental", "estojo organizador", "caixa organizadora"],
  ["clareador", "clareador dental", "clareamento dental", "moldeira dental"],
  ["cozinha", "utensilios cozinha", "organizador cozinha", "cozinha inteligente"],
  ["beleza", "skincare", "maquiagem", "cuidados pessoais", "produto beleza"],
  ["casa", "casa organizacao", "decoracao casa", "utilidades domesticas"]
];

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function expandirTermosBusca(keyword, { maxTerms = 8 } = {}) {
  const original = String(keyword || "").trim();
  const normalizedOriginal = normalizarTexto(original);
  const terms = [original];

  if (!normalizedOriginal) {
    return [];
  }

  for (const group of synonymGroups) {
    const normalizedGroup = group.map(normalizarTexto);
    const matchesGroup = normalizedGroup.some((term) =>
      normalizedOriginal.includes(term) || term.includes(normalizedOriginal)
    );

    if (!matchesGroup) {
      continue;
    }

    for (const term of group) {
      if (!terms.some((item) => normalizarTexto(item) === normalizarTexto(term))) {
        terms.push(term);
      }
    }
  }

  return terms.filter(Boolean).slice(0, maxTerms);
}

function getProductKey(produto) {
  return String(produto.itemId || produto.offerLink || produto.productName || "").trim();
}

export async function buscarProdutosComExpansao(options = {}) {
  const expandedTerms = options.expandSearch
    ? expandirTermosBusca(options.keyword)
    : [String(options.keyword || "").trim()].filter(Boolean);
  const terms = expandedTerms.length ? expandedTerms : [String(options.keyword || "").trim()];
  const produtosByKey = new Map();

  for (const term of terms) {
    const produtos = await buscarProdutos({
      ...options,
      keyword: term
    });

    for (const produto of produtos) {
      const key = getProductKey(produto);

      if (!key || produtosByKey.has(key)) {
        continue;
      }

      produtosByKey.set(key, {
        ...produto,
        searchTerm: term
      });
    }
  }

  return {
    terms,
    produtos: [...produtosByKey.values()]
  };
}
