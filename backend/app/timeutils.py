from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

LJUBLJANA = ZoneInfo("Europe/Ljubljana")


def aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def ljubljana_date(dt: datetime) -> date:
    return aware(dt).astimezone(LJUBLJANA).date()


def ljubljana_time_of_day(dt: datetime) -> str:
    local = aware(dt).astimezone(LJUBLJANA)
    return f"{local.hour:02d}:{local.minute:02d}:{local.second:02d}"
