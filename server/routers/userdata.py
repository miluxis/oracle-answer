"""「我的片刻」与收藏：登录用户的数据读写。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import Favorite, Moment, User
from ..schemas import (
    FavoriteOut,
    LocalMigrateIn,
    LocalMigrateOut,
    MomentIn,
    MomentOut,
    fail,
)
from ..security import require_user

router = APIRouter(prefix="/api", tags=["user-data"])


@router.get("/moments", response_model=list[MomentOut])
def list_moments(
    user: User = Depends(require_user), db: DBSession = Depends(get_db)
):
    rows = db.scalars(
        select(Moment)
        .where(Moment.user_id == user.id)
        .order_by(Moment.created_at.desc(), Moment.id.desc())
    ).all()
    return [MomentOut.model_validate(r) for r in rows]


@router.put("/moments", response_model=MomentOut)
def save_moment(
    payload: MomentIn,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    """保存「这一刻」。

    - 请求带 id → 编辑该条记录
    - 请求不带 id → 新增一条（同一天可留多条，不再互相覆盖）
    """
    row = None
    if payload.id is not None:
        row = db.scalar(
            select(Moment).where(Moment.id == payload.id, Moment.user_id == user.id)
        )
        if row is None:
            raise fail("id", "记录不存在", 404)
    else:
        row = Moment(user_id=user.id, date=payload.date)
        db.add(row)
    row.date = payload.date
    row.symbol_id = payload.symbol_id
    row.emotion_id = payload.emotion_id
    row.note = (payload.note or "")[:140] or None
    row.mode = payload.mode
    db.commit()
    db.refresh(row)
    return MomentOut.model_validate(row)


@router.delete("/moments/{moment_id}")
def delete_moment(
    moment_id: int,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    """按记录 id 删除（一天可能有多条，不能再按日期删）。"""
    row = db.get(Moment, moment_id)
    if row is None or row.user_id != user.id:
        raise fail(None, "记录不存在", 404)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/favorites", response_model=list[FavoriteOut])
def list_favorites(
    user: User = Depends(require_user), db: DBSession = Depends(get_db)
):
    rows = db.scalars(
        select(Favorite).where(Favorite.user_id == user.id).order_by(Favorite.created_at)
    ).all()
    return [FavoriteOut.model_validate(r) for r in rows]


@router.put("/favorites/{symbol_id}")
def add_favorite(
    symbol_id: int,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    exists = db.get(Favorite, {"user_id": user.id, "symbol_id": symbol_id})
    if exists is None:
        db.add(Favorite(user_id=user.id, symbol_id=symbol_id))
        db.commit()
    return {"ok": True, "favorited": True}


@router.delete("/favorites/{symbol_id}")
def remove_favorite(
    symbol_id: int,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    row = db.get(Favorite, {"user_id": user.id, "symbol_id": symbol_id})
    if row is not None:
        db.delete(row)
        db.commit()
    return {"ok": True, "favorited": False}


@router.post("/migrate/local", response_model=LocalMigrateOut)
def migrate_local(
    payload: LocalMigrateIn,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    """把浏览器 localStorage 里的旧数据并入当前账号。

    幂等：依赖 moments 的 UNIQUE(user_id, date)，重复导入不会产生重复行。
    """
    imported = 0
    skipped = 0

    # 一天可留多条，故改为按「日期+字+备注」组合判重，保证重复导入不产生副本
    for rec in payload.records:
        exists = db.scalar(
            select(Moment).where(
                Moment.user_id == user.id,
                Moment.date == rec.date,
                Moment.symbol_id == rec.symbol_id,
                Moment.note == ((rec.note or "")[:140] or None),
            )
        )
        if exists is not None:
            skipped += 1
            continue
        db.add(
            Moment(
                user_id=user.id,
                date=rec.date,
                symbol_id=rec.symbol_id,
                emotion_id=rec.emotion_id,
                note=(rec.note or "")[:140] or None,
                mode=rec.mode,
            )
        )
        imported += 1

    fav_imported = 0
    for sid in payload.favorites:
        row = db.get(Favorite, {"user_id": user.id, "symbol_id": int(sid)})
        if row is None:
            db.add(Favorite(user_id=user.id, symbol_id=int(sid)))
            fav_imported += 1

    db.commit()
    return LocalMigrateOut(
        imported_moments=imported,
        imported_favorites=fav_imported,
        skipped=skipped,
    )
