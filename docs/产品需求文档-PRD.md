# 字有答案 · 产品需求文档（PRD）

> 版本：v1.0　　日期：2026-10-13　　状态：待评审
> 范围：账号体系、数据库落地、权限守卫、管理员后台、Google OAuth、图片显示修复

---

## 0. 项目现状（改造前事实基线）

改造前必须承认的事实，后续所有方案都基于此：

| 维度 | 现状 |
|---|---|
| 架构 | 纯静态前端 SPA，无后端、无构建步骤 |
| 路由 | hash 路由（`#home` / `#journal` / `#symbol/12`…），监听 `hashchange` 重渲染 |
| 数据 | **全部在 localStorage**，无任何服务端 |
| localStorage 键 | `oracle-records`（我的片刻）、`oracle-favorites`（收藏）、`oracle-language`、`oracle-last-draw`、`oracle-daily-claims`、`oracle-experience-count-v2`、`oracle-commerce-demo` |
| 「保存，留下这个字」 | `experience-flow.js` 中 `#save-result` 按钮 → 写入 localStorage 的 `records` |
| 「我的片刻」tab | `app.js` 中 `journal()` 函数 → 读 localStorage 的 `records` / `favorites` |
| 资源 | 66 png + 51 webp + 51 glb + 4 jpg，已验证 121/121 全部可正常解码 |
| 依赖 | 仅 `vendor/model-viewer.min.js`（本地化，无 CDN） |
| 现有账号 | 仅 `commerce.js` 的**演示态**假账号（`oracle-commerce-demo.account`），无真实校验 |

**关键结论**：本次改造的本质是「给一个无后端的静态站注入后端与持久化」，属于架构级变更，不是加功能。

---

## 1. 图片无法显示 — 根因诊断（已完成）

### 1.1 排查过程与结论

已排除的可能：

- ❌ 文件缺失 —— 代码引用的 121 个资源全部存在，路径无差集
- ❌ 文件损坏 —— Pillow 全量解码 121/121 通过，PNG/JPG/WebP 魔数均正确
- ❌ 文件名异常字符 —— 无中文、无空格、无隐藏字符
- ❌ 网络 404 —— 本地服务器对所有资源返回 200

### 1.2 真正的根因

**甲骨文字图片是 RGB 模式、纯白背景、无 Alpha 通道，却统一套用了 `mix-blend-mode: multiply`（正片叠底）。**

证据：

```
symbol-1.png    模式=RGB   尺寸=210×290   无 alpha 通道
四角像素: (255,255,255) (255,255,255) (255,255,255) (255,255,255)
最常见色: (255,255,255) 占 38.6%   ← 纯白背景
```

`styles.css` 中相关规则：

```css
.symbol-stage img { mix-blend-mode: multiply }   /* 结果页大字 */
.symbol-tile img   { mix-blend-mode: multiply }   /* 字库九宫格 */
.quiz-art          { mix-blend-mode: multiply }   /* 测试结果图 */
.emotion img       { mix-blend-mode: multiply }   /* 情绪图标 */
.badge-orbit img   { mix-blend-mode: multiply }   /* 纪念字卡 */
```

`multiply` 的语义是「让白色变透明」——作者的原意是配合**透明底 PNG**，让暖色背景透出来。但实际文件是**白底 RGB**，于是：

- 在**浅色**背景上：白 × 浅色 = 浅色，图片几乎隐形 → 「看不到字」
- 在**深色**背景上：白 × 深色 = 深色，整块白色方块糊在深色上，非常刺眼
- 只有 `ritual-stone-transparent.png`（RGBA、真透明四角）才符合 `multiply` 的预期

这就是「在 Windows 开发机上正常、拿到 Mac/其他环境就异常」的来源：`multiply` 的表现**完全依赖底层背景色**，而背景色又随主题、系统深浅色、页面区块而变。

### 1.3 修复方案（二选一，推荐 A）

**方案 A（推荐）：给图片补 Alpha 通道，保留现有视觉设计**

写一个一次性脚本，把 66 张 `symbol-*.png` 的白色背景转为透明，并保留抗锯齿边缘（按亮度做 alpha 衰减，避免边缘发黑）：

