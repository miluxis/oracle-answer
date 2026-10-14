"""命令行工具：给指定账号设置密码（管理员首次登录用）。

用法：
    python -m server.set_password oracleanswered@gmail.com
    # 交互式输入，不回显

或非交互（仅限本地/CI，谨慎使用）：
    python -m server.set_password oracleanswered@gmail.com --password 'xxx'
"""
from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import select

from . import config
from .db import session_scope
from .models import User
from .security import hash_password


def main() -> int:
    ap = argparse.ArgumentParser(description="设置用户密码")
    ap.add_argument("email", help="目标邮箱")
    ap.add_argument("--password", help="新密码（省略则交互输入）")
    args = ap.parse_args()

    email = args.email.lower().strip()
    if args.password:
        raw = args.password
    else:
        raw = getpass.getpass(f"为 {email} 设置新密码（至少{config.MIN_PASSWORD_LENGTH}位）: ")
        confirm = getpass.getpass("再次输入: ")
        if raw != confirm:
            print("两次输入不一致", file=sys.stderr)
            return 1

    if len(raw) < config.MIN_PASSWORD_LENGTH:
        print(f"密码至少 {config.MIN_PASSWORD_LENGTH} 位", file=sys.stderr)
        return 1

    with session_scope() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"账号不存在：{email}", file=sys.stderr)
            print("提示：管理员账号会在首次启动时自动创建（见 ADMIN_EMAILS）", file=sys.stderr)
            return 1
        user.password_hash = hash_password(raw)
        print(f"已为 {email} 设置密码（角色：{user.role}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
