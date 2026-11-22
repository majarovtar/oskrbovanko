from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.models import Base


def _driver_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url[len("postgresql://") :]
    return database_url


def _make_engine(database_url: str):
    url = _driver_url(database_url)
    if url.startswith("sqlite://"):
        return create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    # Supabase zapre povezave, ki nekaj časa mirujejo. pool_pre_ping pred uporabo preveri
    # povezavo in mrtvo zamenja z novo; pool_recycle stare povezave redno osveži.
    # Supabase (session pooler) dovoli skupaj le 15 povezav za vso ekipo, zato jih en
    # backend porabi največ 4 (privzeto bi jih lahko 15 in zasedel vse).
    return create_engine(
        url, pool_pre_ping=True, pool_recycle=300, pool_size=2, max_overflow=2, pool_timeout=15
    )


engine = _make_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Create tables that don't exist yet, and add columns new models bring to tables that do.

    Never drops or changes a column - existing rows and columns are kept as they are.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    tables_to_create = [table for table in Base.metadata.sorted_tables if table.name not in existing_tables]
    if tables_to_create:
        Base.metadata.create_all(bind=engine, tables=tables_to_create)

    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            existing_columns = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                column_type = column.type.compile(dialect=engine.dialect)
                ddl = f"ALTER TABLE {table.name} ADD COLUMN {column.name} {column_type}"
                connection.exec_driver_sql(ddl)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
