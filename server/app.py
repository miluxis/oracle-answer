"""FastAPI 应用入口。

同一个端口同时提供：
- /api/*        后端接口
- /*静态文件     现有 web/ 目录（保持原来的双击启动体验）
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config
from .db import Base, engine
from .routers import admin, auth, upload, userdata, userstate

app = FastAPI(
    title="字有答案 API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    """把 HTTPException 统一成 {"error":{"field","message"}}。"""
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        body = detail
    else:
        body = {"error": {"field": None, "message": str(detail)}}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """把 Pydantic 校验错误转成字段级提示，前端可直接挂到输入框下方。"""
    errs = exc.errors()
    if errs:
        loc = [x for x in errs[0].get("loc", []) if x not in ("body", "query")]
        field = str(loc[0]) if loc else None
        msg = errs[0].get("msg", "输入有误")
        msg = msg.removeprefix("Value error, ")
    else:
        field, msg = None, "输入有误"
    return JSONResponse(
        status_code=422,
        content={"error": {"field": field, "message": msg}},
    )


app.include_router(auth.router)
app.include_router(userdata.router)
app.include_router(admin.router)
app.include_router(upload.router)
app.include_router(userstate.router)


@app.get("/api/health")
def health():
    return {"ok": True, "google_enabled": config.GOOGLE_ENABLED}


# 静态资源放在最后：避免抢占 /api 路由
app.mount("/", StaticFiles(directory=str(config.WEB_DIR), html=True), name="web")
