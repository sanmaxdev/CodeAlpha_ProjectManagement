(function () {
  'use strict';

  const TOKEN_KEY = 'cadence_token';
  const USER_KEY = 'cadence_user';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (e) {
      return null;
    }
  }
  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  const isLoggedIn = () => !!getToken();

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = {};
    const hasBody = body !== undefined && body !== null;
    if (hasBody) headers['Content-Type'] = 'application/json';
    if (auth && getToken()) headers['Authorization'] = 'Bearer ' + getToken();

    let res;
    try {
      res = await fetch('/api' + path, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error('Could not reach the server.');
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {}
    }
    if (!res.ok) {
      if (res.status === 401 && auth) clearSession();
      throw new Error((data && data.error) || `Request failed (${res.status}).`);
    }
    return data;
  }

  window.api = {
    getToken,
    getUser,
    setSession,
    setUser,
    clearSession,
    isLoggedIn,
    request,
    get: (p, auth) => request(p, { auth }),
    post: (p, body, auth) => request(p, { method: 'POST', body, auth }),
    put: (p, body, auth) => request(p, { method: 'PUT', body, auth }),
    del: (p, auth) => request(p, { method: 'DELETE', auth }),
  };
})();
