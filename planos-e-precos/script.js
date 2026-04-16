/**
 * Simulador de planos — gestão de eventos (uso comercial).
 * Módulos Plus: valor percebido (soma interna) sem alterar o preço exibido no card.
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
  'Clareza total da sua operação',
  'Cuidado com a saúde dos participantes',
  'Presença digital profissional',
];

/**
 * Módulos Plus (extras de fechamento). `valor` = valor percebido / referência interna (não cobrado no card).
 */
const PLUS_CATALOG = {
  relatorios_custom: { clientLabel: 'Relatórios customizados', valor: 120 },
  dashboards_avancados: { clientLabel: 'Dashboards avançados', valor: 80 },
  anamnese_ia: { clientLabel: 'Análise de anamnese com IA', valor: 150 },
};

/** Referência de bônus (mesmos valores que PLUS_CATALOG). */
const valoresBonus = {
  relatorios_custom: 120,
  dashboards_avancados: 80,
  anamnese_ia: 150,
};

function calcularBonus(plusIds) {
  return plusIds.reduce((t, k) => t + (valoresBonus[k] ?? 0), 0);
}

const PLUS_ORDER = ['relatorios_custom', 'dashboards_avancados', 'anamnese_ia'];
const PROPOSTAS_STORAGE_KEY = 'aya.planos-precos.propostas.v1';
let propostasSalvas = [];
let propostaAtivaId = null;
let estadoInicialFormulario = null;

