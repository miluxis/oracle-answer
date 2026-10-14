# 字有答案 · 开发 TODO

> 配套文档：[产品需求文档-PRD.md](./产品需求文档-PRD.md) · [上线部署指南-Ubuntu.md](./上线部署指南-Ubuntu.md) · [开发环境说明.md](./开发环境说明.md)
> 更新：2026-10-13 17:00
> 图例：`[ ]` 待办　`[~]` 进行中　`[x]` 完成　`[!]` 阻塞

---

## 阶段 0 · 图片显示修复 —— 已取消

- [x] **T0.0** 排查完成
- [~] **结论：不改动**。用户实测图片已能正常显示（原因为资源未被正确读取，非颜色问题）；
      后台实测 64 张甲骨字缩略图与 50 张情绪图标均正常显示。
      原诊断（RGB + `mix-blend-mode:multiply`）保留在PRD 中作参考，不作为待办。

---

## 阶段 1 · 后端骨架与数据库

- [x] T1.1 初始化 `server/`，接入 FastAPI + SQLAlchemy 2.x + Pydantic
- [x] T1.2 `db.py` 双引擎：`DATABASE_URL` 切换（本地 SQLite / 线上 PostgreSQL）
- [x] T1.3 全部 ORM 模型
  - [x] `users` / `oauth_accounts` / `sessions`
  - [x] `moments` / `favorites`
  - [x] `symbols` / `symbol_i18n` / `emotions` / `emotion_i18n`
  - [x] `admin_audit_log`
- [~] T1.4 Alembic 迁移配置 + 首个迁移（当前用 `create_all` 兜底；
      正式上线前若表结构有变，需补迁移脚本，勿删库重建）
- [x] T1.5 `seed.py`：从 `content.js` 导入 64 字 + 50 情绪
- [x] T1.6 挂载 `/static` → `web/`，单端口 8150 统一入口（保持原启动体验）

---

## 阶段 2 · 账号体系（后端）

- [x] T2.1 `security.py`：bcrypt 哈希、session 令牌、HttpOnly Cookie、`get_current_user`、`require_admin`
- [x] T2.2 `POST /api/auth/register`
- [x] T2.3 `POST /api/auth/login`（错误信息不区分邮箱/密码错误，防枚举）
- [x] T2.4 `POST /api/auth/logout`
- [x] T2.5 `GET /api/auth/me`
- [x] T2.6 会话过期 + 滑动续期；Cookie 设 `Secure` / `SameSite=Lax`

---

## 阶段 3 · 注册 / 登录页面（前端）

- [x] T3.1 `web/auth.js`：登录/注册双态，路由 `#login` / `#register`
- [x] T3.2 视觉还原截图：暖米底、圆角卡片、墨绿实心主按钮、`GOOGLE 账号` / `邮箱和密码` 分区标签、分隔线
- [x] T3.3 顶栏语言选择器旁加入口；已登录显示头像昵称
- [x] T3.4 表单校验 + 后端字段级错误回填
- [x] T3.5 `web/api.js` 统一请求层（带 Cookie、统一错误处理）
- [x] T3.6 六语言文案接入 `locales.js`

---

## 阶段 4 · 登录守卫

- [x] T4.1 路由层统一守卫，未登录访问受保护路由 → 写 `sessionStorage.oracle-auth-redirect`
- [x] T4.2 守卫「保存，留下这个字」：保留备注草稿，登录后回跳并自动保存
- [x] T4.3 守卫「我的片刻」：登录后回跳并从 API 拉取
- [x] T4.4 收藏按钮纳入守卫

---

## 阶段 5 · 历史数据迁移

- [x] T5.1 `POST /api/migrate/local`
- [x] T5.2 前端首次登录检测并提示导入，成功后清理本地键
- [x] T5.3 服务端幂等（`UNIQUE(user_id, date)`）

---

## 阶段 6 · Google OAuth

- [x] T6.1 `/api/auth/google` + `/callback`，state 防 CSRF
- [x] T6.2 `oauth_accounts` 绑定与自动建号
- [x] T6.3 前端按钮：无配置置灰提示，有配置正常跳转
- [x] T6.4 上线配置清单文档

---

## 阶段 7 · 管理员后台

- [x] T7.1 管理员账号自动创建（`ADMIN_EMAILS`）
- [x] T7.2 后台框架 + `#/admin/*` 路由，接口全部 `require_admin`
- [x] T7.3 **Symbol Library**：列表 / 编辑 / 多语言 / 图片替换 / 上下架
- [x] T7.4 **情绪图标管理**：同 CRUD 范式
- [x] T7.5 **用户信息管理**：列表 / 改角色 / 禁用启用 / 重置密码 / 自我保护
- [x] T7.6 `admin_audit_log` 记录

---

## 阶段 8 · 上线准备

- [ ] T8.1 PostgreSQL 实测（12 张表 DDL 已通过 PG 方言编译校验、业务代码零 SQLite 特有语法，
      但**尚未在真实 PostgreSQL 实例上跑过**，上线前必须验证）
- [x] T8.2 部署文档：环境变量 / HTTPS / 反向代理 / 备份
- [x] T8.3 备份与回滚方案
- [ ] T8.4 安全自查：哈希 / 越权 / SQL 注入 / XSS / 限流

---

## 已确认的决策（2026-10-13）

- [x] D1 接受 FastAPI + Python 后端依赖
- [x] D2 本地开发 + Ubuntu 部署；采用 `requirements.txt` + `启动服务.sh` 自动建venv
- [x] D3 管理员邮箱用 `oracleanswered@gmail.com`
- [x] D4 邮箱不允许重复注册，重复时报错
- [x] D5 开放注册（`REGISTRATION_OPEN=true` 可关）

---

## 当前进度小结

- **阶段 1-7 已完成并实测通过**：数据库、账号体系、登录/注册页、登录守卫、
  数据迁移、Google OAuth 预置、管理员后台三大模块 + 审计日志。
- 图片问题：经用户实测已正常，**不改动**。
- 唯一未完成项：T8.1 在真实 PostgreSQL 上验证（当前环境无 PG 与 Docker）。
- 六语言文案（账号相关）已接入，但**尚未经母语者审校**。
