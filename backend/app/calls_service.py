from __future__ import annotations

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.models import Call
from app.notify import send_critical_call_notice
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
    db: Session, call: Call, patient_name: str, background_tasks: BackgroundTasks
) -> None:
    recompute_severity(call)
    db.commit()
    if call.severity == "critical" and not call.critical_notified:
        call.critical_notified = True
        db.commit()
        background_tasks.add_task(
            send_critical_call_notice,
            call_id=call.id,
            patient_id=call.patient_id,
            patient_name=patient_name,
            started_at=call.started_at,
            severity_reasons=call.severity_reasons,
        )


def call_to_out(call: Call) -> CallOut:
    vitals = call.vitals_record
    return CallOut(
        id=call.id,
        patient_id=call.patient_id,
        started_at=call.started_at,
        answers=[
            AnswerOut(question=QuestionRef(text=a.question_text), value=a.value_json, flag=a.flag)
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
