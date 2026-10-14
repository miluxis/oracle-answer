/* 账号体系与现有应用的集成层。
   职责：
   1) 顶栏渲染登录入口 / 账户菜单
   2) 登录守卫：未登录时拦截受保护操作并跳转登录页，登录后回跳
   3) 数据源切换：登录后「我的片刻」「收藏」改为服务端，退出后回落本地
   4) 注册/登录/账户/后台 路由接入现有 hash 路由体系

   设计原则：不改动 app.js 的原有渲染逻辑，只在必要时打补丁，
   以免影响已经调好的六语言体验与动画。 */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var guarded = false;

  /* 登录前的来源页，登录成功后回到这里 */
  var savedHash = null;

  /* ---------- 顶栏入口（登录后为下拉菜单） ---------- */
  function closeMenu() {
    var m = document.getElementById('auth-menu');
    if (m) m.remove();
    var b = document.getElementById('auth-entry');
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    var existing = document.getElementById('auth-menu');
    if (existing) { closeMenu(); return; }

    var api = window.API;
    var u = api.state.user;
    var T = window.AUTH;
    var lang = langOf();
    var isAdmin = api.isAdmin();

    var menu = document.createElement('div');
    menu.id = 'auth-menu';
    menu.className = 'auth-menu';
    menu.setAttribute('role', 'menu');

    var items = [
      { id: 'menu-account', label: T.t(lang, 'myAccount'), hash: '#account' }
    ];
    if (isAdmin) {
      items.push({ id: 'menu-admin', label: T.t(lang, 'admin'), hash: '#oaguanli' });
    }
    items.push({ id: 'menu-logout', label: T.t(lang, 'logout'), danger: true });

    menu.innerHTML =
      '<div class="auth-menu-head">' +
        '<span class="auth-menu-avatar">' +
          (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="">'
                        : esc((u.display_name || u.email || '?').trim().charAt(0).toUpperCase())) +
        '</span>' +
        '<span class="auth-menu-id">' +
          '<b>' + esc(u.display_name || u.email) + '</b>' +
          '<small dir="ltr">' + esc(u.email) + '</small>' +
        '</span>' +
      '</div>' +
      items.map(function (it) {
        return '<button class="auth-menu-item' + (it.danger ? ' is-danger' : '') +
               '" id="' + it.id + '" role="menuitem" data-hash="' + it.hash + '">' +
               esc(it.label) + '</button>';
      }).join('');

    document.body.appendChild(menu);
    var btn = document.getElementById('auth-entry');
    if (btn) btn.setAttribute('aria-expanded', 'true');

    // 定位到按钮下方
    var rect = btn.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = Math.min(rect.right - 200, window.innerWidth - 212);
    menu.style.top = Math.max(8, top) + 'px';
    menu.style.left = Math.max(8, left) + 'px';

    menu.addEventListener('click', function (ev) {
      var it = ev.target.closest('.auth-menu-item');
      if (!it) return;
      closeMenu();
      if (it.id === 'menu-logout') { doLogout(); return; }
      location.hash = it.dataset.hash;
    });
  }

  function doLogout() {
    return window.API.logout().then(function () {
      // 退出后数据源回落本地，清掉服务端态
      if (window.SERVERDATA) window.SERVERDATA.reset();
      if (window.__onAuthChange) window.__onAuthChange();
      mountHeaderEntry();
      // 停留在受限页面时退回首页
      var h = location.hash || '#home';
      if (h.indexOf('#oaguanli') === 0 || h.indexOf('#journal') === 0 ||
          h === '#account') {
        location.hash = '#home';
      }
    });
  }

  function mountHeaderEntry() {
    var tools = document.querySelector('.header-tools');
    if (!tools) return;
    closeMenu();
    var old = document.getElementById('auth-entry');
    if (old) old.remove();

    var api = window.API;
    var btn = document.createElement('button');
    btn.id = 'auth-entry';
    btn.className = 'auth-entry';
    btn.type = 'button';

    if (api && api.isLoggedIn()) {
      var u = api.state.user;
      var initial = (u.display_name || u.email || '?').trim().charAt(0).toUpperCase();
      btn.innerHTML =
        '<span class="auth-entry-avatar">' +
        (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="">' : esc(initial)) +
        '</span><span>' + esc(u.display_name || u.email) + '</span>' +
        '<span class="auth-entry-caret" aria-hidden="true">▾</span>';
      btn.setAttribute('aria-label', window.AUTH ? window.AUTH.t(langOf(), 'myAccount') : 'My account');
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      btn.textContent = window.AUTH ? window.AUTH.t(langOf(), 'login') + ' / ' + window.AUTH.t(langOf(), 'register') : '登录 / 注册';
      btn.setAttribute('aria-label', '登录 / 注册');
    }

    if (api && api.isLoggedIn()) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        toggleMenu();
      });
    } else {
      btn.addEventListener('click', function () {
        // 记住当前页，登录成功后回来
        var h = location.hash || '#home';
        if (h !== '#login' && h !== '#register') {
          savedHash = h;
          window.AUTH.saveRedirect(h);
        }
        location.hash = '#login';
      });
    }

    // 放在语言选择器之后
    var label = tools.querySelector('label');
    if (label && label.nextSibling) tools.insertBefore(btn, label.nextSibling);
    else tools.appendChild(btn);
  }

  function langOf() {
    if (typeof window.LANG === 'function') return window.LANG();
    return document.documentElement.lang || 'zh-CN';
  }

  /* ---------- 账户页 ---------- */
  function accountPage() {
    var api = window.API;
    var T = window.AUTH;
    var lang = langOf();

    if (!api.isLoggedIn()) {
      // 未登录直接访问账户页 → 引导登录
      return '<div class="auth-page">' +
        '<span class="eyebrow auth-eyebrow">' + esc(T.t(lang, 'account')) + '</span>' +
        '<h1 class="auth-title">' + esc(T.t(lang, 'login')) + '</h1>' +
        '<section class="auth-card"><button class="auth-btn-primary" id="goto-login">' +
        esc(T.t(lang, 'loginBtn')) + '</button>' +
        '<button class="auth-link" id="goto-register">' + esc(T.t(lang, 'toRegister')) + '</button>' +
        '</section></div>';
    }

    var u = api.state.user;
    var row = function (k, v) {
      return '<div class="account-row"><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>';
    };

    return '<div class="auth-page">' +
      '<span class="eyebrow auth-eyebrow">' + esc(T.t(lang, 'account')) + '</span>' +
      '<h1 class="auth-title" style="font-size:clamp(38px,8vw,56px)">' + esc(u.display_name) + '</h1>' +
      '<section class="account-sheet">' +
        row(T.t(lang, 'emailField'), esc(u.email)) +
        row(T.t(lang, 'roleField'), '<span class="account-badge">' + (api.isAdmin() ? 'admin' : 'user') + '</span>') +
        row(T.t(lang, 'joinedField'), esc(new Date(u.created_at).toLocaleDateString(lang))) +
      '</section>' +
      '<div class="account-actions">' +
        (api.isAdmin() ? '<button class="admin-btn" id="goto-admin">' + esc(T.t(lang, 'admin')) + '</button>' : '') +
        '<button class="admin-btn is-danger" id="do-logout">' + esc(T.t(lang, 'logout')) + '</button>' +
      '</div>' +
      '<p class="auth-toast" id="account-msg" role="status"></p>' +
    '</div>';
  }

  function bindAccount() {
    var T = window.AUTH;
    var gotoLogin = document.getElementById('goto-login');
    if (gotoLogin) gotoLogin.addEventListener('click', function () { location.hash = '#login'; });
    var gotoReg = document.getElementById('goto-register');
    if (gotoReg) gotoReg.addEventListener('click', function () { location.hash = '#register'; });

    var logout = document.getElementById('do-logout');
    if (logout) {
      logout.addEventListener('click', function () {
        doLogout().then(function () {
          var msg = document.getElementById('account-msg');
          if (msg) msg.textContent = T.t(langOf(), 'signedOut');
        });
      });
    }

    var gotoAdmin = document.getElementById('goto-admin');
    if (gotoAdmin) gotoAdmin.addEventListener('click', function () { location.hash = '#oaguanli'; });
  }

  /* ---------- 服务端数据源 ---------- */
  var SERVERDATA = {
    ready: false,
    moments: null,
    favorites: null,

    fetch: function () {
      if (!window.API.isLoggedIn()) { SERVERDATA.reset(); return Promise.resolve(null); }
      return Promise.all([
        window.API.listMoments(),
        window.API.listFavorites(),
        window.API.getPreferences().catch(function () { return null; })
      ]).then(function (res) {
        SERVERDATA.moments = (res[0] || []).map(function (m) {
          return {
            id: m.id,
            createdAt: m.created_at || '',
            date: m.date,
            symbol: m.symbol_id,
            emotion: m.emotion_id === null || m.emotion_id === undefined ? '' : String(m.emotion_id),
            note: m.note || '',
            mode: m.mode || ''
          };
        });
        SERVERDATA.favorites = (res[1] || []).map(function (f) { return f.symbol_id; });
        SERVERDATA.ready = true;
        // 把服务端数据灌进 app.js 使用的内存变量
        if (typeof window.__setRecords === 'function') {
          window.__setRecords(SERVERDATA.moments, SERVERDATA.favorites);
        }
        /* 偏好同步到内存：测试题袋、上次抽到的字 */
        var prefs = res[2];
        if (prefs) {
          SERVERDATA.prefs = prefs;
          if (typeof window.__setPrefs === 'function') window.__setPrefs(prefs);
        }
        /* 同步当日体验配额（按账号） */
        if (window.FLOW && window.FLOW.syncQuota) window.FLOW.syncQuota();
        /* 拉取账号上的报名意向草稿 */
        window.API.getApplication().then(function (a) {
          if (a && a.course_id) {
            SERVERDATA.application = a;
            if (typeof window.__setApplication === 'function') window.__setApplication(a);
          }
        }).catch(function () {});
        return SERVERDATA;
      }).catch(function () {
        // 服务端不可用时保持本地数据，页面不白屏
        return null;
      });
    },

    reset: function () {
      SERVERDATA.moments = null;
      SERVERDATA.favorites = null;
      SERVERDATA.prefs = null;
      SERVERDATA.application = null;
      SERVERDATA.ready = false;
      if (typeof window.__setRecords === 'function') window.__setRecords(null, null);
      if (typeof window.__setApplication === 'function') window.__setApplication(null);
    },

    saveMoment: function (record) {
      if (!window.API.isLoggedIn()) return Promise.reject(new Error('need login'));
      var payload = {
        date: record.date,
        symbol_id: Number(record.symbol),
        emotion_id: record.emotion === '' || record.emotion == null ? null : Number(record.emotion),
        note: record.note || '',
        mode: record.mode || null
      };
      /* 带 id 表示编辑既有记录，不带则新增（同一天可留多条） */
      if (record.id != null) payload.id = record.id;
      return window.API.saveMoment(payload).then(function () { return SERVERDATA.fetch(); });
    },

    toggleFavorite: function (symbolId, next) {
      if (!window.API.isLoggedIn()) return Promise.reject(new Error('need login'));
      var call = next ? window.API.addFavorite(symbolId) : window.API.removeFavorite(symbolId);
      return call.then(function () { return SERVERDATA.fetch(); });
    }
  };
  window.SERVERDATA = SERVERDATA;

  /* ---------- 首次登录：导入本地历史 ---------- */
  function migrateIfNeeded(user) {
    if (!user || user.__migrated) return;
    try {
      var raw = localStorage.getItem('oracle-records');
      var favRaw = localStorage.getItem('oracle-favorites');
      var records = raw ? JSON.parse(raw) : [];
      var favs = favRaw ? JSON.parse(favRaw) : [];
      if (!Array.isArray(records) || !Array.isArray(favs)) return;
      records = records.filter(function (r) { return r && r.date && r.symbol; });
      if (!records.length && !favs.length) return;

      window.API.migrateLocal({
        records: records.map(function (r) {
          return {
            date: r.date,
            symbol_id: Number(r.symbol),
            emotion_id: r.emotion === '' || r.emotion == null ? null : Number(r.emotion),
            note: (r.note || '').slice(0, 140),
            mode: r.mode || null
          };
        }),
        favorites: favs.map(Number).filter(function (n) { return !isNaN(n); })
      }).then(function (res) {
        if (res.imported_moments || res.imported_favorites) {
          localStorage.removeItem('oracle-records');
          localStorage.removeItem('oracle-favorites');
        }
        /* 其余本地键一并上传到账号，之后由服务端接管 */
        uploadLocalExtras();
        return SERVERDATA.fetch();
      }).catch(function () {});
    } catch (e) {}
  }

  /* 把本地残留的偏好/意向/配额上传到账号（只在该账号尚无服务端记录时） */
  function uploadLocalExtras() {
    if (!window.API || !window.API.isLoggedIn()) return;
    var lang = null;
    try { lang = localStorage.getItem('oracle-language'); } catch (e) {}
    var lastDraw = null;
    try { lastDraw = localStorage.getItem('oracle-last-draw'); } catch (e) {}
    var bag = null;
    try { bag = JSON.parse(localStorage.getItem('oracle-quiz-bag-v2') || 'null'); } catch (e) {}
    var prefs = {};
    if (lang) prefs.locale = lang;
    if (lastDraw && !isNaN(Number(lastDraw))) prefs.last_draw_symbol = Number(lastDraw);
    if (Array.isArray(bag) && bag.length) prefs.quiz_bag = bag.map(Number);
    if (Object.keys(prefs).length) {
      window.API.putPreferences(prefs).catch(function () {});
    }
    /* 报名意向草稿 */
    var app = null;
    try { app = JSON.parse(localStorage.getItem('oracle-course-application') || 'null'); } catch (e) {}
    if (app && app.course) {
      window.API.getApplication().then(function (exists) {
        if (exists && exists.course_id) return;   // 账号上已有，不覆盖
        return window.API.putApplication({
          course_id: app.course, name: app.name, country: app.country,
          region: app.region, email: app.email, phone: app.phone,
          age: app.age, gender: app.gender, reason: app.reason, saved_at: app.savedAt
        });
      }).catch(function () {});
    }
  }

  /* ---------- 守卫：底部 tab「我的片刻」 ---------- */
  function guardJournal() {
    if (!window.API.isLoggedIn()) {
      window.AUTH.saveRedirect('#journal');
      location.hash = '#login';
      return false;
    }
    return true;
  }

  /* ---------- 守卫：「保存，留下这个字」 ---------- */
  function guardSave(record) {
    if (window.API.isLoggedIn()) return true;
    // 记住当前结果与已填写的备注，登录后自动补上
    window.AUTH.saveRedirect('#keepsake');
    window.AUTH.saveDraft({ action: 'save', record: record });
    location.hash = '#login';
    return false;
  }

  function afterLogin() {
    migrateIfNeeded(window.API.state.user);
    return SERVERDATA.fetch();
  }

  /* ---------- 拦截保存按钮 ---------- */
  function interceptSave() {
    if (guarded) return;
    guarded = true;

    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('#save-result') : null;
      if (!btn) return;
      if (window.API.isLoggedIn()) return; // 已登录走原有逻辑

      ev.preventDefault();
      ev.stopImmediatePropagation();

      var ta = document.getElementById('daily-note');
      var note = ta ? ta.value : '';
      var rec = window.__currentResult ? { ...window.__currentResult } : null;
      if (rec && note) rec.note = note;
      if (rec) window.__pendingSave = rec;
      guardSave(rec);
    }, true);
  }

  /* ---------- 拦截底部「我的片刻」 ---------- */
  function interceptJournalNav() {
    var link = document.querySelector('[data-nav="journal"]');
    if (!link) return;
    link.addEventListener('click', function (ev) {
      if (window.API.isLoggedIn()) return;
      ev.preventDefault();
      window.AUTH.saveRedirect('#journal');
      location.hash = '#login';
    });
  }

  /* ---------- 路由守卫：hash 变化时 ---------- */
  var lastHash = null;

  /* 进入登录/注册页前先记下当前 hash，作为登录成功后的兜底回跳目标。
     这样即使用户手动输入 #login，登录后也能回到原来在看的那一页。 */
  function rememberSource() {
    var h = location.hash || '#home';
    if (h === '#login' || h === '#register') return;
    savedHash = h;
    window.AUTH.saveRedirect(h);
  }

  function routeGuard() {
    var h = location.hash || '#home';
    if (h === lastHash) return;
    lastHash = h;

    // 已登录时访问登录/注册页没有意义，直接送回首页
    if (h === '#login' || h === '#register') {
      if (window.API.state.ready && window.API.isLoggedIn()) {
        location.hash = '#home';
      }
      return;
    }

    // 受保护的 hash：直接输入地址也要拦
    if (h === '#journal' || h.indexOf('#journal/') === 0) {
      if (!window.API.isLoggedIn()) {
        rememberSource();
        location.hash = '#login';
        return;
      }
    }
    if (h === '#oaguanli' || h.indexOf('#oaguanli/') === 0) {
      if (!window.API.isLoggedIn()) {
        rememberSource();
        location.hash = '#login';
        return;
      }
      if (!window.API.isAdmin()) {
        location.hash = '#account';
        return;
      }
    }
  }

  /* ---------- 登录后处理草稿 ---------- */
  function handleDraft() {
    var draft = window.AUTH.takeDraft();
    if (!draft) return;
    if (draft.action === 'save' && draft.record) {
      var rec = draft.record;
      window.__pendingSave = rec;
      // 回到结果页，让用户看到自己填的内容
      window.__pendingSaveAfterLogin = rec;
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    window.AUTH.afterLogin = afterLogin;

    // 先拿登录态，再渲染入口
    window.API.refresh().then(function (user) {
      if (user) {
        migrateIfNeeded(user);
        SERVERDATA.fetch();
      }
      mountHeaderEntry();
      interceptSave();
      interceptJournalNav();
      handleDraft();
      window.addEventListener('hashchange', routeGuard);
      // 供 app.js 在登录态变化时调用
      window.__onAuthChange = function () {
        mountHeaderEntry();
        if (window.API.isLoggedIn()) SERVERDATA.fetch();
        else SERVERDATA.reset();
      };
      // 整页刷新后也要复查一次当前路由（hashchange 不会为初始 hash 触发）
      routeGuard();
      document.dispatchEvent(new CustomEvent('auth-ready'));
    });

    // 点击菜单外部 / 按 Esc 时关闭菜单
    document.addEventListener('click', function (ev) {
      var menu = document.getElementById('auth-menu');
      if (!menu) return;
      if (menu.contains(ev.target)) return;
      if (ev.target.closest && ev.target.closest('#auth-entry')) return;
      closeMenu();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeMenu();
    });
  }

  window.AUTH_INTEGRATION = {
    get savedHash() { return savedHash; },
    mountHeaderEntry: mountHeaderEntry,
    accountPage: accountPage,
    bindAccount: bindAccount,
    guardJournal: guardJournal,
    guardSave: guardSave,
    afterLogin: afterLogin,
    logout: doLogout,
    init: init,
    langOf: langOf
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
