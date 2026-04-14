(function () {
  'use strict';

  var root = document.documentElement;
  var wa = (root.getAttribute('data-sales-whatsapp') || '').replace(/\D/g, '');
  var msg = root.getAttribute('data-sales-message') || '';
  var email = (root.getAttribute('data-sales-email') || '').trim();

  function buildWhatsAppHref() {
    if (wa.length < 10) {
      return '';
    }
    var text = msg || 'Olá! Tenho interesse em agendar uma demonstração.';
    return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
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
})();
