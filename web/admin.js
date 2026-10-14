/* 管理员后台前端：甲骨文字库 / 情绪图标 / 用户管理。
   纯原生实现，不引入框架与构建步骤，保持站点「解压即跑」的基因。

   视图分两类（互不混排）：
   - 列表页：只显示表格 + 搜索 + 排序 + 「添加」链接
   - 表单页：添加 / 编辑，独立整页，含返回列表的链接
*/
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'th', 'ar'];
  var LOCALE_LABEL = {
    'zh-CN': '简体中文', 'zh-TW': '繁體中文', en: 'English',
    ja: '日本語', th: 'ไทย', ar: 'العربية'
  };

  var TABS = [
    { id: 'symbols', label: '甲骨文字库' },
    { id: 'emotions', label: '情绪图标' },
    { id: 'users', label: '用户管理' },
    { id: 'audit', label: '操作日志' }
  ];

  var cache = { symbols: null, emotions: null, users: null, audit: null, meta: null };
  var current = 'symbols';    // 当前 tab
  var view = 'list';          // 'list' | 'form'：列表页 or 表单页
  var editing = null;         // 正在编辑的原始对象
  var userQuery = '';
  var symSort = { key: 'id', dir: 'asc' };
  var emoSort = { key: 'id', dir: 'asc' };

  /* ---------------- 基础 ---------------- */

  function head(title, sub) {
    return '<header class="page-head"><span class="eyebrow" dir="ltr">ADMIN</span>' +
      '<h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</header>';
  }

  function tabs() {
    return '<div class="admin-tabs" role="tablist">' + TABS.map(function (t) {
      return '<button class="admin-tab" role="tab" data-tab="' + t.id + '" ' +
        'aria-selected="' + (t.id === current) + '">' + esc(t.label) + '</button>';
    }).join('') + '</div>';
  }

  function loading() { return '<p class="body-copy">加载中…</p>'; }

  /* 返回列表的超链接（表单页顶部用） */
  function backLink(hash, text) {
    return '<a class="admin-backlink" href="' + esc(hash) + '">← ' + esc(text) + '</a>';
  }

  /* 排序表头：可点击切换升/降序 */
  function sortTh(key, label, sortState, cls) {
    var active = sortState.key === key;
    var arrow = active ? (sortState.dir === 'asc' ? ' ↑' : ' ↓') : '';
    return '<th class="admin-sortable' + (cls ? ' ' + cls : '') + '" data-sort="' + key + '"' +
      ' aria-sort="' + (active ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '"' +
      ' tabindex="0" role="columnheader">' + esc(label) + '<span class="admin-sort-arrow">' + arrow + '</span></th>';
  }

  function applySort(list, sortState, accessors) {
    var arr = list.slice();
    var get = accessors[sortState.key];
    if (!get) return arr;
    arr.sort(function (a, b) {
      var x = get(a), y = get(b);
      if (typeof x === 'number' && typeof y === 'number') {
        return sortState.dir === 'asc' ? x - y : y - x;
      }
      x = String(x == null ? '' : x);
      y = String(y == null ? '' : y);
      // 中文按拼音排序更符合中文用户直觉
      var r = x.localeCompare(y, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
      return sortState.dir === 'asc' ? r : -r;
    });
    return arr;
  }

  /* ---------------- 图片上传控件 ---------------- */

  function imagePicker(id, path, kind) {
    return '<div class="admin-field">' +
      '<label>' + esc(kind) + '图片</label>' +
      '<div class="admin-uploader" data-uploader="' + id + '">' +
        '<button type="button" class="admin-upload-trigger" id="' + id + '-btn" ' +
          'aria-label="点击选择或更换图片">' +
          (path
            ? '<img src="' + esc(path) + '" alt="">'
            : '<span class="admin-upload-empty">＋<br>点击上传</span>') +
        '</button>' +
        '<input type="file" id="' + id + '-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
        '<code class="admin-upload-path" id="' + id + '-path" dir="ltr">' +
          esc(path || '尚未选择图片') + '</code>' +
      '</div>' +
      '<p class="admin-toast" id="' + id + '-msg" role="status"></p>' +
    '</div>';
  }

  function bindUploader(prefix) {
    var btn = document.getElementById(prefix + '-btn');
    var file = document.getElementById(prefix + '-file');
    if (!btn || !file) return;

    btn.addEventListener('click', function () { file.click(); });

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var info = document.getElementById(prefix + '-msg');
      btn.disabled = true;
      if (info) info.textContent = '上传中…';

      var fd = new FormData();
      fd.append('file', f);
      fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok) {
            if (info) info.textContent = (res.data && res.data.error && res.data.error.message) || '上传失败';
            return;
          }
          var path = res.data.path;
          btn.innerHTML = '<img src="' + esc(path) + '" alt="">';
          var p = document.getElementById(prefix + '-path');
          if (p) p.textContent = path;
          if (info) info.textContent = '上传成功';
        })
        .catch(function () {
          btn.disabled = false;
          if (info) info.textContent = '上传失败，请检查网络';
        });
    });
  }

  /* ---------------- 甲骨文字库：列表页 ---------------- */

  function symbolsList() {
    if (!cache.symbols) return loading();

    var q = (window.__symQuery || '').trim();
    var list = q
      ? cache.symbols.filter(function (s) {
          return (s.char || '').indexOf(q) >= 0 ||
                 (s.titleOf('zh-CN') || '').indexOf(q) >= 0;
        })
      : cache.symbols;

    list = applySort(list, symSort, {
      id: function (s) { return s.id; },
      char: function (s) { return s.char; },
      label: function (s) { return s.titleOf('zh-CN') || ''; }
    });

    var rows = list.map(function (s) {
      return '<tr>' +
        '<td>' + s.id + '</td>' +
        '<td><img class="admin-thumb" src="' + esc(s.image_path) + '" alt=""></td>' +
        '<td class="admin-glyph">' + esc(s.char) + '</td>' +
        '<td>' + esc(s.titleOf('zh-CN') || '—') + '</td>' +
        '<td><code>' + esc(s.mode || '—') + '</code></td>' +
        '<td>' + (s.is_published
          ? '<span class="admin-pill">已发布</span>'
          : '<span class="admin-pill is-off">已下架</span>') + '</td>' +
        '<td><button class="admin-btn" data-edit-symbol="' + s.id + '">编辑</button></td>' +
      '</tr>';
    }).join('');

    return '<div class="admin-toolbar admin-toolbar-list">' +
        '<input class="admin-search" id="sym-search" type="search" ' +
          'placeholder="搜索字或标题" value="' + esc(q) + '">' +
        '<a class="admin-addlink" href="#oaguanli/symbols/new">＋ 添加甲骨字</a>' +
      '</div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        sortTh('id', 'ID', symSort) +
        '<th>图片</th>' +
        sortTh('char', '字', symSort) +
        sortTh('label', '标题(简)', symSort) +
        '<th>模式</th><th>状态</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="admin-toolbar-hint">共 ' + cache.symbols.length + ' 个字' +
        (q ? '，匹配 ' + list.length + ' 条' : '') + '　·　点击表头可排序</p>';
  }

  /* ---------------- 甲骨文字库：表单页 ---------------- */

  function symbolForm(sym) {
    var isNew = !sym;
    var meta = cache.meta || { motions: [], modes: [] };
    var cur = sym || {
      char: '', image_path: '', motion: '', mode: 'Being',
      review: false, is_published: true, sort_order: 0, i18n: []
    };

    var field = function (loc, key, label, type) {
      var val = '';
      if (!isNew) {
        var f = (cur.i18n || []).find(function (x) { return x.locale === loc; });
        val = f ? (f[key] || '') : '';
      }
      return '<div class="admin-field"><label>' + esc(label) + '</label>' +
        (type === 'textarea'
          ? '<textarea data-sym-loc="' + loc + '" data-sym-key="' + key + '" dir="auto">' + esc(val) + '</textarea>'
          : '<input type="text" data-sym-loc="' + loc + '" data-sym-key="' + key + '" value="' + esc(val) + '" dir="auto">') +
        '</div>';
    };

    return head(isNew ? '添加甲骨字' : '编辑甲骨字',
                isNew ? '新建一个字，填完六语言后发布' : ('正在编辑 #' + cur.id + ' ' + cur.char)) +
      backLink('#oaguanli/symbols', '返回甲骨文字库') +
      '<div class="admin-save-panel" id="sym-editor">' +
        '<div class="admin-grid-2">' +
          '<div class="admin-field"><label>甲骨字 *</label>' +
            '<input type="text" id="sym-char" value="' + esc(cur.char) + '" maxlength="20" dir="auto"></div>' +
          (isNew ? '' : '<div class="admin-field"><label>ID（自动分配，不可改）</label>' +
            '<input type="text" value="' + cur.id + '" disabled></div>') +
        '</div>' +

        imagePicker('sym-img', cur.image_path, '字形') +

        '<div class="admin-grid-2">' +
          '<div class="admin-field"><label>模式 mode *</label>' +
            '<select id="sym-mode">' + options(meta.modes, cur.mode, false) + '</select>' +
            '<small class="admin-hint">Being＝静静感受（向内），Doing＝亲身行动（向外）</small></div>' +
          '<div class="admin-field"><label>三维动作 motion</label>' +
            '<select id="sym-motion">' + options(meta.motions, cur.motion, true, '（无三维动画）') + '</select>' +
            '<small class="admin-hint">决定结果页播放哪个 3D 动作；选「无」则不播放</small></div>' +
          (isNew ? '' :
            '<div class="admin-field"><label>排序</label>' +
            '<input type="number" id="sym-sort" value="' + (cur.sort_order || 0) + '"></div>') +
          '<div class="admin-field"><label>发布状态</label><select id="sym-pub">' +
            '<option value="1"' + (cur.is_published ? ' selected' : '') + '>已发布</option>' +
            '<option value="0"' + (!cur.is_published ? ' selected' : '') + '>已下架</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="admin-field"><label>' +
          '<input type="checkbox" id="sym-review"' + (cur.review ? ' checked' : '') + '> 标记为「资料待核对」</label></div>' +

        '<h3 class="admin-sub">六语言文案</h3>' +
        LOCALES.map(function (loc) {
          var f = (cur.i18n || []).find(function (x) { return x.locale === loc; });
          var done = f && f.title;
          return '<details' + (done || loc === 'zh-CN' ? ' open' : '') + '>' +
            '<summary>' + esc(LOCALE_LABEL[loc] + '（' + loc + '）') +
            (done ? ' ✓' : (loc === 'zh-CN' ? '（必填）' : '')) + '</summary>' +
            field(loc, 'title', '标题 *') +
            field(loc, 'meaning', '释义', 'textarea') +
            field(loc, 'action', '练习动作', 'textarea') +
            (loc === 'zh-CN' ? field(loc, 'reading', '照见解释', 'textarea') : '') +
          '</details>';
        }).join('') +

        '<div class="account-actions">' +
          '<button class="auth-btn-primary admin-save-btn" id="sym-save">' +
            (isNew ? '创建' : '保存') + '</button>' +
          '<a class="admin-btn admin-btn-aslink" href="#oaguanli/symbols">取消</a>' +
        '</div>' +
        '<p class="admin-toast" id="sym-msg" role="status"></p>' +
      '</div>';
  }

  function options(list, current, allowEmpty, emptyText) {
    var s = '<option value="">' + esc(emptyText || '（未设置）') + '</option>';
    list.forEach(function (v) {
      var val = typeof v === 'string' ? v : v.value;
      var lab = typeof v === 'string' ? v : (v.label || v.value);
      s += '<option value="' + esc(val) + '"' + (val === current ? ' selected' : '') +
           '>' + esc(lab) + '</option>';
    });
    return s;
  }

  function collectSymbolPayload() {
    var i18n = LOCALES.map(function (loc) {
      var get = function (key) {
        var el = document.querySelector('[data-sym-loc="' + loc + '"][data-sym-key="' + key + '"]');
        return el ? el.value.trim() : '';
      };
      return {
        locale: loc,
        title: get('title'),
        meaning: get('meaning') || null,
        action: get('action') || null,
        reading: (loc === 'zh-CN' ? get('reading') : null) || null
      };
    }).filter(function (x) { return x.title; });

    return {
      char: document.getElementById('sym-char').value.trim(),
      image_path: (document.getElementById('sym-img-path').textContent || '').trim(),
      motion: document.getElementById('sym-motion').value || null,
      mode: document.getElementById('sym-mode').value || 'Being',
      review: document.getElementById('sym-review').checked,
      is_published: document.getElementById('sym-pub').value === '1',
      sort_order: editing && document.getElementById('sym-sort')
        ? Number(document.getElementById('sym-sort').value || 0) : 0,
      i18n: i18n
    };
  }

  /* ---------------- 情绪图标：列表页 ---------------- */

  function emotionsList() {
    if (!cache.emotions) return loading();

    var q = (window.__emoQuery || '').trim();
    var list = q
      ? cache.emotions.filter(function (e) {
          return (e.label_default || '').indexOf(q) >= 0 ||
                 (e.labelOf('en') || '').indexOf(q) >= 0;
        })
      : cache.emotions;

    list = applySort(list, emoSort, {
      id: function (e) { return e.id; },
      label: function (e) { return e.label_default; },
      en: function (e) { return e.labelOf('en') || ''; }
    });

    var rows = list.map(function (e) {
      return '<tr>' +
        '<td>' + e.id + '</td>' +
        '<td><img class="admin-thumb" src="' + esc(e.image_path) + '" alt=""></td>' +
        '<td>' + esc(e.label_default) + '</td>' +
        '<td>' + esc(e.labelOf('en') || '—') + '</td>' +
        '<td><code>' + esc(e.group_name || '—') + '</code></td>' +
        '<td>' + (e.is_published
          ? '<span class="admin-pill">已发布</span>'
          : '<span class="admin-pill is-off">已下架</span>') + '</td>' +
        '<td><button class="admin-btn" data-edit-emotion="' + e.id + '">编辑</button></td>' +
      '</tr>';
    }).join('');

    return '<div class="admin-toolbar admin-toolbar-list">' +
        '<input class="admin-search" id="emo-search" type="search" ' +
          'placeholder="搜索标签" value="' + esc(q) + '">' +
        '<a class="admin-addlink" href="#oaguanli/emotions/new">＋ 添加情绪图标</a>' +
      '</div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        sortTh('id', 'ID', emoSort) +
        '<th>图标</th>' +
        sortTh('label', '标签(简)', emoSort) +
        sortTh('en', '标签(en)', emoSort) +
        '<th>分组</th><th>状态</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="admin-toolbar-hint">共 ' + cache.emotions.length + ' 个' +
        (q ? '，匹配 ' + list.length + ' 条' : '') + '　·　点击表头可排序</p>';
  }

  /* ---------------- 情绪图标：表单页 ---------------- */

  function emotionForm(emo) {
    var isNew = !emo;
    var meta = cache.meta || { emotion_groups: [] };
    var cur = emo || {
      label_default: '', image_path: '', group_name: '', is_published: true, i18n: []
    };

    return head(isNew ? '添加情绪图标' : '编辑情绪图标',
                isNew ? '新建一个情绪图标' : ('正在编辑 #' + cur.id + ' ' + cur.label_default)) +
      backLink('#oaguanli/emotions', '返回情绪图标') +
      '<div class="admin-save-panel" id="emo-editor">' +
        imagePicker('emo-img', cur.image_path, '情绪') +

        '<div class="admin-grid-2">' +
          '<div class="admin-field"><label>默认标签（简） *</label>' +
            '<input type="text" id="emo-label" value="' + esc(cur.label_default) + '" maxlength="20"></div>' +
          '<div class="admin-field"><label>所属分组</label>' +
            '<select id="emo-group">' +
              '<option value="">（未分组）</option>' +
              (meta.emotion_groups || []).map(function (g) {
                return '<option value="' + esc(g) + '"' + (g === cur.group_name ? ' selected' : '') + '>' +
                  esc(groupLabel(g)) + '</option>';
              }).join('') +
            '</select></div>' +
          '<div class="admin-field"><label>发布状态</label><select id="emo-pub">' +
            '<option value="1"' + (cur.is_published ? ' selected' : '') + '>已发布</option>' +
            '<option value="0"' + (!cur.is_published ? ' selected' : '') + '>已下架</option>' +
          '</select></div>' +
        '</div>' +

        '<h3 class="admin-sub">六语言标签</h3>' +
        LOCALES.map(function (loc) {
          var val = isNew ? '' : (cur.labelOf(loc) || '');
          return '<div class="admin-field"><label>' + esc(LOCALE_LABEL[loc] + '（' + loc + '）') +
            (loc === 'zh-CN' ? ' *' : '') + '</label>' +
            '<input type="text" data-emo-loc="' + loc + '" value="' + esc(val) + '" dir="auto"></div>';
        }).join('') +

        '<div class="account-actions">' +
          '<button class="auth-btn-primary admin-save-btn" id="emo-save">' +
            (isNew ? '创建' : '保存') + '</button>' +
          '<a class="admin-btn admin-btn-aslink" href="#oaguanli/emotions">取消</a>' +
        '</div>' +
        '<p class="admin-toast" id="emo-msg" role="status"></p>' +
      '</div>';
  }

  function groupLabel(g) {
    return { classic: '经典 classic', modern: '现代 modern',
             youth: '青年 youth', other: '其他 other' }[g] || g;
  }

  function collectEmotionPayload() {
    var i18n = LOCALES.map(function (loc) {
      var el = document.querySelector('[data-emo-loc="' + loc + '"]');
      return { locale: loc, label: el ? el.value.trim() : '' };
    }).filter(function (x) { return x.label; });

    return {
      label_default: document.getElementById('emo-label').value.trim(),
      group_name: document.getElementById('emo-group').value || null,
      image_path: (document.getElementById('emo-img-path').textContent || '').trim(),
      is_published: document.getElementById('emo-pub').value === '1',
      sort_order: 0,
      i18n: i18n
    };
  }

  /* ---------------- 用户管理 ---------------- */

  function usersView() {
    var head2 = '<div class="admin-toolbar">' +
      '<input class="admin-search" id="user-search" type="search" ' +
        'placeholder="搜索邮箱或昵称，回车确认" value="' + esc(userQuery) + '" dir="ltr">' +
    '</div>';
    if (!cache.users) return head2 + loading();

    var rows = cache.users.map(function (u) {
      var isSelf = window.API.state.user && u.id === window.API.state.user.id;
      return '<tr>' +
        '<td>' + u.id + '</td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td>' + esc(u.display_name) + '</td>' +
        '<td><span class="admin-pill">' + esc(u.role) + '</span></td>' +
        '<td>' + (u.status === 'active'
          ? '<span class="admin-pill">正常</span>'
          : '<span class="admin-pill is-off">已停用</span>') + '</td>' +
        '<td>' + u.moment_count + '</td>' +
        '<td>' + (isSelf
          ? '<span class="admin-pill is-off">本人</span>'
          : '<button class="admin-btn" data-toggle-role="' + u.id + '" data-role="' + esc(u.role) + '">' +
            (u.role === 'admin' ? '取消管理员' : '设为管理员') + '</button> ' +
            '<button class="admin-btn" data-toggle-status="' + u.id + '" data-status="' + esc(u.status) + '">' +
            (u.status === 'active' ? '停用' : '启用') + '</button>') +
        '</td>' +
      '</tr>';
    }).join('');

    return head2 +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>ID</th><th>邮箱</th><th>昵称</th><th>角色</th><th>状态</th><th>片刻</th><th>操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="admin-toolbar-hint">共 ' + cache.users.length + ' 名用户</p>';
  }

  /* ---------------- 操作日志 ---------------- */

  function auditView() {
    if (!cache.audit) return loading();
    var rows = cache.audit.map(function (a) {
      return '<tr><td>' + esc(a.admin) + '</td><td><code>' + esc(a.action) + '</code></td>' +
        '<td>' + esc(a.target_type || '') + '</td><td>' + esc(a.target_id || '') + '</td>' +
        '<td>' + esc((a.detail || '').slice(0, 60)) + '</td>' +
        '<td>' + esc(a.created_at ? new Date(a.created_at).toLocaleString() : '') + '</td></tr>';
    }).join('');
    return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>管理员</th><th>动作</th><th>对象</th><th>ID</th><th>详情</th><th>时间</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------------- 页面组装 ---------------- */

  function page(param) {
    // param 形如 'symbols' / 'symbols/new' / 'symbols/3'
    var parts = String(param || '').split('/').filter(Boolean);
    var tab = parts[0] || 'symbols';
    var action = parts[1] || '';

    ensure(tab);

    if (tab === 'users') {
      current = 'users'; view = 'list';
      return head('管理后台', '用户与权限') + tabs() + usersView();
    }
    if (tab === 'audit') {
      current = 'audit'; view = 'list';
      return head('管理后台', '管理员操作留痕') + tabs() + auditView();
    }

    if (tab === 'symbols') {
      current = 'symbols';
      if (action === 'new') { view = 'form'; editing = null; return symbolForm(null); }
      if (/^\d+$/.test(action)) {
        view = 'form';
        editing = (cache.symbols || []).find(function (s) { return String(s.id) === action; }) || null;
        return symbolForm(editing);
      }
      view = 'list'; editing = null;
      return head('管理后台', '甲骨文字库') + tabs() + symbolsList();
    }

    if (tab === 'emotions') {
      current = 'emotions';
      if (action === 'new') { view = 'form'; editing = null; return emotionForm(null); }
      if (/^\d+$/.test(action)) {
        view = 'form';
        editing = (cache.emotions || []).find(function (e) { return String(e.id) === action; }) || null;
        return emotionForm(editing);
      }
      view = 'list'; editing = null;
      return head('管理后台', '情绪图标') + tabs() + emotionsList();
    }

    return head('管理后台') + tabs() + loading();
  }

  /* 数据拉取：幂等，缺失时才请求 */
  function ensure(what) {
    if (!cache.meta) {
      window.API.request('/api/admin/meta').then(function (d) {
        cache.meta = d || {};
        if (current === 'symbols' || current === 'emotions') rerender();
      });
    }
    if (what === 'symbols' && !cache.symbols) {
      window.API.request('/api/admin/symbols').then(function (d) {
        cache.symbols = (d || []).map(normSymbol); rerender();
      });
    } else if (what === 'emotions' && !cache.emotions) {
      window.API.request('/api/admin/emotions').then(function (d) {
        cache.emotions = (d || []).map(normEmotion); rerender();
      });
    } else if (what === 'audit' && !cache.audit) {
      window.API.request('/api/admin/audit').then(function (d) {
        cache.audit = d || []; rerender();
      });
    } else if (what === 'users' && !cache.users) {
      loadUsers();
    }
  }

  function loadUsers() {
    var url = '/api/admin/users' + (userQuery ? '?q=' + encodeURIComponent(userQuery) : '');
    window.API.request(url).then(function (d) { cache.users = d || []; rerender(); });
  }

  function rerender() { if (typeof window.render === 'function') window.render(); }

  function normSymbol(s) {
    s.titleOf = function (loc) {
      var f = (s.i18n || []).find(function (x) { return x.locale === loc; });
      return f ? f.title : '';
    };
    return s;
  }

  function normEmotion(e) {
    e.labelOf = function (loc) {
      var f = (e.i18n || []).find(function (x) { return x.locale === loc; });
      return f ? f.label : '';
    };
    return e;
  }

  /* ---------------- 事件 ---------------- */

  function toggleSort(key, state) {
    if (state.key === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else { state.key = key; state.dir = 'asc'; }
    rerender();
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;

    // 表头排序
    var th = t.closest && t.closest('[data-sort]');
    if (th) {
      var key = th.dataset.sort;
      if (current === 'symbols') toggleSort(key, symSort);
      else if (current === 'emotions') toggleSort(key, emoSort);
      return;
    }

    var tab = t.closest && t.closest('[data-tab]');
    if (tab) { location.hash = '#oaguanli/' + tab.dataset.tab; return; }

    // 进入编辑页
    var es = t.closest && t.closest('[data-edit-symbol]');
    if (es) { location.hash = '#oaguanli/symbols/' + es.dataset.editSymbol; return; }

    var ee = t.closest && t.closest('[data-edit-emotion]');
    if (ee) { location.hash = '#oaguanli/emotions/' + ee.dataset.editEmotion; return; }

    var tr = t.closest && t.closest('[data-toggle-role]');
    if (tr) {
      var next = tr.dataset.role === 'admin' ? 'user' : 'admin';
      window.API.request('/api/admin/users/' + tr.dataset.toggleRole, {
        method: 'PATCH', body: { role: next }
      }).then(loadUsers);
      return;
    }

    var ts = t.closest && t.closest('[data-toggle-status]');
    if (ts) {
      var nxt = ts.dataset.status === 'active' ? 'disabled' : 'active';
      window.API.request('/api/admin/users/' + ts.dataset.toggleStatus, {
        method: 'PATCH', body: { status: nxt }
      }).then(loadUsers);
      return;
    }

    // 保存甲骨字
    if (t.closest && t.closest('#sym-save')) {
      var smsg = document.getElementById('sym-msg');
      var sp = collectSymbolPayload();
      var isNew = !editing;
      var symUrl = isNew ? '/api/admin/symbols' : '/api/admin/symbols/' + editing.id;
      window.API.request(symUrl, { method: isNew ? 'POST' : 'PUT', body: sp })
        .then(function (updated) {
          if (isNew) cache.symbols = (cache.symbols || []).concat([normSymbol(updated)]);
          else cache.symbols = cache.symbols.map(function (s) {
            return s.id === updated.id ? normSymbol(updated) : s;
          });
          editing = null;
          location.hash = '#oaguanli/symbols';
        })
        .catch(function (e) { if (smsg) smsg.textContent = e.message; });
      return;
    }

    // 保存情绪
    if (t.closest && t.closest('#emo-save')) {
      var emsg = document.getElementById('emo-msg');
      var ep = collectEmotionPayload();
      var eIsNew = !editing;
      var emoUrl = eIsNew ? '/api/admin/emotions' : '/api/admin/emotions/' + editing.id;
      window.API.request(emoUrl, { method: eIsNew ? 'POST' : 'PUT', body: ep })
        .then(function (updated) {
          if (eIsNew) cache.emotions = (cache.emotions || []).concat([normEmotion(updated)]);
          else cache.emotions = cache.emotions.map(function (e) {
            return e.id === updated.id ? normEmotion(updated) : e;
          });
          editing = null;
          location.hash = '#oaguanli/emotions';
        })
        .catch(function (e) { if (emsg) emsg.textContent = e.message; });
    }
  });

  // 表头排序也支持键盘操作
  document.addEventListener('keydown', function (ev) {
    var th = ev.target.closest && ev.target.closest('[data-sort]');
    if (th && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      var key = th.dataset.sort;
      if (current === 'symbols') toggleSort(key, symSort);
      else if (current === 'emotions') toggleSort(key, emoSort);
    }
  });

  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'sym-search') { window.__symQuery = ev.target.value; scheduleRerender(); }
    if (ev.target.id === 'emo-search') { window.__emoQuery = ev.target.value; scheduleRerender(); }
    if (ev.target.id === 'user-search') userQuery = ev.target.value.trim();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.target.id === 'user-search' && ev.key === 'Enter') {
      ev.preventDefault(); cache.users = null; loadUsers();
    }
  });

  /* 搜索实时过滤：debounce 避免每次按键都重排 DOM */
  var timer = null;
  function scheduleRerender() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var el = document.activeElement;
      var id = el && el.id;
      var pos = el && el.selectionStart;
      rerender();
      // 重绘后恢复焦点与光标位置
      if (id) {
        var again = document.getElementById(id);
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (e) {}
        }
      }
    }, 220);
  }

  // 上传控件随 DOM 变化自动绑定
  var observer = new MutationObserver(function () {
    if (document.getElementById('sym-editor')) bindUploader('sym-img');
    if (document.getElementById('emo-editor')) bindUploader('emo-img');
  });

  window.ADMIN = {
    page: page,
    load: function () { ensure(current); },
    bind: function () { observer.observe(document.body, { childList: true, subtree: true }); },
    cache: cache
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.ADMIN.bind(); });
  } else {
    window.ADMIN.bind();
  }
})();
