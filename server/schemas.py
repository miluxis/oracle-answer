"""请求/响应模型（Pydantic）与统一错误结构。

前端约定：出错时返回
    {"error": {"field": "email", "message": "该邮箱已被注册"}}
前端据此把提示挂到对应输入框下方。
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from . import config


class ApiError(BaseModel):
    field: str | None = None
    message: str


class ErrorBody(BaseModel):
    error: ApiError


def fail(field: str | None, message: str, code: int = 400) -> Exception:
    from fastapi import HTTPException

    return HTTPException(status_code=code, detail={"error": {"field": field, "message": message}})


# ---------------- 认证 ----------------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=config.MIN_PASSWORD_LENGTH,
                          max_length=config.MAX_PASSWORD_LENGTH)
    display_name: str = Field(default="", max_length=80)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if len(v.strip()) < config.MIN_PASSWORD_LENGTH:
            raise ValueError(f"密码至少{config.MIN_PASSWORD_LENGTH}位")
        return v

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        return v or v  # 空名由后端用邮箱前缀补齐


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=config.MAX_PASSWORD_LENGTH)


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    avatar_url: str | None
    role: str
    locale: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthOut(BaseModel):
    # 未登录时 user 为None，前端据此判断登录态
    user: UserOut | None = None
    google_enabled: bool


# ---------------- 片刻 / 收藏 ----------------

class MomentIn(BaseModel):
    #: 带 id = 编辑该条；不带 = 新增一条（同一天可留多条）
    id: int | None = None
    date: date
    symbol_id: int
    emotion_id: int | None = None
    note: str | None = Field(default=None, max_length=140)
    mode: str | None = None


class MomentOut(BaseModel):
    id: int
    date: date
    symbol_id: int
    emotion_id: int | None
    note: str | None
    mode: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FavoriteOut(BaseModel):
    symbol_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LocalMigrateIn(BaseModel):
    records: list[MomentIn] = Field(default_factory=list)
    favorites: list[int] = Field(default_factory=list)


class LocalMigrateOut(BaseModel):
    imported_moments: int
    imported_favorites: int
    skipped: int


# ---------------- 偏好 / 配额 / 报名意向 ----------------

class PreferencesIn(BaseModel):
    locale: str | None = None
    last_draw_symbol: int | None = None
    quiz_bag: list[int] | None = None


class PreferencesOut(BaseModel):
    locale: str | None
    last_draw_symbol: int | None
    quiz_bag: list[int]


class UsageOut(BaseModel):
    """当天配额状态。前端据此决定能否继续抽字。"""

    day: date
    draw_count: int
    remaining: int
    claimed_symbol: int | None
    has_credit: bool

    model_config = {"from_attributes": True}


class UsageClaimIn(BaseModel):
    day: date
    symbol_id: int | None = None
    #: 消耗次数并把当天抽到的字记为 symbol_id
    claim: bool = False
    #: 运营发放的额外次数标记（如支持过项目的用户）
    credit: bool = False


class ApplicationIn(BaseModel):
    course_id: str = Field(min_length=1, max_length=80)
    name: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=80)
    region: str | None = Field(default=None, max_length=80)
    email: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    age: str | None = Field(default=None, max_length=20)
    gender: str | None = Field(default=None, max_length=40)
    reason: str | None = Field(default=None, max_length=500)
    saved_at: str | None = Field(default=None, max_length=40)


class ApplicationOut(ApplicationIn):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------- 管理员 ----------------

class AdminUserUpdate(BaseModel):
    role: str | None = None
    status: str | None = None


class AdminUserOut(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    status: str
    created_at: datetime
    last_login_at: datetime | None
    moment_count: int = 0

    model_config = {"from_attributes": True}


class SymbolI18nIn(BaseModel):
    model_config = {"from_attributes": True}

    locale: str
    title: str
    meaning: str | None = None
    action: str | None = None
    reading: str | None = None


class SymbolIn(BaseModel):
    char: str
    image_path: str
    motion: str | None = None
    mode: str | None = None
    review: bool = False
    is_published: bool = True
    sort_order: int = 0
    i18n: list[SymbolI18nIn] = Field(default_factory=list)


class SymbolOut(BaseModel):
    id: int
    char: str
    image_path: str
    motion: str | None
    mode: str | None
    review: bool
    is_published: bool
    sort_order: int
    i18n: list[SymbolI18nIn]

    model_config = {"from_attributes": True}


class EmotionI18nIn(BaseModel):
    model_config = {"from_attributes": True}

    locale: str
    label: str


class EmotionIn(BaseModel):
    label_default: str
    group_name: str | None = None
    image_path: str
    aliases: str | None = None
    is_published: bool = True
    sort_order: int = 0
    i18n: list[EmotionI18nIn] = Field(default_factory=list)


class EmotionOut(BaseModel):
    id: int
    label_default: str
    group_name: str | None
    image_path: str
    aliases: str | None
    is_published: bool
    sort_order: int
    i18n: list[EmotionI18nIn]

    model_config = {"from_attributes": True}
