/* 登录 / 注册页面
   视觉严格对齐设计稿：
   - 暖米底 + 超大墨色标题 + eyebrow 小字
   - 一张圆角卡片，内部分「GOOGLE 账号」与「邮箱和密码」两个区块，中间细分隔线
   - 主按钮墨绿实心全圆角，次级动作为文字链接
*/
(function () {
  'use strict';

  var KEY_REDIRECT = 'oracle-auth-redirect';
  var KEY_DRAFT = 'oracle-auth-draft';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var T = {
    'zh-CN': {
      account: '账号', login: '登录', register: '注册', sub: '请选择一种方式进入你的账号。',
      google: 'GOOGLE 账号', googleBtn: '使用 Google 继续',
      emailPwd: '邮箱和密码', email: 'you@example.com', password: '密码',
      confirm: '确认密码', loginBtn: '登录', registerBtn: '创建账号',
      toRegister: '注册新账号', toLogin: '已有账号？返回登录',
      logout: '退出登录', myAccount: '我的账号', admin: '管理后台',
      emailField: '邮箱', roleField: '角色', joinedField: '加入于',
      needLogin: '请先登录', googleOff: '服务器尚未配置 Google 登录',
      welcome: '欢迎回来', signedOut: '已退出登录',
      savedOk: '已保存', nameLabel: '怎么称呼你（可选）'
    },
    'zh-TW': {
      account: '帳號', login: '登入', register: '註冊', sub: '請選擇一種方式進入你的帳號。',
      google: 'GOOGLE 帳號', googleBtn: '使用 Google 繼續',
      emailPwd: '電子郵件和密碼', email: 'you@example.com', password: '密碼',
      confirm: '確認密碼', loginBtn: '登入', registerBtn: '建立帳號',
      toRegister: '註冊新帳號', toLogin: '已有帳號？返回登入',
      logout: '登出', myAccount: '我的帳號', admin: '管理後台',
      emailField: '電子郵件', roleField: '角色', joinedField: '加入於',
      needLogin: '請先登入', googleOff: '伺服器尚未設定 Google 登入',
      welcome: '歡迎回來', signedOut: '已登出',
      savedOk: '已儲存', nameLabel: '怎麼稱呼你（選填）'
    },
    en: {
      account: 'Account', login: 'Sign in', register: 'Sign up',
      sub: 'Choose how you would like to access your account.',
      google: 'GOOGLE ACCOUNT', googleBtn: 'Continue with Google',
      emailPwd: 'Email and password', email: 'you@example.com', password: 'Password',
      confirm: 'Confirm password', loginBtn: 'Sign in', registerBtn: 'Create account',
      toRegister: 'Sign up for a new account', toLogin: 'Already have an account? Sign in',
      logout: 'Sign out', myAccount: 'My account', admin: 'Admin',
      emailField: 'Email', roleField: 'Role', joinedField: 'Joined',
      needLogin: 'Please sign in first', googleOff: 'Google sign-in is not configured yet',
      welcome: 'Welcome back', signedOut: 'Signed out',
      savedOk: 'Saved', nameLabel: 'What should we call you (optional)'
    },
    ja: {
      account: 'アカウント', login: 'ログイン', register: '新規登録',
      sub: 'アカウントへの入り方を選んでください。',
      google: 'GOOGLE アカウント', googleBtn: 'Google で続ける',
      emailPwd: 'メールとパスワード', email: 'you@example.com', password: 'パスワード',
      confirm: 'パスワード（確認）', loginBtn: 'ログイン', registerBtn: 'アカウント作成',
      toRegister: '新規アカウントを作成', toLogin: 'アカウントをお持ちの方はログイン',
      logout: 'ログアウト', myAccount: 'マイアカウント', admin: '管理画面',
      emailField: 'メールアドレス', roleField: '権限', joinedField: '登録日',
      needLogin: 'ログインしてください', googleOff: 'Google ログインはまだ設定されていません',
      welcome: 'おかえりなさい', signedOut: 'ログアウトしました',
      savedOk: '保存しました', nameLabel: 'お名前（任意）'
    },
    th: {
      account: 'บัญชี', login: 'เข้าสู่ระบบ', register: 'สมัครสมาชิก',
      sub: 'เลือกวิธีเข้าสู่บัญชีของคุณ',
      google: 'บัญชี GOOGLE', googleBtn: 'ดำเนินการต่อด้วย Google',
      emailPwd: 'อีเมลและรหัสผ่าน', email: 'you@example.com', password: 'รหัสผ่าน',
      confirm: 'ยืนยันรหัสผ่าน', loginBtn: 'เข้าสู่ระบบ', registerBtn: 'สร้างบัญชี',
      toRegister: 'สมัครบัญชีใหม่', toLogin: 'มีบัญชีแล้ว? เข้าสู่ระบบ',
      logout: 'ออกจากระบบ', myAccount: 'บัญชีของฉัน', admin: 'ผู้ดูแลระบบ',
      emailField: 'อีเมล', roleField: 'บทบาท', joinedField: 'เข้าร่วมเมื่อ',
      needLogin: 'กรุณาเข้าสู่ระบบก่อน', googleOff: 'ยังไม่ได้ตั้งค่า Google',
      welcome: 'ยินดีต้อนรับกลับมา', signedOut: 'ออกจากระบบแล้ว',
      savedOk: 'บันทึกแล้ว', nameLabel: 'ชื่อที่ต้องการให้เรียก (ไม่บังคับ)'
    },
    ar: {
      account: 'الحساب', login: 'تسجيل الدخول', register: 'إنشاء حساب',
      sub: 'اختر طريقة الدخول إلى حسابك.',
      google: 'حساب GOOGLE', googleBtn: 'المتابعة باستخدام Google',
      emailPwd: 'البريد الإلكتروني وكلمة المرور', email: 'you@example.com', password: 'كلمة المرور',
      confirm: 'تأكيد كلمة المرور', loginBtn: 'تسجيل الدخول', registerBtn: 'إنشاء حساب',
      toRegister: 'إنشاء حساب جديد', toLogin: 'لديك حساب بالفعل؟ سجّل الدخول',
      logout: 'تسجيل الخروج', myAccount: 'حسابي', admin: 'لوحة الإدارة',
      emailField: 'البريد الإلكتروني', roleField: 'الدور', joinedField: 'تاريخ الانضمام',
      needLogin: 'يرجى تسجيل الدخول أولاً', googleOff: 'تسجيل دخول Google غير مُعدّ بعد',
      welcome: 'أهلاً بعودتك', signedOut: 'تم تسجيل الخروج',
      savedOk: 'تم الحفظ', nameLabel: 'بماذا نناديك (اختياري)'
    }
  };

  function t(lang, key) {
    var pack = T[lang] || T['zh-CN'];
    return pack[key] || T['zh-CN'][key] || key;
  }

  function saveRedirect(hash) {
    try { sessionStorage.setItem(KEY_REDIRECT, hash || '#home'); } catch (e) {}
  }
  function takeRedirect() {
    try {
      var v = sessionStorage.getItem(KEY_REDIRECT);
      sessionStorage.removeItem(KEY_REDIRECT);
      return v || '#home';
    } catch (e) { return '#home'; }
  }
  function saveDraft(draft) {
    try { sessionStorage.setItem(KEY_DRAFT, JSON.stringify(draft || null)); } catch (e) {}
  }
  function takeDraft() {
    try {
      var v = sessionStorage.getItem(KEY_DRAFT);
      sessionStorage.removeItem(KEY_DRAFT);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  /* 守卫：未登录时记录目标路由并跳转登录页。
     pending 为可选的登录后要执行的回调名（如 'save' / 'journal'）。 */
  function requireLogin(pending) {
    if (window.API && window.API.isLoggedIn()) return true;
    saveRedirect(window.location.hash || '#home');
    if (pending) saveDraft(pending);
    window.location.hash = '#login';
    return false;
  }

  function authPage(mode) {
    var isReg = mode === 'register';
    var lang = (typeof window.LANG === 'function') ? window.LANG() : 'zh-CN';
    var api = window.API;
    var googleOn = api && api.state.googleEnabled;

    return '' +
      '<div class="auth-page">' +
        '<span class="eyebrow auth-eyebrow">' + esc(t(lang, 'account')) + '</span>' +
        '<h1 class="auth-title">' + esc(t(lang, isReg ? 'register' : 'login')) + '</h1>' +
        '<p class="auth-sub">' + esc(t(lang, 'sub')) + '</p>' +
        '<section class="auth-card">' +
          '<div class="auth-section-label">' + esc(t(lang, 'google')) + '</div>' +
          '<button class="auth-btn-primary" id="auth-google" ' +
            (googleOn ? '' : 'disabled aria-disabled="true"') + '>' +
            esc(t(lang, 'googleBtn')) +
          '</button>' +
          (googleOn ? '' : '<p class="auth-hint">' + esc(t(lang, 'googleOff')) + '</p>') +
          '<hr class="auth-divider">' +
          '<div class="auth-section-label">' + esc(t(lang, 'emailPwd')) + '</div>' +
          '<form id="auth-form" novalidate>' +
            '<label class="sr-only" for="auth-email">' + esc(t(lang, 'emailPwd')) + '</label>' +
            '<input class="auth-input" id="auth-email" name="email" type="email" ' +
              'autocomplete="email" dir="ltr" placeholder="' + esc(t(lang, 'email')) + '">' +
            '<p class="auth-error" id="err-email" role="alert"></p>' +
            '<label class="sr-only" for="auth-password">' + esc(t(lang, 'password')) + '</label>' +
            '<input class="auth-input" id="auth-password" name="password" type="password" ' +
              'autocomplete="' + (isReg ? 'new-password' : 'current-password') + '" dir="ltr" placeholder="' + esc(t(lang, 'password')) + '">' +
            '<p class="auth-error" id="err-password" role="alert"></p>' +
            (isReg ?
              '<label class="sr-only" for="auth-confirm">' + esc(t(lang, 'confirm')) + '</label>' +
              '<input class="auth-input" id="auth-confirm" name="confirm" type="password" ' +
                'autocomplete="new-password" dir="ltr" placeholder="' + esc(t(lang, 'confirm')) + '">' +
              '<p class="auth-error" id="err-confirm" role="alert"></p>' +
              '<label class="sr-only" for="auth-name">' + esc(t(lang, 'nameLabel')) + '</label>' +
              '<input class="auth-input" id="auth-name" name="display_name" type="text" ' +
                'autocomplete="nickname" placeholder="' + esc(t(lang, 'nameLabel')) + '">'
              : '') +
            '<p class="auth-error" id="err-form" role="alert"></p>' +
            '<button class="auth-btn-primary" id="auth-submit" type="submit">' +
              esc(t(lang, isReg ? 'registerBtn' : 'loginBtn')) +
            '</button>' +
          '</form>' +
          '<button class="auth-link" id="auth-switch">' +
            esc(t(lang, isReg ? 'toLogin' : 'toRegister')) +
          '</button>' +
        '</section>' +
      '</div>';
  }

  function clearErrors() {
    ['email', 'password', 'confirm', 'form'].forEach(function (k) {
      var el = document.getElementById('err-' + k);
      if (el) el.textContent = '';
    });
  }

  function showError(field, message) {
    var el = document.getElementById('err-' + (field || 'form'));
    if (el) el.textContent = message;
  }

  function bind(page, mode) {
    var lang = (typeof window.LANG === 'function') ? window.LANG() : 'zh-CN';
    var api = window.API;

    var g = document.getElementById('auth-google');
    if (g) {
      g.addEventListener('click', function () {
        if (!api.state.googleEnabled) { showError('form', t(lang, 'googleOff')); return; }
        api.googleLogin();
      });
    }

    var sw = document.getElementById('auth-switch');
    if (sw) {
      sw.addEventListener('click', function () {
        window.location.hash = mode === 'register' ? '#login' : '#register';
      });
    }

    var form = document.getElementById('auth-form');
    if (!form) return;

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearErrors();

      var email = document.getElementById('auth-email').value.trim();
      var password = document.getElementById('auth-password').value;
      var confirmEl = document.getElementById('auth-confirm');
      var nameEl = document.getElementById('auth-name');

      // 前端先做基本校验，减少无谓请求；后端仍会再校验一次
      if (!email) { showError('email', '请填写邮箱'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('email', '邮箱格式不正确'); return;
      }
      if (!password) { showError('password', '请填写密码'); return; }
      if (mode === 'register' && password.length < 8) {
        showError('password', '密码至少 8 位'); return;
      }
      if (mode === 'register' && confirmEl && confirmEl.value !== password) {
        showError('confirm', '两次输入的密码不一致'); return;
      }

      var btn = document.getElementById('auth-submit');
      if (btn) btn.disabled = true;

      var action = mode === 'register'
        ? api.register(email, password, nameEl ? nameEl.value.trim() : '')
        : api.login(email, password);

      action.then(function () {
        if (window.AUTH && window.AUTH.afterLogin) window.AUTH.afterLogin();
        // 登录成功后回到登录前的页面；
        // 若没有记录（例如用户直接手动输入 #login），退回当前页或首页
        var back = takeRedirect();
        if (!back || back === '#login' || back === '#register') {
          back = (window.AUTH_INTEGRATION && window.AUTH_INTEGRATION.savedHash) || '#home';
        }
        window.location.hash = back;
      }).catch(function (e) {
        showError(e.field, e.message);
        if (btn) btn.disabled = false;
      });
    });
  }

  var AUTH = {
    t: t,
    esc: esc,
    authPage: authPage,
    bind: bind,
    requireLogin: requireLogin,
    saveRedirect: saveRedirect,
    takeRedirect: takeRedirect,
    saveDraft: saveDraft,
    takeDraft: takeDraft
  };
  window.AUTH = AUTH;
})();
