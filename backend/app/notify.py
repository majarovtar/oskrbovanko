from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Callable
from datetime import datetime

import resend

from app.config import settings

logger = logging.getLogger("app.notify")


def _default_send(params: dict) -> None:
    resend.api_key = settings.resend_api_key
    resend.Emails.send(params)  # type: ignore[arg-type]


_send_email: Callable[[dict], None] = _default_send


async def send_critical_call_notice(
    *,
    call_id: uuid.UUID,
    patient_id: uuid.UUID,
    patient_name: str,
    started_at: datetime,
    severity_reasons: list[str],
) -> None:
    recipients = settings.critical_call_email_to_list
    if not recipients or not settings.resend_api_key:
        return

    reasons_text = ", ".join(severity_reasons)
    subject = f"CareCall: nujen klic - {patient_name} ({reasons_text})"
    html = (
        f"<p>{subject}</p>"
        f"<p>Patient ID: {patient_id}</p>"
        f"<p>Call ID: {call_id}</p>"
        f"<p>Started at: {started_at.isoformat()}</p>"
    )
    params = {
        "from": settings.critical_call_email_from,
        "to": recipients,
        "subject": subject,
        "html": html,
    }

    try:
        await asyncio.to_thread(_send_email, params)
    except Exception:
        logger.exception("critical-call email send to %s failed", recipients)
