/**
 * Simulador de planos — gestão de eventos (uso comercial).
 * Créditos de artes IA somam ao valor mensal exibido no card.
 */

/** Limite de mensalistas na faixa inclusa de cada plano (referência comercial). */
const limitesMensalistasPlano = {
  starter: 5,
  basic: 10,
  growth: 30,
  scale: 50,
  pro: Infinity,
};

/**
 * Cobrança por mensalistas: faixa incluída por plano + valor proporcional acima (não exibir como “taxa por pessoa”).
 */
const regrasMensalistas = {
  starter: { inclusos: limitesMensalistasPlano.starter, valorExtra: 3.0 },
  basic: { inclusos: limitesMensalistasPlano.basic, valorExtra: 3.0 },
  growth: { inclusos: limitesMensalistasPlano.growth, valorExtra: 3.0 },
  scale: { inclusos: limitesMensalistasPlano.scale, valorExtra: 2.5 },
  pro: { inclusos: limitesMensalistasPlano.pro, valorExtra: 0 },
};

function validarMensalistas(plano, qtd) {
  const lim = limitesMensalistasPlano[plano];
  if (lim === undefined) return true;
  return qtd <= lim;
}

function regraMensalistasDoPlano(plan) {
  return regrasMensalistas[plan.id] ?? regrasMensalistas.starter;
}

/** Ancoragem de valor — posicionamento por plano (copy comercial). */
function getPlanoDescricao(plano) {
  switch (plano) {
    case 'starter':
      return 'Ideal para casas que estão começando a se organizar';
    case 'basic':
      return 'Para quem já tem fluxo e quer mais controle';
    case 'growth':
      return 'Perfeito para casas em crescimento com mais volume';
    case 'scale':
      return 'Para operações estruturadas com alto volume de participantes';
    case 'pro':
      return 'Para casas com operação avançada e necessidade de escala total';
    default:
      return '';
  }
}

/** CTA emocional — foco no resultado, não no nome do plano. */
function getPlanoCTA(plano) {
  switch (plano) {
    case 'starter':
      return 'Começar a organizar minha casa';
    case 'basic':
      return 'Quero mais controle dos meus trabalhos';
    case 'growth':
      return 'Quero estruturar minha casa';
    case 'scale':
      return 'Quero escalar minha operação';
    case 'pro':
      return 'Quero controle total da minha casa';
    default:
      return 'Começar';
  }
}

const getCTA = getPlanoCTA;

/** Itens fixos em “Na prática, você terá:”; Plus entram abaixo quando marcados na configuração. */
const BASE_FEATURES = [
  'Redução de risco jurídico',
  'Cuidado com a saúde dos participantes',
  'Assistente IA: dúvidas, medicamentos e artes para redes',
  'PIX e cartão com baixa automática',
  'Presença digital profissional',
];

/**
 * Extras de fechamento. `valor` = acréscimo mensal no card.
 */
const PLUS_CATALOG = {
  creditos_artes_10: { clientLabel: 'Créditos de artes IA +10 (15 no total)', valor: 19 },
  creditos_artes_25: { clientLabel: 'Créditos de artes IA +25 (30 no total)', valor: 39 },
  creditos_artes_50: { clientLabel: 'Créditos de artes IA +50 (55 no total)', valor: 69 },
  creditos_artes_100: { clientLabel: 'Créditos de artes IA +100 (105 no total)', valor: 119 },
  creditos_artes_150: { clientLabel: 'Créditos de artes IA +150 (155 no total)', valor: 159 },
};

/** Referência de bônus (mesmos valores que PLUS_CATALOG). */
const valoresBonus = {
  creditos_artes_10: 19,
  creditos_artes_25: 39,
  creditos_artes_50: 69,
  creditos_artes_100: 119,
  creditos_artes_150: 159,
};

function calcularBonus(plusIds) {
  return plusIds.reduce((t, k) => t + (valoresBonus[k] ?? 0), 0);
}

const PLUS_ORDER = [
  'creditos_artes_10',
  'creditos_artes_25',
  'creditos_artes_50',
  'creditos_artes_100',
  'creditos_artes_150',
];
const PLUS_CREDIT_IDS = PLUS_ORDER;
const PROPOSTAS_STORAGE_KEY = 'aya.planos-precos.propostas.v1';
let propostasSalvas = [];
let propostaAtivaId = null;
let planoEscolhidoId = null;
let modoNovaProposta = false;
let estadoInicialFormulario = null;
let modalGerarPropostaId = null;

/**
 * Ordem: menor → maior tier.
 * Bases (mensalidade): Starter 97, Basic 197, Growth 297, Scale 397, Pro 597.
 * Licença (única): 297 / 497 / 797 / 1.497 / 2.497.
 */
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    maxParticipants: 30,
    maxUsers: 1,
    base: 97,
    licenca: 297,
    participantsLabel: 'até 30',
  },
  {
    id: 'basic',
    name: 'Basic',
    maxParticipants: 60,
    maxUsers: 2,
    base: 197,
    licenca: 497,
    participantsLabel: 'até 60',
  },
  {
    id: 'growth',
    name: 'Growth',
    maxParticipants: 100,
    maxUsers: 3,
    base: 297,
    licenca: 797,
    participantsLabel: 'até 100',
  },
  {
    id: 'scale',
    name: 'Scale',
    maxParticipants: 200,
    maxUsers: 5,
    base: 397,
    licenca: 1497,
    participantsLabel: 'até 200',
  },
  {
    id: 'pro',
    name: 'Pro',
    maxParticipants: Infinity,
    maxUsers: Infinity,
    base: 597,
    licenca: 2497,
    participantsLabel: 'Ilimitado',
  },
];

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Valor do plano por presença no mês, 2 casas decimais (ex.: ≈ R$ 2,20). */
function calcularValorPorParticipante(valorMensal, totalPresencas) {
  if (!totalPresencas || totalPresencas <= 0) return 0;
  return Number((valorMensal / totalPresencas).toFixed(2));
}

const fmtMoedaDuasDecimais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtMoedaInput = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function parseMoneyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return Number(digits || 0);
}

function formatMoneyInput(value) {
  return fmtMoedaInput.format(Math.max(0, Math.round(Number(value) || 0)));
}

/** Extrai inteiro 0–100 a partir de texto com máscara (ex.: "70 %", "70%"). */
function parsePercentInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 3);
  if (digits === '') return null;
  const n = Number(digits);
  return Number.isNaN(n) ? null : n;
}

const TAXA_PRESENCA_PADRAO_PCT = 70;

function clampTaxaPresencaPct(raw) {
  if (raw === '' || raw === null || raw === undefined) return TAXA_PRESENCA_PADRAO_PCT;
  const n = typeof raw === 'number' && !Number.isNaN(raw) ? raw : parsePercentInput(String(raw));
  if (n === null || Number.isNaN(n)) return TAXA_PRESENCA_PADRAO_PCT;
  return Math.min(100, Math.max(0, n));
}

/** mensalistasPresentes = ceil(qtd × taxa), taxa em 0–100%. */
function calcularPresencaMensalistas(mensalistas, taxaPercentual) {
  const taxa = clampTaxaPresencaPct(taxaPercentual) / 100;
  return Math.ceil(mensalistas * taxa);
}

function calcularNaoMensalistas(mediaPessoas, mensalistas, taxaPresenca) {
  const presentes = calcularPresencaMensalistas(mensalistas, taxaPresenca);

  return {
    mensalistasPresentes: presentes,
    naoMensalistas: Math.max(0, mediaPessoas - presentes),
  };
}

function receitaMensalistas(qtd, valor) {
  return qtd * valor;
}

function receitaParticipantes(trabalhos, qtd, valorMedio) {
  return trabalhos * qtd * valorMedio;
}

/**
 * Modelo de receita: mensalistas (valor fixo/mês) + participantes não mensalistas (por trabalho × faixa).
 * taxaPresenca: % 0–100; mensalistas presentes por evento = ceil(qtd × taxa).
 */
function receitaTotalDetalhado({
  trabalhos,
  media,
  mensalistas,
  valorMensalista,
  valorMin,
  valorMax,
  taxaPresenca,
}) {
  const calcNaoMensalistas = calcularNaoMensalistas(media, mensalistas, taxaPresenca);
  const presentes = calcNaoMensalistas.mensalistasPresentes;
  const naoMensalistas = calcNaoMensalistas.naoMensalistas;
  const valorMedio = (valorMin + valorMax) / 2;

  const rMensalistas = receitaMensalistas(mensalistas, valorMensalista);
  const rParticipantesMedio = receitaParticipantes(trabalhos, naoMensalistas, valorMedio);
  const rParticipantesMin = receitaParticipantes(trabalhos, naoMensalistas, valorMin);
  const rParticipantesMax = receitaParticipantes(trabalhos, naoMensalistas, valorMax);

  return {
    presentesPorTrabalho: presentes,
    naoMensalistasPorTrabalho: naoMensalistas,
    valorMedioParticipante: valorMedio,
    mensalistas: rMensalistas,
    participantes: rParticipantesMedio,
    participantesMin: rParticipantesMin,
    participantesMax: rParticipantesMax,
    total: rMensalistas + rParticipantesMedio,
    totalMin: rMensalistas + rParticipantesMin,
    totalMax: rMensalistas + rParticipantesMax,
  };
}

/** Compatível com percentuais nos cards: faixa a partir da variável só nos participantes avulsos. */
function receitaParaPercentual(detalhado) {
  return { min: detalhado.totalMin, max: detalhado.totalMax };
}

/**
 * Percentual do plano sobre o faturamento (faixa min/max).
 * min = valorPlano/receitaMax (menor %), max = valorPlano/receitaMin (maior %).
 */
function calcularPercentual(valorPlano, receitaMin, receitaMax) {
  if (valorPlano <= 0 || receitaMax <= 0) return null;
  if (receitaMin <= 0) {
    const p = (valorPlano / receitaMax) * 100;
    return { min: p.toFixed(1), max: p.toFixed(1), modo: 'teto' };
  }
  const minPercent = (valorPlano / receitaMax) * 100;
  const maxPercent = (valorPlano / receitaMin) * 100;
  return { min: minPercent.toFixed(1), max: maxPercent.toFixed(1), modo: 'faixa' };
}

