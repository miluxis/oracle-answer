"""把前端现有的 content.js / deep-readings.js 内容导入数据库。

内容源仍是前端那两份 JS（保持单一事实来源），本脚本只在数据不存在时写入，
已有数据不覆盖——避免管理员在后台的修改被重新 seed 冲掉。

用法：
    python -m server.seed
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from . import config
from .db import Base, engine, session_scope
from .models import (
    Emotion,
    EmotionI18n,
    Question,
    QuestionI18n,
    Symbol,
    SymbolI18n,
    User,
)

LOCALES = ["zh-CN", "zh-TW", "en", "ja", "th", "ar"]

_NODE_CANDIDATES = ["node", "/opt/homebrew/bin/node"]


def _extract_with_node() -> dict:
    """用 Node 执行前端 JS 拿到真实对象，避免用正则猜结构。"""
    script = r"""
global.window = {};
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
eval(fs.readFileSync(path.join(dir, 'content.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'deep-readings.js'), 'utf8'));
console.log(JSON.stringify({
  symbols: window.CONTENT.symbols,
  emotions: window.CONTENT.emotions,
  questions: window.CONTENT.questions,
  readings: window.DEEP_READINGS
}));
"""
    node = next((n for n in _NODE_CANDIDATES if Path(n).exists()), None)
    if node is None:
        raise SystemExit("未找到 node。请安装 Node.js，或手动提供内容 JSON 文件。")

    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(script)
        script_path = fh.name
    try:
        out = subprocess.run(
            [node, script_path, str(config.WEB_DIR)],
            capture_output=True, text=True, check=True, timeout=60,
        )
        return json.loads(out.stdout)
    finally:
        Path(script_path).unlink(missing_ok=True)


def seed_content() -> None:
    data = _extract_with_node()
    readings: dict[str, str] = data.get("readings") or {}

    with session_scope() as db:
        # ---- 甲骨文字 ----
        existing = {s.id for s in db.query(Symbol).all()}
        for i, s in enumerate(data["symbols"]):
            if s["id"] in existing:
                continue
            sym = Symbol(
                id=s["id"],
                char=s["char"],
                image_path=s.get("image", f"assets/symbol-{s['id']}.png"),
                motion=s.get("motion"),
                mode=s.get("mode"),
                review=bool(s.get("review")),
                is_published=True,
                sort_order=i,
            )
            db.add(sym)
            for loc in LOCALES:
                if loc not in s.get("title", {}):
                    continue
                db.add(
                    SymbolI18n(
                        symbol_id=s["id"],
                        locale=loc,
                        title=s["title"][loc],
                        meaning=s.get("meaning", {}).get(loc),
                        action=s.get("action", {}).get(loc),
                        reading=readings.get(str(s["id"])),
                    )
                )
        db.flush()

        # ---- 情绪图标 ----
        have_e = {e.id for e in db.query(Emotion).all()}
        for i, e in enumerate(data["emotions"]):
            if e["id"] in have_e:
                continue
            emo = Emotion(
                id=e["id"],
                label_default=e.get("label", {}).get("zh-CN", ""),
                group_name=e.get("group"),
                image_path=e.get("image", f"assets/emotions/{e['id']}.webp"),
                aliases=e.get("aliases") or None,
                is_published=True,
                sort_order=i,
            )
            db.add(emo)
            for loc in LOCALES:
                if loc in e.get("label", {}):
                    db.add(
                        EmotionI18n(
                            emotion_id=e["id"], locale=loc, label=e["label"][loc]
                        )
                    )
        db.flush()

        # ---- 测试题 ----
        if db.query(Question).count() == 0:
            for i, q in enumerate(data["questions"]):
                qq = Question(id=i + 1, sort_order=i, is_published=True)
                db.add(qq)
                answers = q.get("a") or []
                a0 = answers[0] if len(answers) > 0 else {}
                a1 = answers[1] if len(answers) > 1 else {}
                for loc in LOCALES:
                    if loc not in q.get("q", {}):
                        continue
                    db.add(
                        QuestionI18n(
                            question_id=qq.id,
                            locale=loc,
                            prompt=q["q"][loc],
                            option_a=a0.get(loc),
                            option_b=a1.get(loc),
                        )
                    )

    print(
        f"内容已导入：{len(data['symbols'])} 个甲骨字、"
        f"{len(data['emotions'])} 个情绪、{len(data['questions'])} 道题"
    )


def seed_admin() -> None:
    """按 ADMIN_EMAILS 自动创建管理员（无密码，仅可用 Google 登录或后续设密码）。"""
    from . import security

    with session_scope() as db:
        made = []
        for email in config.ADMIN_EMAILS:
            user = db.query(User).filter_by(email=email).one_or_none()
            if user is None:
                user = User(
                    email=email,
                    display_name=email.split("@")[0],
                    role="admin",
                    password_hash=None,
                )
                db.add(user)
                made.append(email)
            elif user.role != "admin":
                user.role = "admin"
        if made:
            print("已创建管理员：" + ", ".join(made))
        else:
            print("管理员账号已存在，跳过")
    _ = security  # 仅确保可导入


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print(f"数据库已就绪：{config.DATABASE_URL.split('://')[0]}")
    seed_admin()
    seed_content()


if __name__ == "__main__":
    main()
    sys.exit(0)
