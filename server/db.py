"""数据库引擎与会话：同一套 ORM 代码，通过 DATABASE_URL 切换 SQLite / PostgreSQL。

SQLite 与 PostgreSQL 的差异（自增主键、布尔值、时间类型）由 SQLAlchemy 的
方言层处理，业务代码不需要写分支。
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config

_connect_args: dict = {}
if config.DATABASE_URL.startswith("sqlite"):
    # SQLite 默认禁止跨线程复用连接，FastAPI 的线程池需要关掉该检查
    _connect_args["check_same_thread"] = False

engine = create_engine(
    config.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

if config.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        # 开启外键约束，否则 ON DELETE CASCADE 在 SQLite 下不生效
        cur.execute("PRAGMA foreign_keys=ON")
        # WAL 提升并发读写表现
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """FastAPI 依赖：请求级数据库会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """脚本/启动流程使用的会话上下文。"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
