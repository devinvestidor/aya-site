(function () {
  'use strict';

  var PROPOSTAS_STORAGE_KEY = 'aya.planos-precos.propostas.v1';
  var DECK_DRAFT_KEY = 'aya.apresentacao.casas-ayahuasca.draft.v1';

  var deck = document.getElementById('deck');
  var viewport = document.getElementById('deck-viewport');
  var clienteEl = document.getElementById('field-cliente');
  var trabalhosEl = document.getElementById('trabalhos');
  var pessoasEl = document.getElementById('pessoas-por-trabalho');
  var valorMinEl = document.getElementById('valor-participante-min');
  var valorMaxEl = document.getElementById('valor-participante-max');
  var mensalistasQtdEl = document.getElementById('mensalistas-qtd');
  var valorMensEl = document.getElementById('valor-mensalista');
  var taxaEl = document.getElementById('taxaPresenca');
  var errorEl = document.getElementById('proposta-error');
  var dorEl = document.getElementById('field-dor');
  var dorParticipanteEl = document.getElementById('field-dor-participante');
  var presentesEl = document.getElementById('field-presentes');
  var pessoasQualEl = document.getElementById('field-pessoas-qual');
  var contextoOutroEl = document.getElementById('field-contexto-outro');
  var contextoOutroWrap = document.getElementById('contexto-outro-wrap');
  var summaryEl = document.getElementById('session-summary');
  var summaryCountEl = document.getElementById('session-summary-count');
  var prevBtn = document.getElementById('deck-prev');
  var nextBtn = document.getElementById('deck-next');
  var progressEl = document.getElementById('deck-progress');
  var counterEl = document.getElementById('deck-counter');
  var dotsEl = document.getElementById('deck-dots');
  var resetBtn = document.getElementById('deck-reset');
  var hubBackEl = document.getElementById('deck-hub-back');
  var pathTagEl = document.getElementById('deck-path-tag');

  if (!deck || !viewport) return;

  var slides = Array.prototype.slice.call(viewport.querySelectorAll('.deck__slide'));
  var total = slides.length;
  var index = 0;
  var answers = {};
  var calcHydrated = false;
  var planoSelecionadoId = null;
  var propostaAtivaId = null;

  function sim() {
    return window.AyaDeckSim || null;
  }

  function refreshSim() {
    var api = sim();
    if (api && typeof api.render === 'function') api.render();
  }

  function mapTrabalhos(v) {
    if (v === '4+') return 4;
    var n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function mapPessoas(v) {
    if (v == null || v === '') return 0;
    var asNum = parseInt(String(v).replace(/\D/g, ''), 10);
    if (Number.isFinite(asNum) && asNum > 0 && String(v).indexOf('–') < 0 && String(v).indexOf('+') < 0 && String(v).indexOf('Até') < 0) {
      return asNum;
    }
    if (v === 'Até 20') return 20;
    if (v === '20–40') return 30;
    if (v === '40–80') return 60;
    if (v === '80–120') return 100;
    if (v === '120–200') return 160;
    if (v === '200+' || v === '80+') return 200;
    return Number.isFinite(asNum) ? asNum : 0;
  }

  function mapMensalistasQtd(v) {
    if (v === 'Até 10') return 10;
    if (v === '10–30') return 20;
    if (v === '30–60') return 45;
    if (v === '60+') return 60;
    return 0;
  }

  function parseMoneyDigits(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    return Number(digits || 0);
  }

  function parseIntField(el) {
    if (!el) return 0;
    var n = parseInt(String(el.value || '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function parsePercentField(raw) {
    var digits = String(raw || '').replace(/\D/g, '').slice(0, 3);
    if (!digits) return 70;
    var n = Number(digits);
    if (Number.isNaN(n)) return 70;
    return Math.min(100, Math.max(0, n));
  }

  function formatPercent(n) {
    return String(n) + '%';
  }

  function buildEstadoFormulario() {
    var api = sim();
    if (api && typeof api.collectEstado === 'function') return api.collectEstado();
    var pessoas = parseIntField(pessoasEl);
    var mens = parseIntField(mensalistasQtdEl);
    if (pessoas > 0) mens = Math.min(mens, pessoas);
    var minV = parseMoneyDigits(valorMinEl && valorMinEl.value);
    var maxV = parseMoneyDigits(valorMaxEl && valorMaxEl.value);
    if (minV > maxV) {
      var t = minV;
      minV = maxV;
      maxV = t;
    }
    return {
      trabalhos: parseIntField(trabalhosEl),
      pessoasPorTrabalho: pessoas,
      mensalistas: mens,
      valorMinParticipante: minV,
      valorMaxParticipante: maxV,
      valorMensalista: parseMoneyDigits(valorMensEl && valorMensEl.value),
      taxaPresencaPct: parsePercentField(taxaEl && taxaEl.value),
      plusIds: [],
    };
  }

  function renderOffer() {
    refreshSim();
  }

  function creditosArtesEl() {
    return document.getElementById('creditos-artes-select');
  }

  function collectCalcDraft() {
    var creditosEl = creditosArtesEl();
    return {
      cliente: clienteEl ? clienteEl.value : '',
      trabalhos: trabalhosEl ? trabalhosEl.value : '',
      pessoas: pessoasEl ? pessoasEl.value : '',
      valorMin: valorMinEl ? valorMinEl.value : '',
      valorMax: valorMaxEl ? valorMaxEl.value : '',
      mensalistasQtd: mensalistasQtdEl ? mensalistasQtdEl.value : '',
      valorMensalista: valorMensEl ? valorMensEl.value : '',
      taxaPresenca: taxaEl ? taxaEl.value : '70%',
      creditosArtes: creditosEl ? creditosEl.value : '',
      planoSelecionadoId: planoSelecionadoId,
      propostaAtivaId: propostaAtivaId,
    };
  }

  function applyCalcDraft(calc) {
    if (!calc || typeof calc !== 'object') return;
    if (clienteEl && typeof calc.cliente === 'string') clienteEl.value = calc.cliente;
    if (trabalhosEl && calc.trabalhos != null && calc.trabalhos !== '') {
      trabalhosEl.value = calc.trabalhos;
    }
    if (pessoasEl && calc.pessoas != null && calc.pessoas !== '') pessoasEl.value = calc.pessoas;
    if (valorMinEl && typeof calc.valorMin === 'string') valorMinEl.value = calc.valorMin;
    if (valorMaxEl && typeof calc.valorMax === 'string') valorMaxEl.value = calc.valorMax;
    if (mensalistasQtdEl && calc.mensalistasQtd != null && calc.mensalistasQtd !== '') {
      mensalistasQtdEl.value = calc.mensalistasQtd;
    }
    if (valorMensEl && typeof calc.valorMensalista === 'string') {
      valorMensEl.value = calc.valorMensalista;
    }
    if (taxaEl && typeof calc.taxaPresenca === 'string' && calc.taxaPresenca) {
      taxaEl.value = calc.taxaPresenca;
    }
    var creditosEl = creditosArtesEl();
    if (creditosEl && typeof calc.creditosArtes === 'string') creditosEl.value = calc.creditosArtes;
    if (calc.planoSelecionadoId) planoSelecionadoId = calc.planoSelecionadoId;
    var apiPlano = sim();
    if (apiPlano && typeof apiPlano.setPlanoEscolhido === 'function') {
      apiPlano.setPlanoEscolhido(calc.planoSelecionadoId || null);
    }
    if (calc.propostaAtivaId) {
      propostaAtivaId = calc.propostaAtivaId;
      var api = sim();
      if (api && typeof api.setPropostaAtivaId === 'function') api.setPropostaAtivaId(propostaAtivaId);
    }
    refreshSim();
  }

  function applyEstadoToFields(estado) {
    if (!estado) return;
    var api = sim();
    if (api && typeof api.applyEstado === 'function') {
      api.applyEstado(estado);
      calcHydrated = true;
      return;
    }
    if (trabalhosEl) trabalhosEl.value = String(estado.trabalhos ?? '');
    if (pessoasEl) pessoasEl.value = String(estado.pessoasPorTrabalho ?? '');
    if (mensalistasQtdEl) mensalistasQtdEl.value = String(estado.mensalistas ?? '');
    if (valorMinEl) valorMinEl.value = estado.valorMinParticipante ? String(estado.valorMinParticipante) : '';
    if (valorMaxEl) valorMaxEl.value = estado.valorMaxParticipante ? String(estado.valorMaxParticipante) : '';
    if (valorMensEl) valorMensEl.value = estado.valorMensalista ? String(estado.valorMensalista) : '';
    if (taxaEl) taxaEl.value = formatPercent(estado.taxaPresencaPct == null ? 70 : estado.taxaPresencaPct);
    calcHydrated = true;
  }

  function hydrateCalcFromChipsIfEmpty() {
    if (calcHydrated) return;
    if (trabalhosEl && !trabalhosEl.value && answers.trabalhos) {
      trabalhosEl.value = String(mapTrabalhos(answers.trabalhos));
    }
    if (pessoasEl && !pessoasEl.value && answers.pessoas) {
      var nPessoas = mapPessoas(answers.pessoas);
      if (nPessoas > 0) pessoasEl.value = String(nPessoas);
    }
    if (mensalistasQtdEl && !mensalistasQtdEl.value) {
      if (answers.mensalistas === 'Sim' && answers.mensalistas_qtd) {
        mensalistasQtdEl.value = String(mapMensalistasQtd(answers.mensalistas_qtd));
      } else if (answers.mensalistas === 'Não') {
        mensalistasQtdEl.value = '0';
      }
    }
    if (taxaEl && !String(taxaEl.value || '').trim()) taxaEl.value = '70%';
    calcHydrated = true;
    refreshSim();
  }

  function resetSession() {
    if (!window.confirm('Limpar os dados preenchidos e começar uma nova apresentação?')) return;
    try {
      localStorage.removeItem(DECK_DRAFT_KEY);
    } catch (eReset) {
      /* ignore */
    }
    window.location.replace(window.location.href.split('?')[0].split('#')[0]);
  }

  function persistDraft() {
    try {
      localStorage.setItem(
        DECK_DRAFT_KEY,
        JSON.stringify({
          answers: answers,
          dor: dorEl ? dorEl.value : '',
          dorParticipante: dorParticipanteEl ? dorParticipanteEl.value : '',
          presentes: presentesEl ? presentesEl.value : '',
          contextoOutro: contextoOutroEl ? contextoOutroEl.value : '',
          calc: collectCalcDraft(),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function restoreDraft() {
    try {
      var raw = localStorage.getItem(DECK_DRAFT_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;
      if (data.answers && typeof data.answers === 'object') answers = data.answers;
      if (dorEl && typeof data.dor === 'string') dorEl.value = data.dor;
      if (dorParticipanteEl && typeof data.dorParticipante === 'string') {
        dorParticipanteEl.value = data.dorParticipante;
      }
      if (presentesEl && typeof data.presentes === 'string') presentesEl.value = data.presentes;
      if (contextoOutroEl && typeof data.contextoOutro === 'string') {
        contextoOutroEl.value = data.contextoOutro;
      }
      if (pessoasQualEl && answers.pessoas != null && answers.pessoas !== '') {
        var n = mapPessoas(answers.pessoas);
        pessoasQualEl.value = n > 0 ? String(n) : '';
      }
      if (data.calc) {
        applyCalcDraft(data.calc);
        calcHydrated = true;
      }
    } catch (e2) {
      /* ignore */
    }
  }

  function loadPropostas() {
    try {
      var raw = localStorage.getItem(PROPOSTAS_STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e3) {
      return [];
    }
  }

  function savePropostas(list) {
    localStorage.setItem(PROPOSTAS_STORAGE_KEY, JSON.stringify(list));
  }

  function loadPropostaFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('proposta');
    if (!id) return false;
    var list = loadPropostas();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) found = list[i];
    }
    if (!found) return false;

    propostaAtivaId = found.id;
    if (clienteEl) clienteEl.value = found.clientName || '';
    if (found.qualificacao && typeof found.qualificacao === 'object') {
      answers = Object.assign({}, answers, {
        trabalhos: found.qualificacao.trabalhos || answers.trabalhos,
        pessoas: found.qualificacao.pessoas || answers.pessoas,
        mensalistas: found.qualificacao.mensalistas || answers.mensalistas,
        mensalistas_qtd: found.qualificacao.mensalistas_qtd || answers.mensalistas_qtd,
        contexto: found.qualificacao.contexto || answers.contexto || [],
        dor: found.qualificacao.dor || answers.dor || '',
        dorParticipante:
          found.qualificacao.dorParticipante || answers.dorParticipante || '',
        presentes: found.qualificacao.presentes || answers.presentes || '',
        contextoOutro: found.qualificacao.contextoOutro || answers.contextoOutro || '',
      });
      if (dorEl && found.qualificacao.dor) dorEl.value = found.qualificacao.dor;
      if (dorParticipanteEl && found.qualificacao.dorParticipante) {
        dorParticipanteEl.value = found.qualificacao.dorParticipante;
      }
      if (presentesEl && found.qualificacao.presentes) {
        presentesEl.value = found.qualificacao.presentes;
      }
      if (contextoOutroEl && found.qualificacao.contextoOutro) {
        contextoOutroEl.value = found.qualificacao.contextoOutro;
      }
      if (pessoasQualEl && answers.pessoas) {
        var nQ = mapPessoas(answers.pessoas);
        pessoasQualEl.value = nQ > 0 ? String(nQ) : '';
      }
    }
    applyEstadoToFields(found.estado);
    planoSelecionadoId =
      (found.resumo && found.resumo.planoId) || found.planoSelecionadoId || null;
    var apiEscolha = sim();
    if (apiEscolha && typeof apiEscolha.setPlanoEscolhido === 'function') {
      apiEscolha.setPlanoEscolhido(planoSelecionadoId);
    }
    refreshSim();
    persistDraft();
    return true;
  }

  function validateCalc() {
    var nome = clienteEl ? clienteEl.value.trim() : '';
    if (nome.length < 2) return 'Informe o nome da casa na qualificação.';
    if (parseIntField(trabalhosEl) <= 0) return 'Informe quantos trabalhos por mês.';
    if (parseIntField(pessoasEl) <= 0) return 'Informe a média de pessoas por trabalho.';
    if (parseMoneyDigits(valorMinEl && valorMinEl.value) <= 0) {
      return 'Informe o valor mínimo por participante.';
    }
    if (parseMoneyDigits(valorMaxEl && valorMaxEl.value) <= 0) {
      return 'Informe o valor máximo por participante.';
    }
    return '';
  }

  function syncQualificacaoIntoPropostaAtiva() {
    var api = sim();
    var id = (api && api.getPropostaAtivaId && api.getPropostaAtivaId()) || propostaAtivaId;
    if (!id) return;
    var list = loadPropostas();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) idx = i;
    }
    if (idx < 0) return;
    if (dorEl) answers.dor = dorEl.value.trim();
    if (dorParticipanteEl) answers.dorParticipante = dorParticipanteEl.value.trim();
    if (presentesEl) answers.presentes = presentesEl.value.trim();
    if (contextoOutroEl) answers.contextoOutro = contextoOutroEl.value.trim();
    list[idx].qualificacao = {
      trabalhos: answers.trabalhos || null,
      pessoas: answers.pessoas || null,
      mensalistas: answers.mensalistas || null,
      mensalistas_qtd: answers.mensalistas_qtd || null,
      contexto: answers.contexto || [],
      contextoOutro: answers.contextoOutro || '',
      dor: answers.dor || '',
      dorParticipante: answers.dorParticipante || '',
      presentes: answers.presentes || '',
    };
    list[idx].origem = 'apresentacao-casas-ayahuasca';
    try {
      savePropostas(list);
      if (api && api.refreshPropostas) api.refreshPropostas();
    } catch (e) {
      /* ignore */
    }
  }

  function updateContextoOutroVisibility(shouldFocus) {
    if (!contextoOutroWrap) return;
    var show = Array.isArray(answers.contexto) && answers.contexto.indexOf('Outro') >= 0;
    if (show) {
      contextoOutroWrap.classList.add('is-visible');
      contextoOutroWrap.setAttribute('aria-hidden', 'false');
      if (shouldFocus && contextoOutroEl) {
        window.requestAnimationFrame(function () {
          try {
            contextoOutroEl.focus();
          } catch (e) {
            /* ignore */
          }
        });
      }
    } else {
      contextoOutroWrap.classList.remove('is-visible');
      contextoOutroWrap.setAttribute('aria-hidden', 'true');
      if (contextoOutroEl) contextoOutroEl.value = '';
      answers.contextoOutro = '';
    }
  }

  function formatContextoLabels() {
    var list = Array.isArray(answers.contexto) ? answers.contexto.slice() : [];
    var outroTxt = contextoOutroEl ? contextoOutroEl.value.trim() : answers.contextoOutro || '';
    return list
      .map(function (item) {
        if (item === 'Outro' && outroTxt) return 'Outro: ' + outroTxt;
        return item;
      })
      .join(', ');
  }

  function restoreChipSelections() {
    var groups = viewport.querySelectorAll('[data-qualify]');
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var key = group.getAttribute('data-qualify');
      var multi = group.getAttribute('data-multi') === 'true';
      var chips = group.querySelectorAll('.deck__chip');
      for (var c = 0; c < chips.length; c++) {
        var chip = chips[c];
        var value = chip.getAttribute('data-value');
        var selected = false;
        if (multi) {
          selected = Array.isArray(answers[key]) && answers[key].indexOf(value) >= 0;
        } else {
          selected = answers[key] === value;
        }
        chip.classList.toggle('is-selected', selected);
      }
    }
    var mensWrap = document.getElementById('mensalistas-qtd-wrap');
    if (mensWrap) {
      if (answers.mensalistas === 'Sim') {
        mensWrap.classList.add('is-visible');
        mensWrap.setAttribute('aria-hidden', 'false');
      } else {
        mensWrap.classList.remove('is-visible');
        mensWrap.setAttribute('aria-hidden', 'true');
      }
    }
    updateContextoOutroVisibility(false);
  }

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    for (var i = 0; i < total; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'deck__dot' + (i === index ? ' is-active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', 'Ir para slide ' + (i + 1));
      btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
      btn.dataset.index = String(i);
      dotsEl.appendChild(btn);
    }
  }

  function updateChrome() {
    if (progressEl) progressEl.style.width = ((index + 1) / total) * 100 + '%';
    if (counterEl) counterEl.textContent = index + 1 + ' / ' + total;
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === total - 1;
    if (resetBtn) resetBtn.hidden = index !== 0;
    var onCover = index === 0;
    if (hubBackEl) hubBackEl.hidden = !onCover;
    if (pathTagEl) pathTagEl.hidden = onCover;
    if (dotsEl) {
      var dots = dotsEl.querySelectorAll('.deck__dot');
      for (var d = 0; d < dots.length; d++) {
        var on = d === index;
        dots[d].classList.toggle('is-active', on);
        dots[d].setAttribute('aria-selected', on ? 'true' : 'false');
      }
    }
  }

  function goTo(nextIndex, direction) {
    if (nextIndex < 0 || nextIndex >= total || nextIndex === index) return;

    var current = slides[index];
    var next = slides[nextIndex];
    var dir = direction || (nextIndex > index ? 1 : -1);

    current.classList.remove('is-active');
    if (dir > 0) current.classList.add('is-exit-left');
    else current.classList.remove('is-exit-left');
    current.hidden = true;
    current.setAttribute('aria-hidden', 'true');

    next.hidden = false;
    next.classList.remove('is-exit-left');
    next.classList.add('is-active');
    next.setAttribute('aria-hidden', 'false');

    window.setTimeout(function () {
      current.classList.remove('is-exit-left');
    }, 350);

    index = nextIndex;
    updateChrome();
    if (nextIndex >= total - 2) renderSummary();
    if (nextIndex === total - 1) {
      hydrateCalcFromChipsIfEmpty();
      renderOffer();
      var api = sim();
      if (api && typeof api.syncNomeCasa === 'function') api.syncNomeCasa();
    }
  }

  function next() {
    goTo(index + 1, 1);
  }

  function prev() {
    goTo(index - 1, -1);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function chipValues(qualifyKey) {
    var group = viewport.querySelector('[data-qualify="' + qualifyKey + '"]');
    if (!group) return [];
    var chips = group.querySelectorAll('.deck__chip');
    var values = [];
    for (var i = 0; i < chips.length; i++) {
      var value = chips[i].getAttribute('data-value');
      if (value) values.push(value);
    }
    return values;
  }

  function summaryOption(value, label, selected) {
    return (
      '<option value="' +
      escapeHtml(value) +
      '"' +
      (value === selected ? ' selected' : '') +
      '>' +
      escapeHtml(label) +
      '</option>'
    );
  }

  function mensalistasSelectedValue() {
    if (answers.mensalistas === 'Não') return 'Não';
    if (answers.mensalistas !== 'Sim') return '';
    if (answers.mensalistas_qtd) return 'Sim|' + answers.mensalistas_qtd;
    return 'Sim';
  }

  function mensalistasOptionsHtml() {
    var selected = mensalistasSelectedValue();
    var html = summaryOption('', 'Selecione', selected);
    html += summaryOption('Não', 'Não', selected);
    html += summaryOption('Sim', 'Sim', selected);
    var qtys = chipValues('mensalistas_qtd');
    for (var i = 0; i < qtys.length; i++) {
      html += summaryOption('Sim|' + qtys[i], 'Sim · ' + qtys[i], selected);
    }
    return html;
  }

  function summaryControl(key, kind, value, extra) {
    var attrs = ' class="deck__summary-input" data-summary="' + key + '" autocomplete="off"';
    if (kind === 'select') return '<select' + attrs + '>' + extra.options + '</select>';
    if (kind === 'textarea') {
      return (
        '<textarea' +
        attrs +
        ' rows="2" maxlength="' +
        extra.max +
        '"' +
        (extra.placeholder ? ' placeholder="' + escapeHtml(extra.placeholder) + '"' : '') +
        '>' +
        escapeHtml(value) +
        '</textarea>'
      );
    }
    return (
      '<input' +
      attrs +
      ' type="text" maxlength="' +
      extra.max +
      '" value="' +
      escapeHtml(value) +
      '"' +
      (extra.placeholder ? ' placeholder="' + escapeHtml(extra.placeholder) + '"' : '') +
      (extra.inputmode ? ' inputmode="' + extra.inputmode + '"' : '') +
      ' />'
    );
  }

  function summaryField(label, key, kind, value, wide, extra) {
    return (
      '<label class="deck__summary-item' +
      (wide ? ' deck__summary-item--wide' : '') +
      '"><span class="deck__summary-item-label">' +
      escapeHtml(label) +
      '</span>' +
      summaryControl(key, kind, value, extra || {}) +
      '</label>'
    );
  }

  function summaryFilledCount() {
    var count = 0;
    if (clienteEl && clienteEl.value.trim()) count += 1;
    if (presentesEl && presentesEl.value.trim()) count += 1;
    if (answers.trabalhos) count += 1;
    if (answers.pessoas) count += 1;
    if (answers.mensalistas === 'Sim' || answers.mensalistas === 'Não') count += 1;
    if (answers.contexto && answers.contexto.length) count += 1;
    if (dorEl && dorEl.value.trim()) count += 1;
    if (dorParticipanteEl && dorParticipanteEl.value.trim()) count += 1;
    return count;
  }

  function updateSummaryCount() {
    if (!summaryCountEl) return;
    var count = summaryFilledCount();
    summaryCountEl.hidden = count === 0;
    summaryCountEl.textContent = count ? String(count) : '';
  }

  function renderSummary() {
    if (!summaryEl) return;
    if (summaryEl.contains(document.activeElement)) {
      updateSummaryCount();
      return;
    }

    var nomeCasa = clienteEl ? clienteEl.value : '';
    var presentes = presentesEl ? presentesEl.value : '';
    var dor = dorEl ? dorEl.value : '';
    var dorPart = dorParticipanteEl ? dorParticipanteEl.value : '';
    var pessoas = answers.pessoas != null && answers.pessoas !== '' ? String(answers.pessoas) : '';

    var html =
      '<div class="deck__summary-row deck__summary-row--2 deck__summary-item--wide">' +
      summaryField('Nome da casa', 'nome', 'text', nomeCasa, false, {
        max: 120,
        placeholder: 'Ex.: Casa Aurora',
      }) +
      summaryField('Presentes', 'presentes', 'text', presentes, false, {
        max: 800,
        placeholder: 'Quem está na conversa',
      }) +
      '</div>' +
      '<div class="deck__summary-row deck__summary-row--3 deck__summary-item--wide">' +
      summaryField('Trabalhos / mês', 'trabalhos', 'text', answers.trabalhos || '', false, {
        max: 8,
        placeholder: 'Ex.: 2',
        inputmode: 'numeric',
      }) +
      summaryField('Pessoas / trabalho', 'pessoas', 'text', pessoas, false, {
        max: 6,
        placeholder: 'Ex.: 40',
        inputmode: 'numeric',
      }) +
      summaryField('Mensalistas', 'mensalistas', 'select', '', false, {
        options: mensalistasOptionsHtml(),
      }) +
      '</div>' +
      summaryField('Hoje usam', 'contexto', 'text', formatContextoLabels(), true, {
        max: 240,
        placeholder: 'Ex.: WhatsApp, Planilha',
      }) +
      '<div class="deck__summary-row deck__summary-row--2 deck__summary-item--wide">' +
      summaryField('Dificuldade da casa', 'dor', 'textarea', dor, false, {
        max: 400,
        placeholder: 'Ex.: pagar as contas',
      }) +
      summaryField('Dificuldade do participante', 'dorPart', 'textarea', dorPart, false, {
        max: 400,
        placeholder: 'Ex.: inscrição',
      }) +
      '</div>';

    summaryEl.innerHTML = html;
    updateSummaryCount();
  }

  function applyMensalistasFromSummary(raw) {
    var value = String(raw || '');
    if (value === 'Não') {
      answers.mensalistas = 'Não';
      delete answers.mensalistas_qtd;
      if (mensalistasQtdEl) mensalistasQtdEl.value = '0';
    } else if (value === 'Sim') {
      answers.mensalistas = 'Sim';
      delete answers.mensalistas_qtd;
      if (mensalistasQtdEl) mensalistasQtdEl.value = '';
    } else if (value.indexOf('Sim|') === 0) {
      answers.mensalistas = 'Sim';
      answers.mensalistas_qtd = value.slice(4);
      if (mensalistasQtdEl) {
        mensalistasQtdEl.value = String(mapMensalistasQtd(answers.mensalistas_qtd));
      }
    } else {
      delete answers.mensalistas;
      delete answers.mensalistas_qtd;
      if (mensalistasQtdEl) mensalistasQtdEl.value = '';
    }
    restoreChipSelections();
    refreshSim();
    persistDraft();
  }

  function applyTrabalhosFromSummary(raw) {
    var value = String(raw || '').trim();
    if (value) answers.trabalhos = value;
    else delete answers.trabalhos;
    if (trabalhosEl) {
      var mapped = value ? mapTrabalhos(value) : 0;
      trabalhosEl.value = mapped > 0 ? String(mapped) : '';
    }
    restoreChipSelections();
    refreshSim();
    persistDraft();
  }

  function applyPessoasFromSummary(raw) {
    var value = String(raw || '').trim();
    if (!value) {
      delete answers.pessoas;
      if (pessoasQualEl) pessoasQualEl.value = '';
      if (pessoasEl) pessoasEl.value = '';
      refreshSim();
      persistDraft();
      return;
    }
    answers.pessoas = value;
    var n = mapPessoas(value);
    if (pessoasQualEl) pessoasQualEl.value = n > 0 ? String(n) : '';
    if (pessoasEl) pessoasEl.value = n > 0 ? String(n) : '';
    refreshSim();
    persistDraft();
  }

  function knownContextoToken(part) {
    var tools = chipValues('contexto');
    for (var i = 0; i < tools.length; i++) {
      if (tools[i].toLowerCase() === part.toLowerCase()) return tools[i];
    }
    return '';
  }

  function parseContextoSummary(raw, commit) {
    var text = String(raw || '');
    var parts = text.split(',');
    if (!commit && parts.length && text.trim().slice(-1) !== ',') {
      var tail = parts[parts.length - 1].trim();
      var finishedOutro = /^outro\s*:\s*\S/i.test(tail);
      if (tail && !knownContextoToken(tail) && !finishedOutro) parts.pop();
    }
    var list = [];
    var outros = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;
      var known = knownContextoToken(part);
      if (known && known !== 'Outro') {
        if (list.indexOf(known) < 0) list.push(known);
        continue;
      }
      var outroPrefix = part.match(/^outro\s*:\s*(.*)$/i);
      if (list.indexOf('Outro') < 0) list.push('Outro');
      if (outroPrefix && outroPrefix[1].trim()) outros.push(outroPrefix[1].trim());
      else if (part.toLowerCase() !== 'outro') outros.push(part);
    }
    return { list: list, outro: outros.join(', ') };
  }

  function applyContextoFromSummary(raw, commit) {
    var parsed = parseContextoSummary(raw, commit);
    answers.contexto = parsed.list;
    answers.contextoOutro = parsed.outro;
    if (contextoOutroEl) contextoOutroEl.value = parsed.outro;
    restoreChipSelections();
  }

  function applySummaryValue(key, raw, commit) {
    if (key === 'nome' && clienteEl) {
      clienteEl.value = String(raw || '');
      var api = sim();
      if (api && typeof api.syncNomeCasa === 'function') api.syncNomeCasa();
    } else if (key === 'presentes') {
      if (presentesEl) presentesEl.value = String(raw || '');
      answers.presentes = String(raw || '').trim();
    } else if (key === 'trabalhos') {
      applyTrabalhosFromSummary(raw);
    } else if (key === 'pessoas') {
      applyPessoasFromSummary(raw);
    } else if (key === 'mensalistas') {
      applyMensalistasFromSummary(raw);
    } else if (key === 'contexto') {
      applyContextoFromSummary(raw, commit);
    } else if (key === 'dor') {
      if (dorEl) dorEl.value = String(raw || '');
      answers.dor = String(raw || '').trim();
    } else if (key === 'dorPart') {
      if (dorParticipanteEl) dorParticipanteEl.value = String(raw || '');
      answers.dorParticipante = String(raw || '').trim();
    }
    updateSummaryCount();
    persistDraft();
  }

  function wireSummaryEdits() {
    if (!summaryEl || summaryEl.getAttribute('data-wired') === 'true') return;
    summaryEl.setAttribute('data-wired', 'true');
    summaryEl.addEventListener('input', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      var key = el.getAttribute('data-summary');
      if (!key) return;
      applySummaryValue(key, el.value, false);
    });
    summaryEl.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.getAttribute('data-summary') !== 'mensalistas') return;
      applySummaryValue('mensalistas', el.value, true);
    });
    summaryEl.addEventListener('focusout', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.getAttribute('data-summary') !== 'contexto') return;
      applySummaryValue('contexto', el.value, true);
      var canonical = formatContextoLabels();
      if (el.value !== canonical) el.value = canonical;
    });
  }

  function setSingleAnswer(key, value, chipEl, group) {
    answers[key] = value;
    var chips = group.querySelectorAll('.deck__chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('is-selected', chips[i] === chipEl);
    }
    calcHydrated = false;
    renderSummary();
    persistDraft();
  }

  function toggleMultiAnswer(key, value, chipEl) {
    if (!answers[key]) answers[key] = [];
    var list = answers[key];
    var pos = list.indexOf(value);
    if (pos >= 0) {
      list.splice(pos, 1);
      chipEl.classList.remove('is-selected');
    } else {
      list.push(value);
      chipEl.classList.add('is-selected');
    }
    if (key === 'contexto' && value === 'Outro') updateContextoOutroVisibility(true);
    renderSummary();
    persistDraft();
  }

  function wireQualify() {
    var groups = viewport.querySelectorAll('[data-qualify]');
    for (var g = 0; g < groups.length; g++) {
      (function (group) {
        var key = group.getAttribute('data-qualify');
        var multi = group.getAttribute('data-multi') === 'true';
        group.addEventListener('click', function (e) {
          var chip = e.target.closest('.deck__chip');
          if (!chip || !group.contains(chip)) return;
          var value = chip.getAttribute('data-value');
          if (!value) return;

          if (multi) {
            toggleMultiAnswer(key, value, chip);
            return;
          }

          setSingleAnswer(key, value, chip, group);
          if (key === 'trabalhos') applyTrabalhosFromSummary(value);
          if (key === 'mensalistas' || key === 'mensalistas_qtd') {
            applyMensalistasFromSummary(mensalistasSelectedValue());
          }

          var revealId = chip.getAttribute('data-reveal');
          var hideId = chip.getAttribute('data-hide');
          if (revealId) {
            var reveal = document.getElementById(revealId);
            if (reveal) {
              reveal.classList.add('is-visible');
              reveal.setAttribute('aria-hidden', 'false');
            }
          }
          if (hideId) {
            var hide = document.getElementById(hideId);
            if (hide) {
              hide.classList.remove('is-visible');
              hide.setAttribute('aria-hidden', 'true');
              var subChips = hide.querySelectorAll('.deck__chip');
              for (var s = 0; s < subChips.length; s++) {
                subChips[s].classList.remove('is-selected');
              }
              delete answers.mensalistas_qtd;
              calcHydrated = false;
              renderSummary();
              persistDraft();
            }
          }
        });
      })(groups[g]);
    }
  }

  function wireFields() {
    function onQualField() {
      if (dorEl) answers.dor = dorEl.value.trim();
      if (dorParticipanteEl) answers.dorParticipante = dorParticipanteEl.value.trim();
      if (presentesEl) answers.presentes = presentesEl.value.trim();
      if (contextoOutroEl) answers.contextoOutro = contextoOutroEl.value.trim();
      if (pessoasQualEl) {
        applyPessoasFromSummary(String(pessoasQualEl.value || '').trim());
        calcHydrated = false;
      }
      renderSummary();
      persistDraft();
      var api = sim();
      if (api && typeof api.syncNomeCasa === 'function') api.syncNomeCasa();
    }

    function onCalcField() {
      persistDraft();
    }

    if (dorEl) dorEl.addEventListener('input', onQualField);
    if (dorParticipanteEl) dorParticipanteEl.addEventListener('input', onQualField);
    if (presentesEl) presentesEl.addEventListener('input', onQualField);
    if (contextoOutroEl) contextoOutroEl.addEventListener('input', onQualField);
    if (clienteEl) clienteEl.addEventListener('input', onQualField);
    if (pessoasQualEl) pessoasQualEl.addEventListener('input', onQualField);

    [trabalhosEl, pessoasEl, valorMinEl, valorMaxEl, mensalistasQtdEl, valorMensEl, taxaEl].forEach(
      function (el) {
        if (el) el.addEventListener('input', onCalcField);
      }
    );
    var creditosEl = creditosArtesEl();
    if (creditosEl) creditosEl.addEventListener('change', onCalcField);

    document.addEventListener('aya:proposta-salva', function () {
      var api = sim();
      if (api && api.getPropostaAtivaId) propostaAtivaId = api.getPropostaAtivaId();
      persistDraft();
    });

    document.addEventListener('aya:plano-selecionado', function (ev) {
      if (!ev || !ev.detail) return;
      planoSelecionadoId = ev.detail.planId || null;
      persistDraft();
      if (planoSelecionadoId) syncQualificacaoIntoPropostaAtiva();
    });

    var btnSalvar = document.getElementById('btn-salvar-proposta');
    if (btnSalvar) {
      window.ayaDeckCanSalvarProposta = function () {
        if (errorEl) {
          errorEl.hidden = true;
          errorEl.textContent = '';
        }
        var err = validateCalc();
        if (err) {
          if (errorEl) {
            errorEl.textContent = err;
            errorEl.hidden = false;
          }
          return false;
        }
        return true;
      };
    }

    var btnConfirmar = document.getElementById('btn-confirmar-salvar');
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', function () {
        window.setTimeout(function () {
          var api = sim();
          if (api && api.getPropostaAtivaId) propostaAtivaId = api.getPropostaAtivaId();
          syncQualificacaoIntoPropostaAtiva();
          persistDraft();
        }, 50);
      });
    }
  }

  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) return true;
    if (tag === 'summary' || (el.closest && el.closest('summary'))) return true;
    return false;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (deck.requestFullscreen) deck.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  /* Init */
  restoreDraft();
  var fromSimulador = loadPropostaFromUrl();

  for (var i = 0; i < slides.length; i++) {
    if (i === 0) {
      slides[i].hidden = false;
      slides[i].classList.add('is-active');
      slides[i].setAttribute('aria-hidden', 'false');
    } else {
      slides[i].hidden = true;
      slides[i].classList.remove('is-active');
      slides[i].setAttribute('aria-hidden', 'true');
    }
  }

  buildDots();
  updateChrome();
  wireQualify();
  restoreChipSelections();
  wireFields();
  wireSummaryEdits();
  renderSummary();
  renderOffer();

  if (fromSimulador) {
    goTo(total - 1);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      resetSession();
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);

  if (dotsEl) {
    dotsEl.addEventListener('click', function (e) {
      var dot = e.target.closest('.deck__dot');
      if (!dot) return;
      var n = parseInt(dot.dataset.index, 10);
      if (!isNaN(n)) goTo(n);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (isTypingTarget(e.target)) return;
    if (e.target && e.target.closest && e.target.closest('#deck-reset')) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(total - 1);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  var touchStartX = null;
  viewport.addEventListener(
    'touchstart',
    function (e) {
      if (e.changedTouches && e.changedTouches[0]) {
        touchStartX = e.changedTouches[0].clientX;
      }
    },
    { passive: true }
  );
  viewport.addEventListener(
    'touchend',
    function (e) {
      if (touchStartX == null || !e.changedTouches || !e.changedTouches[0]) return;
      if (isTypingTarget(e.target)) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) next();
      else prev();
    },
    { passive: true }
  );
})();
