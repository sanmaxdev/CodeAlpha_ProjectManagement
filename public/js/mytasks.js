(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('mytasks');
  if (!U.requireLogin()) return;

  const root = document.getElementById('mytasks');

  function taskRow(t) {
    const pr = U.PRIORITY[t.priority] || U.PRIORITY.medium;
    const due = U.dueInfo(t.dueDate);
    return `<a class="task-row ${t.completed ? 'done' : ''}" href="/board.html?p=${t.project.id}&t=${t.id}">
      <span class="proj-code" style="background:var(--c-${U.esc(t.project.color)})">${U.esc(t.project.code)}</span>
      <div style="min-width:0">
        <div class="tr-title">${U.esc(t.title)}</div>
        <div class="muted" style="font-size:12.5px">${U.esc(t.project.name)} · ${U.esc(t.columnName)}</div>
      </div>
      <div class="tr-meta">
        <span class="pri ${pr.class}">${U.icon('flag', 13)}${pr.label}</span>
        ${due ? `<span class="${due.cls}">${U.icon('clock', 13)}${due.label}</span>` : ''}
      </div>
    </a>`;
  }

  function group(title, tasks, accent) {
    if (!tasks.length) return '';
    return `<div class="mt-group">
      <h2 ${accent ? `style="color:${accent}"` : ''}>${title} <span class="mt-count">${tasks.length}</span></h2>
      ${tasks.map(taskRow).join('')}
    </div>`;
  }

  async function load() {
    root.innerHTML = '<div class="skel" style="height:64px;margin-bottom:8px"></div>'.repeat(4);
    try {
      const { tasks } = await window.api.get('/tasks/mine', true);
      if (!tasks.length) {
        root.innerHTML = `<div class="state"><h3>Nothing assigned to you yet</h3><p>Tasks people assign to you will collect here.</p><a class="btn btn-primary" href="/dashboard.html" style="margin-top:12px">Go to projects</a></div>`;
        return;
      }
      const open = tasks.filter((t) => !t.completed);
      const done = tasks.filter((t) => t.completed);
      const overdue = [], today = [], upcoming = [], someday = [];
      open.forEach((t) => {
        const d = U.dueInfo(t.dueDate);
        if (!d) someday.push(t);
        else if (d.days < 0) overdue.push(t);
        else if (d.days === 0) today.push(t);
        else upcoming.push(t);
      });
      root.innerHTML =
        group('Overdue', overdue, 'var(--pr-urgent)') +
        group('Due today', today, 'var(--pr-high)') +
        group('Upcoming', upcoming) +
        group('No due date', someday) +
        group('Completed', done);
    } catch (err) {
      root.innerHTML = `<div class="state"><h3>Could not load your tasks</h3><p>${U.esc(err.message)}</p></div>`;
    }
  }

  load();
})();
