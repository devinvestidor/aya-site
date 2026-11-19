(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var links = document.querySelectorAll('.hub-path');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function (e) {
      var link = e.currentTarget;
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (link.classList.contains('is-clicking')) return;
      e.preventDefault();
      link.classList.add('is-clicking');
      var href = link.href;
      window.setTimeout(function () {
        window.location.href = href;
      }, 220);
    });
  }
})();
