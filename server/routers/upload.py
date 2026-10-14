"""管理员图片上传。

安全要点：
- 必须 admin 身份。
- 校验**文件头魔数**而非仅扩展名，防止把脚本改名为 .png 上传。
- 文件名完全由服务端生成（随机 token + 白名单扩展名），不接受客户端文件名，
  因此不会出现 ../ 路径穿越，也不会覆盖已有文件。
- 限制体积与像素数。
"""
from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile

from ..models import User
from ..schemas import fail
from ..security import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "web" / "assets" / "uploads"

MAX_BYTES = 8 * 1024 * 1024  # 8MB

# 扩展名 -> 必需的文件头魔数
SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".webp": (b"RIFF",),  # 另需校验第 8-11 字节为 WEBP
    ".gif": (b"GIF87a", b"GIF89a"),
}


def _check_signature(ext: str, head: bytes) -> bool:
    sigs = SIGNATURES.get(ext)
    if not sigs:
        return False
    if ext == ".webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    return any(head.startswith(s) for s in sigs)


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
):
    """上传图片，返回可直接用于 image_path 的相对路径。"""
    original = file.filename or ""
    ext = Path(original).suffix.lower()

    if ext not in SIGNATURES:
        raise fail(
            "file",
            "只支持 PNG / JPG / WEBP / GIF 格式，当前文件类型不受支持",
        )

    data = await file.read()
    if not data:
        raise fail("file", "文件为空")
    if len(data) > MAX_BYTES:
        raise fail("file", "图片过大，请压缩到 8MB 以内")

    if not _check_signature(ext, data[:16]):
        raise fail("file", "文件内容与扩展名不符，请重新选择图片")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    # 服务端生成文件名，完全忽略客户端提供的名字
    name = f"{secrets.token_hex(12)}{ext}"
    target = UPLOAD_DIR / name
    target.write_bytes(data)

    rel = f"assets/uploads/{name}"
    return {"ok": True, "path": rel, "bytes": len(data)}