function formatPercentPtBR(n) {
  const x = typeof n === 'number' ? n : parseFloat(String(n));
  if (Number.isNaN(x)) return '0';
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Parágrafo: movimentação + % do plano; texto base neutro, negrito só nos percentuais.
 */
function criarElementoResumoOperacao(receita, valorPlano) {
  const r = receita;
  if (!r || r.max <= 0) return null;
  const pct = calcularPercentual(valorPlano, r.min, r.max);
  if (!pct) return null;
  const pMin = parseFloat(pct.min);
  const pMax = parseFloat(pct.max);
  const pctUnico = pct.modo === 'teto' || Math.abs(pMin - pMax) < 0.05;

  const p = document.createElement('p');
  p.className = 'plan-card__resumo-operacao';

  const txt = (s) => {
    p.appendChild(document.createTextNode(s));
  };

  const pctStrong = (text) => {
    const el = document.createElement('strong');
    el.className = 'plan-card__resumo-operacao-pct';
    el.textContent = text;
    return el;
  };

  const pctDestaque = () => {
    if (pctUnico) return pctStrong(`${formatPercentPtBR(pMin)}%`);
    return pctStrong(
      `${formatPercentPtBR(Math.min(pMin, pMax))}% a ${formatPercentPtBR(Math.max(pMin, pMax))}%`,
    );
  };

  if (r.min <= 0) {
    txt('No teto do cenário, você movimenta até ');
    txt(`${fmt.format(r.max)}/mês`);
    txt(' — este plano representa apenas ');
    p.appendChild(pctDestaque());
    txt(' da sua operação');
    return p;
  }
  if (Math.abs(r.min - r.max) < 0.01) {
    txt('Você movimenta cerca de ');
    txt(`${fmt.format(r.max)}/mês`);
    txt(' — este plano representa apenas ');
    p.appendChild(pctDestaque());
    txt(' da sua operação');
    return p;
  }

  txt('Você movimenta entre ');
  txt(fmt.format(r.min));
  txt(' e ');
  txt(`${fmt.format(r.max)}/mês`);
  txt(' — este plano representa apenas ');
  p.appendChild(pctDestaque());
  txt(' da sua operação');
  return p;
}

function getSelectedPlusIds() {
  const ids = [];
  const creditId = document.getElementById('creditos-artes-select')?.value ?? '';
  if (creditId && PLUS_CATALOG[creditId]) ids.push(creditId);
  return ids;
}

function aplicarSelectCreditos(selected) {
  const select = document.getElementById('creditos-artes-select');
  if (!select) return;
  const creditId = PLUS_CREDIT_IDS.find((id) => selected.has(id)) ?? '';
  select.value = creditId;
}

/** Soma dos valores percebidos dos módulos Plus selecionados. */
function somaValorBonus(ids) {
  return calcularBonus(ids);
}

function getInputs() {
  const trabalhos = Math.max(0, Number(document.getElementById('trabalhos').value) || 0);
  const pessoasPorTrabalho = Math.max(
    0,
    Number(document.getElementById('pessoas-por-trabalho')?.value) || 0,
  );
  let mensalistas = Math.max(0, Number(document.getElementById('mensalistas-qtd')?.value) || 0);
  if (pessoasPorTrabalho > 0) {
    mensalistas = Math.min(mensalistas, pessoasPorTrabalho);
  }
  let valorMin = Math.max(0, parseMoneyInput(document.getElementById('valor-participante-min')?.value));
  let valorMax = Math.max(0, parseMoneyInput(document.getElementById('valor-participante-max')?.value));
  if (valorMin > valorMax) {
    const t = valorMin;
    valorMin = valorMax;
    valorMax = t;
  }
  const valorMensalista = Math.max(0, parseMoneyInput(document.getElementById('valor-mensalista')?.value));
  const taxaPresencaPct = clampTaxaPresencaPct(document.getElementById('taxaPresenca')?.value);
  return {
    trabalhos,
    pessoasPorTrabalho,
    mensalistas,
    valorMinParticipante: valorMin,
    valorMaxParticipante: valorMax,
    valorMensalista,
    taxaPresencaPct,
  };
}

/** Presenças no mês: cada trabalho tem a mesma média de pessoas (mensalistas + demais já compõem o total). */
function participantesPorMes(trabalhos, pessoasPorTrabalho) {
  return trabalhos * pessoasPorTrabalho;
}

function aplicarTetoMensalistas(pessoasPorTrabalho) {
  const input = document.getElementById('mensalistas-qtd');
  if (!input) return;
  const cap = pessoasPorTrabalho > 0 ? pessoasPorTrabalho : 500;
  let m = Math.max(0, Number(input.value) || 0);
  if (m > cap) {
    m = cap;
    input.value = String(m);
  }
}

function atualizarBreakdownPorTrabalho() {
  const elValor = document.getElementById('demais-participantes-por-trabalho');
  const elFormula = document.getElementById('demais-participantes-formula');
  if (!elValor) return;
  const pessoas = Math.max(0, Number(document.getElementById('pessoas-por-trabalho')?.value) || 0);
  const mensalistasRaw = Math.max(0, Number(document.getElementById('mensalistas-qtd')?.value) || 0);
  const mensalistas = pessoas > 0 ? Math.min(mensalistasRaw, pessoas) : mensalistasRaw;
  const taxaPct = clampTaxaPresencaPct(document.getElementById('taxaPresenca')?.value);
  const calc = calcularNaoMensalistas(pessoas, mensalistas, taxaPct);
  elValor.textContent = String(calc.naoMensalistas);
  if (elFormula) {
    elFormula.textContent = `${pessoas} − ${calc.mensalistasPresentes} (${Math.round(taxaPct)}%)`;
  }
}

function prepararEntradas() {
  const pessoasPorTrabalho = Math.max(0, Number(document.getElementById('pessoas-por-trabalho')?.value) || 0);
  aplicarTetoMensalistas(pessoasPorTrabalho);
  atualizarBreakdownPorTrabalho();
  return getInputs();
}

function custoMensalistasExtras(plan, mensalistas) {
  const regra = regraMensalistasDoPlano(plan);
  if (regra.inclusos === Infinity) return 0;
  const acimaDoIncluso = Math.max(0, mensalistas - regra.inclusos);
  return acimaDoIncluso * regra.valorExtra;
}

function calcularTotalPlano(plan, participantes, mensalistas, plusIds = []) {
  const cabeParticipantes = participantes <= plan.maxParticipants;
  if (!cabeParticipantes) {
    return { total: null, extrasMensalistas: null, extrasIa: null, breakdown: null, cabeParticipantes: false };
  }
  const extrasMensalistas = custoMensalistasExtras(plan, mensalistas);
  const extrasIa = somaValorBonus(plusIds);
  const total = plan.base + extrasMensalistas + extrasIa;
  const breakdown = {
    base: plan.base,
    extrasMensalistas,
    extrasIa,
  };
  return { total, extrasMensalistas, extrasIa, breakdown, cabeParticipantes: true };
}

/** Preço de tabela do tier (mensalidade + créditos de IA), mesmo acima do volume. */
function cotarPlano(plan, participantes, _mensalistas, plusIds = []) {
  const extrasIa = somaValorBonus(plusIds);
  return {
    total: plan.base + extrasIa,
    extrasMensalistas: 0,
    extrasIa,
    breakdown: { base: plan.base, extrasMensalistas: 0, extrasIa },
    cabeParticipantes: participantes <= plan.maxParticipants,
  };
}

function planoEmFoco(recomendado) {
  if (!planoEscolhidoId) return recomendado;
  return PLANS.find((p) => p.id === planoEscolhidoId) || recomendado;
}

function textoFaixaPlanos(foco, recomendado) {
  if (foco.id === recomendado.id) {
    return `Plano em foco: ${foco.name}. Clique no card ao lado para descer ou subir.`;
  }
  return `Recomendado pelo volume: ${recomendado.name}. Em foco: ${foco.name}. Clique ao lado para descer ou subir.`;
}

function cotacaoDoPlanoEmFoco(estado) {
  const participantes = participantesPorMes(estado.trabalhos, estado.pessoasPorTrabalho);
  const rec = planoRecomendado(participantes, estado.mensalistas, estado.plusIds);
  const plan = planoEmFoco(rec.plan);
  const cotacao = cotarPlano(plan, participantes, estado.mensalistas, estado.plusIds);
  return { plan, total: cotacao.total };
}

/**
 * Recomenda o plano mais barato que cabe em participantes e na faixa de mensalistas inclusos.
 * Se a quantidade de mensalistas passa do incluso, sobe de tier (sem alerta de proporcional).
 */
function planoRecomendado(participantes, mensalistas, plusIds = []) {
  let best = null;
  let bestCost = Infinity;
  for (const plan of PLANS) {
    const r = calcularTotalPlano(plan, participantes, mensalistas, plusIds);
    if (!r.cabeParticipantes || r.total === null) continue;
    const lim = limitesMensalistasPlano[plan.id];
    if (lim !== undefined && lim !== Infinity && mensalistas > lim) continue;
    if (r.total < bestCost) {
      bestCost = r.total;
      best = { plan, ...r };
    }
  }
  if (!best) {
    const pro = PLANS[PLANS.length - 1];
    return { plan: pro, ...calcularTotalPlano(pro, participantes, mensalistas, plusIds) };
  }
  return best;
}

function indexPlano(planId) {
  return PLANS.findIndex((p) => p.id === planId);
}

function logNegociacaoInterno(planoNome, valorTotal, plusIds) {
  const extrasIa = somaValorBonus(plusIds);
  console.log({
    plano: planoNome,
    valorTotal,
    extrasIa,
  });
}

function renderCards() {
  const {
    trabalhos,
    pessoasPorTrabalho,
    mensalistas,
    valorMinParticipante,
    valorMaxParticipante,
    valorMensalista,
    taxaPresencaPct,
  } = prepararEntradas();
  const participantes = participantesPorMes(trabalhos, pessoasPorTrabalho);
  const receitaDet = receitaTotalDetalhado({
    trabalhos,
    media: pessoasPorTrabalho,
    mensalistas,
    valorMensalista,
    valorMin: valorMinParticipante,
    valorMax: valorMaxParticipante,
    taxaPresenca: taxaPresencaPct,
  });
  const receita = receitaParaPercentual(receitaDet);
  const plusIds = getSelectedPlusIds();

  document.getElementById('participantes-total').textContent = String(participantes);

  const elTaxaResumo = document.getElementById('summary-taxa-presenca-display');
  if (elTaxaResumo) elTaxaResumo.textContent = String(Math.round(taxaPresencaPct));

  const elRm = document.getElementById('receita-mensalistas');
  const elRp = document.getElementById('receita-participantes');
  const elRt = document.getElementById('receita-total');
  const elRph = document.getElementById('receita-participantes-faixa');
  const elRth = document.getElementById('receita-total-faixa');
  if (elRm) elRm.textContent = fmt.format(receitaDet.mensalistas);
  if (elRp) {
    elRp.textContent =
      Math.abs(receitaDet.participantesMin - receitaDet.participantesMax) < 0.01
        ? fmt.format(receitaDet.participantes)
        : `${fmt.format(receitaDet.participantes)} (média)`;
  }
  if (elRph) {
    const diff = Math.abs(receitaDet.participantesMin - receitaDet.participantesMax) < 0.01;
    elRph.textContent = diff
      ? ''
      : `Faixa (mín./máx. por participante): ${fmt.format(receitaDet.participantesMin)} a ${fmt.format(receitaDet.participantesMax)}`;
    elRph.hidden = diff;
  }
  if (elRt) {
    elRt.textContent =
      Math.abs(receitaDet.totalMin - receitaDet.totalMax) < 0.01
        ? fmt.format(receitaDet.total)
        : `${fmt.format(receitaDet.total)} (média)`;
  }
  if (elRth) {
    const diffT = Math.abs(receitaDet.totalMin - receitaDet.totalMax) < 0.01;
    elRth.textContent = diffT
      ? ''
      : `Total com faixa de ticket: ${fmt.format(receitaDet.totalMin)} a ${fmt.format(receitaDet.totalMax)}`;
    elRth.hidden = diffT;
  }

  const receitaEl = document.getElementById('receita-range');
  if (receitaEl) {
    if (receita.max > 0) {
      receitaEl.textContent =
        receita.min === receita.max
          ? `${fmt.format(receita.min)}/mês`
          : `${fmt.format(receita.min)} a ${fmt.format(receita.max)}/mês`;
    } else {
      receitaEl.textContent = '—';
    }
  }

  const rec = planoRecomendado(participantes, mensalistas, plusIds);
  const foco = planoEmFoco(rec.plan);
  const idx = indexPlano(foco.id);
  const cotacaoFoco = cotarPlano(foco, participantes, mensalistas, plusIds);

  const recRegra = regraMensalistasDoPlano(foco);
  const limiteMensalistas =
    recRegra.inclusos === Infinity ? 'ilimitados' : String(recRegra.inclusos);
  document.getElementById('mensalistas-limite-rec').textContent = limiteMensalistas;

  const alertaLimite = document.getElementById('summary-mensalistas-alerta');
  if (alertaLimite) {
    alertaLimite.hidden = true;
    alertaLimite.textContent = '';
  }

  logNegociacaoInterno(foco.name, cotacaoFoco.total, plusIds);

  const below = idx > 0 ? PLANS[idx - 1] : null;
  const above = idx < PLANS.length - 1 ? PLANS[idx + 1] : null;

  const sorted = [];
  if (below) sorted.push({ plan: below, role: 'below', isRecommended: below.id === rec.plan.id });
  sorted.push({ plan: foco, role: 'focus', isRecommended: foco.id === rec.plan.id });
  if (above) sorted.push({ plan: above, role: 'above', isRecommended: above.id === rec.plan.id });

  const root = document.getElementById('cards-root');
  root.innerHTML = '';
  if (document.getElementById('deck-sim')) {
    const hint = document.createElement('p');
    hint.className = 'cards__escolha';
    hint.textContent = textoFaixaPlanos(foco, rec.plan);
    root.appendChild(hint);
  }
  montarFaixaDePlanos(root, sorted, participantes, mensalistas, {
    plusIds,
    receita,
    totalPresencasMes: participantes,
  });
  atualizarBotaoSalvarAlteracoes();
}

function montarFaixaDePlanos(root, sorted, participantes, mensalistas, extras) {
  const noDeck = Boolean(document.getElementById('deck-sim'));
  sorted.forEach((item, index) => {
    const card = createCard(item, participantes, mensalistas, extras);
    if (!noDeck) {
      root.appendChild(card);
      return;
    }
    const slot = document.createElement('div');
    slot.className = 'cards__slot';
    const naPontaEsquerda = index === 0 && item.role === 'below';
    const naPontaDireita = index === sorted.length - 1 && item.role === 'above';
    if (naPontaEsquerda) {
      slot.classList.add('cards__slot--prev');
      slot.appendChild(criarSetaNavegacao('prev', item.plan));
    }
    if (naPontaDireita) {
      slot.classList.add('cards__slot--next');
      slot.appendChild(criarSetaNavegacao('next', item.plan));
    }
    slot.appendChild(card);
    root.appendChild(slot);
  });
}

function criarSetaNavegacao(direcao, plan) {
  const descer = direcao === 'prev';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `cards__nav cards__nav--${direcao}`;
  btn.setAttribute('aria-label', descer ? `Descer para ${plan.name}` : `Subir para ${plan.name}`);
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="${descer ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    escolherPlano(plan.id);
  });
  return btn;
}

