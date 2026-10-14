# 字有答案 · Ubuntu 上线部署指南

面向 Ubuntu 22.04 / 24.04。目标：本地用 SQLite 快速开发，上线切换 PostgreSQL，业务代码零改动。

---

## 1. 架构与「为什么不用前端托管」

改造后站点不再是纯静态站——注册、登录、我的片刻都需要服务端存储，因此**必须有一个能跑 Python 的后端**。同时后端直接挂载 `web/` 作为静态目录，**单端口即可访问整站**，不用再单独部署前端。

```
浏览器 → Nginx (443/HTTPS) → uvicorn (127.0.0.1:8150) → PostgreSQL
                                  └── 同时提供 /api/* 与 web/ 静态文件
```

---

## 2. 服务器准备

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip postgresql postgresql-contrib nginx git curl

# 建议创建专用用户（不要用 root 跑服务）
sudo adduser --system --group --home /opt/oracle-answer oracle
```

---

## 3. 部署代码

```bash
sudo -u oracle git clone <你的仓库地址> /opt/oracle-answer
cd /opt/oracle-answer

sudo -u oracle python3 -m venv .venv
sudo -u oracle .venv/bin/pip install -r requirements.txt
```

---

## 4. 配置 PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER oracle WITH PASSWORD '换成强密码';
CREATE DATABASE oracle_answer OWNER oracle;
\q
SQL
```

生成连接串：

```
DATABASE_URL=postgresql+psycopg://oracle:强密码@127.0.0.1:5432/oracle_answer
```

> 本地开发时**不要设置** `DATABASE_URL`，代码会默认使用 `data/oracle.db`（SQLite）。这就是双引擎的切换点。

---

## 5. 环境变量文件

```bash
sudo -u oracle touch /opt/oracle-answer/.env
sudo -u oracle chmod 600 /opt/oracle-answer/.env
```

写入（**每项都要按你的实际情况改**）：

```bash
DATABASE_URL=postgresql+psycopg://oracle:强密码@127.0.0.1:5432/oracle_answer

# 会话密钥，生成方式：openssl rand -hex 32
SESSION_SECRET=

# 生产环境走 HTTPS，必须开启 Secure Cookie
COOKIE_SECURE=true

# 管理员邮箱（逗号分隔，可多个）
ADMIN_EMAILS=oracleanswered@gmail.com

# 注册开关
REGISTRATION_OPEN=true

# ---- Google OAuth：上线后在 Google Cloud Console 申请，再填这里 ----
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://你的域名/api/auth/google/callback
```

---

## 6. 初始化数据库

```bash
cd /opt/oracle-answer
sudo -u oracle set -a && . ./.env && set +a
sudo -u oracle .venv/bin/python -m server.seed
```

预期输出：

```
数据库已就绪：postgresql
已创建管理员：oracleanswered@gmail.com
内容已导入：64 个甲骨字、50 个情绪、21 道题
```

> `seed` 幂等：已存在的数据不会覆盖，管理员在后台做的修改不会被冲掉。

给管理员设一个登录密码（管理员默认无密码，只能用 Google 登录；设密码后才能用邮箱登录进后台）：

```bash
sudo -u oracle .venv/bin/python -m server.set_password oracleanswered@gmail.com
```

---

## 7. systemd 服务

```bash
sudo tee /etc/systemd/system/oracle-answer.service > /dev/null <<'UNIT'
[Unit]
Description=Daily Symbol (字有答案)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=oracle
Group=oracle
WorkingDirectory=/opt/oracle-answer
EnvironmentFile=/opt/oracle-answer/.env
ExecStart=/opt/oracle-answer/.venv/bin/python -m uvicorn server.app:app --host 127.0.0.1 --port 8150 --workers 2
Restart=always
RestartSec=5

# 安全加固
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/oracle-answer/data

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now oracle-answer
sudo systemctl status oracle-answer
```

---

## 8. Nginx + HTTPS

```bash
sudo tee /etc/nginx/sites-available/oracle-answer > /dev/null <<'NGINX'
server {
    listen 80;
    server_name 你的域名;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 你的域名;

    ssl_certificate     /etc/letsencrypt/live/你的域名/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名/privkey.pem;

    client_max_body_size 12M;   # 管理员上传图片需要

    location / {
        proxy_pass http://127.0.0.1:8150;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/oracle-answer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

签发证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

---

## 9. Google OAuth 上线配置

代码已预置，只需填环境变量。步骤：

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → 新建项目
2. 启用 **Google+ API**（旧称 Google People API）
3. 凭据 → 创建 **OAuth 客户端 ID** → 类型选 **Web 应用**
4. 填入：
   - 授权来源（Authorized JavaScript origins）：`https://你的域名`
   - 授权重定向 URI：`https://你的域名/api/auth/google/callback`
5. 把 Client ID / Client Secret 填进 `/opt/oracle-answer/.env`
6. `sudo systemctl restart oracle-answer`

配置生效后，登录页的「使用 Google 继续」按钮自动变为可点击；未配置时按钮置灰并提示「服务器尚未配置 Google 登录」。

**回调地址必须与 `GOOGLE_REDIRECT_URI` 完全一致**，包括末尾有没有斜杠。

---

## 10. 上线检查清单

