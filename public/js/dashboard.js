(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('dashboard');
  if (!U.requireLogin()) return;

  const grid = document.getElementById('proj-grid');
  document.getElementById('new-project-btn').innerHTML = U.icon('plus', 18) + ' New project';
  document.getElementById('new-project-btn').addEventListener('click', openCreate);

  function stack(members) {
    const shown = members.slice(0, 4);
    const extra = members.length - shown.length;
    return `<div class="stack">${shown.map((m) => U.avatarHtml(m, 28)).join('')}${
      extra > 0 ? `<span class="more" style="width:28px;height:28px">+${extra}</span>` : ''
    }</div>`;
  }

  function projectCard(p) {
    const pct = p.counts.tasks ? Math.round((p.counts.done / p.counts.tasks) * 100) : 0;
    return `<a class="proj-card c-${U.esc(p.color)}" href="/board.html?p=${p.id}">
      <span class="bar"></span>
      <div class="proj-top">
        <span class="proj-code">${U.esc(p.code)}</span>
      </div>
      <h3>${U.esc(p.name)}</h3>
      <p class="desc">${U.esc(p.description || 'No description yet.')}</p>
      <div class="proj-foot">
        ${stack(p.members)}
        <div class="proj-progress"><span class="mini-bar"><i style="width:${pct}%"></i></span>${p.counts.done}/${p.counts.tasks}</div>
      </div>
    </a>`;
  }

  async function load() {
    grid.innerHTML = '<div class="skel" style="height:168px"></div><div class="skel" style="height:168px"></div><div class="skel" style="height:168px"></div>';
    try {
      const { projects } = await window.api.get('/projects', true);
      grid.innerHTML =
        projects.map(projectCard).join('') +
        `<button class="proj-card new" id="new-tile">${U.icon('plus', 26)}<span>Create a project</span></button>`;
      document.getElementById('new-tile').addEventListener('click', openCreate);
    } catch (err) {
      grid.innerHTML = `<div class="state"><h3>Could not load projects</h3><p>${U.esc(err.message)}</p></div>`;
    }
  }

  let chosenColor = 'iris';
  function openCreate() {
    let overlay = document.getElementById('create-overlay');
    if (overlay) { overlay.classList.add('open'); return; }
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'create-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h2>New project</h2><button class="icon-btn js-close">${U.icon('x', 18)}</button></div>
        <div class="modal-body">
          <label class="field"><span>Project name</span><input id="cp-name" placeholder="Mobile App Launch" maxlength="80" /></label>
          <label class="field"><span>Short code <span class="muted" style="font-weight:400">(optional)</span></span><input id="cp-code" placeholder="MOB" maxlength="5" style="max-width:140px;text-transform:uppercase" /></label>
          <label class="field"><span>Description</span><textarea id="cp-desc" placeholder="What is this project about?" maxlength="240"></textarea></label>
          <div class="field"><span>Color</span><div class="swatches" id="cp-swatches">${U.PROJECT_COLORS.map(
            (c) => `<button type="button" class="swatch c-${c} ${c === 'iris' ? 'on' : ''}" data-color="${c}" style="--sc:var(--c-${c})"></button>`
          ).join('')}</div></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost js-close">Cancel</button>
          <button class="btn btn-primary" id="cp-create">Create project</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = () => overlay.classList.remove('open');
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.js-close')) close(); });
    overlay.querySelectorAll('.swatch').forEach((s) =>
      s.addEventListener('click', () => {
        overlay.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on'));
        s.classList.add('on');
        chosenColor = s.dataset.color;
      })
    );
    overlay.querySelector('#cp-name').focus();
    overlay.querySelector('#cp-create').addEventListener('click', async () => {
      const name = overlay.querySelector('#cp-name').value.trim();
      if (!name) { overlay.querySelector('#cp-name').focus(); return; }
      const btn = overlay.querySelector('#cp-create');
      btn.disabled = true;
      try {
        const { project } = await window.api.post('/projects', {
          name,
          code: overlay.querySelector('#cp-code').value.trim(),
          description: overlay.querySelector('#cp-desc').value.trim(),
          color: chosenColor,
        }, true);
        location.href = '/board.html?p=' + project.id;
      } catch (err) {
        U.toast(err.message, 'error');
        btn.disabled = false;
      }
    });
  }

  load();
})();
