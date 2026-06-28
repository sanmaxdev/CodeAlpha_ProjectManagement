(function () {
  'use strict';

  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function avatarHtml(user, size = 36) {
    const s = `width:${size}px;height:${size}px`;
    if (user && user.avatar) {
      return `<span class="avatar" style="${s}"><img src="${esc(user.avatar)}" alt="${esc(user.name)}" loading="lazy" /></span>`;
    }
    const hue = (String(user && user.username || '?').charCodeAt(0) * 47) % 360;
    return `<span class="avatar avatar-initials" style="${s};font-size:${Math.round(size / 2.6)}px;--ah:${hue}">${esc(initials(user && user.name))}</span>`;
  }

  const ICONS = {
    logo: '<path d="M4 14a8 8 0 0 1 8-8" /><path d="M20 10a8 8 0 0 1-8 8" /><circle cx="12" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1.6" fill="currentColor" stroke="none"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
    comment: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/>',
    flag: '<path d="M5 21V4M5 4h11l-1.5 4L16 12H5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M22 20a6.5 6.5 0 0 0-5-6.3"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5M15 12H3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 14H3.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 7.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.6V3.5a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.4 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.4 10H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    board: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
    sparkle: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z"/>',
  };

  function icon(name, size = 20, extra = '') {
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name] || ''}</svg>`;
  }

  const PROJECT_COLORS = ['iris', 'emerald', 'amber', 'rose', 'sky'];
  const PRIORITY = {
    low: { label: 'Low', class: 'pr-low' },
    medium: { label: 'Medium', class: 'pr-medium' },
    high: { label: 'High', class: 'pr-high' },
    urgent: { label: 'Urgent', class: 'pr-urgent' },
  };
  const LABEL_HUES = [262, 158, 32, 338, 205, 12, 280, 190];
  function labelHue(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 7)) % LABEL_HUES.length;
    return LABEL_HUES[h];
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const then = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).getTime();
    const s = Math.floor((Date.now() - then) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function dueInfo(dateStr) {
    if (!dateStr) return null;
    const due = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    let cls = 'due';
    let label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (days < 0) { cls = 'due overdue'; label = Math.abs(days) === 1 ? '1d overdue' : Math.abs(days) + 'd overdue'; }
    else if (days === 0) { cls = 'due soon'; label = 'Due today'; }
    else if (days <= 2) { cls = 'due soon'; }
    return { cls, label, days };
  }

  let toastTimer = null;
  function toast(message, type = 'info') {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.className = 'toast ' + type;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('cadence_theme', theme); } catch (e) {}
    document.querySelectorAll('.js-theme .ic').forEach((el) => el.remove());
    document.querySelectorAll('.js-theme').forEach((btn) => {
      btn.insertAdjacentHTML('afterbegin', icon(theme === 'dark' ? 'sun' : 'moon', 18));
    });
  }
  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  function renderHeader(active) {
    const me = window.api.getUser();
    const header = document.querySelector('[data-header]');
    if (!header) return;
    const right = window.api.isLoggedIn()
      ? `<button class="icon-btn js-theme" title="Theme" aria-label="Toggle theme"></button>
         <a class="icon-btn notif-link ${active === 'notifications' ? 'active' : ''}" href="/notifications.html" title="Notifications" aria-label="Notifications">
           ${icon('bell', 21)}<span class="nbadge" id="notif-badge" hidden></span>
         </a>
         <div class="acct">
           <button class="acct-btn" aria-label="Account">${avatarHtml(me, 32)}</button>
           <div class="acct-menu" hidden>
             <div class="acct-head">${avatarHtml(me, 40)}<div><div class="an">${esc(me && me.name)}</div><div class="at">${esc(me && me.title || '@' + (me && me.username))}</div></div></div>
             <a href="/dashboard.html">${icon('board', 18)} Projects</a>
             <a href="/settings.html">${icon('settings', 18)} Settings</a>
             <button class="js-logout">${icon('logout', 18)} Log out</button>
           </div>
         </div>`
      : `<button class="icon-btn js-theme" title="Theme" aria-label="Toggle theme"></button>
         <a class="btn btn-ghost" href="/login.html">Log in</a>
         <a class="btn btn-primary" href="/register.html">Get started</a>`;

    header.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="${window.api.isLoggedIn() ? '/dashboard.html' : '/'}">
          <span class="brand-mark">${icon('logo', 22)}</span> Cadence
        </a>
        ${window.api.isLoggedIn() ? `<nav class="topnav"><a href="/dashboard.html" class="${active === 'dashboard' ? 'active' : ''}">Projects</a></nav>` : ''}
        <div class="topbar-right">${right}</div>
      </div>`;

    applyTheme(document.documentElement.dataset.theme || 'light');

    header.querySelector('.js-theme')?.addEventListener('click', toggleTheme);
    const acctBtn = header.querySelector('.acct-btn');
    const acctMenu = header.querySelector('.acct-menu');
    if (acctBtn) {
      acctBtn.addEventListener('click', (e) => { e.stopPropagation(); acctMenu.hidden = !acctMenu.hidden; });
      document.addEventListener('click', () => { if (acctMenu) acctMenu.hidden = true; });
    }
    header.querySelector('.js-logout')?.addEventListener('click', () => {
      window.api.clearSession();
      location.href = '/login.html';
    });

    if (window.api.isLoggedIn()) {
      RT.start();
      refreshBadge();
      RT.on('notification', (n) => {
        bumpBadge();
        toast(notifText(n), 'info');
      });
      RT.on('unread', (d) => setBadge(d.unread));
    }
  }

  function setBadge(count) {
    const el = document.getElementById('notif-badge');
    if (!el) return;
    if (count > 0) { el.textContent = count > 99 ? '99+' : count; el.hidden = false; }
    else { el.textContent = ''; el.hidden = true; }
  }
  let badgeCount = 0;
  function bumpBadge() { badgeCount += 1; setBadge(badgeCount); }
  function refreshBadge() {
    window.api.get('/notifications/unread', true).then((d) => { badgeCount = d.unread; setBadge(d.unread); }).catch(() => {});
  }

  const VERB = {
    assigned: 'assigned you',
    comment: 'commented on',
    member_added: 'added you to',
    mention: 'mentioned you in',
  };
  function notifText(n) {
    const who = n.actor ? n.actor.name : 'Someone';
    const verb = VERB[n.type] || 'updated';
    return `${who} ${verb} ${n.detail ? '“' + n.detail + '”' : ''}`.trim();
  }

  const RT = (function () {
    let ws = null;
    let backoff = 1000;
    let joined = null;
    const handlers = {};
    function connect() {
      if (!window.api.isLoggedIn() || ws) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(window.api.getToken())}`);
      ws.onopen = () => { backoff = 1000; if (joined) doJoin(joined); };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (_) { return; }
        emit(m.event, m.data);
      };
      ws.onclose = () => { ws = null; setTimeout(connect, backoff); backoff = Math.min(Math.round(backoff * 1.6), 15000); };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    }
    function doJoin(pid) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'join', projectId: pid })); }
    function emit(ev, data) {
      (handlers[ev] || []).forEach((fn) => fn(data));
      (handlers['*'] || []).forEach((fn) => fn(ev, data));
    }
    return {
      start: connect,
      join(pid) { joined = pid; doJoin(pid); },
      leave() { joined = null; if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'leave' })); },
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); },
      get myId() { const u = window.api.getUser(); return u ? u.id : null; },
    };
  })();

  function requireLogin() {
    if (!window.api.isLoggedIn()) {
      location.href = '/login.html?redirect=' + encodeURIComponent(location.pathname + location.search);
      return false;
    }
    return true;
  }

  window.UI = {
    esc, initials, avatarHtml, icon, toast, timeAgo, dueInfo,
    renderHeader, applyTheme, toggleTheme, requireLogin,
    setBadge, refreshBadge, notifText,
    PROJECT_COLORS, PRIORITY, labelHue,
  };
  window.RT = RT;
})();
