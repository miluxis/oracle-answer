#!/bin/bash
# 字有答案 · 本地一键启动（macOS / Linux）
# 自动创建虚拟环境、安装依赖、初始化数据库、启动服务
set -e
cd "$(dirname "$0")"

PY=""
for c in python3 /usr/bin/python3; do
  if command -v "$c" >/dev/null 2>&1; then
    if "$c" -c 'import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)' 2>/dev/null; then
      PY="$c"; break
    fi
  fi
done

if [ -z "$PY" ]; then
  echo "需要 Python 3.10 或更高版本。"
  echo "  macOS: brew install python3"
  echo "  Ubuntu: sudo apt install python3 python3-venv"
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "首次运行：正在创建虚拟环境…"
  "$PY" -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  echo "正在安装依赖（首次约需 1-2 分钟）…"
  .venv/bin/pip install -q -r requirements.txt
  echo "正在初始化数据库…"
  .venv/bin/python -m server.seed
fi

PORT="${PORT:-8150}"
echo ""
echo "  字有答案 · Daily Symbol"
echo "  地址：http://127.0.0.1:${PORT}/"
echo "  管理员：oracleanswered@gmail.com"
echo "  首次使用请执行：.venv/bin/python -m server.set_password oracleanswered@gmail.com"
echo ""
echo "  按 Ctrl+C 停止服务"
echo ""

exec .venv/bin/python -m uvicorn server.app:app --host 127.0.0.1 --port "${PORT}"
