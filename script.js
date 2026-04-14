(function () {
  'use strict';

  /**
   * Limpa texto antes de encodeURIComponent (uma vez) na URL do WhatsApp:
   * remove U+FFFD, zero-width, normaliza traços “inteligentes” para '-', NFC, emojis.
   */
  function sanitizeWhatsAppMessageBody(s) {
    var t = String(s || '');
    t = t.replace(/\uFFFD/g, '');
    t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
    try {
      t = t.normalize('NFC');
    } catch (e0) {
      /* ignore */
    }
    t = t
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '-')
      .replace(/\u2212/g, '-')
      .replace(/\u00A0/g, ' ');
    try {
      t = t.replace(/\p{Extended_Pictographic}/gu, '');
    } catch (e1) {
      /* \p não suportado em runtimes muito antigos */
    }
    return t;
  }

  var root = document.documentElement;
  var wa = (root.getAttribute('data-sales-whatsapp') || '').replace(/\D/g, '');
  var msg = root.getAttribute('data-sales-message') || '';
  var email = (root.getAttribute('data-sales-email') || '').trim();

  function buildWhatsAppHref(customText) {
    if (wa.length < 10) {
      return '';
    }
    var raw =
      typeof customText === 'string' && customText.trim()
        ? customText.trim()
        : msg || 'Olá! Tenho interesse em agendar uma demonstração.';
    var text = sanitizeWhatsAppMessageBody(raw);
    return 'https://api.whatsapp.com/send?phone=' + wa + '&text=' + encodeURIComponent(text);
  }

  function wireSalesContacts() {
    var href = buildWhatsAppHref();
    var nodes = document.querySelectorAll('a[data-sales-contact]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (href) {
        el.setAttribute('href', href);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      } else if (email) {
        el.setAttribute('href', 'mailto:' + email + '?subject=' + encodeURIComponent('Demonstração comercial'));
        el.removeAttribute('target');
      } else {
        el.setAttribute('href', '#contato');
        el.removeAttribute('target');
      }
    }
  }

  function smoothScrollToHash(hash) {
    if (!hash || hash === '#') {
      return;
    }
    var id = hash.replace(/^#/, '');
    var el = document.getElementById(id);
    if (!el) {
      return;
    }
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') {
      return;
    }
    var href = a.getAttribute('href');
    if (href.length > 1 && href.startsWith('#') && document.getElementById(href.slice(1))) {
      e.preventDefault();
      smoothScrollToHash(href);
      if (history.replaceState) {
        history.replaceState(null, '', href);
      }
    }
  });

  wireSalesContacts();

  /* —— Lead capture → WhatsApp —— */
  var TOTAL_STEPS = 5;

  /** SVG inline (mesmo path dos CTAs da landing) para o botão “Enviar no WhatsApp” no modal */
  var LEAD_MODAL_WA_ICON_SVG =
    '<svg class="lead-demo__btn-wa-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  function digitsOnly(s) {
    return String(s || '').replace(/\D/g, '');
  }

  /** Máscara nacional: (DD) NNNNN-NNNN ou (DD) NNNN-NNNN */
  function formatNationalBRDigits(d) {
    d = digitsOnly(d).slice(0, 11);
    if (!d.length) {
      return '';
    }
    if (d.length <= 2) {
      return '(' + d;
    }
    var ddd = d.slice(0, 2);
    var rest = d.slice(2);
    if (!rest.length) {
      return '(' + ddd + ') ';
    }
    if (d.length <= 6) {
      return '(' + ddd + ') ' + rest;
    }
    if (d.length <= 10) {
      return '(' + ddd + ') ' + rest.slice(0, 4) + '-' + rest.slice(4);
    }
    return '(' + ddd + ') ' + rest.slice(0, 5) + '-' + rest.slice(5);
  }

  /** +55 opcional; até 13 dígitos com código do país */
  function formatWhatsAppFieldValue(raw) {
    var d = digitsOnly(raw);
    if (d.startsWith('55')) {
      d = d.slice(0, 13);
      var nat = d.slice(2);
      var tail = formatNationalBRDigits(nat);
      return tail ? '+55 ' + tail : '+55';
    }
    return formatNationalBRDigits(d);
  }

  function normalizePhoneDigits(raw) {
    var d = digitsOnly(raw);
    if (d.startsWith('55')) {
      return d.slice(0, 13);
    }
    return d.slice(0, 11);
  }

  function isValidBrazilWhatsAppDigits(d) {
    var n = d;
    if (n.startsWith('55')) {
      n = n.slice(2);
    }
    return n.length >= 10 && n.length <= 11;
  }

  function getContextoList(fd) {
    if (typeof fd.getAll === 'function') {
      return fd.getAll('contexto').filter(function (v) {
        return v && String(v).length;
      });
    }
    var one = fd.get('contexto');
    return one ? [one] : [];
  }

  function buildLeadMessage(fd) {
    var nome = (fd.get('nome') || '').trim();
    var whats = formatWhatsAppFieldValue(fd.get('whatsapp') || '');
    var trabalhos = fd.get('trabalhos') || '';
    var pessoas = fd.get('pessoas') || '';
    var mensalistas = fd.get('mensalistas') || '';
    var mensQtd = fd.get('mensalistas_qtd') || '';
    var contextos = getContextoList(fd);
    var valorParticipante = (fd.get('valor_participante') || '').trim();
    var valorMensalista = (fd.get('valor_mensalista') || '').trim();

    var lines = [
      '*Demonstração - lead (site)*',
      '',
      '*Nome:* ' + nome,
      '*WhatsApp:* ' + whats,
      '',
      '*Trabalhos/mês:* ' + trabalhos,
      '*Pessoas por trabalho:* ' + pessoas,
      ''
    ];
    if (mensalistas === 'Sim') {
      lines.push('*Mensalistas:* Sim - ' + mensQtd);
    } else {
      lines.push('*Mensalistas:* Não');
    }
    lines.push('', '*Hoje vocês usam:* ' + contextos.join(', '));
    lines.push('', '*Valor médio por participante:* ' + (valorParticipante || 'Não informado'));
    if (mensalistas === 'Sim') {
      lines.push('*Mensalistas (contribuição):* ' + (valorMensalista || 'Não informado'));
    }
    return lines.join('\n');
  }

  function initLeadDemoModal() {
    var dialog = document.getElementById('lead-demo-dialog');
    var form = document.getElementById('lead-demo-form');
    if (!dialog || !form) {
      return;
    }

    var stepLabel = document.getElementById('lead-demo-step-label');
    var dotsEl = document.getElementById('lead-demo-dots');
    var errEl = document.getElementById('lead-demo-error');
    var btnBack = document.getElementById('lead-demo-back');
    var btnNext = document.getElementById('lead-demo-next');
    var btnClose = document.getElementById('lead-demo-close');
    var mensalistasQtyWrap = document.getElementById('lead-mensalistas-qtd-wrap');
    var waInput = document.getElementById('lead-whatsapp');
    var currentStep = 1;
    var panels = form.querySelectorAll('.lead-demo__panel');

    if (waInput) {
      waInput.addEventListener('input', function () {
        var formatted = formatWhatsAppFieldValue(waInput.value);
        if (waInput.value !== formatted) {
          waInput.value = formatted;
        }
        var end = waInput.value.length;
        try {
          waInput.setSelectionRange(end, end);
        } catch (e2) {
          /* ignore */
        }
      });
      waInput.addEventListener('blur', function () {
        waInput.value = formatWhatsAppFieldValue(waInput.value).trim();
      });
    }

    function setDots() {
      if (!dotsEl) {
        return;
      }
      dotsEl.innerHTML = '';
      for (var i = 1; i <= TOTAL_STEPS; i++) {
        var dot = document.createElement('span');
        dot.className = 'lead-demo__dot' + (i === currentStep ? ' is-active' : '');
        dotsEl.appendChild(dot);
      }
    }

    function showError(text) {
      if (!errEl) {
        return;
      }
      if (text) {
        errEl.textContent = text;
        errEl.hidden = false;
      } else {
        errEl.textContent = '';
        errEl.hidden = true;
      }
    }

    function updateMensalistasQtyVisibility() {
      var sim = form.querySelector('input[name="mensalistas"][value="Sim"]');
      var showQty = sim && sim.checked;
      if (mensalistasQtyWrap) {
        if (showQty) {
          mensalistasQtyWrap.classList.add('is-visible');
          mensalistasQtyWrap.setAttribute('aria-hidden', 'false');
          mensalistasQtyWrap.removeAttribute('inert');
        } else {
          mensalistasQtyWrap.classList.remove('is-visible');
          mensalistasQtyWrap.setAttribute('aria-hidden', 'true');
          mensalistasQtyWrap.setAttribute('inert', '');
          var rq = form.querySelectorAll('input[name="mensalistas_qtd"]');
          for (var i = 0; i < rq.length; i++) {
            rq[i].checked = false;
          }
        }
      }
      updateValorMensalistaPricingWrap();
    }

    function updateValorMensalistaPricingWrap() {
      var wrap = document.getElementById('lead-valor-mensalista-wrap');
      var sel = document.getElementById('lead-valor-mensalista');
      if (!wrap || !sel) {
        return;
      }
      var sim = form.querySelector('input[name="mensalistas"][value="Sim"]');
      var show = sim && sim.checked;
      if (show) {
        wrap.classList.remove('is-hidden');
        wrap.setAttribute('aria-hidden', 'false');
        wrap.removeAttribute('inert');
      } else {
        wrap.classList.add('is-hidden');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.setAttribute('inert', '');
        sel.value = '';
      }
    }

    function setStep(step) {
      currentStep = Math.max(1, Math.min(TOTAL_STEPS, step));
      for (var i = 0; i < panels.length; i++) {
        var p = panels[i];
        var n = parseInt(p.getAttribute('data-step'), 10);
        p.classList.toggle('is-active', n === currentStep);
      }
      if (stepLabel) {
        stepLabel.textContent = 'Passo ' + currentStep + ' de ' + TOTAL_STEPS;
      }
      setDots();
      if (btnBack) {
        btnBack.hidden = currentStep === 1;
      }
      if (btnNext) {
        if (currentStep === TOTAL_STEPS) {
          btnNext.innerHTML = LEAD_MODAL_WA_ICON_SVG + '<span>Enviar no WhatsApp</span>';
        } else {
          btnNext.textContent = 'Continuar';
        }
      }
      showError('');
      updateMensalistasQtyVisibility();

      var panel = form.querySelector('.lead-demo__panel[data-step="' + currentStep + '"]');
      var focusEl = panel && panel.querySelector('input, button, select, textarea');
      if (focusEl && dialog.open) {
        window.requestAnimationFrame(function () {
          try {
            focusEl.focus();
          } catch (e2) {
            /* ignore */
          }
        });
      }
    }

    function resetLeadForm() {
      form.reset();
      updateMensalistasQtyVisibility();
      setStep(1);
      showError('');
    }

    function validateStep(step) {
      var fd = new FormData(form);

      if (step === 1) {
        var nome = (fd.get('nome') || '').trim();
        if (nome.length < 2) {
          showError('Informe seu nome.');
          return false;
        }
        var w = normalizePhoneDigits(fd.get('whatsapp'));
        if (!isValidBrazilWhatsAppDigits(w)) {
          showError('Informe um WhatsApp válido (DDD + número, com ou sem +55).');
          return false;
        }
        return true;
      }

      if (step === 2) {
        if (!fd.get('trabalhos')) {
          showError('Selecione quantos trabalhos por mês.');
          return false;
        }
        if (!fd.get('pessoas')) {
          showError('Selecione pessoas por trabalho.');
          return false;
        }
        return true;
      }

      if (step === 3) {
        if (!fd.get('mensalistas')) {
          showError('Indique se vocês possuem participantes mensalistas.');
          return false;
        }
        if (fd.get('mensalistas') === 'Sim' && !fd.get('mensalistas_qtd')) {
          showError('Selecione a faixa de mensalistas.');
          return false;
        }
        return true;
      }

      if (step === 4) {
        if (getContextoList(fd).length === 0) {
          showError('Selecione como vocês organizam hoje (uma ou mais opções).');
          return false;
        }
        return true;
      }

      return true;
    }

    function openLeadModal() {
      if (typeof dialog.showModal === 'function') {
        form.reset();
        updateMensalistasQtyVisibility();
        showError('');
        dialog.showModal();
        setStep(1);
      } else {
        var href = buildWhatsAppHref();
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    }

    function closeLeadModal() {
      if (typeof dialog.close === 'function') {
        dialog.close();
      }
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-lead-demo]')) {
        e.preventDefault();
        openLeadModal();
      }
    });

    if (btnClose) {
      btnClose.addEventListener('click', closeLeadModal);
    }

    dialog.addEventListener('close', function () {
      resetLeadForm();
    });

    form.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'mensalistas') {
        updateMensalistasQtyVisibility();
        showError('');
      }
    });

    if (btnBack) {
      btnBack.addEventListener('click', function () {
        if (currentStep > 1) {
          setStep(currentStep - 1);
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', function () {
        if (!validateStep(currentStep)) {
          return;
        }
        if (currentStep < TOTAL_STEPS) {
          setStep(currentStep + 1);
          return;
        }

        var fd = new FormData(form);
        var text = buildLeadMessage(fd);
        var href = buildWhatsAppHref(text);
        if (!href) {
          showError('WhatsApp de contato não configurado. Tente mais tarde.');
          return;
        }
        closeLeadModal();
        window.open(href, '_blank', 'noopener,noreferrer');
      });
    }
  }

  initLeadDemoModal();
})();
