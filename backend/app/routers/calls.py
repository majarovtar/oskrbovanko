from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.calls_service import call_to_out, reassess_and_notify
from app.db import get_db
from app.deps import Principal, ensure_patient_access, get_principal, require_service_key
from app.models import Answer, Call, Patient, Question
from app.schemas import CallIn, CallOut
from app.severity import flag_for_answer

router = APIRouter(tags=["calls"])


def _questions_for(db: Session, patient_id: uuid.UUID) -> list[Question]:
    return db.query(Question).filter(Question.patient_id == patient_id).order_by(Question.position).all()


def _validate_answers(questions: list[Question], answers: list) -> None:
    if len(answers) != len(questions):
        raise HTTPException(status_code=422, detail="validation_error")
    for question, value in zip(questions, answers, strict=True):
        if value is None:
            continue
        if question.answer_type == "free_text":
            if not isinstance(value, str):
                raise HTTPException(status_code=422, detail="validation_error")
        elif question.answer_type == "yes_no":
            if value not in ("yes", "no"):
                raise HTTPException(status_code=422, detail="validation_error")
        elif question.answer_type == "scale_0_10" and (
            isinstance(value, bool) or not isinstance(value, int) or not (0 <= value <= 10)
        ):
            raise HTTPException(status_code=422, detail="validation_error")


@router.post(
    "/patients/{patient_id}/calls",
    status_code=201,
    response_model=CallOut,
    dependencies=[Depends(require_service_key)],
)
def submit_call(
    patient_id: uuid.UUID,
    body: CallIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> CallOut:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="not_found")

    questions = _questions_for(db, patient_id)
    _validate_answers(questions, body.answers)

    call = Call(
        patient_id=patient_id,
        started_at=body.started_at,
        closing_answer=body.closing_answer,
        transcript=body.transcript,
        emergency_heard=body.emergency_heard,
        emergency_question=body.emergency_question,
    )
    db.add(call)
    db.flush()

    for position, (question, value) in enumerate(zip(questions, body.answers, strict=True), start=1):
        is_emergency_question = body.emergency_question == position
        flag = (
            "high"
            if is_emergency_question
            else flag_for_answer(question.answer_type, value, question.flag_rules)
        )
        db.add(
            Answer(
                call_id=call.id,
                position=position,
                question_text=question.text,
                answer_type=question.answer_type,
                value_json=value,
                flag=flag,
            )
        )
    db.commit()
    db.refresh(call)

    reassess_and_notify(db, call, patient.name, background_tasks)
    db.refresh(call)
    return call_to_out(call)


@router.get("/patients/{patient_id}/calls", response_model=list[CallOut])
def list_patient_calls(
    patient_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[CallOut]:
    ensure_patient_access(principal, patient_id, db)
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="not_found")
    calls = db.query(Call).filter(Call.patient_id == patient_id).order_by(Call.started_at.desc()).all()
    return [call_to_out(c) for c in calls]
