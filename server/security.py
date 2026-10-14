"""安全相关：密码哈希、会话令牌、当前用户依赖。

原则：
- 密码只存bcrypt 哈希，永不落明文、永不进日志。
- Cookie 只放 128位随机 token，用户身份每次从数据库反查，便于封禁与改角色即时生效。
- 登录失败时不区分「邮箱不存在」与「密码错误」，避免账号枚举。
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config
from .db import get_db
from .models import Session as SessionRow
from .models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    # bcrypt 上限 72 字节，超长会报错，这里显式截断并说明
    return pwd_context.hash(raw[:72])


def verify_password(raw: str, hashed: str | None) -> bool:
    if not hashed:
        # Google 账号没有密码，一律视为校验失败
        return False
    try:
        return pwd_context.verify(raw[:72], hashed)
    except Exception:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def create_session(db: Session, user: User, request: Request) -> str:
    token = new_token()
    expires = datetime.now(timezone.utc) + timedelta(seconds=config.SESSION_TTL_SECONDS)
    ua = request.headers.get("user-agent", "")[:255] or None
    db.add(
        SessionRow(token=token, user_id=user.id, expires_at=expires, user_agent=ua)
    )
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return token


def set_session_cookie(response, token: str) -> None:  # noqa: ANN001
    response.set_cookie(
        key=config.SESSION_COOKIE,
        value=token,
        max_age=config.SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=config.COOKIE_SECURE,
        path="/",
    )


def clear_session_cookie(response) -> None:  # noqa: ANN001
    response.delete_cookie(key=config.SESSION_COOKIE, path="/")


def _read_token(request: Request) -> str | None:
    return request.cookies.get(config.SESSION_COOKIE)


def get_current_user(
    request: Request, db: Session = Depends(get_db)
) -> User | None:
    """未登录返回 None，不抛错——供「可选登录」场景使用。"""
    token = _read_token(request)
    if not token:
        return None
    row = db.get(SessionRow, token)
    if row is None:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        return None
    user = db.get(User, row.user_id)
    if user is None or user.status != "active":
        return None
    return user


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"field": None, "message": "请先登录"}},
        )
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"field": None, "message": "需要管理员权限"}},
        )
    return user


def revoke_session(db: Session, request: Request) -> None:
    token = _read_token(request)
    if token:
        row = db.get(SessionRow, token)
        if row is not None:
            db.delete(row)
            db.commit()