function escolherPlano(planId) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return;
  planoEscolhidoId = plan.id;
  const entradas = prepararEntradas();
  const participantes = participantesPorMes(entradas.trabalhos, entradas.pessoasPorTrabalho);
  const plusIds = getSelectedPlusIds();
  const cotacao = cotarPlano(plan, participantes, entradas.mensalistas, plusIds);
  document.dispatchEvent(
    new CustomEvent('aya:plano-selecionado', {
      detail: {
        planId: plan.id,
        name: plan.name,
        valorTotal: cotacao.total,
        licenca: plan.licenca,
      },
    }),
  );
  if (propostaAtivaId) {
    atualizarPropostaAtivaComEstado({
      id: plan.id,
      name: plan.name,
      valorTotal: cotacao.total,
      licenca: plan.licenca,
    });
  }
  renderCards();
  pulsePrices();
}

function appendLinhaExtrasIa(parent, extrasIa) {
  if (!extrasIa || extrasIa <= 0) return;
  const line = document.createElement('div');
  line.className = 'price-extras-ia';
  line.textContent = `Inclui ${fmt.format(extrasIa)}/mês de créditos de artes IA`;
  parent.appendChild(line);
}

function createCard({ plan, role, isRecommended = false }, participantes, mensalistas, giftUi) {
  const { plusIds = [], receita, totalPresencasMes = 0 } = giftUi || {};
  const embutidoNoDeck = Boolean(document.getElementById('deck-sim'));
  const emFoco = role === 'focus';
  const cotacao = cotarPlano(plan, participantes, mensalistas, plusIds);
  const result = embutidoNoDeck ? cotacao : calcularTotalPlano(plan, participantes, mensalistas, plusIds);
  const insufficient = !cotacao.cabeParticipantes;
  const exibirPreco = result.total != null;

  const article = document.createElement('article');
  article.className = 'plan-card';
  if (emFoco) article.classList.add('plan-card--recommended');
  if (insufficient) article.classList.add('plan-card--insufficient');

  if (emFoco) {
    const badge = document.createElement('span');
    badge.className = 'plan-card__badge';
    badge.textContent = isRecommended ? 'Recomendado' : 'Escolhido';
    article.appendChild(badge);
  }

  const name = document.createElement('h3');
  name.className = 'plan-card__name';
  name.textContent = plan.name;

  const tag = document.createElement('p');
  tag.className = 'plan-card__tag';
  if (role === 'below') {
    tag.textContent = isRecommended ? 'Clique para voltar ao recomendado' : 'Clique para descer';
  } else if (role === 'above') {
    tag.textContent = isRecommended ? 'Clique para voltar ao recomendado' : 'Clique para subir';
  } else if (isRecommended) {
    tag.textContent = 'Melhor custo para o seu volume';
  } else {
    tag.textContent = 'Escolhido para esta negociação';
  }

  const descricaoPlano = getPlanoDescricao(plan.id);

  article.appendChild(name);
  article.appendChild(tag);
  if (descricaoPlano) {
    const anchor = document.createElement('p');
    anchor.className = 'plan-card__anchor';
    anchor.textContent = descricaoPlano;
    article.appendChild(anchor);
  } else {
    tag.classList.add('plan-card__tag--no-descricao');
  }

  const participantesAcima = plan.maxParticipants !== Infinity && participantes > plan.maxParticipants;
  const rowP = row('Participantes', plan.participantsLabel, participantes, participantesAcima);
  const rowU = row('Usuários', plan.maxUsers === Infinity ? 'Ilimitados' : `até ${plan.maxUsers}`);
  const regraM = regraMensalistasDoPlano(plan);
  const mensInc =
    regraM.inclusos === Infinity ? 'Ilimitados' : `até ${regraM.inclusos}`;
  const mensalistasAcima = regraM.inclusos !== Infinity && mensalistas > regraM.inclusos;
  const rowM = row('Mensalistas inclusos', mensInc, mensalistas, mensalistasAcima);
  article.appendChild(rowP);
  article.appendChild(rowU);
  article.appendChild(rowM);

  if (exibirPreco) {
    article.appendChild(createGiftSection(plusIds));
  }

  const priceWrap = document.createElement('div');
  priceWrap.className = 'plan-card__price';

  const pl = document.createElement('div');
  pl.className = 'plan-card__price-label';
  pl.textContent = 'Simulação de custo';

  const stack = document.createElement('div');
  stack.className = 'plan-card__price-stack';

  if (!exibirPreco) {
    const pv = document.createElement('div');
    pv.className = 'plan-card__price-value plan-card__price-value--empty';
    pv.textContent = '—';
    stack.appendChild(pv);
  } else {
    const total = result.total;
    const presencasOk = totalPresencasMes > 0;
    if (presencasOk) {
      const valorPp = calcularValorPorParticipante(total, totalPresencasMes);
      const block = document.createElement('div');
      block.className = 'pricing-block';

      const perPart = document.createElement('div');
      perPart.className = 'price-per-participant';
      perPart.textContent = `≈ ${fmtMoedaDuasDecimais.format(valorPp)} por participante`;

      const monthRow = document.createElement('div');
      monthRow.className = 'price-month';
      const now = document.createElement('strong');
      now.className = 'plan-card__price-value plan-card__price-now price';
      now.dataset.priceKey = plan.id;
      now.textContent = `${fmt.format(total)}/mês`;
      monthRow.appendChild(now);

      const ctx = document.createElement('div');
      ctx.className = 'price-context';
      ctx.textContent = `Com base em ~${totalPresencasMes} presenças/mês`;

      block.appendChild(perPart);
      block.appendChild(monthRow);
      block.appendChild(ctx);
      appendLinhaExtrasIa(block, result.extrasIa);

      const licencaLine = document.createElement('div');
      licencaLine.className = 'price-license';
      licencaLine.textContent = `Licença: ${fmt.format(plan.licenca)} (única)`;
      block.appendChild(licencaLine);

      stack.appendChild(block);
    } else {
      const now = document.createElement('strong');
      now.className = 'plan-card__price-value plan-card__price-now price';
      now.dataset.priceKey = plan.id;
      now.textContent = `${fmt.format(total)}/mês`;
      stack.appendChild(now);
      appendLinhaExtrasIa(stack, result.extrasIa);

      const licencaLine = document.createElement('div');
      licencaLine.className = 'price-license';
      licencaLine.textContent = `Licença: ${fmt.format(plan.licenca)} (única)`;
      stack.appendChild(licencaLine);
    }
  }

  priceWrap.appendChild(pl);
  priceWrap.appendChild(stack);

  article.appendChild(priceWrap);

  if (exibirPreco && receita) {
    const resumo = criarElementoResumoOperacao(receita, result.total);
    if (resumo) article.appendChild(resumo);
  }

  if (insufficient) {
    const w = document.createElement('p');
    w.className = 'plan-card__warn';
    w.textContent = embutidoNoDeck
      ? 'Volume acima do limite deste plano. O valor deste card vale para a negociação.'
      : 'Participantes/mês acima do limite deste plano. Suba de tier ou ajuste trabalhos, participantes ou mensalistas.';
    article.appendChild(w);
  }

  if (!embutidoNoDeck) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plan-card__btn';
    btn.textContent = insufficient ? 'Volume acima deste plano' : getCTA(plan.id);
    btn.disabled = insufficient;
    btn.addEventListener('click', () => {
      if (insufficient) return;
      const enviado = enviarPlanoAoFechamento(plan, result.total);
      if (enviado) return;
      const label = `${plan.name} — ${fmt.format(result.total)}`;
      alert(`Registrado na conversa: ${getCTA(plan.id)}\n${label}\n(Cole no CRM ou proposta.)`);
    });
    article.appendChild(btn);
  } else if (emFoco) {
    article.dataset.planId = plan.id;
    article.setAttribute('aria-current', 'true');
  } else {
    article.classList.add('plan-card--selectable');
    article.tabIndex = 0;
    article.setAttribute('role', 'button');
    const acao = role === 'below' ? `Descer para ${plan.name}` : `Subir para ${plan.name}`;
    article.setAttribute('aria-label', acao);
    const cue = document.createElement('p');
    cue.className = 'plan-card__cue';
    cue.textContent = 'Usar este plano';
    article.appendChild(cue);
    const onChoose = () => escolherPlano(plan.id);
    article.addEventListener('click', onChoose);
    article.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      onChoose();
    });
  }

  return article;
}