- 读取 RGB → 计算与背景色的接近程度 → 生成 alpha
- 存为 RGBA PNG
- `multiply` 继续保留，视觉效果与设计稿一致

优点：改动最小，视觉还原度最高，不动 CSS。
风险：脚本处理需人工抽检边缘质量。

**方案 B：去掉 `mix-blend-mode`，改为 CSS 遮罩**

用 `mask-image` 让白色区域透明，图片保持原样不改：

```css
.symbol-stage img { mix-blend-mode: normal; -webkit-mask-image: url(...); }
```

优点：不动图片文件。
风险：每处都要单独配 mask，维护成本高，且九宫格/列表场景仍需逐个适配。

**验收标准**：64 张甲骨文字在浅色/深色背景下均清晰可见，边缘无白边、无锯齿。

---

## 2. 数据库设计（需求 1）

### 2.1 技术选型

| 层 | 本地开发 | 线上生产 |
|---|---|---|
| 数据库 | SQLite（文件，零依赖） | PostgreSQL（托管，如 Supabase/Neon/RDS） |
| 驱动 | Python 内置 `sqlite3` | `psycopg[binary]` / `psycopg2-binary` |
| 连接池 | 无需 | 简单连接池或框架自带 |

**双引擎策略**：统一用 **SQLAlchemy 2.x ORM** 声明模型，同一套代码通过 `DATABASE_URL` 切换引擎：

```
本地：DATABASE_URL=sqlite:///./data/oracle.db
线上：DATABASE_URL=postgresql+psycopg://user:pass@host:5432/oracle
```

好处：SQL 方言差异由方言层吸收；迁移工具 Alembic 同时支持两端；上线只需换环境变量，不改业务代码。

> 保守提醒：如果你希望**零外部依赖**（保持「解压即跑」的特性），可以退化为 `sqlite3` + `psycopg` 双分支手写 SQL。但这会让分页、占位符、类型映射都要写两遍，**我不推荐**。若你坚持零依赖，请告诉我，我按双分支实现。

### 2.2 表结构

