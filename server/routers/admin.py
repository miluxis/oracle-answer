"""管理员后台：甲骨文字库、情绪图标、用户管理。

所有接口都强制 require_admin。前端隐藏入口只是体验，鉴权在这里才是真的。
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import (
    AdminAuditLog,
    Emotion,
    EmotionI18n,
    Favorite,
    Moment,
    Symbol,
    SymbolI18n,
    User,
)
from ..schemas import (
    AdminUserOut,
    AdminUserUpdate,
    EmotionI18nIn,
    EmotionIn,
    EmotionOut,
    SymbolI18nIn,
    SymbolIn,
    SymbolOut,
    fail,
)
from ..security import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _log(db: DBSession, admin: User, action: str, target_type: str,
         target_id: str | None, detail: dict | None = None) -> None:
    db.add(
        AdminAuditLog(
            admin_id=admin.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=json.dumps(detail, ensure_ascii=False) if detail else None,
        )
    )


# ==================== 1) 甲骨文字库 ====================

@router.post("/symbols", response_model=SymbolOut)
def create_symbol(
    payload: SymbolIn,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    """新增甲骨字。id 自动取当前最大值 +1。"""
    if not payload.char.strip():
        raise fail("char", "请填写甲骨字字符")
    if not payload.image_path.strip():
        raise fail("image_path", "请上传该字的图片")
    if not any(x.locale == "zh-CN" and x.title for x in payload.i18n):
        raise fail("i18n", "至少需要填写简体中文标题")

    dup = db.scalar(select(Symbol).where(Symbol.char == payload.char.strip()))
    if dup is not None:
        raise fail("char", f"甲骨字「{payload.char.strip()}」已存在，请直接编辑", 409)

    max_id = db.scalar(select(func.max(Symbol.id))) or 0
    new_id = int(max_id) + 1

    sym = Symbol(
        id=new_id,
        char=payload.char.strip(),
        image_path=payload.image_path.strip(),
        motion=payload.motion,
        mode=payload.mode,
        review=payload.review,
        is_published=payload.is_published,
        sort_order=new_id,
    )
    db.add(sym)
    db.flush()

    for item in payload.i18n:
        db.add(
            SymbolI18n(
                symbol_id=new_id,
                locale=item.locale,
                title=item.title,
                meaning=item.meaning,
                action=item.action,
                reading=item.reading,
            )
        )

    _log(db, admin, "symbol.create", "symbol", str(new_id), {"char": sym.char})
    db.commit()
    db.refresh(sym)
    result = SymbolOut.model_validate(sym)
    result.i18n = [SymbolI18nIn.model_validate(x) for x in sym.i18n]
    return result


@router.get("/symbols", response_model=list[SymbolOut])
def list_symbols(_: User = Depends(require_admin), db: DBSession = Depends(get_db)):
    rows = db.scalars(select(Symbol).order_by(Symbol.sort_order, Symbol.id)).all()
    out = []
    for r in rows:
        item = SymbolOut.model_validate(r)
        item.i18n = [SymbolI18nIn.model_validate(x) for x in r.i18n]
        out.append(item)
    return out



@router.put("/symbols/{symbol_id}", response_model=SymbolOut)
def update_symbol(
    symbol_id: int,
    payload: SymbolIn,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    sym = db.get(Symbol, symbol_id)
    if sym is None:
        raise fail(None, "甲骨字不存在", 404)

    sym.char = payload.char
    sym.image_path = payload.image_path
    sym.motion = payload.motion
    sym.mode = payload.mode
    sym.review = payload.review
    sym.is_published = payload.is_published
    sym.sort_order = payload.sort_order

    for item in payload.i18n:
        row = db.get(SymbolI18n, {"symbol_id": symbol_id, "locale": item.locale})
        if row is None:
            db.add(
                SymbolI18n(
                    symbol_id=symbol_id,
                    locale=item.locale,
                    title=item.title,
                    meaning=item.meaning,
                    action=item.action,
                    reading=item.reading,
                )
            )
        else:
            row.title = item.title
            row.meaning = item.meaning
            row.action = item.action
            row.reading = item.reading

    _log(db, admin, "symbol.update", "symbol", str(symbol_id),
         {"char": payload.char, "published": payload.is_published})
    db.commit()
    db.refresh(sym)
    result = SymbolOut.model_validate(sym)
    result.i18n = [SymbolI18nIn.model_validate(x) for x in sym.i18n]
    return result


# ==================== 2) 情绪图标管理 ====================

@router.post("/emotions", response_model=EmotionOut)
def create_emotion(
    payload: EmotionIn,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    """新增情绪图标。id 自动取当前最大值 +1。"""
    if not payload.image_path.strip():
        raise fail("image_path", "请上传该情绪的图标")
    labels = [x.label for x in payload.i18n if x.label]
    if not labels:
        raise fail("i18n", "至少需要填写一个语言的标签")

    default_label = payload.label_default.strip() or labels[0]
    dup = db.scalar(
        select(Emotion).where(Emotion.label_default == default_label)
    )
    if dup is not None:
        raise fail("label_default", f"情绪「{default_label}」已存在，请直接编辑", 409)

    max_id = db.scalar(select(func.max(Emotion.id))) or 0
    new_id = int(max_id) + 1

    emo = Emotion(
        id=new_id,
        label_default=default_label,
        group_name=payload.group_name,
        image_path=payload.image_path.strip(),
        aliases=payload.aliases,
        is_published=payload.is_published,
        sort_order=new_id,
    )
    db.add(emo)
    db.flush()

    for item in payload.i18n:
        if item.label:
            db.add(EmotionI18n(emotion_id=new_id, locale=item.locale, label=item.label))

    _log(db, admin, "emotion.create", "emotion", str(new_id), {"label": default_label})
    db.commit()
    db.refresh(emo)
    result = EmotionOut.model_validate(emo)
    result.i18n = [EmotionI18nIn.model_validate(x) for x in emo.i18n]
    return result


@router.delete("/symbols/{symbol_id}")
def delete_symbol(
    symbol_id: int,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
    hard: bool = False,
):
    """下架甲骨字。

    默认是**软删除**（只把 is_published 置为 False）：
    用户的「我的片刻」与「我收藏的字」里存的是 symbol_id，
    物理删除会让这些历史记录变成空洞，且无法恢复。
    软删除后前台立刻抽不到这个字，但历史记录仍可正常显示。

    传 `?hard=true` 才真正删除行（仅在确认无任何用户数据引用时使用）。
    """
    sym = db.get(Symbol, symbol_id)
    if sym is None:
        raise fail(None, "甲骨字不存在", 404)

    if hard:
        used = db.scalar(
            select(func.count(Moment.id)).where(Moment.symbol_id == symbol_id)
        )
        # favorites 是 (user_id, symbol_id) 复合主键，没有 id 列
        used += db.scalar(
            select(func.count(Favorite.user_id)).where(
                Favorite.symbol_id == symbol_id
            )
        )
        if used:
            raise fail(
                None,
                f"该字已被 {used} 条用户记录引用，无法彻底删除；请改为「下架」",
                409,
            )
        db.query(SymbolI18n).filter(SymbolI18n.symbol_id == symbol_id).delete()
        db.delete(sym)
        db.commit()
        _log(db, admin, "symbol.delete", "symbol", str(symbol_id), {"hard": True})
        db.commit()
        return {"ok": True, "mode": "deleted"}

    sym.is_published = False
    db.commit()
    _log(db, admin, "symbol.unpublish", "symbol", str(symbol_id), {"char": sym.char})
    db.commit()
    return {"ok": True, "mode": "unpublished"}


@router.get("/meta")
def admin_meta(_: User = Depends(require_admin), db: DBSession = Depends(get_db)):
    """下拉选项：库里实际在用的 motion，以及 mode 的固定取值与文案。"""
    motions = sorted({
        s.motion for s in db.scalars(select(Symbol)).all() if s.motion
    })
    groups = sorted({
        e.group_name for e in db.scalars(select(Emotion)).all() if e.group_name
    })
    return {
        "motions": motions,
        "modes": [
            {"value": "Being", "label": "Being — 静静感受"},
            {"value": "Doing", "label": "Doing — 亲身行动"},
        ],
        "emotion_groups": groups,
        "locales": ["zh-CN", "zh-TW", "en", "ja", "th", "ar"],
    }


@router.get("/emotions", response_model=list[EmotionOut])
def list_emotions(_: User = Depends(require_admin), db: DBSession = Depends(get_db)):
    rows = db.scalars(select(Emotion).order_by(Emotion.sort_order, Emotion.id)).all()
    out = []
    for r in rows:
        item = EmotionOut.model_validate(r)
        item.i18n = [EmotionI18nIn.model_validate(x) for x in r.i18n]
        out.append(item)
    return out



@router.put("/emotions/{emotion_id}", response_model=EmotionOut)
def update_emotion(
    emotion_id: int,
    payload: EmotionIn,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    emo = db.get(Emotion, emotion_id)
    if emo is None:
        raise fail(None, "情绪图标不存在", 404)

    emo.label_default = payload.label_default
    emo.group_name = payload.group_name
    emo.image_path = payload.image_path
    emo.aliases = payload.aliases
    emo.is_published = payload.is_published
    emo.sort_order = payload.sort_order

    for item in payload.i18n:
        row = db.get(EmotionI18n, {"emotion_id": emotion_id, "locale": item.locale})
        if row is None:
            db.add(EmotionI18n(emotion_id=emotion_id, locale=item.locale, label=item.label))
        else:
            row.label = item.label

    _log(db, admin, "emotion.update", "emotion", str(emotion_id),
         {"label": payload.label_default, "published": payload.is_published})
    db.commit()
    db.refresh(emo)
    result = EmotionOut.model_validate(emo)
    result.i18n = [EmotionI18nIn.model_validate(x) for x in emo.i18n]
    return result


@router.delete("/emotions/{emotion_id}")
def delete_emotion(
    emotion_id: int,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
    hard: bool = False,
):
    """下架情绪图标。同样默认软删除，保护用户历史记录。"""
    emo = db.get(Emotion, emotion_id)
    if emo is None:
        raise fail(None, "情绪图标不存在", 404)

    if hard:
        used = db.scalar(
            select(func.count(Moment.id)).where(Moment.emotion_id == emotion_id)
        )
        if used:
            raise fail(
                None,
                f"该情绪已被 {used} 条用户记录引用，无法彻底删除；请改为「下架」",
                409,
            )
        db.query(EmotionI18n).filter(EmotionI18n.emotion_id == emotion_id).delete()
        db.delete(emo)
        db.commit()
        _log(db, admin, "emotion.delete", "emotion", str(emotion_id), {"hard": True})
        db.commit()
        return {"ok": True, "mode": "deleted"}

    emo.is_published = False
    db.commit()
    _log(db, admin, "emotion.unpublish", "emotion", str(emotion_id),
         {"label": emo.label_default})
    db.commit()
    return {"ok": True, "mode": "unpublished"}


# ==================== 3) 用户信息管理 ====================

@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    _: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
    q: str | None = None,
):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            func.lower(User.email).like(like) | func.lower(User.display_name).like(like)
        )
    users = db.scalars(stmt).all()

    out = []
    for u in users:
        item = AdminUserOut.model_validate(u)
        item.moment_count = db.scalar(
            select(func.count(Moment.id)).where(Moment.user_id == u.id)
        ) or 0
        out.append(item)
    return out


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None:
        raise fail(None, "用户不存在", 404)

    if target.id == admin.id:
        # 保护：不能改自己的角色，也不能停用自己（避免把最后一个管理员锁死）
        if payload.role is not None and payload.role != target.role:
            raise fail("role", "不能修改自己的管理员权限", 400)
        if payload.status is not None and payload.status != "active":
            raise fail("status", "不能停用自己的账号", 400)

    if payload.role is not None:
        if payload.role not in {"user", "admin"}:
            raise fail("role", "角色只能是 user 或 admin", 400)
        if payload.role != target.role:
            # 不能降级最后一个管理员
            if target.role == "admin" and payload.role == "user":
                admin_count = db.scalar(
                    select(func.count(User.id)).where(User.role == "admin")
                )
                if (admin_count or 0) <= 1:
                    raise fail("role", "系统至少需要保留一名管理员", 400)
            target.role = payload.role

    if payload.status is not None:
        if payload.status not in {"active", "disabled"}:
            raise fail("status", "状态只能是 active 或 disabled", 400)
        if payload.status == "disabled" and target.role == "admin":
            admin_count = db.scalar(
                select(func.count(User.id)).where(
                    User.role == "admin", User.status == "active"
                )
            )
            if (admin_count or 0) <= 1:
                raise fail("status", "系统至少需要保留一名可用管理员", 400)
        target.status = payload.status
        if payload.status == "disabled":
            # 停用即刻失效所有会话
            from ..models import Session as SessionRow

            for row in db.scalars(
                select(SessionRow).where(SessionRow.user_id == target.id)
            ).all():
                db.delete(row)

    _log(db, admin, "user.update", "user", str(target.id), payload.model_dump(exclude_none=True))
    db.commit()
    db.refresh(target)
    return AdminUserOut.model_validate(target)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None:
        raise fail(None, "用户不存在", 404)
    if target.id == admin.id:
        raise fail(None, "不能删除自己的账号", 400)
    if target.role == "admin":
        admin_count = db.scalar(
            select(func.count(User.id)).where(User.role == "admin")
        )
        if (admin_count or 0) <= 1:
            raise fail(None, "系统至少需要保留一名管理员", 400)

    # moments / favorites / oauth / sessions 由 ON DELETE CASCADE 处理
    db.delete(target)
    _log(db, admin, "user.delete", "user", str(target.id), {"email": target.email})
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/password")
def reset_password(
    user_id: int,
    payload: dict,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    from .. import security

    target = db.get(User, user_id)
    if target is None:
        raise fail(None, "用户不存在", 404)
    raw = str(payload.get("password") or "")
    if len(raw) < 8:
        raise fail("password", "密码至少 8 位", 400)
    target.password_hash = security.hash_password(raw)
    _log(db, admin, "user.reset_password", "user", str(target.id))
    db.commit()
    return {"ok": True}


# ==================== 审计日志 ====================

@router.get("/audit")
def list_audit(
    _: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
    limit: int = 100,
):
    rows = db.scalars(
        select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(min(limit, 500))
    ).all()
    out = []
    for r in rows:
        admin = db.get(User, r.admin_id)
        out.append(
            {
                "id": r.id,
                "admin": admin.email if admin else "-",
                "action": r.action,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "detail": r.detail,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )
    return out
