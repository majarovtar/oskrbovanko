"""Sends a real email through Resend - hits the network, no mocking.

Requires RESEND_API_KEY and CRITICAL_CALL_EMAIL_TO in the repo's top-level .env;
skipped when either is missing so the rest of the suite doesn't need them.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import resend
from dotenv import load_dotenv

from app.config import get_settings

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
settings = get_settings()

requires_resend = pytest.mark.skipif(
    not settings.resend_api_key or not settings.critical_call_email_to_list,
    reason="RESEND_API_KEY and CRITICAL_CALL_EMAIL_TO must be set in .env to send a live email",
)


@requires_resend
def test_sends_a_real_email_via_resend() -> None:
    resend.api_key = settings.resend_api_key

    response = resend.Emails.send(
        {
            "from": settings.critical_call_email_from,
            "to": settings.critical_call_email_to_list,
            "subject": "MojOdpust live test email",
            "html": "<p>This is a live test email sent by <strong>test_email_live.py</strong>.</p>",
        }
    )

    assert response.get("id")
