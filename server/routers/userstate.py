"""用户偏好、每日配额、课程报名意向。

全部按 user_id 存储，实现**跨设备一致**：
- 体验次数配额按账号限制，而不是按设备（换设备不会重置）
- 报名意向换设备后仍能看到
"""
from __future__ import annotations

import json
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import CourseApplication, DailyUsage, User, UserPreferences
from ..schemas import (
    ApplicationIn,
    ApplicationOut,
    PreferencesIn,
    PreferencesOut,
    UsageClaimIn,
    UsageOut,
    fail,
)
from ..security import require_user

router = APIRouter(prefix="/api", tags=["user-state"])

# 每天可抽字次数
DAILY_LIMIT = 7


def _today() -> date:
    return date.today()


def _usage_row(db: DBSession, user_id: int, day: date) -> DailyUsage:
    row = db.scalar(
        select(DailyUsage).where(DailyUsage.user_id == user_id, DailyUsage.day == day)
    )
    if row is None:
        row = DailyUsage(user_id=user_id, day=day)
        db.add(row)
        db.flush()
    return row


def _usage_out(row: DailyUsage) -> UsageOut:
    return UsageOut(
        day=row.day,
        draw_count=row.draw_count,
        remaining=max(0, DAILY_LIMIT - row.draw_count),
        claimed_symbol=row.claimed_symbol,
        has_credit=row.has_credit,
    )


# ---------------- 偏好 ----------------

@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(
    user: User = Depends(require_user), db: DBSession = Depends(get_db)
):
    row = db.get(UserPreferences, user.id)
    if row is None:
        return PreferencesOut(locale=None, last_draw_symbol=None, quiz_bag=[])
    bag: list[int] = []
    if row.quiz_bag:
        try:
            parsed = json.loads(row.quiz_bag)
            if isinstance(parsed, list):
                bag = [int(x) for x in parsed]
        except (ValueError, TypeError):
            bag = []
    return PreferencesOut(
        locale=row.locale,
        last_draw_symbol=row.last_draw_symbol,
        quiz_bag=bag,
    )


@router.put("/preferences", response_model=PreferencesOut)
def put_preferences(
    payload: PreferencesIn,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    row = db.get(UserPreferences, user.id)
    if row is None:
        row = UserPreferences(user_id=user.id)
        db.add(row)
    if payload.locale is not None:
        row.locale = payload.locale
        user.locale = payload.locale
    if payload.last_draw_symbol is not None:
        row.last_draw_symbol = payload.last_draw_symbol
    if payload.quiz_bag is not None:
        row.quiz_bag = json.dumps(payload.quiz_bag[:64])
    db.commit()
    db.refresh(row)
    bag = json.loads(row.quiz_bag) if row.quiz_bag else []
    return PreferencesOut(
        locale=row.locale, last_draw_symbol=row.last_draw_symbol, quiz_bag=bag
    )


# ---------------- 每日配额（按账号） ----------------

@router.get("/usage", response_model=UsageOut)
def get_usage(
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
    day: str | None = None,
):
    target = _today()
    if day:
        try:
            target = date.fromisoformat(day)
        except ValueError:
            raise fail("day", "日期格式应为 YYYY-MM-DD") from None
    row = _usage_row(db, user.id, target)
    db.commit()
    return _usage_out(row)


@router.post("/usage", response_model=UsageOut)
def post_usage(
    payload: UsageClaimIn,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    """记录一次抽字；超出每日上限时返回 403，前端据此引导到支持/课程页。"""
    row = _usage_row(db, user.id, payload.day)

    if payload.credit:
        row.has_credit = True

    if payload.claim:
        if row.draw_count >= DAILY_LIMIT and not row.has_credit:
            db.commit()
            raise fail("quota", "今天的体验次数已用完，明天再来", 403)
        row.draw_count += 1
        if payload.symbol_id is not None:
            row.claimed_symbol = payload.symbol_id

    db.commit()
    db.refresh(row)
    return _usage_out(row)


# ---------------- 课程报名意向 ----------------

@router.get("/application", response_model=ApplicationOut | None)
def get_application(
    user: User = Depends(require_user), db: DBSession = Depends(get_db)
):
    row = db.scalar(
        select(CourseApplication)
        .where(CourseApplication.user_id == user.id)
        .order_by(CourseApplication.updated_at.desc())
    )
    return ApplicationOut.model_validate(row) if row else None


@router.put("/application", response_model=ApplicationOut)
def put_application(
    payload: ApplicationIn,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    """保存/覆盖报名意向草稿（一个账号保留一份）。"""
    row = db.scalar(
        select(CourseApplication).where(CourseApplication.user_id == user.id)
    )
    if row is None:
        row = CourseApplication(user_id=user.id, course_id=payload.course_id)
        db.add(row)
    row.course_id = payload.course_id
    row.name = payload.name
    row.country = payload.country
    row.region = payload.region
    row.email = payload.email
    row.phone = payload.phone
    row.age = payload.age
    row.gender = payload.gender
    row.reason = payload.reason
    row.saved_at = payload.saved_at
    db.commit()
    db.refresh(row)
    return ApplicationOut.model_validate(row)


@router.delete("/application")
def delete_application(
    user: User = Depends(require_user), db: DBSession = Depends(get_db)
):
    rows = db.scalars(
        select(CourseApplication).where(CourseApplication.user_id == user.id)
    ).all()
    for r in rows:
        db.delete(r)
    db.commit()
    return {"ok": True}
