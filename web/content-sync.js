/* 内容同步层：让前台体验流程读取后台（数据库）的内容。

  背景：前台原先读静态 `web/content.js`，后台管理写PostgreSQL，
  两者互不相通——后台添加/修改/下架的内容，用户看不到。

  本模块在页面加载后拉取 `/api/content`，用数据库里的已发布内容覆盖
  `window.CONTENT` 与 app.js 的局部变量，然后让页面重渲染一次。

  设计原则：**永不阻塞**。拉取失败、超时、接口不可用时，
  继续使用静态 content.js 的内容，站点照常可用。 */
(function () {
  'use strict';

  var TIMEOUT = 6000;      // 超过这个时间就放弃，用静态内容
  var applied = false;

  /* 抽签只从「已发布」的内容里选；历史数据另存一份，供旧记录回显。 */
  var published = null;

  function load() {
    // 页面已经离线打开（比如直接双击 index.html），fetch 会失败，静默即可
    if (typeof fetch !== 'function') return;

    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT);

    var opts = controller ? { signal: controller.signal, credentials: 'same-origin' }
                          : { credentials: 'same-origin' };

    fetch('/api/content', opts)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !Array.isArray(data.symbols) || !data.symbols.length) return;

        /* 已发布集合 —— 只有这些参与抽字 */
        published = data;

        /* 回显集合 = 新内容 + 旧内容中已不在新内容里的（多半是下架/删除）。
           这样用户历史上保存过的字仍能在「我的片刻」正常显示，
           不会因byId() 查不到而报 undefined。 */
        var merged = mergeKeepingHistory(data.symbols, currentSymbols());
        var patch = { symbols: merged };
        if (data.emotions) patch.emotions = data.emotions;
        if (data.questions) patch.questions = data.questions;

        if (typeof window.__applyContent === 'function') {
          applied = window.__applyContent(patch) || applied;
        } else {
          // app.js 尚未就绪时直接改 CONTENT，等它解构时会拿到新值
          window.CONTENT.symbols = patch.symbols;
          window.CONTENT.emotions = patch.emotions || window.CONTENT.emotions;
          window.CONTENT.questions = patch.questions || window.CONTENT.questions;
        }
        if (applied) rerender();
      })
      .catch(function () {
        clearTimeout(timer);
        // 静默失败：沿用静态 content.js 的内容
      });
  }

  function currentSymbols() {
    if (Array.isArray(window.CONTENT && window.CONTENT.symbols)) {
      return window.CONTENT.symbols;
    }
    return [];
  }

  /* 把 old 中不在 incoming 里的条目追加到 incoming 末尾。
     这些条目不再参与抽签（draw.js 只用 published 集合），
     仅用于让历史记录仍能渲染出图片与文字。 */
  function mergeKeepingHistory(incoming, old) {
    var seen = {};
    incoming.forEach(function (s) { seen[s.id] = true; });
    var orphans = old.filter(function (s) { return !seen[s.id]; });
    return orphans.length ? incoming.concat(orphans) : incoming;
  }

  /* 内容变化会影响当前页面的渲染（如情绪页列表、抽字结果），需要重绘。
     若当前正处于需要 3D/动画的流程中，重绘可能有副作用，
     因此只在首页/情绪页等安全路由重绘。 */
  function rerender() {
    var h = location.hash || '#home';
    var safe = ['#home', '#emotions', '#library', '#about'].indexOf(h) >= 0 ||
               h === '#home' || h === '#emotions';
    if (!safe) return;
    if (typeof window.render === 'function') {
      try { window.render(); } catch (e) { /* 渲染失败保持原状 */ }
    }
  }

  // 尽早启动，尽量赶在首次渲染之前完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  window.__contentSync = { reload: load, isApplied: function () { return applied; } };
})();
