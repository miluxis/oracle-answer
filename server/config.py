"""全局配置：全部通过环境变量注入，敏感项不进代码库。"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
WEB_DIR = BASE_DIR / "web"
# 目录可能已由启动脚本创建，这里不主动 mkdir（避免只读环境或代理环境下报错）
DATA_DIR.mkdir(parents=True, exist_ok=True) if not DATA_DIR.exists() else None


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# ---- 数据库：本地默认 SQLite，线上由 DATABASE_URL 指向 PostgreSQL ----
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{(DATA_DIR / 'oracle.db').as_posix()}",
)

# ---- 会话 ----
SESSION_SECRET = os.getenv("SESSION_SECRET", "")
SESSION_COOKIE = os.getenv("SESSION_COOKIE", "oa_session")
# 生产环境（HTTPS）自动开启 Secure；本地 http 调试时保持关闭，否则 cookie 发不出去
COOKIE_SECURE = _bool("COOKIE_SECURE", default=False)
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
SESSION_TTL_SECONDS = SESSION_DAYS * 24 * 3600

# ---- Google OAuth（留空则前端按钮置灰） ----
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")
GOOGLE_ENABLED = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)

# ---- 管理员：逗号分隔的邮箱，首次启动自动建号 ----
ADMIN_EMAILS = [
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", "oracleanswered@gmail.com").split(",")
    if e.strip()
]

# ---- 注册开关 ----
REGISTRATION_OPEN = _bool("REGISTRATION_OPEN", default=True)

# ---- 密码规则 ----
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