```sql
-- 用户
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,        -- SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255),                  -- 邮箱注册才有；Google 登录为 NULL
  display_name    VARCHAR(80)  NOT NULL,
  avatar_url      TEXT,
  role            VARCHAR(20)  NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  locale          VARCHAR(10)  NOT NULL DEFAULT 'zh-CN',
  status          VARCHAR(20)  NOT NULL DEFAULT 'active', -- 'active' | 'disabled'
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  last_login_at   TIMESTAMP
);

-- Google OAuth 关联
CREATE TABLE oauth_accounts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        VARCHAR(40) NOT NULL,          -- 'google'
  provider_user_id VARCHAR(255) NOT NULL,        -- Google 的 sub
  email           VARCHAR(255),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);

-- 会话（服务端 session，HttpOnly Cookie）
CREATE TABLE sessions (
  token      VARCHAR(128) PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  user_agent VARCHAR(255)
);

-- 「我的片刻」：原 localStorage 的 oracle-records
CREATE TABLE moments (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,                    -- YYYY-MM-DD
  symbol_id   INT    NOT NULL,                  -- 对应 content.js 的 symbol.id (1..64)
  emotion_id  INT,                              -- 对应 emotion.id
  note        VARCHAR(140),
  mode        VARCHAR(20),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)                        -- 一天一条，与现有去重逻辑一致
);

-- 收藏：原 localStorage 的 oracle-favorites
CREATE TABLE favorites (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol_id  INT    NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, symbol_id)
);

-- 管理员：甲骨文字库（symbol library）
CREATE TABLE symbols (
  id         INT PRIMARY KEY,                   -- 1..64，保持与 content.js 一致
  char       VARCHAR(20) NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  motion     VARCHAR(40),
  mode       VARCHAR(20),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- 多语言文案（title / meaning / body 六语言）单独存，避免主表臃肿
CREATE TABLE symbol_i18n (
  symbol_id INT NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  locale    VARCHAR(10) NOT NULL,               -- zh-CN/zh-TW/en/ja/th/ar
  title     VARCHAR(80)  NOT NULL,
  meaning   TEXT,
  body      TEXT,
  PRIMARY KEY (symbol_id, locale)
);

-- 管理员：情绪图标管理
CREATE TABLE emotions (
  id          INT PRIMARY KEY,
  label       VARCHAR(80) NOT NULL,
  image_path  VARCHAR(255) NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE TABLE emotion_i18n (
  emotion_id INT NOT NULL REFERENCES emotions(id) ON DELETE CASCADE,
  locale     VARCHAR(10) NOT NULL,
  label      VARCHAR(80) NOT NULL,
  PRIMARY KEY (emotion_id, locale)
);

-- 审计日志（管理员操作留痕）
CREATE TABLE admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    BIGINT NOT NULL REFERENCES users(id),
  action      VARCHAR(60) NOT NULL,             -- 'symbol.update' / 'user.disable' ...
  target_type VARCHAR(40),
  target_id   VARCHAR(40),
  detail      TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 2.3 数据迁移（重要）

现有用户的 localStorage 数据不能丢。方案：

- 用户**首次登录**时，前端检测 localStorage 是否有 `oracle-records` / `oracle-favorites`
- 若有，调用 `POST /api/migrate/local` 一次性导入并绑定到该 user_id
- 导入成功后前端清除这些键，**服务端保证幂等**（靠 `UNIQUE(user_id, date)` 去重）
- 已在 localStorage 但从未登录的用户：数据留在本地，登录时提示「发现 N 条本地记录，是否导入」

---

## 3. 注册 / 登录页面（需求 2）

### 3.1 入口位置

顶栏 `header-tools` 内，**紧邻语言选择器并排**：

```
[字有答案 DAILY SYMBOL]        [🌐 简体中文 ▾] [登录/注册] [ⓘ]
```

- 未登录：显示「登录 / 注册」文字按钮
- 已登录：显示头像 + 昵称，点击进入账户页（含退出登录）
- 移动端：收进现有 `header-tools`，保持不换行

### 3.2 页面结构（严格按你提供的两张截图）

单页两态切换，**不使用弹窗**，是独立路由 `#/auth/login` 与 `#/auth/register`（也可用 `#login` / `#register`，实现时择一）。

**登录页（截图一）**

```
账号                              ← eyebrow 小字，橄榄绿
登录                              ← 超大标题
请选择一种方式进入你的账号。        ← 副标题

┌─ 圆角卡片，浅米色底 ────────────┐
│ GOOGLE 账号                      │  ← 分区标签，橄榄绿加粗
│ [  使用 Google 继续  ]           │  ← 深墨绿实心大按钮
│ ──────────── 分隔线 ──────────── │
│ 邮箱和密码                        │  ← 分区标签
│ [ you@example.com            ]  │  ← 白底圆角输入框
│ [ 密码                        ]  │
│ [ 登录 ]                         │  ← 深墨绿实心按钮
│      注册新账号                   │  ← 文字链接
└─────────────────────────────────┘
```

**注册页（截图二）**

结构完全一致，差异仅三处：
1. 大标题「注册」
2. 邮箱区多一个「确认密码」输入框（两框必须一致，否则报错）
3. 底部主按钮为「创建账号」，其下文字链接为「已有账号？返回登录」

### 3.3 视觉规范（对齐现有设计系统）

| 元素 | 取值 | 来源 |
|---|---|---|
| 页面背景 | `#f5f2eb`（暖米） | 现有 `--bg` |
| 卡片背景 | `#faf7f0` 暖白 | 比页面略亮，形成层次 |
| 卡片圆角 | `14px` | 贴近截图圆角感 |
| 主按钮 | 墨绿实心 `background:#2f3a2f` / 白字 / 全圆角 `999px` | 与截图一致 |
| 输入框 | 白底、`1px` 浅描边、`999px` 圆角 | 同上 |
| 分区标签 | 橄榄绿加粗小字，字间距放大 | `GOOGLE 账号` / `邮箱和密码` |
| 大标题 | 超大字号（`clamp(56px, 12vw, 96px)`）、墨色 | 截图标题非常醒目 |
| 分隔线 | `1px` 极浅描边 | 截图卡片内横线 |

