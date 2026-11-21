from __future__ import annotations

from app.config import settings
from app.phrases import contains_emergency_phrase

_FLAG_ORDER = {"low": 0, "medium": 1, "high": 2}


def flag_for_answer(answer_type: str, value: object, flag_rules: list[dict]) -> str | None:
    if value is None:
        return None
    matched: list[str] = []
    for rule in flag_rules:
        if answer_type == "yes_no" and rule.get("when") == value:
            matched.append(rule["level"])
        elif answer_type == "scale_0_10" and isinstance(value, int):
            low, high = rule.get("min"), rule.get("max")
            if low is not None and high is not None and low <= value <= high:
                matched.append(rule["level"])
    if not matched:
        return None
    return max(matched, key=lambda level: _FLAG_ORDER[level])


def assess_severity(
    *,
    transcript: str,
    closing_answer: str,
    emergency_heard: bool,
    answer_flags: list[str | None],
    vitals_pulse: int | None,
    vitals_spo2: int | None,
) -> tuple[str, list[str]]:
    reasons: list[str] = []

    if emergency_heard or contains_emergency_phrase(transcript) or contains_emergency_phrase(closing_answer):
        reasons.append("emergency_phrase")

    if "high" in answer_flags:
        reasons.append("high_flag")

    if vitals_spo2 is not None and vitals_spo2 < settings.spo2_min:
        reasons.append("spo2_low")

    if vitals_pulse is not None and not (settings.pulse_min <= vitals_pulse <= settings.pulse_max):
        reasons.append("pulse_out_of_range")

    severity = "critical" if reasons else "normal"
    return severity, reasons
