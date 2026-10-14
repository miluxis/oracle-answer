# OracleAnswer · 项目长期约定

## 项目性质
「字有答案 / Daily Symbol」——六语言正念体验站，64 个甲骨字 + 50 种情绪 + 21 道测试题。
品牌名与甲骨字形不翻译；用户填写的姓名、留言不自动翻译；阿拉伯语从右向左排版。

## 技术栈
- **前端**：纯静态 SPA，无构建步骤。原生 JS + hash 路由。
  保持「解压即跑」的基因——**不引入前端框架、不引入打包器**。
- **后端**：FastAPI + SQLAlchemy 2.x + Pydantic v2 + passlib[bcrypt]
- **数据库**：双引擎，`DATABASE_URL` 一行切换
  - 本地 SQLite（默认，`data/oracle.db`，不设环境变量即生效）
  - 线上 PostgreSQL

## 目录约定
```
server/    后端（routers: auth / userdata / admin）
web/       前端（新增模块一律挂在 window 全局，不侵入原有逻辑）
data/      本地 SQLite
docs/      产品文档、TODO、部署指南
```

## 关键约定
1. **注入代码位置敏感**：往 `web/app.js` 插入代码必须放在变量声明之后，
   否则触发 TDZ（`Cannot access 'x' before initialization`）。
2. **改动 app.js 前先备份**：`app.js` 是压缩过的单行逻辑，回归成本高。
3. **后端返回统一错误结构**：`{"error":{"field":"email","message":"..."}}`，
   前端据此把提示挂到对应输入框。异常已在 `server/app.py` 全局转换。
4. **管理员自我保护**：不能降自己、不能停自己、不能删自己；
   最后一个管理员不可降级或停用。
5. **安全基线**：bcrypt 密码哈希、HttpOnly+SameSite=Lax Cookie、
   登录失败不区分「邮箱不存在」与「密码错误」、所有 admin 接口 `require_admin`。
6. **OAuth state 校验**：防 CSRF，不可省。
7. **seed 幂等**：只写入不存在的数据，不覆盖后台修改。

## 已确认的业务决策
- 邮箱不允许重复注册，重复时报错（2026-10-13）
- 开放注册（`REGISTRATION_OPEN` 可关）
- 管理员邮箱 `oracleanswered@gmail.com`
- 图片显示问题**不修复**（用户实测已正常）
- **管理后台前端路径为 `#oaguanli`，不用 `#admin`**（2026-10-13，避免被随意猜到）
  - 子路径：`#oaguanli/symbols` `#oaguanli/emotions` `#oaguanli/users` `#oaguanli/audit`
  - 改路径只是降低被随手试到的概率，**真正的防线是后端 `require_admin`**（已验证 401/403）

## 部署目标
Ubuntu 22.04/24.04 + Nginx + systemd + PostgreSQL。
单端口同时提供 `/api/*` 与静态站点。
详见 `docs/上线部署指南-Ubuntu.md`。
