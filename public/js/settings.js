(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('');
  if (!U.requireLogin()) return;

  const me = window.api.getUser();
  const PICKS = [12, 45, 33, 32, 68, 24, 5, 60].map((n) => `https://i.pravatar.cc/240?img=${n}`);

  const nameI = document.getElementById('s-name');
  const titleI = document.getElementById('s-title');
  const avatarI = document.getElementById('s-avatar');
  const errBox = document.getElementById('form-error');

  nameI.value = me.name || '';
  titleI.value = me.title || '';
  avatarI.value = me.avatar || '';

  function refreshPreview() {
    const u = { name: nameI.value, username: me.username, avatar: avatarI.value };
    document.getElementById('avatar-preview').innerHTML = U.avatarHtml(u, 56);
    document.getElementById('who-name').textContent = nameI.value || me.name;
    document.getElementById('who-handle').textContent = '@' + me.username;
  }
  refreshPreview();
  nameI.addEventListener('input', refreshPreview);
  avatarI.addEventListener('input', refreshPreview);

  document.getElementById('avatar-picks').innerHTML = PICKS.map(
    (src) => `<button type="button" class="swatch" data-src="${src}" style="background-image:url(${src});background-size:cover;border-radius:50%"></button>`
  ).join('');
  document.getElementById('avatar-picks').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch'); if (!b) return;
    avatarI.value = b.dataset.src;
    refreshPreview();
  });

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const { user } = await window.api.put('/auth/me', {
        name: nameI.value.trim(),
        title: titleI.value.trim(),
        avatar: avatarI.value.trim(),
      }, true);
      window.api.setUser(user);
      U.toast('Profile saved', 'success');
      U.renderHeader('');
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
})();