- [ ] `.env` 中 `COOKIE_SECURE=true`（未开 HTTPS 时登录会失败）
- [ ] `SESSION_SECRET` 已随机生成，不是空值
- [ ] 数据库密码不是弱密码，且不与项目名相同
- [ ] `ADMIN_EMAILS` 是你自己的邮箱
- [ ] 已执行 `server.seed`，甲骨字/情绪/题目均已导入
- [ ] 已用 `set_password` 给管理员设密码
- [ ] `.env` 权限 600，属主为 `oracle`
- [ ] Nginx 配置正确，`/api/health` 返回 `{"ok":true}`
- [ ] 浏览器实测：注册 → 退出 → 登录 → 保存片刻 → 我的片刻能看到
- [ ] 数据库备份策略已配置（见下）

---

## 11. 备份与回滚

**PostgreSQL 备份**（每天一次，保留 14 天）：

```bash
sudo tee /etc/cron.daily/oracle-backup > /dev/null <<'CRON'
#!/bin/bash
set -e
mkdir -p /var/backups/oracle
sudo -u postgres pg_dump oracle_answer | gzip > /var/backups/oracle/oracle-$(date +\%F).sql.gz
find /var/backups/oracle -name '*.sql.gz' -mtime +14 -delete
CRON
sudo chmod +x /etc/cron.daily/oracle-backup
```

**恢复**：

```bash
gunzip -c /var/backups/oracle/oracle-2026-10-13.sql.gz | sudo -u postgres psql oracle_answer
```

**回滚代码**：

```bash
cd /opt/oracle-answer
sudo -u oracle git log --oneline -5      # 找到上一个好版本
sudo -u oracle git checkout <commit>
sudo systemctl restart oracle-answer
```

> schema 变更建议用 Alembic 管理。当前 `seed.py` 走的是「表不存在则创建」，若后续表结构有变，请补迁移脚本而不是删库重建——生产库里已有真实用户数据。

---

## 12. 常见问题

| 现象 | 原因与处理 |
|---|---|
| 登录后立刻掉线 | `COOKIE_SECURE=true` 但没配 HTTPS，或反代没传 `X-Forwarded-Proto` |
| 一直未登录 | 检查浏览器是否拦截了 Cookie；确认 `SESSION_COOKIE` 名未被占用 |
| Google 报 redirect_uri_mismatch | `GOOGLE_REDIRECT_URI` 与 Google Cloud Console 登记的完全一致（注意末尾斜杠） |
| 502 Bad Gateway | uvicorn 没起来：`systemctl status oracle-answer` 看日志 |
| 改了管理员数据后重启又变回去 | `seed.py` 只在数据不存在时写入，不会覆盖；但若你手动删过表会重灌 |
| 静态资源 404 | 确认 `web/` 目录存在，且 `server/config.py` 里的 `WEB_DIR` 路径正确 |

---

## 13. 本地开发（对照）

```bash
cd /path/to/OracleAnswer
./启动服务.sh              # 首次会自动建 venv、装依赖、初始化数据库
```

或手动：

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m server.seed
.venv/bin/python -m uvicorn server.app:app --port 8150
```

**不设 `DATABASE_URL` 即为 SQLite**，无需任何额外配置。

---

## 14. 用户数据存储位置（全部按账号）

站点已无任何依赖浏览器的用户数据。下列内容都存在数据库里，**换设备登录后完全一致**：

| 内容 | 表 | 说明 |
|---|---|---|
| 账号、昵称、角色 | `users` | |
| 第三方登录绑定 | `oauth_accounts` | Google |
| 登录会话 | `sessions` | Cookie 只存随机 token |
| 留给自己的片刻 | `moments` | **一天可留多条**，按创建时间倒序 |
| 我收藏的字 | `favorites` | 账号+字 联合主键 |
| 语言、上次抽到的字、测试题袋 | `user_preferences` | 每账号一行 |
| 每日体验次数配额 | `daily_usage` | **按账号限 7 次/天**，换设备不重置 |
| 课程报名意向草稿 | `course_applications` | |

### 关于体验配额

每天 7 次，**按账号累计**——在 A 电脑用了 3 次，换到 B 电脑只能再用 4 次。
超出后 `POST /api/usage` 返回 403，前端引导到课程/支持页。
跨天自动重置（按 `day` 字段分行存储，不做清理也不影响正确性）。

若运营需要给某个用户临时放开次数：

```bash
# 发放额外次数标记
curl -X POST https://你的域名/api/usage \
  -H 'Content-Type: application/json' -b 'oa_session=管理员的token' \
  -d '{"day":"2026-10-13","credit":true}'
```

或直接在库里改：

```sql
UPDATE daily_usage SET has_credit = TRUE WHERE user_id = <用户id>;
```

### 上线前必须补的数据库迁移 ⚠️

2026-10-13 起`moments` 去掉了 `UNIQUE(user_id, date)`（改为一天多条）。
**本地 SQLite 已重建该表，但线上 PostgreSQL 需要你执行：**

```sql
-- 1. 去掉唯一约束
ALTER TABLE moments DROP CONSTRAINT IF EXISTS uq_moment_user_date;

-- 2. 建新索引（按创建时间倒序展示）
CREATE INDEX IF NOT EXISTS ix_moment_user_created ON moments (user_id, created_at);
```

验证：

```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'moments'::regclass AND contype = 'u';
-- 应为空（没有唯一约束了）
```

> 更推荐把这两条写成 Alembic 迁移脚本纳入版本管理，
> 避免以后多台服务器执行顺序不一致。当前项目仍用 `create_all` 兜底，
> **表结构有变更时务必手动补迁移，不要删库重建**。

### 旧数据迁移

用户**首次登录**时，浏览器里遗留的 localStorage 数据会自动上传到该账号
（片刻、收藏、偏好、报名意向）。服务端用唯一索引保证幂等，重复登录不会产生重复行。
上传成功后本地副本会被清除。
