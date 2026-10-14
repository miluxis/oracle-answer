"""ORM 模型。

跨库兼容要点：
- 主键用 `BigInteger().with_variant(Integer, "sqlite")`，SQLite 不自增BIGINT，
  在 SQLite 下退回INTEGER 从而配合 `primary_key=True` 走rowid 自增。
- 时间统一用 `DateTime(timezone=True)`。
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# 简写：外键
FK = ForeignKey
PK = BigInteger().with_variant(Integer, "sqlite")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(PK, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    # 邮箱注册才有密码；Google 登录为NULL
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="zh-CN")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    moments: Mapped[list["Moment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


class OAuthAccount(Base):
    """Google 等第三方账号绑定。"""

    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_uid"),)

    id: Mapped[int] = mapped_column(PK, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        FK("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="oauth_accounts")


class Session(Base):
    """服务端会话。Cookie 里只放随机 token，不放用户信息。"""

    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        FK("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Moment(Base):
    """「我的片刻」：一次保存 = 一条记录。

    早期版本对 (user_id, date) 建了唯一索引，导致同一天只能留一条、
    后保存的会覆盖先保存的。现在改为**一天可留多条**，按创建时间倒序展示。
    """

    __tablename__ = "moments"
    __table_args__ = (
        Index("ix_moment_user_created", "user_id", "created_at"),
        Index("ix_moment_user_date", "user_id", "date"),
    )

    id: Mapped[int] = mapped_column(PK, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        FK("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    symbol_id: Mapped[int] = mapped_column(Integer, nullable=False)
    emotion_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(String(140), nullable=True)
    mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="moments")


class Favorite(Base):
    """收藏的字。"""

    __tablename__ = "favorites"

    user_id: Mapped[int] = mapped_column(
        FK("users.id", ondelete="CASCADE"), primary_key=True
    )
    symbol_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserPreferences(Base):
    """用户偏好：语言、上次抽到的字、测试题袋等零散状态。

    每个用户一行，避免为每个小开关单开一张表。
    """

    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(
        FK("users.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str | None] = mapped_column(String(10), nullable=True)
    last_draw_symbol: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 测试题袋：存放已抽到的题目序号 JSON
    quiz_bag: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class DailyUsage(Base):
    """每日体验配额与抽字记录，**按账号限制**而非按设备。

    每个用户每天一行，记录当天已抽字次数与当天抽到的字。
    """

    __tablename__ = "daily_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "day", name="uq_usage_user_day"),
    )

    id: Mapped[int] = mapped_column(PK, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        FK("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    draw_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    claimed_symbol: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_credit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class CourseApplication(Base):
    """课程报名意向草稿。

    原先只存在浏览器 localStorage，现改为入库，实现跨设备。
    """

    __tablename__ = "course_applications"

    id: Mapped[int] = mapped_column(PK, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        FK("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country: Mapped[str | None] = mapped_column(String(80), nullable=True)
    region: Mapped[str | None] = mapped_column(String(80), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    age: Mapped[str | None] = mapped_column(String(20), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(40), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    saved_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Symbol(Base):
    """甲骨文字库（管理员可维护）。"""

    __tablename__ = "symbols"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # 1..64，与 content.js 一致
    char: Mapped[str] = mapped_column(String(20), nullable=False)
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    motion: Mapped[str | None] = mapped_column(String(40), nullable=True)
    mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    i18n: Mapped[list["SymbolI18n"]] = relationship(
        back_populates="symbol", cascade="all, delete-orphan"
    )


class SymbolI18n(Base):
    """甲骨字的多语言文案。"""

    __tablename__ = "symbol_i18n"

    symbol_id: Mapped[int] = mapped_column(
        FK("symbols.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str] = mapped_column(String(10), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    meaning: Mapped[str | None] = mapped_column(Text, nullable=True)
    action: Mapped[str | None] = mapped_column(Text, nullable=True)
    reading: Mapped[str | None] = mapped_column(Text, nullable=True)  # 照见解释

    symbol: Mapped[Symbol] = relationship(back_populates="i18n")


class Emotion(Base):
    """情绪图标（管理员可维护）。"""

    __tablename__ = "emotions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label_default: Mapped[str] = mapped_column(String(80), nullable=False)
    group_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    aliases: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    i18n: Mapped[list["EmotionI18n"]] = relationship(
        back_populates="emotion", cascade="all, delete-orphan"
    )


class EmotionI18n(Base):
    __tablename__ = "emotion_i18n"

    emotion_id: Mapped[int] = mapped_column(
        FK("emotions.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str] = mapped_column(String(10), primary_key=True)
    label: Mapped[str] = mapped_column(String(80), nullable=False)

    emotion: Mapped[Emotion] = relationship(back_populates="i18n")


class Question(Base):
    """21 道测试题。"""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    i18n: Mapped[list["QuestionI18n"]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )


class QuestionI18n(Base):
    __tablename__ = "question_i18n"

    question_id: Mapped[int] = mapped_column(
        FK("questions.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str] = mapped_column(String(10), primary_key=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str | None] = mapped_column(Text, nullable=True)
    option_b: Mapped[str | None] = mapped_column(Text, nullable=True)

    question: Mapped[Question] = relationship(back_populates="i18n")


class AdminAuditLog(Base):
    """管理员操作留痕。"""

    __tablename__ = "admin_audit_log"

    id: Mapped[int] = mapped_column(PK, primary_key=True)
    admin_id: Mapped[int] = mapped_column(FK("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now()
    )
