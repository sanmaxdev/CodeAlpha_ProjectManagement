(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('');

  document.getElementById('eyebrow').innerHTML = U.icon('sparkle', 15) + ' Real-time project management';

  if (window.api.isLoggedIn()) {
    const primary = document.getElementById('cta-primary');
    primary.textContent = 'Go to your projects';
    primary.href = '/dashboard.html';
    document.getElementById('cta-secondary').remove();
    document.querySelector('.hero-note').remove();
  }

  const FEATURES = [
    ['board', 'Boards & cards', 'Organize work into columns and drag cards across them as they move from idea to done.'],
    ['users', 'Group projects', 'Invite your team into shared projects with owner and member roles, so everyone has the right access.'],
    ['user', 'Task assignments', 'Give every card an owner, a priority, a due date, and labels — so nothing slips through.'],
    ['comment', 'In-task discussion', 'Keep the conversation next to the work with threaded comments and @mentions.'],
    ['bell', 'Smart notifications', 'Get notified the moment you are assigned, mentioned, or added to a project.'],
    ['sparkle', 'Live collaboration', 'Powered by WebSockets — every move, comment, and edit appears for your teammates instantly.'],
  ];
  document.getElementById('feature-grid').innerHTML = FEATURES.map(
    ([ic, title, body], i) => `<div class="feature reveal" style="transition-delay:${(i % 3) * 0.06}s">
      <div class="fi">${U.icon(ic, 22)}</div>
      <h3>${title}</h3>
      <p>${body}</p>
    </div>`
  ).join('');

  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); o.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((e) => obs.observe(e));
})();