function createGiftSection(plusIds) {
  const wrap = document.createElement('div');
  wrap.className = 'plan-card__gift';

  const badge = document.createElement('span');
  badge.className = 'plan-card__gift-badge';
  badge.textContent = 'Na prática, você terá:';

  const listBase = document.createElement('ul');
  listBase.className = 'plan-card__gift-list';
  BASE_FEATURES.forEach((label) => {
    const li = document.createElement('li');
    li.className = 'plan-card__gift-item plan-card__gift-item--compact';
    li.textContent = `✔ ${label}`;
    listBase.appendChild(li);
  });

  wrap.appendChild(badge);
  wrap.appendChild(listBase);

  const orderedPlus = PLUS_ORDER.filter((id) => plusIds.includes(id) && PLUS_CATALOG[id]);

  if (orderedPlus.length > 0) {
    const subPlus = document.createElement('p');
    subPlus.className = 'plan-card__gift-sub plan-card__gift-sub--plus';
    const totalPercebido = somaValorBonus(orderedPlus);
    subPlus.textContent = `Incluído na mensalidade (${fmt.format(totalPercebido)}/mês):`;

    const listPlus = document.createElement('ul');
    listPlus.className = 'plan-card__gift-list plan-card__gift-list--plus';
    orderedPlus.forEach((id) => {
      const entry = PLUS_CATALOG[id];
      const li = document.createElement('li');
      li.className = 'plan-card__gift-item plan-card__gift-item--plus';
      li.appendChild(document.createTextNode(`✔ ${entry.clientLabel}\u00a0`));
      const ref = document.createElement('span');
      ref.className = 'plan-card__gift-item-ref';
      ref.textContent = `(${fmt.format(entry.valor)})`;
      li.appendChild(ref);
      listPlus.appendChild(li);
    });
    wrap.appendChild(subPlus);
    wrap.appendChild(listPlus);
  }

  return wrap;
}

function row(label, value, informado, acima) {
  const wrap = document.createElement('div');
  wrap.className = 'plan-card__row';
  const l = document.createElement('span');
  l.className = 'plan-card__label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'plan-card__value';
  v.textContent = value;
  if (informado > 0) {
    const tom = acima ? 'plan-card__value-informado--acima' : 'plan-card__value-informado--dentro';
    const extra = document.createElement('span');
    extra.className = `plan-card__value-informado ${tom}`;
    extra.textContent = ` (${informado})`;
    v.appendChild(extra);
  }
  wrap.appendChild(l);
  wrap.appendChild(v);
  return wrap;
}

let lastPriceSnapshot = '';

function pulsePrices() {
  const nodes = document.querySelectorAll('.plan-card__price-value');
  const key = Array.from(nodes)
    .map((n) => n.textContent)
    .join('|');
  if (key === lastPriceSnapshot) return;
  lastPriceSnapshot = key;
  nodes.forEach((n) => {
    n.classList.remove('plan-card__price-value--pulse');
    void n.offsetWidth;
    n.classList.add('plan-card__price-value--pulse');
  });
}

function setupMoneyField(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const applyMask = () => {
    const digits = String(input.value ?? '').replace(/\D/g, '');
    if (!digits) {
      input.value = '';
      return;
    }
    const raw = Number(digits);
    input.value = formatMoneyInput(raw);
  };

  applyMask();
  input.addEventListener('input', () => {
    applyMask();
    renderCards();
    pulsePrices();
  });
}

function setupPercentField(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const applyMask = () => {
    const parsed = parsePercentInput(input.value);
    if (parsed === null) {
      input.value = '';
      return;
    }
    const n = Math.min(100, Math.max(0, Math.round(parsed)));
    input.value = `${n}%`;
  };

  applyMask();
  input.addEventListener('input', () => {
    applyMask();
    renderCards();
    pulsePrices();
  });
  input.addEventListener('blur', () => {
    if (input.value.trim() === '' || parsePercentInput(input.value) === null) {
      input.value = `${TAXA_PRESENCA_PADRAO_PCT}%`;
      renderCards();
      pulsePrices();
      return;
    }
    applyMask();
    renderCards();
    pulsePrices();
  });
}

