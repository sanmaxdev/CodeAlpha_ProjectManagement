(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('notifications');
  if (!U.requireLogin()) return;

  const list = document.getElementById('notif-list');

  function row(n) {
    const link = n.projectId ? `/board.html?p=${n.projectId}${n.taskId ? '&t=' + n.taskId : ''}` : '#';
    const color = n.project ? n.project.color : 'iris';
    const pill = n.project ? `<span class="npill c-${U.esc(color)}" style="background:var(--c-${U.esc(color)})">${U.esc(n.project.code)}</span>` : '';
    if (n.type === 'due_soon') {
      return `<a class="notif ${n.read ? '' : 'unread'}" href="${link}">
        <span class="avatar avatar-initials" style="width:40px;height:40px;background:var(--accent-weak);color:var(--accent)">${U.icon('clock', 20)}</span>
        <div class="ntext"><div><span class="nname">Reminder</span> · ${U.esc(n.detail)}</div><div class="nt">${U.timeAgo(n.createdAt)}</div></div>
        ${pill}
      </a>`;
    }
    return `<a class="notif ${n.read ? '' : 'unread'}" href="${link}">
      ${U.avatarHtml(n.actor, 40)}
      <div class="ntext">
        <div><span class="nname">${U.esc(n.actor ? n.actor.name : 'Someone')}</span> ${U.esc(verb(n.type))} ${n.detail ? '<strong>' + U.esc(n.detail) + '</strong>' : ''}</div>
        <div class="nt">${U.timeAgo(n.createdAt)}</div>
      </div>
      ${pill}
    </a>`;
  }

  function verb(type) {
    return { assigned: 'assigned you', comment: 'commented on', member_added: 'added you to', mention: 'mentioned you in' }[type] || 'updated';
  }

  async function load() {
    list.innerHTML = '<div class="skel" style="height:64px;margin-bottom:8px"></div>'.repeat(4);
    try {
      const { notifications } = await window.api.get('/notifications', true);
      if (!notifications.length) {
        list.innerHTML = `<div class="state"><h3>You're all caught up</h3><p>Notifications from your projects will show up here.</p></div>`;
        return;
      }
      list.innerHTML = notifications.map(row).join('');
      await window.api.post('/notifications/read', null, true);
      U.setBadge(0);
    } catch (err) {
      list.innerHTML = `<div class="state"><h3>Could not load notifications</h3><p>${U.esc(err.message)}</p></div>`;
    }
  }

  RT.on('notification', (n) => {
    const empty = list.querySelector('.state');
    if (empty) empty.remove();
    list.insertAdjacentHTML('afterbegin', row(n));
  });

  load();
})();
