"""公开内容接口：把后台（数据库）的内容提供给前台体验流程。

背景：前台原先读静态文件 `web/content.js`，后台管理写入 PostgreSQL，
两者是彼此独立的两套数据源——后台改字、添字、下架都不会影响用户看到的页面。
本接口让前台可以直接读库，从而实现「后台改动实时生效」。

只返回 `is_published` 为真的记录；未发布的内容仅在管理后台可见。
无需登录——这是站点公开内容，与用户数据无关。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import Emotion, EmotionI18n, Question, QuestionI18n, Symbol, SymbolI18n

router = APIRouter(prefix="/api", tags=["content"])

# 前端需要的语言集合
LOCALES = ("zh-CN", "zh-TW", "en", "ja", "th", "ar")


def _i18n_map(rows, value_attr: str) -> dict[str, str]:
    """把多行 i18n 记录转成 {locale: 文本}。缺语言时不补，留空给前端回落。"""
    return {r.locale: (getattr(r, value_attr) or "") for r in rows}


@router.get("/content")
def get_content(db: DBSession = Depends(get_db)):
    """返回已发布内容，结构与 `web/content.js` 中的 symbols/emotions/questions 一致。

    前端拿到后会整体覆盖同名字段；请求失败时自动回落到静态文件，站点仍可访问。
    """
    # ---- 甲骨字 ----
    symbols = db.scalars(
        select(Symbol)
        .where(Symbol.is_published.is_(True))
        .order_by(Symbol.sort_order, Symbol.id)
    ).all()
    i18n_rows = db.scalars(
        select(SymbolI18n).where(SymbolI18n.symbol_id.in_([s.id for s in symbols] or [0]))
    ).all()
    by_symbol: dict[int, list] = {}
    for r in i18n_rows:
        by_symbol.setdefault(r.symbol_id, []).append(r)

    out_symbols = []
    for s in symbols:
        rows = by_symbol.get(s.id, [])
        out_symbols.append(
            {
                "id": s.id,
                "char": s.char,
                "title": _i18n_map(rows, "title"),
                "meaning": _i18n_map(rows, "meaning"),
                "action": _i18n_map(rows, "action"),
                "motion": s.motion or "",
                "image": s.image_path,
                "mode": s.mode or "Being",
                "review": bool(s.review),
            }
        )

    # ---- 情绪 ----
    emotions = db.scalars(
        select(Emotion)
        .where(Emotion.is_published.is_(True))
        .order_by(Emotion.sort_order, Emotion.id)
    ).all()
    emo_i18n = db.scalars(
        select(EmotionI18n).where(EmotionI18n.emotion_id.in_([e.id for e in emotions] or [0]))
    ).all()
    by_emotion: dict[int, list] = {}
    for r in emo_i18n:
        by_emotion.setdefault(r.emotion_id, []).append(r)

    out_emotions = []
    for e in emotions:
        out_emotions.append(
            {
                "id": e.id,
                "label": _i18n_map(by_emotion.get(e.id, []), "label"),
                "group": e.group_name or "classic",
                "image": e.image_path,
                "aliases": e.aliases or "",
            }
        )

    # ---- 测试题 ----
    questions = db.scalars(
        select(Question)
        .where(Question.is_published.is_(True))
        .order_by(Question.sort_order, Question.id)
    ).all()
    q_i18n = db.scalars(
        select(QuestionI18n).where(
            QuestionI18n.question_id.in_([q.id for q in questions] or [0])
        )
    ).all()
    by_question: dict[int, dict] = {}
    for r in q_i18n:
        by_question.setdefault(r.locale, {})[r.question_id] = r

    out_questions = []
    for q in questions:
        per_locale = by_question
        prompt = {}
        opt_a = {}
        opt_b = {}
        for loc in LOCALES:
            row = per_locale.get(loc, {}).get(q.id)
            if row is None:
                continue
            prompt[loc] = row.prompt or ""
            opt_a[loc] = row.option_a or ""
            opt_b[loc] = row.option_b or ""
        out_questions.append({"q": prompt, "a": [opt_a, opt_b]})

    return {
        "symbols": out_symbols,
        "emotions": out_emotions,
        "questions": out_questions,
        "locales": list(LOCALES),
    }
