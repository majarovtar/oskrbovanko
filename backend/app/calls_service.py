from __future__ import annotations

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.models import Call
from app.notify import send_call_notice
from app.phone_answers import assess_answer
from app.phone_call import QUESTIONS as PHONE_QUESTIONS
from app.schemas import AnswerOut, CallOut, QuestionRef, VitalsSummary
from app.severity import assess_severity


def recompute_severity(call: Call) -> None:
    vitals = call.vitals_record
    pulse = vitals.pulse if vitals else None
    spo2 = vitals.spo2 if vitals else None
    answer_flags = [answer.flag for answer in call.answers]
    severity, reasons = assess_severity(
        transcript=call.transcript,
        closing_answer=call.closing_answer,
        emergency_heard=call.emergency_heard,
        answer_flags=answer_flags,
        vitals_pulse=pulse,
        vitals_spo2=spo2,
    )
    call.severity = severity
    call.severity_reasons = reasons


def reassess_and_notify(
    db: Session,
    call: Call,
    patient_name: str,
    background_tasks: BackgroundTasks,
    *,
    new_entry: bool = False,
) -> None:
    """Recompute severity and email a notice.

    `new_entry` fires a notice unconditionally (every new call is announced, with a
    warning emoji when critical); without it, a notice only fires the first time this
    call turns critical - e.g. when vitals attached later tip it over.
    """
    recompute_severity(call)
    db.commit()

    newly_critical = call.severity == "critical" and not call.critical_notified
    if call.severity == "critical" and not call.critical_notified:
        call.critical_notified = True
        db.commit()

    if new_entry or newly_critical:
        background_tasks.add_task(
            send_call_notice,
            call_id=call.id,
            patient_id=call.patient_id,
            patient_name=patient_name,
            started_at=call.started_at,
            severity=call.severity,
            severity_reasons=call.severity_reasons,
        )


def _answer_flag(answer) -> str | None:
    """Shranjena oznaka; za odgovore iz telefonskega klica brez oznake (shranjene pred
    uvedbo ocenjevanja) jo izračunamo ob branju, da so vsi klici obarvani enako."""
    if answer.flag is not None:
        return answer.flag
    if answer.question_text in PHONE_QUESTIONS and isinstance(answer.value_json, str):
        return assess_answer(PHONE_QUESTIONS.index(answer.question_text) + 1, answer.value_json)
    return None


def call_to_out(call: Call) -> CallOut:
    vitals = call.vitals_record
    return CallOut(
        id=call.id,
        patient_id=call.patient_id,
        started_at=call.started_at,
        answers=[
            AnswerOut(question=QuestionRef(text=a.question_text), value=a.value_json, flag=_answer_flag(a))
            for a in call.answers
        ],
        closing_answer=call.closing_answer,
        transcript=call.transcript,
        emergency_heard=call.emergency_heard,
        emergency_question=call.emergency_question,
        vitals=(
            VitalsSummary(pulse=vitals.pulse, spo2=vitals.spo2, measured_at=vitals.measured_at)
            if vitals
            else None
        ),
        severity=call.severity,
        severity_reasons=call.severity_reasons,
    )
