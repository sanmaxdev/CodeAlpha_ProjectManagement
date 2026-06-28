(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('');
  if (!U.requireLogin()) return;

  const projectId = Number(new URLSearchParams(location.search).get('p'));
  if (!projectId) { location.href = '/dashboard.html'; return; }

  const topEl = document.getElementById('board-top');
  const boardEl = document.getElementById('board');
  const myId = window.api.getUser().id;

  const state = { project: null, columns: [], tasks: [], presence: [] };
  let dragId = null;
  let openTaskId = null;
  let pendingRender = false;

  const tasksIn = (colId) =>
    state.tasks.filter((t) => t.columnId === colId).sort((a, b) => a.position - b.position);
  const findTask = (id) => state.tasks.find((t) => t.id === id);
  const canManage = () => state.project && (state.project.myRole === 'owner' || state.project.myRole === 'admin');

  /* ---------- load ---------- */
  async function load() {
    boardEl.innerHTML = `<div class="column"><div class="col-cards">${'<div class="skel skel-card"></div>'.repeat(3)}</div></div>`.repeat(3);
    try {
      const data = await window.api.get('/projects/' + projectId, true);
      state.project = data.project;
      state.columns = data.columns.sort((a, b) => a.position - b.position);
      state.tasks = data.tasks;
      renderTop();
      renderBoard();
      RT.join(projectId);
      const focusTask = Number(new URLSearchParams(location.search).get('t'));
      if (focusTask && findTask(focusTask)) openTask(focusTask);
    } catch (err) {
      topEl.innerHTML = '';
      boardEl.innerHTML = `<div class="state" style="width:100%"><h3>Could not open this project</h3><p>${U.esc(err.message)}</p><a class="btn btn-outline" href="/dashboard.html" style="margin-top:12px">Back to projects</a></div>`;
    }
  }

  /* ---------- top bar ---------- */
  function renderTop() {
    const p = state.project;
    const online = state.presence.length;
    topEl.innerHTML = `
      <div class="board-top-inner">
        <a class="board-back" href="/dashboard.html" title="All projects">${U.icon('arrowLeft', 19)}</a>
        <div class="board-title">
          <span class="proj-code c-${U.esc(p.color)}" style="background:var(--c-${U.esc(p.color)})">${U.esc(p.code)}</span>
          <h1>${U.esc(p.name)}</h1>
        </div>
        <div class="board-meta">
          <div class="presence" id="presence"></div>
          <button class="btn btn-outline btn-sm" id="members-btn">${U.icon('users', 16)} <span>${p.members.length}</span></button>
        </div>
      </div>`;
    renderPresence();
    document.getElementById('members-btn').addEventListener('click', openMembers);
  }

  function renderPresence() {
    const el = document.getElementById('presence');
    if (!el) return;
    const users = state.presence;
    if (!users.length) { el.innerHTML = ''; return; }
    const shown = users.slice(0, 5);
    el.innerHTML = `<span class="live-dot"></span>
      <div class="stack">${shown.map((u) => `<span title="${U.esc(u.name)}">${U.avatarHtml(u, 30)}</span>`).join('')}</div>
      <span class="presence-label">${users.length} online</span>`;
  }

  /* ---------- board ---------- */
  function renderBoard() {
    boardEl.innerHTML = state.columns.map(columnHtml).join('') + addColumnHtml();
    wireDnD();
  }

  function columnHtml(col) {
    const cards = tasksIn(col.id);
    return `<section class="column" data-col="${col.id}">
      <div class="col-head">
        <span class="cname">${U.esc(col.name)}</span>
        <span class="count">${cards.length}</span>
        <div class="col-actions">
          <button class="icon-btn js-col-rename" title="Rename">${U.icon('settings', 16)}</button>
          <button class="icon-btn js-col-del" title="Delete column">${U.icon('trash', 16)}</button>
        </div>
      </div>
      <div class="col-cards" data-col="${col.id}">${cards.map(cardHtml).join('')}</div>
      <div class="col-foot"><button class="add-card js-add-card" data-col="${col.id}">${U.icon('plus', 16)} Add a card</button></div>
    </section>`;
  }

  function addColumnHtml() {
    return `<div class="column" style="background:transparent;border-style:dashed">
      <button class="add-card js-add-col" style="padding:14px">${U.icon('plus', 16)} Add column</button>
    </div>`;
  }

  function cardHtml(t) {
    const labels = (t.labels || [])
      .map((l) => `<span class="tag" style="--lh:${U.labelHue(l)}">${U.esc(l)}</span>`)
      .join('');
    const pr = U.PRIORITY[t.priority] || U.PRIORITY.medium;
    const due = U.dueInfo(t.dueDate);
    return `<article class="card ${t.completed ? 'done' : ''}" draggable="true" data-id="${t.id}">
      ${labels ? `<div class="card-labels">${labels}</div>` : ''}
      <div class="card-title">${U.esc(t.title)}</div>
      <div class="card-foot">
        <span class="pri ${pr.class}">${U.icon('flag', 13)}${pr.label}</span>
        ${due ? `<span class="${due.cls}">${U.icon('clock', 13)}${due.label}</span>` : ''}
        <span class="right">
          ${t.commentCount ? `<span class="card-comments">${U.icon('comment', 13)}${t.commentCount}</span>` : ''}
          ${t.assignee ? `<span title="${U.esc(t.assignee.name)}">${U.avatarHtml(t.assignee, 24)}</span>` : ''}
        </span>
      </div>
    </article>`;
  }

  /* ---------- drag & drop ---------- */
  function getAfter(container, y) {
    const els = [...container.querySelectorAll('.card:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: -Infinity }).element;
  }

  function wireDnD() {
    boardEl.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('dragstart', () => { dragId = Number(card.dataset.id); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { dragId = null; card.classList.remove('dragging'); boardEl.querySelectorAll('.drop-target').forEach((c) => c.classList.remove('drop-target')); if (pendingRender) { pendingRender = false; renderBoard(); } });
    });
    boardEl.querySelectorAll('.col-cards').forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = boardEl.querySelector('.card.dragging');
        if (!dragging) return;
        zone.closest('.column').classList.add('drop-target');
        const after = getAfter(zone, e.clientY);
        if (after) zone.insertBefore(dragging, after);
        else zone.appendChild(dragging);
      });
      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) zone.closest('.column').classList.remove('drop-target');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        const colId = Number(zone.dataset.col);
        const ids = [...zone.querySelectorAll('.card')].map((c) => Number(c.dataset.id));
        const index = ids.indexOf(dragId);
        if (dragId != null) doMove(dragId, colId, index);
      });
    });
  }

  function doMove(taskId, colId, index) {
    const t = findTask(taskId);
    if (!t) return;
    const fromCol = t.columnId;
    if (t.columnId === colId && tasksIn(colId).map((x) => x.id).indexOf(taskId) === index) return;

    const dest = tasksIn(colId).filter((x) => x.id !== taskId).map((x) => x.id);
    dest.splice(Math.max(0, Math.min(index, dest.length)), 0, taskId);
    t.columnId = colId;
    const destCol = state.columns.find((c) => c.id === colId);
    if (destCol && /done|complete|shipped|closed/i.test(destCol.name)) t.completed = true;
    else if (fromCol !== colId) { const fc = state.columns.find((c) => c.id === fromCol); if (fc && /done|complete|shipped|closed/i.test(fc.name)) t.completed = false; }
    dest.forEach((id, i) => { findTask(id).position = i; });
    if (fromCol !== colId) tasksIn(fromCol).forEach((x, i) => { x.position = i; });
    renderBoard();

    window.api.put('/tasks/' + taskId + '/move', { columnId: colId, index }, true).catch((err) => {
      U.toast(err.message, 'error');
      load();
    });
  }

  /* ---------- board interactions ---------- */
  boardEl.addEventListener('click', (e) => {
    const addCard = e.target.closest('.js-add-card');
    if (addCard) return startAddCard(Number(addCard.dataset.col), addCard);
    const addCol = e.target.closest('.js-add-col');
    if (addCol) return startAddColumn(addCol);
    const rename = e.target.closest('.js-col-rename');
    if (rename) return renameColumn(Number(rename.closest('.column').dataset.col));
    const del = e.target.closest('.js-col-del');
    if (del) return deleteColumn(Number(del.closest('.column').dataset.col));
    const card = e.target.closest('.card');
    if (card) return openTask(Number(card.dataset.id));
  });

  function startAddCard(colId, btn) {
    const foot = btn.parentElement;
    foot.innerHTML = `<textarea class="add-card-input" rows="2" placeholder="What needs to be done?" style="margin-bottom:8px"></textarea>
      <div style="display:flex;gap:8px"><button class="btn btn-primary btn-sm js-save">Add card</button><button class="btn btn-ghost btn-sm js-cancel">Cancel</button></div>`;
    const ta = foot.querySelector('textarea');
    ta.focus();
    const reset = () => { foot.innerHTML = `<button class="add-card js-add-card" data-col="${colId}">${U.icon('plus', 16)} Add a card</button>`; };
    foot.querySelector('.js-cancel').addEventListener('click', reset);
    ta.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); foot.querySelector('.js-save').click(); } if (ev.key === 'Escape') reset(); });
    foot.querySelector('.js-save').addEventListener('click', async () => {
      const title = ta.value.trim();
      if (!title) return reset();
      try {
        const { task } = await window.api.post('/tasks', { columnId: colId, title }, true);
        state.tasks.push(task);
        renderBoard();
      } catch (err) { U.toast(err.message, 'error'); reset(); }
    });
  }

  function startAddColumn(btn) {
    const col = btn.parentElement;
    col.innerHTML = `<div style="padding:12px"><input class="add-col-input" placeholder="Column name" maxlength="40" /><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-primary btn-sm js-save">Add</button><button class="btn btn-ghost btn-sm js-cancel">Cancel</button></div></div>`;
    const input = col.querySelector('input');
    input.focus();
    col.querySelector('.js-cancel').addEventListener('click', renderBoard);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') col.querySelector('.js-save').click(); if (ev.key === 'Escape') renderBoard(); });
    col.querySelector('.js-save').addEventListener('click', async () => {
      const name = input.value.trim();
      if (!name) return renderBoard();
      try {
        const { column } = await window.api.post('/columns', { projectId, name }, true);
        state.columns.push(column);
        renderBoard();
      } catch (err) { U.toast(err.message, 'error'); }
    });
  }

  async function renameColumn(colId) {
    const col = state.columns.find((c) => c.id === colId);
    const name = prompt('Rename column', col.name);
    if (name == null || !name.trim() || name.trim() === col.name) return;
    try {
      const { column } = await window.api.put('/columns/' + colId, { name: name.trim() }, true);
      Object.assign(col, column);
      renderBoard();
    } catch (err) { U.toast(err.message, 'error'); }
  }

  async function deleteColumn(colId) {
    if (tasksIn(colId).length) { U.toast('Move or delete this column’s cards first.', 'error'); return; }
    if (!confirm('Delete this column?')) return;
    try {
      await window.api.del('/columns/' + colId, true);
      state.columns = state.columns.filter((c) => c.id !== colId);
      renderBoard();
    } catch (err) { U.toast(err.message, 'error'); }
  }

  /* ---------- task modal ---------- */
  async function openTask(id) {
    openTaskId = id;
    let overlay = document.getElementById('task-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.id = 'task-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.js-close')) closeTask(); });
    }
    overlay.innerHTML = `<div class="modal task-modal"><div class="modal-body" style="padding:0"><div class="state" style="padding:50px">Loading…</div></div></div>`;
    requestAnimationFrame(() => overlay.classList.add('open'));
    try {
      const { task, comments } = await window.api.get('/tasks/' + id, true);
      renderTaskModal(overlay, task, comments);
    } catch (err) { U.toast(err.message, 'error'); closeTask(); }
  }

  function closeTask() {
    openTaskId = null;
    const overlay = document.getElementById('task-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function patchTask(id, patch, after) {
    window.api.put('/tasks/' + id, patch, true).then(({ task }) => {
      const local = findTask(id);
      if (local) Object.assign(local, task);
      renderBoard();
      if (after) after(task);
    }).catch((err) => U.toast(err.message, 'error'));
  }

  function renderTaskModal(overlay, task, comments) {
    const members = state.project.members;
    const pr = task.priority;
    overlay.innerHTML = `
      <div class="modal task-modal">
        <div class="modal-head">
          <h2 style="font-size:13px;color:var(--muted);font-family:var(--font);text-transform:uppercase;letter-spacing:.05em">${U.esc(state.project.code)}-${task.id}</h2>
          <div style="display:flex;gap:4px">
            <button class="icon-btn js-del-task" title="Delete task">${U.icon('trash', 18)}</button>
            <button class="icon-btn js-close" title="Close">${U.icon('x', 18)}</button>
          </div>
        </div>
        <div class="task-grid">
          <div class="task-main">
            <input class="task-title-input" id="t-title" value="${U.esc(task.title)}" />
            <textarea class="task-desc" id="t-desc" placeholder="Add a more detailed description…">${U.esc(task.description)}</textarea>
            <div class="comments">
              <h4>${comments.length} comment${comments.length === 1 ? '' : 's'}</h4>
              <div id="t-comments">${comments.map(commentHtml).join('')}</div>
              <div class="comment-box">
                ${U.avatarHtml(window.api.getUser(), 32)}
                <div style="flex:1"><textarea id="t-comment" placeholder="Write a comment… use @ to mention"></textarea>
                <div style="margin-top:8px"><button class="btn btn-primary btn-sm" id="t-comment-send">Comment</button></div></div>
              </div>
            </div>
          </div>
          <div class="task-side">
            <div class="seg"><h4>Assignee</h4><button class="assignee-pick" id="t-assignee">${assigneeInner(task.assignee)}</button></div>
            <div class="seg"><h4>Priority</h4><div class="seg-row" id="t-priority">${['low', 'medium', 'high', 'urgent'].map((k) => `<button class="chip ${U.PRIORITY[k].class} ${k === pr ? 'on' : ''}" data-pr="${k}">${U.PRIORITY[k].label}</button>`).join('')}</div></div>
            <div class="seg"><h4>Due date</h4><input type="date" id="t-due" value="${task.dueDate || ''}" /></div>
            <div class="seg"><h4>Labels</h4><div class="seg-row" id="t-labels" style="margin-bottom:8px"></div><input id="t-label-input" placeholder="Add label + Enter" maxlength="20" /></div>
            <div class="seg"><h4>Status</h4><label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;cursor:pointer"><input type="checkbox" id="t-complete" ${task.completed ? 'checked' : ''} style="width:auto" /> Mark complete</label></div>
          </div>
        </div>
      </div>`;

    let labels = [...(task.labels || [])];
    const renderLabels = () => {
      overlay.querySelector('#t-labels').innerHTML = labels.length
        ? labels.map((l) => `<span class="tag" style="--lh:${U.labelHue(l)};cursor:pointer" data-label="${U.esc(l)}" title="Remove">${U.esc(l)} ✕</span>`).join('')
        : '<span class="muted" style="font-size:12.5px">No labels</span>';
    };
    renderLabels();

    const title = overlay.querySelector('#t-title');
    title.addEventListener('blur', () => { if (title.value.trim() && title.value.trim() !== task.title) patchTask(task.id, { title: title.value.trim() }, (t) => { task.title = t.title; }); });
    const desc = overlay.querySelector('#t-desc');
    desc.addEventListener('blur', () => { if (desc.value !== task.description) patchTask(task.id, { description: desc.value.trim() }, (t) => { task.description = t.description; }); });

    overlay.querySelector('#t-priority').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      overlay.querySelectorAll('#t-priority .chip').forEach((c) => c.classList.remove('on'));
      chip.classList.add('on');
      patchTask(task.id, { priority: chip.dataset.pr }, (t) => { task.priority = t.priority; });
    });
    overlay.querySelector('#t-due').addEventListener('change', (e) => patchTask(task.id, { dueDate: e.target.value || null }, (t) => { task.dueDate = t.dueDate; }));
    overlay.querySelector('#t-complete').addEventListener('change', (e) => patchTask(task.id, { completed: e.target.checked }, (t) => { task.completed = t.completed; }));

    overlay.querySelector('#t-labels').addEventListener('click', (e) => {
      const tag = e.target.closest('[data-label]'); if (!tag) return;
      labels = labels.filter((l) => l !== tag.dataset.label);
      renderLabels();
      patchTask(task.id, { labels }, (t) => { task.labels = t.labels; });
    });
    const labelInput = overlay.querySelector('#t-label-input');
    labelInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = labelInput.value.trim();
      if (v && !labels.includes(v) && labels.length < 6) {
        labels.push(v); labelInput.value = ''; renderLabels();
        patchTask(task.id, { labels }, (t) => { task.labels = t.labels; });
      }
    });

    overlay.querySelector('#t-assignee').addEventListener('click', (e) => {
      e.stopPropagation();
      openAssigneePicker(overlay.querySelector('#t-assignee'), members, task.assignee, (uid) => {
        patchTask(task.id, { assigneeId: uid }, (t) => { task.assignee = t.assignee; overlay.querySelector('#t-assignee').innerHTML = assigneeInner(t.assignee); });
      });
    });

    overlay.querySelector('.js-del-task').addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try {
        await window.api.del('/tasks/' + task.id, true);
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        renderBoard();
        closeTask();
      } catch (err) { U.toast(err.message, 'error'); }
    });

    const send = overlay.querySelector('#t-comment-send');
    const cinput = overlay.querySelector('#t-comment');
    send.addEventListener('click', async () => {
      const body = cinput.value.trim();
      if (!body) return;
      send.disabled = true;
      try {
        const { comment } = await window.api.post('/tasks/' + task.id + '/comments', { body }, true);
        cinput.value = '';
        appendComment(overlay, comment);
        const local = findTask(task.id); if (local) { local.commentCount = (local.commentCount || 0) + 1; renderBoard(); }
      } catch (err) { U.toast(err.message, 'error'); } finally { send.disabled = false; }
    });
    cinput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send.click(); });

    overlay.querySelector('#t-comments').addEventListener('click', async (e) => {
      const del = e.target.closest('.cdel'); if (!del) return;
      const cid = Number(del.dataset.cid);
      try { await window.api.del('/tasks/' + task.id + '/comments/' + cid, true); del.closest('.comment').remove(); } catch (err) { U.toast(err.message, 'error'); }
    });
  }

  function assigneeInner(a) {
    return a
      ? `${U.avatarHtml(a, 26)}<span>${U.esc(a.name)}</span>`
      : `<span class="avatar avatar-initials" style="width:26px;height:26px;background:var(--surface-3);color:var(--muted)">?</span><span class="muted-pick">Unassigned</span>`;
  }

  function commentHtml(c) {
    const mine = c.author && c.author.id === myId;
    return `<div class="comment" data-cid="${c.id}">
      ${U.avatarHtml(c.author, 32)}
      <div class="body">
        <div class="chead"><span class="cname">${U.esc(c.author.name)}</span><span class="ctime">${U.timeAgo(c.createdAt)}</span>${mine ? `<button class="cdel" data-cid="${c.id}" style="margin-left:auto">Delete</button>` : ''}</div>
        <div class="ctext">${U.esc(c.body)}</div>
      </div>
    </div>`;
  }

  function appendComment(overlay, c) {
    const list = overlay.querySelector('#t-comments');
    if (!list || list.querySelector(`[data-cid="${c.id}"]`)) return;
    list.insertAdjacentHTML('beforeend', commentHtml(c));
    const h = overlay.querySelector('.comments h4');
    if (h) h.textContent = list.querySelectorAll('.comment').length + ' comments';
  }

  /* ---------- pickers ---------- */
  function openAssigneePicker(anchor, members, current, onPick) {
    closePicker();
    const rect = anchor.getBoundingClientRect();
    const pick = document.createElement('div');
    pick.className = 'picker';
    pick.id = 'active-picker';
    pick.style.top = window.scrollY + rect.bottom + 6 + 'px';
    pick.style.left = window.scrollX + rect.left + 'px';
    pick.innerHTML = `<div class="pick-list">
      <div class="pick-item" data-uid=""><span class="avatar avatar-initials" style="width:30px;height:30px;background:var(--surface-3);color:var(--muted)">?</span><span class="pn">Unassigned</span></div>
      ${members.map((m) => `<div class="pick-item" data-uid="${m.id}">${U.avatarHtml(m, 30)}<div><div class="pn">${U.esc(m.name)}</div><div class="pu">@${U.esc(m.username)}</div></div></div>`).join('')}
    </div>`;
    document.body.appendChild(pick);
    pick.addEventListener('click', (e) => {
      const item = e.target.closest('.pick-item'); if (!item) return;
      onPick(item.dataset.uid ? Number(item.dataset.uid) : null);
      closePicker();
    });
    setTimeout(() => document.addEventListener('click', closePicker, { once: true }), 0);
  }
  function closePicker() { const p = document.getElementById('active-picker'); if (p) p.remove(); }

  /* ---------- members modal ---------- */
  function openMembers() {
    let overlay = document.getElementById('members-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.id = 'members-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.js-close')) overlay.classList.remove('open'); });
    }
    const manage = canManage();
    overlay.innerHTML = `<div class="modal">
      <div class="modal-head"><h2>Members</h2><button class="icon-btn js-close">${U.icon('x', 18)}</button></div>
      <div class="modal-body">
        ${manage ? `<div style="display:flex;gap:8px;margin-bottom:18px"><input id="m-add" placeholder="Add by username or email" /><button class="btn btn-primary" id="m-add-btn">Add</button></div>` : ''}
        <div id="m-list">${state.project.members.map(memberRowHtml).join('')}</div>
      </div></div>`;
    requestAnimationFrame(() => overlay.classList.add('open'));
    if (manage) {
      const addBtn = overlay.querySelector('#m-add-btn');
      const addInput = overlay.querySelector('#m-add');
      const doAdd = async () => {
        const identifier = addInput.value.trim();
        if (!identifier) return;
        addBtn.disabled = true;
        try {
          const { members } = await window.api.post('/projects/' + projectId + '/members', { identifier }, true);
          state.project.members = members;
          addInput.value = '';
          overlay.querySelector('#m-list').innerHTML = members.map(memberRowHtml).join('');
          renderTop();
          U.toast('Member added', 'success');
        } catch (err) { U.toast(err.message, 'error'); } finally { addBtn.disabled = false; }
      };
      addBtn.addEventListener('click', doAdd);
      addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    }
    overlay.querySelector('#m-list').addEventListener('click', async (e) => {
      const rm = e.target.closest('.js-rm-member'); if (!rm) return;
      const uid = Number(rm.dataset.uid);
      try {
        const { members } = await window.api.del('/projects/' + projectId + '/members/' + uid, true);
        state.project.members = members;
        overlay.querySelector('#m-list').innerHTML = members.map(memberRowHtml).join('');
        renderTop();
      } catch (err) { U.toast(err.message, 'error'); }
    });
  }

  function memberRowHtml(m) {
    const isOwner = m.role === 'owner';
    const removable = canManage() && !isOwner;
    return `<div class="member-row">
      ${U.avatarHtml(m, 38)}
      <div><div class="mn">${U.esc(m.name)}</div><div class="mt">${U.esc(m.title || '@' + m.username)}</div></div>
      <span class="role ${isOwner ? 'owner' : ''}">${U.esc(m.role)}</span>
      ${removable ? `<button class="icon-btn js-rm-member" data-uid="${m.id}" title="Remove" style="width:30px;height:30px">${U.icon('x', 15)}</button>` : ''}
    </div>`;
  }

  /* ---------- realtime ---------- */
  RT.on('presence', (d) => { if (d.projectId === projectId) { state.presence = d.users; renderPresence(); } });

  function ext(d) { return d && d.by === myId; }

  RT.on('task:created', (d) => { if (ext(d)) return; if (!findTask(d.task.id)) { state.tasks.push(d.task); safeRender(); } });
  RT.on('task:updated', (d) => { if (ext(d)) return; const t = findTask(d.task.id); if (t) Object.assign(t, d.task); else state.tasks.push(d.task); safeRender(); if (openTaskId === d.task.id) refreshOpenTask(); });
  RT.on('task:deleted', (d) => { if (ext(d)) return; state.tasks = state.tasks.filter((t) => t.id !== d.id); safeRender(); if (openTaskId === d.id) closeTask(); });
  RT.on('task:moved', (d) => {
    if (ext(d)) return;
    const t = findTask(d.task.id);
    if (t) Object.assign(t, d.task); else state.tasks.push(d.task);
    (d.affected || []).forEach((a) => a.order.forEach((id, i) => { const x = findTask(id); if (x) { x.position = i; x.columnId = a.columnId; } }));
    safeRender();
  });
  RT.on('column:created', (d) => { if (ext(d)) return; if (!state.columns.find((c) => c.id === d.id)) { state.columns.push(d); safeRender(); } });
  RT.on('column:updated', (d) => { if (ext(d)) return; const c = state.columns.find((x) => x.id === d.id); if (c) Object.assign(c, d); safeRender(); });
  RT.on('column:deleted', (d) => { if (ext(d)) return; state.columns = state.columns.filter((c) => c.id !== d.id); safeRender(); });
  RT.on('column:reordered', (d) => { if (ext(d)) return; state.columns = d.columns; safeRender(); });
  RT.on('comment:created', (d) => {
    if (ext(d)) return;
    const t = findTask(d.taskId); if (t) { t.commentCount = (t.commentCount || 0) + 1; safeRender(); }
    if (openTaskId === d.taskId) { const ov = document.getElementById('task-overlay'); if (ov) appendComment(ov, d.comment); }
  });
  RT.on('member:added', (d) => { state.project.members = d.members; renderTop(); });
  RT.on('member:updated', (d) => { state.project.members = d.members; renderTop(); });
  RT.on('member:removed', (d) => { state.project.members = d.members; renderTop(); if (d.userId === myId) { U.toast('You were removed from this project'); setTimeout(() => location.href = '/dashboard.html', 1200); } });
  RT.on('project:updated', (d) => { state.project = Object.assign(state.project, d); renderTop(); });
  RT.on('project:deleted', () => { U.toast('This project was deleted'); setTimeout(() => location.href = '/dashboard.html', 1200); });

  function safeRender() { if (dragId != null) { pendingRender = true; return; } renderBoard(); }
  function refreshOpenTask() {
    if (!openTaskId) return;
    const ov = document.getElementById('task-overlay');
    if (ov && !ov.querySelector('input:focus, textarea:focus')) openTask(openTaskId);
  }

  load();
})();
