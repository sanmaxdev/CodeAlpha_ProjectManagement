(function () {
  'use strict';
  const U = window.UI;
  U.renderHeader('');

  if (window.api.isLoggedIn()) {
    location.href = '/dashboard.html';
    return;
  }

  const errBox = document.getElementById('form-error');
  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
  function redirectTarget() {
    const r = new URLSearchParams(location.search).get('redirect');
    return r && r.startsWith('/') ? r : '/dashboard.html';
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      const btn = loginForm.querySelector('button');
      btn.disabled = true;
      try {
        const { token, user } = await window.api.post('/auth/login', {
          identifier: document.getElementById('identifier').value,
          password: document.getElementById('password').value,
        });
        window.api.setSession(token, user);
        location.href = redirectTarget();
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
      }
    });
  }

  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      const btn = regForm.querySelector('button');
      btn.disabled = true;
      try {
        const { token, user } = await window.api.post('/auth/register', {
          name: document.getElementById('name').value,
          username: document.getElementById('username').value,
          email: document.getElementById('email').value,
          title: document.getElementById('title').value,
          password: document.getElementById('password').value,
        });
        window.api.setSession(token, user);
        location.href = '/dashboard.html';
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
      }
    });
  }
})();
