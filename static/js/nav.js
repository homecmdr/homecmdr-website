/* nav.js — Mobile navigation toggle */
(function () {
  'use strict';

  var toggle = document.getElementById('nav-toggle');
  var drawer = document.getElementById('mobile-nav');

  if (!toggle || !drawer) return;

  toggle.addEventListener('click', function () {
    var isOpen = drawer.classList.contains('is-open');
    drawer.classList.toggle('is-open', !isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // Close drawer when a link inside it is clicked
  drawer.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();