### 3.4 表单校验

- 邮箱：正则 + 前后端**双重**校验
- 密码：≥8 位；注册需两次一致
- 后端错误以 `{ "error": { "field": "email", "message": "..." } }` 返回，前端定位到对应输入框下方
- 提交中禁用按钮，防重复提交

---

## 4. 登录守卫（需求 3）

### 4.1 需要保护的入口

| # | 位置 | 未登录行为 |
|---|---|---|
| 1 | tab「一个字」→ 结果页点「保存，留下这个字」（`#save-result`） | 立即跳转登录页，登录后**自动回到结果页并保留已填的备注**，登录完成自动完成保存 |
| 2 | tab「我的片刻」（`#journal`） | 跳转登录页；登录后自动回到「我的片刻」并展示数据 |

### 4.2 实施要点

- 路由渲染前统一拦截，不在各个按钮里各写一遍
- 登录前把「想去的路由 + 未提交的表单草稿」存入 `sessionStorage` 的 `oracle-auth-redirect`，登录成功后读取并跳转、执行
- 直接输入 `#journal` 也要拦截（不能只拦点击）
- 登录成功后若 `records` 已被服务端接管，页面需从 API 拉取渲染，而不是读 localStorage

---

## 5. Google OAuth（需求 4）

### 5.1 预置方式

代码写全、配置留空，**上线后填环境变量即可用**，本地无配置时按钮置灰并提示。

流程（推荐 Google 官方标准流程）：

```
前端点「使用 Google 继续」
  → 跳转 /api/auth/google
  → 后端重定向到 accounts.google.com/o/oauth2/v2/auth
  → 用户授权
  → Google 回调 /api/auth/google/callback?code=...
  → 后端用 code 换 token → 取用户邮箱与 sub
  → 查 oauth_accounts：命中则登录；未命中则按邮箱匹配已有用户并绑定，否则新建用户
  → 生成 session，写 HttpOnly Cookie，重定向回前端
```

### 5.2 待上线后配置的环境变量

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://你的域名/api/auth/google/callback
SESSION_SECRET=          # 用于签名 Cookie
DATABASE_URL=postgresql+psycopg://...
```

Google Cloud Console 需登记的授权来源与回调地址，会在部署清单中列出。

---

## 6. 管理员账号与后台（需求 5）

### 6.1 管理员账号

- 通过**环境变量**指定管理员邮箱（`ADMIN_EMAILS=oracleanswered@gmail.com`），首次启动时自动创建该账号并置 `role='admin'`
- **不设默认密码**，避免上线即被接管；首次登录走 Google 或由管理员在后台设置密码
- 密码使用 `bcrypt`（`passlib[bcrypt]`）加盐哈希，绝不明文存储

### 6.2 后台入口与三个模块

入口：昵称头像 → 账户页 → 出现「管理后台」链接（仅 `role='admin'` 可见；**后端每个接口也都要校验，前端隐藏不等于安全**）。

**① Symbol Library（甲骨文字库）**

- 表格列出 64 个字：字符、图片预览、motion、mode、发布状态
- 支持编辑：字符、图片替换上传、六语言标题/释义/练习文案、下架
- 图片走静态目录直存（不上对象存储，减少复杂度），校验扩展名与体积
- 改动写 `admin_audit_log`，并同步更新前端读的数据源

**② 情绪图标管理**

- 50 种情绪列表：标签、图片（webp）、发布状态
- 编辑多语言标签、替换图标、上下架
- 与 Symbol Library 同一套 CRUD 范式，复用组件

**③ 用户信息管理**

- 用户列表：邮箱、昵称、注册时间、最后登录、角色、状态
- 操作：设为管理员 / 取消管理员、禁用 / 启用、重置密码
- 禁止管理员禁用或降级自己；禁止禁用最后一个管理员

### 6.3 技术实现

后台页面复用现有 hash 路由体系（`#/admin/symbols` 等），不引入前端框架、不引入构建步骤 —— 与项目「解压即跑」的基因保持一致。后端用 **FastAPI**（自带 OpenAPI 文档，异步 performant，部署简单）。

