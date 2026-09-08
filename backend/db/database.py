"""
database.py — SQLAlchemy engine and session factory.

Uses SQLite for development (zero setup). Switch to PostgreSQL by setting
DATABASE_URL=postgresql://... in your .env file.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from config import settings


# ── Engine ────────────────────────────────────────────────────────────────────
connect_args = {}
if settings.database_url.startswith("sqlite"):
    # SQLite-specific: enable WAL mode and foreign-key enforcement
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=settings.debug,          # prints SQL to stdout when DEBUG=true
)

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Base class for all ORM models ─────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_db():
    """Yield a DB session; close it automatically after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables that don't yet exist (called on app startup)."""
    # Import all models so SQLAlchemy can see them before calling create_all
    import db.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_columns()


# Columns added after the first release.  ``create_all`` never alters existing
# tables, so add them here for databases created by older versions.
_NEW_COLUMNS = {
    "meetings": [
        ("source", "VARCHAR(20) DEFAULT 'upload'"),
    ],
    "action_items": [
        ("due", "VARCHAR(100)"),
        ("evidence", "TEXT"),
        ("confidence", "FLOAT DEFAULT 1.0"),
        ("segment_index", "INTEGER"),
    ],
    "decisions": [
        ("rationale", "TEXT"),
        ("evidence", "TEXT"),
        ("confidence", "FLOAT DEFAULT 1.0"),
        ("segment_index", "INTEGER"),
    ],
}


def _ensure_columns() -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _NEW_COLUMNS.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