function carregarPropostasDoStorage() {
  try {
    const raw = localStorage.getItem(PROPOSTAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function salvarPropostasNoStorage() {
  localStorage.setItem(PROPOSTAS_STORAGE_KEY, JSON.stringify(propostasSalvas));
}

function formatarDataHora(iso) {
  if (!iso) return 'sem data';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'sem data';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function coletarEstadoFormulario() {
  const {
    trabalhos,
    pessoasPorTrabalho,
    mensalistas,
    valorMinParticipante,
    valorMaxParticipante,
    valorMensalista,
    taxaPresencaPct,
  } = prepararEntradas();
  return {
    trabalhos,
    pessoasPorTrabalho,
    mensalistas,
    valorMinParticipante,
    valorMaxParticipante,
    valorMensalista,
    taxaPresencaPct,
    plusIds: getSelectedPlusIds(),
  };
}

function aplicarEstadoFormulario(estado) {
  if (!estado) return;
  const trabalhosEl = document.getElementById('trabalhos');
  const pessoasEl = document.getElementById('pessoas-por-trabalho');
  const mensalistasEl = document.getElementById('mensalistas-qtd');
  const minEl = document.getElementById('valor-participante-min');
  const maxEl = document.getElementById('valor-participante-max');
  const mensalistaValorEl = document.getElementById('valor-mensalista');
  const taxaEl = document.getElementById('taxaPresenca');

  if (trabalhosEl) trabalhosEl.value = String(estado.trabalhos ?? 0);
  if (pessoasEl) pessoasEl.value = String(estado.pessoasPorTrabalho ?? 0);
  if (mensalistasEl) mensalistasEl.value = String(estado.mensalistas ?? 0);
  if (minEl) minEl.value = formatMoneyInput(estado.valorMinParticipante ?? 0);
  if (maxEl) maxEl.value = formatMoneyInput(estado.valorMaxParticipante ?? 0);
  if (mensalistaValorEl) mensalistaValorEl.value = formatMoneyInput(estado.valorMensalista ?? 0);
  if (taxaEl) taxaEl.value = `${clampTaxaPresencaPct(estado.taxaPresencaPct)}%`;

  const selected = new Set(Array.isArray(estado.plusIds) ? estado.plusIds : []);
  aplicarSelectCreditos(selected);

  renderCards();
  pulsePrices();
}

function montarResumoProposta(estado) {
  const det = receitaTotalDetalhado({
    trabalhos: estado.trabalhos,
    media: estado.pessoasPorTrabalho,
    mensalistas: estado.mensalistas,
    valorMensalista: estado.valorMensalista,
    valorMin: estado.valorMinParticipante,
    valorMax: estado.valorMaxParticipante,
    taxaPresenca: estado.taxaPresencaPct,
  });
  const foco = cotacaoDoPlanoEmFoco(estado);
  return {
    plano: foco.plan.name,
    planoId: foco.plan.id,
    valorPlano: foco.total ?? 0,
    licenca: foco.plan.licenca ?? 0,
    receitaMedia: det.total,
  };
}

function nomeCasaDaApresentacao() {
  return document.getElementById('field-cliente')?.value?.trim() || '';
}

function estadoCalculadoIgual(atual, salvo) {
  const campos = [
    'trabalhos',
    'pessoasPorTrabalho',
    'mensalistas',
    'valorMinParticipante',
    'valorMaxParticipante',
    'valorMensalista',
    'taxaPresencaPct',
  ];
  const numeroDifere = campos.some((campo) => Number(atual[campo] ?? 0) !== Number(salvo[campo] ?? 0));
  if (numeroDifere) return false;
  const plusAtual = Array.isArray(atual.plusIds) ? atual.plusIds.join(',') : '';
  const plusSalvo = Array.isArray(salvo.plusIds) ? salvo.plusIds.join(',') : '';
  return plusAtual === plusSalvo;
}

function propostaComAlteracaoPendente() {
  if (!propostaAtivaId) return false;
  const proposta = propostasSalvas.find((p) => p.id === propostaAtivaId);
  if (!proposta) return false;
  if (!proposta.estado) return true;
  return !estadoCalculadoIgual(coletarEstadoFormulario(), proposta.estado);
}

function atualizarBotaoSalvarAlteracoes() {
  const btn = document.getElementById('btn-salvar-alteracoes');
  if (!btn) return;
  const noDeck = Boolean(document.getElementById('deck-sim'));
  const pendente = noDeck && (modoNovaProposta || propostaComAlteracaoPendente());
  btn.hidden = !pendente;
  atualizarCampoNomeProposta();
}

function atualizarCampoNomeProposta() {
  const input = document.getElementById('input-nome-proposta');
  const select = document.getElementById('propostas-select');
  const label = document.querySelector('label[for="propostas-select"], label[for="input-nome-proposta"]');
  if (!input) return;
  const editandoNome = Boolean(document.getElementById('deck-sim')) && modoNovaProposta && !propostaAtivaId;
  input.hidden = !editandoNome;
  if (select) select.hidden = editandoNome;
  if (label) {
    label.textContent = editandoNome ? 'Nome da proposta' : 'Propostas salvas';
    label.setAttribute('for', editandoNome ? 'input-nome-proposta' : 'propostas-select');
  }
  if (editandoNome) {
    const info = document.getElementById('proposta-atual-info');
    if (info) info.textContent = 'Digite o nome e clique em Salvar.';
  }
}

function aplicarNomeNoDeck(nome) {
  const cliente = document.getElementById('field-cliente');
  if (!cliente) return;
  cliente.value = nome;
  cliente.dispatchEvent(new Event('input', { bubbles: true }));
}

function definirErroProposta(mensagem) {
  const erro = document.getElementById('proposta-error');
  if (!erro) return;
  if (!mensagem) {
    erro.hidden = true;
    erro.textContent = '';
    return;
  }
  erro.hidden = false;
  erro.textContent = mensagem;
}

function nomeParaSalvarPropostaAtiva() {
  const nomeNaTela = nomeCasaDaApresentacao();
  if (nomeNaTela.length >= 2) return nomeNaTela;
  const ativa = propostasSalvas.find((p) => p.id === propostaAtivaId);
  const nomeSalvo = ativa?.clientName?.trim() || '';
  const cliente = document.getElementById('field-cliente');
  if (cliente && nomeSalvo.length >= 2) cliente.value = nomeSalvo;
  return nomeSalvo;
}

function salvarAlteracoesDaProposta() {
  if (modoNovaProposta) {
    const nome = document.getElementById('input-nome-proposta')?.value?.trim() || '';
    if (nome.length < 2) {
      document.getElementById('input-nome-proposta')?.focus();
      const info = document.getElementById('proposta-atual-info');
      if (info) info.textContent = 'Informe o nome da proposta para salvar.';
      return false;
    }
    aplicarNomeNoDeck(nome);
    persistirPropostaComNome(nome);
    modoNovaProposta = false;
    definirErroProposta('');
    atualizarPainelPropostas();
    return true;
  }
  const nome = nomeParaSalvarPropostaAtiva();
  if (typeof window.ayaDeckCanSalvarProposta === 'function' && !window.ayaDeckCanSalvarProposta()) {
    return false;
  }
  if (!nome || nome.length < 2) {
    abrirModalSalvarProposta();
    return false;
  }
  persistirPropostaComNome(nome);
  atualizarBotaoSalvarAlteracoes();
  return true;
}

function atualizarBotaoNovaSalvar() {
  const btn = document.getElementById('btn-nova-proposta');
  if (!btn) return;
  const embutido = Boolean(document.getElementById('deck-sim'));
  const nomeCasa = nomeCasaDaApresentacao();
  const criandoProposta = embutido && modoNovaProposta && !propostaAtivaId;
  if (criandoProposta) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  const podeSalvarRapido = embutido && nomeCasa.length >= 2 && !propostaAtivaId;

  if (podeSalvarRapido) {
    btn.textContent = 'Salvar';
    btn.dataset.mode = 'salvar';
    btn.classList.remove('propostas-topo__btn--ghost');
    btn.setAttribute('aria-label', 'Salvar proposta');
  } else {
    btn.textContent = 'Nova';
    btn.dataset.mode = 'nova';
    btn.classList.add('propostas-topo__btn--ghost');
    btn.setAttribute('aria-label', 'Nova proposta');
  }
}

function atualizarPainelPropostas() {
  const select = document.getElementById('propostas-select');
  const btnExcluir = document.getElementById('btn-excluir-proposta');
  const info = document.getElementById('proposta-atual-info');
  if (!select || !btnExcluir || !info) return;

  const nomeCasa = nomeCasaDaApresentacao();
  select.innerHTML = '';

  if (!propostasSalvas.length) {
    const option = document.createElement('option');
    option.value = '';
    if (nomeCasa) {
      option.textContent = nomeCasa;
      select.disabled = true;
      info.textContent = `Em edição: ${nomeCasa}`;
    } else {
      option.textContent = 'Nenhuma proposta salva';
      select.disabled = true;
      info.textContent = 'Nenhuma proposta ativa.';
    }
    select.appendChild(option);
    btnExcluir.disabled = true;
    btnExcluir.hidden = true;
    atualizarBotaoNovaSalvar();
    atualizarBotaoSalvarAlteracoes();
    return;
  }

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = nomeCasa && !propostaAtivaId ? nomeCasa : 'Selecionar proposta...';
  select.appendChild(placeholder);

  propostasSalvas.forEach((p) => {
    const option = document.createElement('option');
    option.value = p.id;
    const dataTxt = formatarDataHora(p.updatedAt || p.createdAt);
    const planoTxt = p.resumo?.plano ? ` · ${p.resumo.plano}` : '';
    option.textContent = `${p.clientName}${planoTxt} · ${dataTxt}`;
    select.appendChild(option);
  });

  select.disabled = false;
  if (propostaAtivaId && propostasSalvas.some((p) => p.id === propostaAtivaId)) {
    select.value = propostaAtivaId;
    const ativa = propostasSalvas.find((p) => p.id === propostaAtivaId);
    info.textContent = `Proposta ativa: ${ativa.clientName} · atualizada em ${formatarDataHora(ativa.updatedAt || ativa.createdAt)}.`;
    btnExcluir.disabled = false;
    btnExcluir.hidden = false;
  } else {
    select.value = '';
    info.textContent = nomeCasa
      ? `Em edição: ${nomeCasa}`
      : 'Selecione uma proposta salva ou crie uma nova.';
    btnExcluir.disabled = true;
    btnExcluir.hidden = true;
  }

  atualizarBotaoNovaSalvar();
  atualizarBotaoSalvarAlteracoes();
}

function carregarPropostaSelecionada() {
  const select = document.getElementById('propostas-select');
  if (!select || !select.value) return;
  const proposta = propostasSalvas.find((p) => p.id === select.value);
  if (!proposta) return;
  propostaAtivaId = proposta.id;
  modoNovaProposta = false;
  planoEscolhidoId = proposta.planoSelecionadoId || proposta.resumo?.planoId || null;
  const campoCliente = document.getElementById('field-cliente');
  if (campoCliente && proposta.clientName) campoCliente.value = proposta.clientName;
  aplicarEstadoFormulario(proposta.estado);
  document.dispatchEvent(
    new CustomEvent('aya:plano-selecionado', { detail: { planId: planoEscolhidoId } }),
  );
  atualizarPainelPropostas();
}

function excluirPropostaSelecionada() {
  const select = document.getElementById('propostas-select');
  const idSelecionado = select?.value || propostaAtivaId;
  if (!idSelecionado) return;

  const proposta = propostasSalvas.find((p) => p.id === idSelecionado);
  if (!proposta) return;

  const confirmar = window.confirm(`Excluir a proposta "${proposta.clientName}"?`);
  if (!confirmar) return;

  propostasSalvas = propostasSalvas.filter((p) => p.id !== idSelecionado);
  salvarPropostasNoStorage();
  criarNovaProposta();
}

function abrirModalSalvarProposta() {
  const modal = document.getElementById('modal-salvar-proposta');
  const input = document.getElementById('input-nome-cliente');
  if (!modal || !input) return;
  const ativa = propostasSalvas.find((p) => p.id === propostaAtivaId);
  const nomeCasa = document.getElementById('field-cliente')?.value?.trim() || '';
  input.value = ativa?.clientName || nomeCasa || '';
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  input.focus();
}

function fecharModalSalvarProposta() {
  const modal = document.getElementById('modal-salvar-proposta');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function atualizarPropostaAtivaComEstado(planoSelecionado) {
  if (!propostaAtivaId) return null;
  const idx = propostasSalvas.findIndex((p) => p.id === propostaAtivaId);
  if (idx < 0) return null;

  const estado = coletarEstadoFormulario();
  const resumo = montarResumoProposta(estado);
  if (planoSelecionado) {
    resumo.plano = planoSelecionado.name;
    resumo.planoId = planoSelecionado.id;
    resumo.valorPlano = planoSelecionado.valorTotal ?? resumo.valorPlano;
    resumo.licenca = planoSelecionado.licenca ?? resumo.licenca;
  }

  propostasSalvas[idx] = {
    ...propostasSalvas[idx],
    updatedAt: new Date().toISOString(),
    estado,
    resumo,
    planoSelecionadoId: planoSelecionado?.id ?? propostasSalvas[idx].planoSelecionadoId ?? resumo.planoId,
  };
  salvarPropostasNoStorage();
  atualizarPainelPropostas();
  return propostasSalvas[idx];
}

function urlFechamentoApresentacao(propostaId) {
  const q = new URLSearchParams({ proposta: propostaId });
  return `../apresentacao/casas-ayahuasca/?${q.toString()}`;
}

/** Salva o plano escolhido na proposta ativa e volta ao fechamento da apresentação. */
function enviarPlanoAoFechamento(plan, valorTotal) {
  const params = new URLSearchParams(window.location.search);
  const veioDaApresentacao = params.get('from') === 'apresentacao';
  if (!veioDaApresentacao || !propostaAtivaId) return false;

  const salva = atualizarPropostaAtivaComEstado({
    id: plan.id,
    name: plan.name,
    valorTotal,
    licenca: plan.licenca,
  });
  if (!salva) return false;

  window.location.href = urlFechamentoApresentacao(salva.id);
  return true;
}

function enviarFechamentoAtual() {
  if (!propostaAtivaId) {
    abrirModalSalvarProposta();
    return;
  }
  const estado = coletarEstadoFormulario();
  const foco = cotacaoDoPlanoEmFoco(estado);
  const ok = enviarPlanoAoFechamento(foco.plan, foco.total);
  if (!ok) {
    atualizarPropostaAtivaComEstado({
      id: foco.plan.id,
      name: foco.plan.name,
      valorTotal: foco.total,
      licenca: foco.plan.licenca,
    });
    window.location.href = urlFechamentoApresentacao(propostaAtivaId);
  }
}

function confirmarSalvarProposta() {
  const input = document.getElementById('input-nome-cliente');
  if (!input) return;
  const nomeCliente = input.value.trim();
  if (!nomeCliente) {
    input.focus();
    return;
  }
  persistirPropostaComNome(nomeCliente);
  fecharModalSalvarProposta();
}

function persistirPropostaComNome(nomeCliente) {
  const estado = coletarEstadoFormulario();
  const resumo = montarResumoProposta(estado);
  const now = new Date().toISOString();

  if (propostaAtivaId) {
    const idx = propostasSalvas.findIndex((p) => p.id === propostaAtivaId);
    if (idx >= 0) {
      propostasSalvas[idx] = {
        ...propostasSalvas[idx],
        clientName: nomeCliente,
        updatedAt: now,
        estado,
        resumo,
        origem: propostasSalvas[idx].origem || 'apresentacao-casas-ayahuasca',
      };
      salvarPropostasNoStorage();
      atualizarPainelPropostas();
      document.dispatchEvent(
        new CustomEvent('aya:proposta-salva', { detail: { id: propostaAtivaId, clientName: nomeCliente } }),
      );
      return propostaAtivaId;
    }
  }

  const proposta = {
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    clientName: nomeCliente,
    createdAt: now,
    updatedAt: now,
    origem: 'apresentacao-casas-ayahuasca',
    estado,
    resumo,
  };

  propostasSalvas.unshift(proposta);
  propostaAtivaId = proposta.id;
  salvarPropostasNoStorage();
  atualizarPainelPropostas();
  document.dispatchEvent(
    new CustomEvent('aya:proposta-salva', { detail: { id: proposta.id, clientName: nomeCliente } }),
  );
  return proposta.id;
}

function salvarPropostaDaApresentacao() {
  if (typeof window.ayaDeckCanSalvarProposta === 'function' && !window.ayaDeckCanSalvarProposta()) {
    return false;
  }
  const nome = nomeCasaDaApresentacao();
  if (!nome || nome.length < 2) {
    abrirModalSalvarProposta();
    return false;
  }
  persistirPropostaComNome(nome);
  return true;
}

function criarNovaProposta() {
  propostaAtivaId = null;
  planoEscolhidoId = null;
  modoNovaProposta = true;
  document.dispatchEvent(new CustomEvent('aya:plano-selecionado', { detail: { planId: null } }));
  const trabalhosEl = document.getElementById('trabalhos');
  const pessoasEl = document.getElementById('pessoas-por-trabalho');
  const mensalistasEl = document.getElementById('mensalistas-qtd');
  const minEl = document.getElementById('valor-participante-min');
  const maxEl = document.getElementById('valor-participante-max');
  const mensalistaValorEl = document.getElementById('valor-mensalista');
  const taxaEl = document.getElementById('taxaPresenca');
  const nomeClienteEl = document.getElementById('input-nome-cliente');

  if (trabalhosEl) trabalhosEl.value = '';
  if (pessoasEl) pessoasEl.value = '';
  if (mensalistasEl) mensalistasEl.value = '';
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';
  if (mensalistaValorEl) mensalistaValorEl.value = '';
  if (taxaEl) taxaEl.value = '';
  if (nomeClienteEl) nomeClienteEl.value = '';
  const nomePropostaEl = document.getElementById('input-nome-proposta');
  if (nomePropostaEl) nomePropostaEl.value = '';

  aplicarSelectCreditos(new Set());
  document.getElementById('creditos-artes-select')?.dispatchEvent(new Event('change', { bubbles: true }));

  fecharModalSalvarProposta();
  renderCards();
  pulsePrices();
  atualizarPainelPropostas();
  if (nomePropostaEl) nomePropostaEl.focus();
  else trabalhosEl?.focus();
}

const VENDEDOR_STORAGE_KEY = 'aya.orcamento.vendedor.v1';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dataCurta(data) {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${data.getDate()} ${meses[data.getMonth()]} ${data.getFullYear()}`;
}

function dataArquivo(data) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${data.getFullYear()}`;
}

function slugNomeArquivo(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function lerVendedorGuardado() {
  try {
    const bruto = sessionStorage.getItem(VENDEDOR_STORAGE_KEY);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function mostrarErroGerar(mensagem) {
  const erro = document.getElementById('gerar-proposta-erro');
  if (!erro) return;
  erro.hidden = !mensagem;
  erro.textContent = mensagem || '';
}

function pacoteArtesSelecionado(plusIds) {
  const id = plusIds.find((chave) => PLUS_CATALOG[chave]);
  if (!id) return null;
  return { id, ...PLUS_CATALOG[id] };
}

function textoArtes(pacote) {
  if (!pacote) return '5 artes de IA por mês';
  const total = pacote.clientLabel.match(/\((\d+)\s+no total\)/);
  if (total) return `${total[1]} artes de IA por mês`;
  return pacote.clientLabel;
}

function textoMovimentacao(receita, valorPlano) {
  const pct = calcularPercentual(valorPlano, receita.min, receita.max);
  if (!pct || receita.max <= 0) return '';
  const menor = parseFloat(pct.min);
  const maior = parseFloat(pct.max);
  const unico = pct.modo === 'teto' || Math.abs(menor - maior) < 0.05;
  const pctTxt = unico
    ? `${formatPercentPtBR(menor)}%`
    : `${formatPercentPtBR(Math.min(menor, maior))}% a ${formatPercentPtBR(Math.max(menor, maior))}%`;
  if (receita.min <= 0 || Math.abs(receita.min - receita.max) < 0.01) {
    const verbo = receita.min <= 0 ? 'até' : 'cerca de';
    return `Você movimenta ${verbo} <b>${fmt.format(receita.max)}/mês</b> — este plano representa apenas <b>${pctTxt}</b> da sua operação.`;
  }
  return `Você movimenta entre <b>${fmt.format(receita.min)}</b> e <b>${fmt.format(receita.max)}/mês</b> — este plano representa apenas <b>${pctTxt}</b> da sua operação.`;
}

function coletarDadosOrcamento(vendedor) {
  const estado = coletarEstadoFormulario();
  const participantes = participantesPorMes(estado.trabalhos, estado.pessoasPorTrabalho);
  const recomendado = planoRecomendado(participantes, estado.mensalistas, estado.plusIds);
  const plan = planoEmFoco(recomendado.plan);
  const cotacao = cotarPlano(plan, participantes, estado.mensalistas, estado.plusIds);
  const receitaDet = receitaTotalDetalhado({
    trabalhos: estado.trabalhos,
    media: estado.pessoasPorTrabalho,
    mensalistas: estado.mensalistas,
    valorMensalista: estado.valorMensalista,
    valorMin: estado.valorMinParticipante,
    valorMax: estado.valorMaxParticipante,
    taxaPresenca: estado.taxaPresencaPct,
  });
  const hoje = new Date();
  const validade = new Date(hoje);
  validade.setDate(validade.getDate() + 20);
  const pacote = pacoteArtesSelecionado(estado.plusIds);
  const regra = regraMensalistasDoPlano(plan);
  const casa = nomeCasaDaApresentacao();
  const ativa = propostasSalvas.find((p) => p.id === propostaAtivaId);
  const clienteInformado = typeof vendedor.cliente === 'string' ? vendedor.cliente.trim() : '';
  const responsavelInformado = typeof vendedor.responsavel === 'string' ? vendedor.responsavel.trim() : '';
  const cliente = clienteInformado || casa || ativa?.clientName?.trim() || '';
  const nomeArquivo = `orcamento-portal-luar-${dataArquivo(hoje)}-${slugNomeArquivo(cliente) || 'cliente'}`;
  return {
    cliente,
    arquivo: nomeArquivo,
    responsavel: responsavelInformado,
    vendedor: vendedor.nome,
    contato: vendedor.contato,
    emitido: dataCurta(hoje),
    validoAte: dataCurta(validade),
    plano: plan.name,
    recomendado: plan.id === recomendado.plan.id,
    descricao: getPlanoDescricao(plan.id),
    participantesLabel: plan.participantsLabel,
    participantes,
    usuarios: plan.maxUsers === Infinity ? 'Ilimitados' : `até ${plan.maxUsers}`,
    mensalistasLabel: regra.inclusos === Infinity ? 'Ilimitados' : `até ${regra.inclusos}`,
    mensalistas: estado.mensalistas,
    base: plan.base,
    extrasIa: cotacao.extrasIa,
    total: cotacao.total,
    licenca: plan.licenca,
    isentarLicenca: vendedor.isentarLicenca === true,
    observacao: typeof vendedor.observacao === 'string' ? vendedor.observacao.trim() : '',
    artes: textoArtes(pacote),
    pacoteLabel: pacote ? pacote.clientLabel : '',
    porParticipante: calcularValorPorParticipante(cotacao.total, participantes),
    movimentacao: textoMovimentacao(receitaParaPercentual(receitaDet), cotacao.total),
    logo: new URL('../../assets/images/hub/logo-mark.png', window.location.href).href,
  };
}

function htmlOrcamento(d) {
  const e = escaparHtml;
  const mensalidade = d.extrasIa
    ? `${fmt.format(d.total)} por mês: ${fmt.format(d.base)} do ${e(d.plano)} e ${fmt.format(d.extrasIa)} dos créditos de IA.`
    : `${fmt.format(d.total)} por mês (plano ${e(d.plano)}).`;
  const participantesValor = d.participantes > 0
    ? `${e(d.participantesLabel)} (${d.participantes})`
    : e(d.participantesLabel);
  const mensalistasValor = d.mensalistas > 0
    ? `${e(d.mensalistasLabel)} (${d.mensalistas})`
    : e(d.mensalistasLabel);
  const porPart = d.participantes > 0
    ? `<div class="per">≈ ${fmtMoedaDuasDecimais.format(d.porParticipante)} por participante</div>`
    : '';
  const basePresencas = d.participantes > 0
    ? `<div class="hint">Com base em ~${d.participantes} presenças/mês</div>`
    : '';
  const iaCard = d.extrasIa
    ? `<div class="ia">Incluído na mensalidade (${fmt.format(d.extrasIa)}/mês):<b>${e(d.pacoteLabel)}</b></div>`
    : '';
  const iaPreco = d.extrasIa
    ? `<div class="hint gold">Inclui ${fmt.format(d.extrasIa)}/mês de créditos de artes IA</div>`
    : '';
  const valorLicenca = fmt.format(d.licenca);
  const ativacao = d.isentarLicenca
    ? `Licença de <s>${valorLicenca}</s>, isenta nesta proposta.`
    : `Licença de ${valorLicenca} (única).`;
  const caixaLicenca = d.isentarLicenca
    ? `<div class="license"><span>Licença: <s>${valorLicenca}</s> (única)</span><span class="isenta">ISENTA</span></div>`
    : `<div class="license"><span>Licença: ${valorLicenca} (única)</span></div>`;
  const somaLicenca = d.isentarLicenca
    ? `<div><small>Licença única</small><strong>Isenta</strong></div>`
    : `<div><small>Licença única</small><strong>${valorLicenca}</strong></div>`;
  const soma = d.extrasIa
    ? `<div><small>Plano ${e(d.plano)}</small><strong>${fmt.format(d.base)}/mês</strong></div>
       <div><small>Créditos de IA</small><strong>${fmt.format(d.extrasIa)}/mês</strong></div>
       <div class="total"><small>Total</small><strong>${fmt.format(d.total)}/mês</strong></div>`
    : `<div class="total"><small>Plano ${e(d.plano)}</small><strong>${fmt.format(d.total)}/mês</strong></div>
       ${somaLicenca}`;
  const blocoObservacao = d.observacao
    ? `<h3 class="sec sec--obs">Observação</h3><p class="obs">${e(d.observacao)}</p>`
    : '';
  const mov = d.movimentacao ? `<div class="share">${d.movimentacao}</div>` : '';
  const linhaResponsavel = d.responsavel ? `<p class="resp">${e(d.responsavel)}</p>` : '';
  const linhaResponsavelP2 = d.responsavel ? `<div class="for-resp">${e(d.responsavel)}</div>` : '';
  const selo = d.recomendado ? 'Recomendado' : 'Escolhido';
  const tag = d.recomendado ? 'Melhor custo para o seu volume' : 'Escolhido para esta negociação';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${e(d.arquivo)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Avenir Next", "Avenir Next LT Pro", Inter, "Segoe UI", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; position: relative; overflow: hidden; break-after: page; }
.p1 { background: #f6f3ec; color: #1c2433; }
.head { height: 34mm; background: #0b1220; color: #f4f1ea; display: flex; align-items: center; justify-content: space-between; padding: 0 12mm; }
.brand { display: flex; align-items: center; gap: 4mm; }
.brand img { height: 22mm; width: auto; }
.kicker { color: #e4c06a; font-size: 8.5pt; letter-spacing: 0.22em; font-weight: 700; text-transform: uppercase; }
.brand h1 { font-size: 16.5pt; margin-top: 1mm; }
.brand p, .issued { font-size: 8.5pt; color: #b7b1a4; }
.meta { text-align: right; }
.until { margin-top: 1mm; font-size: 11pt; font-weight: 700; color: #e4c06a; }
.body { padding: 8mm 12mm 0; }
.parties { display: flex; gap: 4mm; }
.card, .seller { background: #fff; border: 0.3mm solid #e4ddcf; border-radius: 3mm; }
.card { flex: 1; padding: 4.6mm 4.4mm 5mm; }
.seller { margin-top: 5mm; border-left: 1.1mm solid #e4c06a; padding: 3.2mm 4.2mm; display: flex; align-items: center; justify-content: space-between; }
.label { font-size: 7.4pt; letter-spacing: 0.16em; text-transform: uppercase; color: #8a7350; font-weight: 700; }
.card h2 { font-size: 12.5pt; margin: 1.4mm 0 1.8mm; }
.resp { font-size: 10pt; font-weight: 600; margin: -0.6mm 0 1.6mm; color: #1c2433; }
.card p, .lead, .item, .row span { font-size: 9pt; line-height: 1.4; color: #2c3544; }
.card .vol { font-size: 7.5pt; color: #8a8174; white-space: nowrap; }
.seller .name { font-size: 13pt; font-weight: 700; }
.seller .phone { margin-left: 2.4mm; font-size: 9pt; font-weight: 500; color: #5c6572; }
h3.sec { margin: 7mm 0 2.6mm; font-size: 9pt; letter-spacing: 0.14em; text-transform: uppercase; color: #8a7350; }
h3.sec--obs { margin-top: 5mm; margin-bottom: 1.6mm; }
.obs { font-size: 9pt; line-height: 1.4; color: #2c3544; white-space: pre-wrap; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3.4mm 8mm; }
.item { display: flex; gap: 2mm; }
.tick { color: #8a7350; font-weight: 700; }
.rows { border-top: 0.25mm solid #e4ddcf; }
.row { display: grid; grid-template-columns: 32mm 1fr; gap: 3mm; padding: 3.4mm 0; border-bottom: 0.25mm solid #e4ddcf; }
.row b { font-size: 9pt; }
.note { margin-top: 7mm; font-size: 8.6pt; color: #5c6572; }
.foot { position: absolute; left: 0; right: 0; bottom: 0; height: 10mm; background: #0b1220; color: #d9d3c6; display: flex; align-items: center; justify-content: space-between; padding: 0 12mm; font-size: 8pt; }
.foot b { color: #e4c06a; }
.p2 { background: radial-gradient(120mm 80mm at 100% 0%, rgba(228,192,106,.14), transparent 60%), #0b1220; color: #f3efe6; padding: 11mm 13mm 10mm; display: flex; flex-direction: column; }
.p2top { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 5mm; }
.p2top h2 { font-size: 13pt; margin-top: 0.8mm; }
.for { font-size: 8pt; color: #b7b1a4; }
.for-resp { margin-top: 0.4mm; font-size: 8pt; color: #e4c06a; }
.badge { align-self: flex-start; background: #e4c06a; color: #1a1408; font-size: 7.4pt; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; padding: 1.3mm 3.4mm; border-radius: 999px; }
.scale { font-size: 32pt; line-height: 1; margin: 3mm 0 1.4mm; }
.tag { font-size: 11pt; }
.sub { margin-top: 1mm; font-size: 9.2pt; color: #b7b1a4; }
.lim { display: flex; justify-content: space-between; padding: 2.1mm 0; border-bottom: 0.25mm solid rgba(228,192,106,.28); font-size: 10.5pt; }
.lim span { color: #c9c3b6; }
.lim em { font-style: normal; color: #e4c06a; font-weight: 700; }
.goldbox { margin-top: 5.5mm; background: #161e30; border: 0.35mm solid #e4c06a; border-radius: 3.5mm; padding: 3.6mm 4.5mm; }
.bar { background: #e4c06a; color: #1a1408; font-weight: 800; font-size: 9.4pt; border-radius: 2mm; padding: 1.8mm 3mm; margin-bottom: 2.6mm; }
.checks { list-style: none; }
.checks li { position: relative; padding-left: 5.5mm; font-size: 9.6pt; line-height: 1.45; }
.checks li::before { content: "✓"; position: absolute; left: 0; color: #e4c06a; }
.ia { margin-top: 2.4mm; padding-top: 2.2mm; border-top: 0.25mm solid rgba(228,192,106,.45); font-size: 8.6pt; color: #d9d2c4; }
.ia b { display: block; color: #f7f1e4; font-size: 9.5pt; margin-top: 0.6mm; }
.sim { margin-top: 5mm; font-size: 8pt; letter-spacing: 0.14em; text-transform: uppercase; color: #b7b1a4; font-weight: 700; }
.per { margin-top: 1.2mm; font-size: 22pt; font-weight: 800; color: #3dde74; }
.month { font-size: 18pt; font-weight: 700; margin-top: 0.4mm; }
.hint { margin-top: 1.2mm; font-size: 9pt; color: #c9c3b6; }
.hint.gold, .share b { color: #e4c06a; }
.license, .share, .sum div { background: #121a2b; border-radius: 3mm; }
.license { margin-top: 4mm; display: flex; align-items: center; justify-content: space-between; padding: 3mm 4mm; font-size: 10.5pt; }
.row s, .license s { color: #8a8174; text-decoration-thickness: 0.35mm; }
.license s { color: #9a9386; }
.isenta { background: #3dde74; color: #06210f; font-weight: 800; font-size: 10pt; letter-spacing: 0.04em; padding: 1.3mm 3.4mm; border-radius: 999px; }
.share { margin-top: 4mm; border: 0.3mm solid rgba(228,192,106,.4); padding: 3.2mm 4mm; font-size: 9.4pt; line-height: 1.4; }
.sum { margin-top: auto; padding-top: 4mm; display: grid; grid-template-columns: 1fr 1fr 1.15fr; gap: 2.5mm; }
.sum div { padding: 2.6mm 3.2mm; }
.sum small { display: block; color: #b7b1a4; font-size: 7.4pt; letter-spacing: 0.08em; text-transform: uppercase; }
.sum strong { display: block; margin-top: 0.8mm; font-size: 11pt; }
.sum .total strong { color: #3dde74; }
.p2foot { margin-top: 3.5mm; display: flex; justify-content: space-between; font-size: 8pt; color: #9d978c; }
</style></head><body>
<section class="page p1">
  <header class="head">
    <div class="brand"><img src="${e(d.logo)}" alt="" /><div><div class="kicker">Orçamento</div><h1>Portal do Luar</h1><p>Serviços continuados em nuvem (SaaS)</p></div></div>
    <div class="meta"><div class="issued">Emitido em ${e(d.emitido)}</div><div class="until">Válido até ${e(d.validoAte)}</div></div>
  </header>
  <div class="body">
    <div class="parties">
      <article class="card"><div class="label">Prestador</div><h2>Portal do Luar</h2><p>CNPJ 29.557.191/0001-79<br />portaldoluar2@gmail.com</p></article>
      <article class="card"><div class="label">Cliente</div><h2>${e(d.cliente)}</h2>${linhaResponsavel}<p>Plano ${e(d.plano)}${d.extrasIa ? ' com créditos de IA' : ''}<span class="vol"> - ${d.participantes ? `Simulação com cerca de ${d.participantes} presenças por mês` : 'Simulação com os dados informados'}</span></p></article>
    </div>
    <div class="seller"><div class="label">Vendedor</div><div><span class="name">${e(d.vendedor)}</span><span class="phone">${e(d.contato)}</span></div></div>
    <h3 class="sec">Objeto</h3>
    <p class="lead">Acesso remoto à plataforma Portal do Luar para a gestão da casa, no plano ${e(d.plano)}${d.extrasIa ? ' e no pacote de créditos desta proposta' : ''}.</p>
    <h3 class="sec">O que a mensalidade cobre</h3>
    <div class="grid">
      <div class="item"><span class="tick">✓</span><span>Acesso ao Portal do Luar: eventos, pessoas, financeiro e páginas da casa</span></div>
      <div class="item"><span class="tick">✓</span><span>Relatórios, painel e prestação de contas</span></div>
      <div class="item"><span class="tick">✓</span><span>${e(d.artes)}</span></div>
      <div class="item"><span class="tick">✓</span><span>Suporte remoto: manuais, ajuda no sistema e WhatsApp</span></div>
    </div>
    <h3 class="sec">Condições</h3>
    <div class="rows">
      <div class="row"><b>Mensalidade</b><span>${mensalidade}</span></div>
      <div class="row"><b>Pagamento</b><span>PIX, até o dia 15 do mês seguinte.</span></div>
      <div class="row"><b>Ativação</b><span>${ativacao}</span></div>
      <div class="row"><b>Prazo</b><span>12 meses, com renovação automática. Para não renovar, um aviso de 30 dias.</span></div>
    </div>
    ${blocoObservacao}
    <p class="note">Proposta válida por 20 dias. O acesso começa depois do aceite online.</p>
  </div>
  <footer class="foot"><span>www.portaldoluar.com.br</span><span>Página 1 de 2 · <b>valores na página seguinte</b></span></footer>
</section>
<section class="page p2">
  <div class="p2top"><div><div class="for">${e(d.cliente)}</div>${linhaResponsavelP2}<h2>O que foi orçado</h2></div><div class="meta"><div class="issued">Emitido em ${e(d.emitido)}</div><div class="until">Válido até ${e(d.validoAte)}</div></div></div>
  <div class="badge">${e(selo)}</div>
  <div class="scale">${e(d.plano)}</div>
  <div class="tag">${e(tag)}</div>
  <div class="sub">${e(d.descricao)}</div>
  <div class="limits">
    <div class="lim"><span>Participantes</span><b>${participantesValor}</b></div>
    <div class="lim"><span>Usuários</span><b>${e(d.usuarios)}</b></div>
    <div class="lim"><span>Mensalistas inclusos</span><b>${mensalistasValor}</b></div>
  </div>
  <div class="goldbox"><div class="bar">Na prática, você terá:</div>
    <ul class="checks"><li>Redução de risco jurídico</li><li>Cuidado com a saúde dos participantes</li><li>Assistente IA: dúvidas, medicamentos e artes para redes</li><li>PIX e cartão com baixa automática</li><li>Presença digital profissional</li></ul>
    ${iaCard}
  </div>
  <div class="sim">Simulação de custo</div>
  ${porPart}
  <div class="month">${fmt.format(d.total)}/mês</div>
  ${basePresencas}
  ${iaPreco}
  ${caixaLicenca}
  ${mov}
  <div class="sum">${soma}</div>
  <div class="p2foot"><span>www.portaldoluar.com.br</span><span>Página 2 de 2</span></div>
</section>
</body></html>`;
}

function abrirOrcamento(dados) {
  const janela = window.open('', '_blank');
  if (!janela) {
    mostrarErroGerar('O navegador bloqueou a janela da proposta. Permita pop-ups neste site e tente de novo.');
    return;
  }
  janela.document.open();
  janela.document.write(htmlOrcamento(dados));
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 300);
}

function nomeClienteSugerido() {
  const ativa = propostasSalvas.find((p) => p.id === propostaAtivaId);
  const nomeSalvo = ativa?.clientName?.trim() || '';
  if (nomeSalvo) return nomeSalvo;
  return nomeCasaDaApresentacao();
}

function alinharModalGerarAProposta(cliente, responsavel) {
  const idAtual = propostaAtivaId || '';
  cliente.value = nomeClienteSugerido();
  if (modalGerarPropostaId === idAtual) return;
  responsavel.value = '';
  const observacao = document.getElementById('input-gerar-observacao');
  if (observacao) observacao.value = '';
  const isentar = document.getElementById('check-isentar-licenca');
  if (isentar) isentar.checked = false;
  modalGerarPropostaId = idAtual;
}

function abrirModalGerarProposta() {
  mostrarErroGerar('');
  const modal = document.getElementById('modal-gerar-proposta');
  const cliente = document.getElementById('input-gerar-cliente');
  const responsavel = document.getElementById('input-gerar-responsavel');
  const nome = document.getElementById('input-vendedor-nome');
  const contato = document.getElementById('input-vendedor-contato');
  if (!modal || !cliente || !responsavel || !nome || !contato) return;
  alinharModalGerarAProposta(cliente, responsavel);
  const guardado = lerVendedorGuardado();
  if (guardado) {
    if (!nome.value) nome.value = guardado.nome || '';
    if (!contato.value) contato.value = formatarTelefone(guardado.contato || '');
  }
  const erroModal = document.getElementById('gerar-vendedor-erro');
  if (erroModal) erroModal.hidden = true;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  const foco = [cliente, responsavel, nome].find((campo) => !campo.value.trim()) || contato;
  foco.focus();
}

function fecharModalGerarProposta() {
  const modal = document.getElementById('modal-gerar-proposta');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function registrarClienteDaProposta(cliente) {
  const campo = document.getElementById('field-cliente');
  if (campo) campo.value = cliente;
  atualizarPainelPropostas();
  try {
    const chave = 'aya.apresentacao.casas-ayahuasca.draft.v1';
    const bruto = localStorage.getItem(chave);
    if (!bruto) return;
    const rascunho = JSON.parse(bruto);
    if (!rascunho.calc || typeof rascunho.calc !== 'object') rascunho.calc = {};
    rascunho.calc.cliente = cliente;
    localStorage.setItem(chave, JSON.stringify(rascunho));
  } catch {
    /* o nome segue no campo mesmo sem atualizar o rascunho */
  }
}

function digitosTelefone(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

function formatarTelefone(valor) {
  const d = digitosTelefone(valor);
  if (d.length === 0) return '';
  const ddd = d.slice(0, 2);
  if (d.length <= 2) return `(${ddd}`;
  if (d[2] === '9') return formatarCelular(ddd, d.slice(2));
  return formatarFixo(ddd, d.slice(2, 10));
}

function formatarCelular(ddd, resto) {
  const nono = resto.slice(0, 1);
  const meio = resto.slice(1, 5);
  const fim = resto.slice(5, 9);
  let texto = `(${ddd}) ${nono}`;
  if (meio) texto += ` ${meio}`;
  if (fim) texto += `-${fim}`;
  return texto;
}

function formatarFixo(ddd, resto) {
  const meio = resto.slice(0, 4);
  const fim = resto.slice(4, 8);
  let texto = `(${ddd}) ${meio}`;
  if (fim) texto += `-${fim}`;
  return texto;
}

function telefoneCompleto(valor) {
  const d = digitosTelefone(valor);
  if (d.length >= 3 && d[2] === '9') return d.length === 11;
  return d.length === 10;
}

function aplicarMascaraTelefone(input) {
  const antes = input.value;
  const pos = input.selectionStart ?? antes.length;
  const digitosAntes = antes.slice(0, pos).replace(/\D/g, '').length;
  const formatado = formatarTelefone(antes);
  input.value = formatado;
  let novaPos = 0;
  let vistos = 0;
  while (novaPos < formatado.length && vistos < digitosAntes) {
    if (/\d/.test(formatado[novaPos])) vistos += 1;
    novaPos += 1;
  }
  input.setSelectionRange(novaPos, novaPos);
}

function mensagemErroGerarProposta(clienteOk, responsavelOk, nomeOk, telefoneOk) {
  const faltas = [];
  if (!clienteOk) faltas.push('o nome do cliente');
  if (!responsavelOk) faltas.push('o responsável');
  if (!nomeOk) faltas.push('o nome do vendedor');
  if (!telefoneOk) faltas.push('o telefone do vendedor');
  if (faltas.length === 1) return `Informe ${faltas[0]}.`;
  const ultimo = faltas.pop();
  return `Informe ${faltas.join(', ')} e ${ultimo}.`;
}

function confirmarGerarProposta() {
  const cliente = document.getElementById('input-gerar-cliente')?.value?.trim() || '';
  const responsavel = document.getElementById('input-gerar-responsavel')?.value?.trim() || '';
  const nome = document.getElementById('input-vendedor-nome')?.value?.trim() || '';
  const campoTelefone = document.getElementById('input-vendedor-contato');
  const contato = formatarTelefone(campoTelefone?.value || '');
  if (campoTelefone) campoTelefone.value = contato;
  const erroModal = document.getElementById('gerar-vendedor-erro');
  const clienteOk = cliente.length >= 2;
  const responsavelOk = responsavel.length >= 2;
  const nomeOk = nome.length >= 2;
  const telefoneOk = telefoneCompleto(contato);
  if (!clienteOk || !responsavelOk || !nomeOk || !telefoneOk) {
    if (erroModal) {
      erroModal.hidden = false;
      erroModal.textContent = mensagemErroGerarProposta(clienteOk, responsavelOk, nomeOk, telefoneOk);
    }
    return;
  }
  if (erroModal) erroModal.hidden = true;
  const isentarLicenca = document.getElementById('check-isentar-licenca')?.checked === true;
  const observacao = document.getElementById('input-gerar-observacao')?.value?.trim() || '';
  const vendedor = { nome, contato, cliente, responsavel, isentarLicenca, observacao };
  try {
    sessionStorage.setItem(VENDEDOR_STORAGE_KEY, JSON.stringify({ nome, contato }));
  } catch {
    /* a proposta segue mesmo sem gravar o vendedor */
  }
  registrarClienteDaProposta(cliente);
  mostrarErroGerar('');
  fecharModalGerarProposta();
  abrirOrcamento(coletarDadosOrcamento(vendedor));
}

function init() {
  ['trabalhos', 'pessoas-por-trabalho', 'mensalistas-qtd'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      renderCards();
      pulsePrices();
    });
  });

  const mensalistasQtdEl = document.getElementById('mensalistas-qtd');
  if (mensalistasQtdEl) {
    mensalistasQtdEl.addEventListener('blur', () => {
      if (mensalistasQtdEl.value === '' || Number.isNaN(Number(mensalistasQtdEl.value))) {
        mensalistasQtdEl.value = '0';
        renderCards();
        pulsePrices();
      }
    });
  }

  const creditosSelect = document.getElementById('creditos-artes-select');
  if (creditosSelect) {
    creditosSelect.addEventListener('change', () => {
      renderCards();
      pulsePrices();
    });
  }

  const btnSalvar = document.getElementById('btn-salvar-proposta');
  if (btnSalvar) {
    btnSalvar.addEventListener('click', () => {
      if (typeof window.ayaDeckCanSalvarProposta === 'function' && !window.ayaDeckCanSalvarProposta()) {
        return;
      }
      abrirModalSalvarProposta();
    });
  }
  const btnEnviarFechamento = document.getElementById('btn-enviar-fechamento');
  if (btnEnviarFechamento) btnEnviarFechamento.addEventListener('click', enviarFechamentoAtual);
  const telefoneVendedor = document.getElementById('input-vendedor-contato');
  if (telefoneVendedor) telefoneVendedor.addEventListener('input', () => aplicarMascaraTelefone(telefoneVendedor));
  const btnGerar = document.getElementById('btn-gerar-proposta');
  if (btnGerar) btnGerar.addEventListener('click', abrirModalGerarProposta);
  const btnCancelarGerar = document.getElementById('btn-cancelar-gerar');
  if (btnCancelarGerar) btnCancelarGerar.addEventListener('click', fecharModalGerarProposta);
  const btnConfirmarGerar = document.getElementById('btn-confirmar-gerar');
  if (btnConfirmarGerar) btnConfirmarGerar.addEventListener('click', confirmarGerarProposta);
  const btnCancelarSalvar = document.getElementById('btn-cancelar-salvar');
  if (btnCancelarSalvar) btnCancelarSalvar.addEventListener('click', fecharModalSalvarProposta);
  const btnConfirmarSalvar = document.getElementById('btn-confirmar-salvar');
  if (btnConfirmarSalvar) btnConfirmarSalvar.addEventListener('click', confirmarSalvarProposta);
  const btnExcluir = document.getElementById('btn-excluir-proposta');
  if (btnExcluir) btnExcluir.addEventListener('click', excluirPropostaSelecionada);
  const btnNova = document.getElementById('btn-nova-proposta');
  const btnSalvarAlteracoes = document.getElementById('btn-salvar-alteracoes');
  if (btnSalvarAlteracoes) {
    btnSalvarAlteracoes.addEventListener('click', () => {
      salvarAlteracoesDaProposta();
    });
  }
  const nomePropostaInput = document.getElementById('input-nome-proposta');
  if (nomePropostaInput) {
    nomePropostaInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      salvarAlteracoesDaProposta();
    });
  }
  if (btnNova) {
    btnNova.addEventListener('click', () => {
      if (btnNova.dataset.mode === 'salvar') {
        salvarPropostaDaApresentacao();
        return;
      }
      criarNovaProposta();
    });
  }

  const selectPropostas = document.getElementById('propostas-select');
  if (selectPropostas) {
    selectPropostas.addEventListener('change', () => {
      if (selectPropostas.value) {
        carregarPropostaSelecionada();
        return;
      }
      criarNovaProposta();
    });
  }

  const modal = document.getElementById('modal-salvar-proposta');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) fecharModalSalvarProposta();
    });
  }
  const modalGerar = document.getElementById('modal-gerar-proposta');
  if (modalGerar) {
    modalGerar.addEventListener('click', (event) => {
      if (event.target === modalGerar) fecharModalGerarProposta();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const modalEl = document.getElementById('modal-salvar-proposta');
    if (modalEl?.classList.contains('is-open')) fecharModalSalvarProposta();
    const modalGerar = document.getElementById('modal-gerar-proposta');
    if (modalGerar?.classList.contains('is-open')) fecharModalGerarProposta();
  });

  setupMoneyField('valor-participante-min');
  setupMoneyField('valor-participante-max');
  setupMoneyField('valor-mensalista');
  setupPercentField('taxaPresenca');

  renderCards();
  estadoInicialFormulario = coletarEstadoFormulario();
  propostasSalvas = carregarPropostasDoStorage();

  const params = new URLSearchParams(window.location.search);
  const propostaId = params.get('proposta');
  const fromApresentacao = params.get('from') === 'apresentacao';
  const embutidoNoDeck = Boolean(document.getElementById('deck-sim'));

  if (propostaId && !embutidoNoDeck) {
    const fromDeck = propostasSalvas.find((p) => p.id === propostaId);
    if (fromDeck) {
      propostaAtivaId = fromDeck.id;
      aplicarEstadoFormulario(fromDeck.estado);
    }
  }
  if (btnEnviarFechamento && (fromApresentacao || propostaAtivaId) && !embutidoNoDeck) {
    btnEnviarFechamento.hidden = false;
  }

  atualizarPainelPropostas();
  wirePanelToggles();
}

function wirePanelToggles() {
  const root = document.getElementById('deck-sim');
  if (!root) return;
  const buttons = root.querySelectorAll('[data-toggle-panel]');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', () => {
      const id = buttons[i].getAttribute('data-toggle-panel');
      const panel = document.getElementById(id);
      if (!panel) return;
      const collapsed = panel.classList.toggle('is-collapsed');
      buttons[i].setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      const labelOpen =
        id === 'panel-config' ? 'Abrir configuração' : 'Abrir resumo de presenças';
      const labelClose =
        id === 'panel-config' ? 'Fechar configuração' : 'Fechar resumo de presenças';
      buttons[i].setAttribute('aria-label', collapsed ? labelOpen : labelClose);
    });
  }
}

init();

window.AyaDeckSim = {
  applyEstado: aplicarEstadoFormulario,
  collectEstado: coletarEstadoFormulario,
  render: function () {
    renderCards();
    pulsePrices();
  },
  getPropostaAtivaId: function () {
    return propostaAtivaId;
  },
  setPropostaAtivaId: function (id) {
    propostaAtivaId = id || null;
    atualizarPainelPropostas();
  },
  refreshPropostas: function () {
    propostasSalvas = carregarPropostasDoStorage();
    atualizarPainelPropostas();
  },
  syncNomeCasa: function () {
    atualizarPainelPropostas();
  },
  setPlanoEscolhido: function (id) {
    planoEscolhidoId = id || null;
  },
};