---

## 7. 技术架构总览

```
浏览器（现有静态 SPA，不加构建）
   │  fetch('/api/...')  +  HttpOnly Cookie 会话
   ▼
FastAPI 后端（新增）
   ├── /api/auth/*        注册、登录、登出、Google OAuth、会话查询
   ├── /api/moments/*     我的片刻 CRUD
   ├── /api/favorites/*   收藏
   ├── /api/me            当前用户
   ├── /api/admin/*       后台三大模块（role=admin 校验）
   └── /static            挂载现有 web/ 目录
   ▼
SQLAlchemy 2.x ORM
   ├── 本地：SQLite  (sqlite:///./data/oracle.db)
   └── 线上：PostgreSQL (postgresql+psycopg://...)
```

目录建议：

```
OracleAnswer/
├── server/
│   ├── app.py            FastAPI 入口
│   ├── config.py         环境变量配置
│   ├── db.py             引擎/会话/双引擎切换
│   ├── models.py         ORM 模型
│   ├── schemas.py        Pydantic 校验
│   ├── security.py       密码哈希、session、权限依赖
│   ├── routers/
│   │   ├── auth.py  moments.py  favorites.py  admin.py
│   └── seed.py           首次灌入 symbol/emotion 基础数据
├── migrations/           Alembic
├── web/                  现有前端（新增 auth.js / api.js / admin.js）
├── data/oracle.db        本地 SQLite（不入版本库）
└── start_local_preview.py  改为同时拉起后端
```

---

## 8. TODO 清单（按依赖顺序）

### 阶段 0 · 修复图片显示（独立可先交付）
- [ ] T0.1 写脚本为 66 张 `symbol-*.png` 补 Alpha 通道（白色背景转透明，边缘按亮度衰减）
- [ ] T0.2 人工抽检 10 张边缘质量（尤其笔画细的「休」「利」「元」）
- [ ] T0.3 浅色/深色背景各验证一遍
- [ ] T0.4 检查 `emotions/*.webp` 是否同样问题（51 张，需同样处理）

### 阶段 1 · 后端骨架与数据库
- [ ] T1.1 初始化 `server/`，接入 FastAPI + SQLAlchemy 2.x + Pydantic
- [ ] T1.2 实现 `db.py` 双引擎（`DATABASE_URL` 切换），本地默认 SQLite
- [ ] T1.3 写全部 ORM 模型（users / oauth_accounts / sessions / moments / favorites / symbols / symbol_i18n / emotions / emotion_i18n / admin_audit_log）
- [ ] T1.4 配置 Alembic，生成首个迁移
- [ ] T1.5 `seed.py`：把 `content.js` 的 64 字 + 50 情绪灌入数据库
- [ ] T1.6 挂载 `/static` 指向现有 `web/`，统一单端口 8150（保持原启动体验）

### 阶段 2 · 账号体系
- [ ] T2.1 `security.py`：bcrypt 密码哈希、session 令牌、HttpOnly Cookie、`get_current_user` / `require_admin` 依赖
- [ ] T2.2 `POST /api/auth/register`（邮箱唯一性、密码强度、确认密码由前端保证）
- [ ] T2.3 `POST /api/auth/login`（错误信息不区分「邮箱不存在」与「密码错误」，防枚举）
- [ ] T2.4 `POST /api/auth/logout`、`GET /api/auth/me`
- [ ] T2.5 会话过期与滑动续期；`Secure` / `SameSite=Lax` Cookie

### 阶段 3 · 前端注册登录页
- [ ] T3.1 新增 `web/auth.js`：登录/注册双态渲染，路由 `#login` / `#register`
- [ ] T3.2 按截图实现视觉：暖米背景、圆角卡片、墨绿实心主按钮、`GOOGLE 账号` / `邮箱和密码` 分区标签、分隔线
- [ ] T3.3 顶栏语言选择器旁加入口按钮；已登录态显示头像昵称
- [ ] T3.4 表单校验与错误提示（后端字段级错误回填）
- [ ] T3.5 新增 `web/api.js` 统一请求层（自动带 Cookie、统一错误处理）
- [ ] T3.6 六语言文案接入 `locales.js`（登录/注册/退出/邮箱/密码等全部词条）

