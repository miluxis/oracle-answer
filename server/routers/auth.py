"""认证路由：注册、登录、登出、当前用户、Google OAuth。"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from .. import config, security
from ..db import get_db
from ..models import OAuthAccount, User
from ..schemas import AuthOut, LoginIn, RegisterIn, UserOut, fail

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=AuthOut)
def me(
    response: Response,
    user: User | None = Depends(security.get_current_user),
    db: DBSession = Depends(get_db),
):
    """前端启动时调用：拿当前登录态。未登录返回 user=null而非 401。"""
    return AuthOut(
        user=UserOut.model_validate(user) if user else None,
        google_enabled=config.GOOGLE_ENABLED,
    )  # type: ignore[arg-type]


@router.post("/register", response_model=AuthOut)
def register(
    payload: RegisterIn,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
):
    if not config.REGISTRATION_OPEN:
        raise fail(None, "注册暂未开放", 403)

    email = payload.email.lower().strip()
    exists = db.scalar(select(User).where(User.email == email))
    if exists is not None:
        raise fail("email", "该邮箱已被注册，请直接登录")

    name = payload.display_name.strip() or email.split("@")[0]
    user = User(
        email=email,
        display_name=name[:80],
        password_hash=security.hash_password(payload.password),
        role="admin" if email in config.ADMIN_EMAILS else "user",
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        # 并发注册同一邮箱时靠数据库唯一索引兜底
        db.rollback()
        raise fail("email", "该邮箱已被注册，请直接登录", 409) from None

    token = security.create_session(db, user, request)
    security.set_session_cookie(response, token)
    return AuthOut(
        user=UserOut.model_validate(user), google_enabled=config.GOOGLE_ENABLED
    )


@router.post("/login", response_model=AuthOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
):
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))

    # 不区分「邮箱不存在」与「密码错误」，避免账号枚举
    generic = fail("password", "邮箱或密码不正确", 401)
    if user is None:
        # 无论用户是否存在都做一次哈希校验，抹平时间差
        security.verify_password(payload.password, security.hash_password("x"))
        raise generic
    if not security.verify_password(payload.password, user.password_hash):
        raise generic
    if user.status != "active":
        raise fail(None, "该账号已被停用，请联系管理员", 403)

    token = security.create_session(db, user, request)
    security.set_session_cookie(response, token)
    return AuthOut(
        user=UserOut.model_validate(user), google_enabled=config.GOOGLE_ENABLED
    )


@router.post("/logout")
def logout(request: Request, response: Response, db: DBSession = Depends(get_db)):
    security.revoke_session(db, request)
    security.clear_session_cookie(response)
    return {"ok": True}


@router.get("/config")
def auth_config():
    """前端用它决定 Google 按钮是否可点。"""
    return {
        "google_enabled": config.GOOGLE_ENABLED,
        "registration_open": config.REGISTRATION_OPEN,
    }


# ---------------- Google OAuth ----------------

def _google_auth_url(state: str) -> str:
    from urllib.parse import urlencode

    params = {
        "client_id": config.GOOGLE_CLIENT_ID,
        "redirect_uri": config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


@router.get("/google")
def google_start(request: Request):
    """未配置时返回明确错误，前端据此把按钮置灰。"""
    if not config.GOOGLE_ENABLED:
        raise fail(None, "服务器尚未配置 Google 登录", 501)
    state = secrets.token_urlsafe(24)
    from fastapi.responses import RedirectResponse

    resp = RedirectResponse(_google_auth_url(state), status_code=302)
    resp.set_cookie("oa_oauth_state", state, max_age=600,
                    httponly=True, samesite="lax", path="/")
    return resp


@router.get("/google/callback")
def google_callback(
    request: Request,
    db: DBSession = Depends(get_db),
):
    from fastapi.responses import RedirectResponse

    if not config.GOOGLE_ENABLED:
        raise fail(None, "服务器尚未配置 Google 登录", 501)

    code = request.query_params.get("code")
    state = request.query_params.get("state")
    expected = request.cookies.get("oa_oauth_state")
    # state 校验：防 CSRF
    if not code or not state or not expected or state != expected:
        raise fail(None, "Google 登录校验失败，请重试", 400)

    import httpx

    try:
        token_resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
                "redirect_uri": config.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=15.0,
        )
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")

        info_resp = httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15.0,
        )
        info_resp.raise_for_status()
        info = info_resp.json()
    except Exception as exc:  # noqa: BLE001
        raise fail(None, "Google 登录失败，请稍后重试", 502) from exc

    provider_uid = info.get("sub")
    email = (info.get("email") or "").lower().strip()
    if not provider_uid or not info.get("email_verified"):
        raise fail(None, "该 Google 账号未验证邮箱，无法登录", 400)

    # 1) 已绑定过 → 直接登录
    link = db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == "google",
            OAuthAccount.provider_user_id == provider_uid,
        )
    )
    if link is not None:
        user = db.get(User, link.user_id)
    else:
        # 2) 邮箱已存在 → 绑定到该账号（需求：邮箱不允许重复注册）
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                display_name=info.get("name") or email.split("@")[0],
                avatar_url=info.get("picture"),
                password_hash=None,
            )
            db.add(user)
            db.flush()
        db.add(
            OAuthAccount(
                user_id=user.id,
                provider="google",
                provider_user_id=provider_uid,
                email=email,
            )
        )

    if user.status != "active":
        raise fail(None, "该账号已被停用，请联系管理员", 403)

    user.avatar_url = user.avatar_url or info.get("picture")
    user.last_login_at = datetime.now(timezone.utc)
    token = security.new_token()
    from ..models import Session as SessionRow

    db.add(
        SessionRow(
            token=token,
            user_id=user.id,
            expires_at=datetime.fromtimestamp(
                datetime.now(timezone.utc).timestamp() + config.SESSION_TTL_SECONDS,
                tz=timezone.utc,
            ),
            user_agent=request.headers.get("user-agent", "")[:255] or None,
        )
    )
    db.commit()

    resp = RedirectResponse("/?auth=google#home", status_code=302)
    security.set_session_cookie(resp, token)
    resp.delete_cookie("oa_oauth_state", path="/")
    return resp
