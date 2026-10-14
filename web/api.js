/* 统一 API 请求层：自动带 Cookie、统一错误处理、统一登录态。
   后端未启动时页面仍可只读浏览（降级为本地模式），写入类操作给出明确提示。 */
(function () {
  'use strict';

  var state = {
    user: null,
    ready: false,
    googleEnabled: false,
    registrationOpen: true,
    online: false
  };

  var listeners = [];

  function emit() { listeners.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  function onChange(fn) { listeners.push(fn); }

  function request(path, options) {
    options = options || {};
    var init = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    };
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    return fetch(path, init).then(function (res) {
      var ctype = res.headers.get('content-type') || '';
      var parse = ctype.indexOf('application/json') >= 0 ? res.json() : Promise.resolve(null);
      return parse.catch(function () { return null; }).then(function (data) {
        if (res.ok) return data;
        var err = (data && data.error) || {};
        var e = new Error(err.message || ('请求失败（' + res.status + '）'));
        e.field = err.field || null;
        e.status = res.status;
        throw e;
      });
    });
  }

  function refresh() {
    return request('/api/auth/me').then(function (data) {
      state.online = true;
      state.user = (data && data.user) || null;
      state.googleEnabled = !!(data && data.google_enabled);
      state.ready = true;
      emit();
      return state.user;
    }).catch(function () {
      state.online = false;
      state.user = null;
      state.ready = true;
      emit();
      return null;
    });
  }

  var api = {
    state: state,
    onChange: onChange,
    refresh: refresh,
    request: request,

    isLoggedIn: function () { return !!state.user; },
    isAdmin: function () { return !!state.user && state.user.role === 'admin'; },

    login: function (email, password) {
      return request('/api/auth/login', { method: 'POST', body: { email: email, password: password } })
        .then(function (data) { state.user = data.user; state.online = true; emit(); return data.user; });
    },
    register: function (email, password, displayName) {
      return request('/api/auth/register', {
        method: 'POST',
        body: { email: email, password: password, display_name: displayName || '' }
      }).then(function (data) { state.user = data.user; state.online = true; emit(); return data.user; });
    },
    logout: function () {
      return request('/api/auth/logout', { method: 'POST' }).then(function () {
        state.user = null; emit();
      });
    },
    googleLogin: function () { window.location.href = '/api/auth/google'; },

    listMoments: function () { return request('/api/moments'); },
    saveMoment: function (payload) { return request('/api/moments', { method: 'PUT', body: payload }); },
    deleteMoment: function (day) { return request('/api/moments/' + day, { method: 'DELETE' }); },
    listFavorites: function () { return request('/api/favorites'); },
    addFavorite: function (id) { return request('/api/favorites/' + id, { method: 'PUT' }); },
    removeFavorite: function (id) { return request('/api/favorites/' + id, { method: 'DELETE' }); },
    migrateLocal: function (payload) { return request('/api/migrate/local', { method: 'POST', body: payload }); },

    // ---- 用户偏好（语言、上次抽到的字、测试题袋） ----
    getPreferences: function () { return request('/api/preferences'); },
    putPreferences: function (payload) { return request('/api/preferences', { method: 'PUT', body: payload }); },

    // ---- 每日体验配额（按账号，不按设备） ----
    getUsage: function (day) { return request('/api/usage' + (day ? '?day=' + day : '')); },
    claimUsage: function (payload) { return request('/api/usage', { method: 'POST', body: payload }); },

    // ---- 课程报名意向 ----
    getApplication: function () { return request('/api/application'); },
    putApplication: function (payload) { return request('/api/application', { method: 'PUT', body: payload }); },
    deleteApplication: function () { return request('/api/application', { method: 'DELETE' }); }
  };

  window.API = api;
})();