/**
 * Ordem: menor → maior tier.
 * Bases: Starter 97, Basic 197, Growth 297, Scale 397, Pro 597.
 */
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    maxParticipants: 30,
    maxUsers: 1,
    base: 97,
    participantsLabel: 'até 30',
  },
  {
    id: 'basic',
    name: 'Basic',
    maxParticipants: 60,
    maxUsers: 2,
    base: 197,
    participantsLabel: 'até 60',
  },
  {
    id: 'growth',
    name: 'Growth',
    maxParticipants: 100,
    maxUsers: 3,
    base: 297,
    participantsLabel: 'até 100',
  },
  {
    id: 'scale',
    name: 'Scale',
    maxParticipants: 200,
    maxUsers: 5,
    base: 397,
    participantsLabel: 'até 200',
  },
  {
    id: 'pro',
    name: 'Pro',
    maxParticipants: Infinity,
    maxUsers: Infinity,
    base: 597,
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
  document.querySelectorAll('.plus-list__input:checked').forEach((input) => {
    const id = input.getAttribute('data-plus-id');
    if (id && PLUS_CATALOG[id]) ids.push(id);
  });
  return ids;
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

function calcularTotalPlano(plan, participantes, mensalistas) {
  const cabeParticipantes = participantes <= plan.maxParticipants;
  if (!cabeParticipantes) {
    return { total: null, extrasMensalistas: null, breakdown: null, cabeParticipantes: false };
  }
  const extras = custoMensalistasExtras(plan, mensalistas);
  const total = plan.base + extras;
  const breakdown = {
    base: plan.base,
    extrasMensalistas: extras,
  };
  return { total, extrasMensalistas: extras, breakdown, cabeParticipantes: true };
}

/**
 * valorBase = preço visível (plano + extras mensalistas). Módulos Plus não entram.
 */
function planoRecomendado(participantes, mensalistas) {
  let best = null;
  let bestCost = Infinity;
  for (const plan of PLANS) {
    const r = calcularTotalPlano(plan, participantes, mensalistas);
    if (!r.cabeParticipantes || r.total === null) continue;
    if (r.total < bestCost) {
      bestCost = r.total;
      best = { plan, ...r };
    }
  }
  if (!best) {
    const pro = PLANS[PLANS.length - 1];
    return { plan: pro, ...calcularTotalPlano(pro, participantes, mensalistas) };
  }
  return best;
}

function indexPlano(planId) {
  return PLANS.findIndex((p) => p.id === planId);
}

function logNegociacaoInterno(planoNome, valorBase, plusIds) {
  const valorBonus = somaValorBonus(plusIds);
  const valorInterno = valorBase + valorBonus;
  console.log({
    plano: planoNome,
    valorBase,
    valorInterno,
    valorBonus,
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

  const rec = planoRecomendado(participantes, mensalistas);
  const idx = indexPlano(rec.plan.id);

  const recRegra = regraMensalistasDoPlano(rec.plan);
  const limiteMensalistas =
    recRegra.inclusos === Infinity ? 'ilimitados' : String(recRegra.inclusos);
  document.getElementById('mensalistas-limite-rec').textContent = limiteMensalistas;

  const alertaLimite = document.getElementById('summary-mensalistas-alerta');
  if (alertaLimite) {
    const ok = validarMensalistas(rec.plan.id, mensalistas);
    if (ok) {
      alertaLimite.hidden = true;
      alertaLimite.textContent = '';
    } else {
      alertaLimite.hidden = false;
      alertaLimite.textContent = `No plano ${rec.plan.name}, a faixa inclusa é de até ${limiteMensalistas} mensalistas; você indicou ${mensalistas}. Haverá cobrança proporcional acima do incluso (ou avalie subir de plano).`;
    }
  }

  if (rec.total !== null) {
    logNegociacaoInterno(rec.plan.name, rec.total, plusIds);
  }

  const below = idx > 0 ? PLANS[idx - 1] : null;
  const above = idx < PLANS.length - 1 ? PLANS[idx + 1] : null;

  const sorted = [];
  if (below) sorted.push({ plan: below, role: 'below' });
  sorted.push({ plan: rec.plan, role: 'recommended' });
  if (above) sorted.push({ plan: above, role: 'above' });

  const root = document.getElementById('cards-root');
  root.innerHTML = '';
  root.append(
    ...sorted.map((item) =>
      createCard(item, participantes, mensalistas, {
        plusIds,
        receita,
        totalPresencasMes: participantes,
      }),
    ),
  );
}

function createCard({ plan, role }, participantes, mensalistas, giftUi) {
  const { plusIds = [], receita, totalPresencasMes = 0 } = giftUi || {};
  const article = document.createElement('article');
  article.className = 'plan-card';
  if (role === 'recommended') article.classList.add('plan-card--recommended');

  const result = calcularTotalPlano(plan, participantes, mensalistas);
  const insufficient = !result.cabeParticipantes;

  if (insufficient) article.classList.add('plan-card--insufficient');

  if (role === 'recommended') {
    const badge = document.createElement('span');
    badge.className = 'plan-card__badge';
    badge.textContent = 'Recomendado';
    article.appendChild(badge);
  }

  const name = document.createElement('h3');
  name.className = 'plan-card__name';
  name.textContent = plan.name;

  const tag = document.createElement('p');
  tag.className = 'plan-card__tag';
  if (role === 'below') tag.textContent = 'Plano abaixo';
  else if (role === 'above') tag.textContent = 'Plano acima (upsell)';
  else tag.textContent = 'Melhor custo para o seu volume';

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

  const rowP = row('Participantes', plan.participantsLabel);
  const rowU = row('Usuários', plan.maxUsers === Infinity ? 'Ilimitados' : `até ${plan.maxUsers}`);
  const regraM = regraMensalistasDoPlano(plan);
  const mensInc =
    regraM.inclusos === Infinity ? 'Ilimitados' : `até ${regraM.inclusos}`;
  const rowM = row('Mensalistas inclusos', mensInc);

  article.appendChild(rowP);
  article.appendChild(rowU);
  article.appendChild(rowM);

  const limM = limitesMensalistasPlano[plan.id];
  if (limM !== undefined && limM !== Infinity && mensalistas > limM) {
    const hint = document.createElement('p');
    hint.className = 'plan-card__mensalistas-alerta';
    hint.textContent = `Você indicou ${mensalistas} mensalistas; na faixa inclusa deste plano são até ${limM} (acima disso há proporcional na simulação).`;
    article.appendChild(hint);
  }

  if (!insufficient) {
    article.appendChild(createGiftSection(plusIds));
  }

  const priceWrap = document.createElement('div');
  priceWrap.className = 'plan-card__price';

  const pl = document.createElement('div');
  pl.className = 'plan-card__price-label';
  pl.textContent = 'Simulação de custo';

  const stack = document.createElement('div');
  stack.className = 'plan-card__price-stack';

  if (insufficient) {
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

      stack.appendChild(block);
    } else {
      const now = document.createElement('strong');
      now.className = 'plan-card__price-value plan-card__price-now price';
      now.dataset.priceKey = plan.id;
      now.textContent = `${fmt.format(total)}/mês`;
      stack.appendChild(now);
    }
  }

  priceWrap.appendChild(pl);
  priceWrap.appendChild(stack);

  article.appendChild(priceWrap);

  if (!insufficient && receita) {
    const resumo = criarElementoResumoOperacao(receita, result.total);
    if (resumo) article.appendChild(resumo);
  }

  if (insufficient) {
    const w = document.createElement('p');
    w.className = 'plan-card__warn';
    w.textContent =
      'Participantes/mês acima do limite deste plano. Suba de tier ou ajuste trabalhos, participantes ou mensalistas.';
    article.appendChild(w);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'plan-card__btn';
  btn.textContent = insufficient ? 'Volume acima deste plano' : getCTA(plan.id);
  btn.disabled = insufficient;
  btn.addEventListener('click', () => {
    const label = `${plan.name} — ${insufficient ? 'indisponível' : fmt.format(result.total)}`;
    alert(`Registrado na conversa: ${getCTA(plan.id)}\n${label}\n(Cole no CRM ou proposta.)`);
  });
  article.appendChild(btn);

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
    subPlus.textContent = `Módulos Plus inclusos (valor percebido ~${fmt.format(totalPercebido)}/mês):`;

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

function row(label, value) {
  const wrap = document.createElement('div');
  wrap.className = 'plan-card__row';
  const l = document.createElement('span');
  l.className = 'plan-card__label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'plan-card__value';
  v.textContent = value;
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
  document.querySelectorAll('.plus-list__input').forEach((input) => {
    const id = input.getAttribute('data-plus-id');
    input.checked = !!id && selected.has(id);
  });

  renderCards();
  pulsePrices();
}

function montarResumoProposta(estado) {
  const participantes = participantesPorMes(estado.trabalhos, estado.pessoasPorTrabalho);
  const det = receitaTotalDetalhado({
    trabalhos: estado.trabalhos,
    media: estado.pessoasPorTrabalho,
    mensalistas: estado.mensalistas,
    valorMensalista: estado.valorMensalista,
    valorMin: estado.valorMinParticipante,
    valorMax: estado.valorMaxParticipante,
    taxaPresenca: estado.taxaPresencaPct,
  });
  const rec = planoRecomendado(participantes, estado.mensalistas);
  return {
    plano: rec.plan.name,
    valorPlano: rec.total ?? 0,
    receitaMedia: det.total,
  };
}

function atualizarPainelPropostas() {
  const select = document.getElementById('propostas-select');
  const btnExcluir = document.getElementById('btn-excluir-proposta');
  const info = document.getElementById('proposta-atual-info');
  if (!select || !btnExcluir || !info) return;

  select.innerHTML = '';
  if (!propostasSalvas.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nenhuma proposta salva';
    select.appendChild(option);
    select.disabled = true;
    btnExcluir.disabled = true;
    btnExcluir.hidden = true;
    info.textContent = 'Nenhuma proposta ativa.';
    return;
  }

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecionar proposta...';
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
    info.textContent = 'Selecione uma proposta salva ou crie uma nova.';
    btnExcluir.disabled = true;
    btnExcluir.hidden = true;
  }
}

function carregarPropostaSelecionada() {
  const select = document.getElementById('propostas-select');
  if (!select || !select.value) return;
  const proposta = propostasSalvas.find((p) => p.id === select.value);
  if (!proposta) return;
  propostaAtivaId = proposta.id;
  aplicarEstadoFormulario(proposta.estado);
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
  input.value = ativa?.clientName ?? '';
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

function confirmarSalvarProposta() {
  const input = document.getElementById('input-nome-cliente');
  if (!input) return;
  const nomeCliente = input.value.trim();
  if (!nomeCliente) {
    input.focus();
    return;
  }

  const estado = coletarEstadoFormulario();
  const resumo = montarResumoProposta(estado);
  const now = new Date().toISOString();
  const proposta = {
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    clientName: nomeCliente,
    createdAt: now,
    updatedAt: now,
    estado,
    resumo,
  };

  propostasSalvas.unshift(proposta);
  propostaAtivaId = proposta.id;
  salvarPropostasNoStorage();
  atualizarPainelPropostas();
  fecharModalSalvarProposta();
}

function criarNovaProposta() {
  propostaAtivaId = null;
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

  document.querySelectorAll('.plus-list__input').forEach((input) => {
    input.checked = false;
  });

  fecharModalSalvarProposta();
  renderCards();
  pulsePrices();
  atualizarPainelPropostas();
  trabalhosEl?.focus();
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

  document.querySelectorAll('.plus-list__input').forEach((input) => {
    input.addEventListener('change', () => {
      renderCards();
      pulsePrices();
    });
  });

  const btnSalvar = document.getElementById('btn-salvar-proposta');
  if (btnSalvar) btnSalvar.addEventListener('click', abrirModalSalvarProposta);
  const btnCancelarSalvar = document.getElementById('btn-cancelar-salvar');
  if (btnCancelarSalvar) btnCancelarSalvar.addEventListener('click', fecharModalSalvarProposta);
  const btnConfirmarSalvar = document.getElementById('btn-confirmar-salvar');
  if (btnConfirmarSalvar) btnConfirmarSalvar.addEventListener('click', confirmarSalvarProposta);
  const btnExcluir = document.getElementById('btn-excluir-proposta');
  if (btnExcluir) btnExcluir.addEventListener('click', excluirPropostaSelecionada);
  const btnNova = document.getElementById('btn-nova-proposta');
  if (btnNova) btnNova.addEventListener('click', criarNovaProposta);

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
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const modalEl = document.getElementById('modal-salvar-proposta');
    if (modalEl?.classList.contains('is-open')) fecharModalSalvarProposta();
  });

  setupMoneyField('valor-participante-min');
  setupMoneyField('valor-participante-max');
  setupMoneyField('valor-mensalista');
  setupPercentField('taxaPresenca');

  renderCards();
  estadoInicialFormulario = coletarEstadoFormulario();
  propostasSalvas = carregarPropostasDoStorage();
  atualizarPainelPropostas();
}

init();
