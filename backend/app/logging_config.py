from __future__ import annotations

import logging
import re

_QUERY_PARAM_PATTERN = re.compile(r"(?<=[?&])(token|service_key)=[^&\s\"]*")


def _redact(value: str) -> str:
    return _QUERY_PARAM_PATTERN.sub(r"\1=[REDACTED]", value)


class RedactQueryParamsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _redact(record.msg)
        if record.args:
            record.args = tuple(_redact(arg) if isinstance(arg, str) else arg for arg in record.args)
        return True


def configure_logging() -> None:
    for logger_name in ("uvicorn.access", "app.call_stream"):
        logging.getLogger(logger_name).addFilter(RedactQueryParamsFilter())
