(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('');

  if (window.api.isLoggedIn()) {
    const primary = document.getElementById('cta-primary');
    if (primary) { primary.textContent = 'Go to your projects'; primary.href = '/dashboard.html'; }
    document.getElementById('cta-secondary')?.remove();
    document.querySelector('.lp-note')?.remove();
    const panel = document.getElementById('cta-panel');
    if (panel) { panel.textContent = 'Go to your projects'; panel.href = '/dashboard.html'; }
  }

  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); o.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((e) => obs.observe(e));
})();