### 阶段 4 · 登录守卫
- [ ] T4.1 路由层统一守卫：未登录访问受保护路由 → 记 `sessionStorage.oracle-auth-redirect`
- [ ] T4.2 守卫「保存，留下这个字」：保留已填备注，登录后回跳并自动保存
- [ ] T4.3 守卫「我的片刻」：登录后回跳并从 API 拉取渲染
- [ ] T4.4 收藏（`#favorite` 按钮）同样纳入守卫

### 阶段 5 · 数据迁移
- [ ] T5.1 `POST /api/migrate/local`：导入 localStorage 的 records/favorites
- [ ] T5.2 前端首次登录检测并提示导入；成功后清理本地键
- [ ] T5.3 服务端幂等保证（`UNIQUE(user_id, date)`）

### 阶段 6 · Google OAuth
- [ ] T6.1 `/api/auth/google` 与 `/callback`，state 防 CSRF
- [ ] T6.2 `oauth_accounts` 绑定与自动建号逻辑
- [ ] T6.3 前端按钮：无配置时置灰 + 提示；配置后正常跳转
- [ ] T6.4 写《上线配置清单》（Google Cloud 授权来源、回调 URI、环境变量）

### 阶段 7 · 管理员后台
- [ ] T7.1 管理员账号自动创建（`ADMIN_EMAILS`）+ 后台入口按角色显示
- [ ] T7.2 后台整体框架与路由（`#/admin/*`），所有接口 `require_admin`
- [ ] T7.3 Symbol Library 管理：列表、编辑、多语言、图片替换、上下架
- [ ] T7.4 情绪图标管理：同 CRUD 范式
- [ ] T7.5 用户信息管理：列表、改角色、禁用/启用、重置密码、关键操作自我保护
- [ ] T7.6 `admin_audit_log` 记录所有管理员操作

### 阶段 8 · 上线准备
- [ ] T8.1 PostgreSQL 实测（不只 SQLite 跑通）
- [ ] T8.2 部署文档：环境变量、HTTPS、反向代理、备份策略
- [ ] T8.3 数据库备份与回滚方案
- [ ] T8.4 安全自查：密码哈希、越权检查、SQL 注入（ORM 已参数化）、XSS（输出转义）、限流

---

## 9. 需要你确认的决策点

在动手前，这几个问题会实质影响架构，希望你先定：

1. **后端框架**：我推荐 FastAPI（自带接口文档、部署轻）。你是否接受引入 Python 后端依赖（`fastapi` / `uvicorn` / `sqlalchemy` / `passlib` / `psycopg`）？如果你坚持「零依赖纯静态」，方案 B 是把数据放 Supabase 等 BaaS，但那会偏离你「本地 SQLite + 线上 PostgreSQL」的设想。
2. **依赖引入方式**：用 `requirements.txt` + 虚拟环境，还是希望我封装成启动器自动建 venv？
3. **管理员账号**：是否用 `oracleanswered@gmail.com`（说明文件里提到的邮箱）作为管理员？
4. **「我的片刻」历史数据**：现有 localStorage 数据导入数据库时，是否需要合并进同一账号（同一邮箱的多次注册）？
5. **注册是否开放**：需要邀请码 / 关闭公开注册 / 任何人可注册？

---

## 10. 交付物清单

- `server/` 后端源码 + `requirements.txt`
- `migrations/` 数据库迁移
- `web/auth.js`、`web/api.js`、`web/admin.js` 前端新增模块
- 修改后的 `web/index.html`、`web/styles.css`（顶栏入口 + 账号页样式）
- `docs/上线配置清单.md`（Google OAuth + PostgreSQL + 环境变量）
- `docs/TODO.md`（本清单的可勾选版本）
- 修复后的图片资产（补 Alpha 通道）
