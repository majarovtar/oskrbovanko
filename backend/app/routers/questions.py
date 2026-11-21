from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Principal, ensure_doctor_or_admin, ensure_patient_access, get_principal
from app.models import Patient, Question
from app.presets import preset_by_id, question_presets
from app.schemas import FlagRule, QuestionIn, QuestionOut, QuestionPresetOut

router = APIRouter(tags=["questions"])


def _validate_question_set(questions: list[QuestionIn]) -> None:
    if not questions or len(questions) > 10:
        raise HTTPException(status_code=422, detail="validation_error")
    for question in questions:
        if question.answer_type not in ("free_text", "yes_no", "scale_0_10"):
            raise HTTPException(status_code=422, detail="validation_error")
        if question.answer_type == "free_text" and question.flag_rules:
            raise HTTPException(status_code=422, detail="validation_error")
        if question.answer_type == "yes_no":
            for rule in question.flag_rules:
                if rule.when not in ("yes", "no") or rule.min is not None or rule.max is not None:
                    raise HTTPException(status_code=422, detail="validation_error")
        if question.answer_type == "scale_0_10":
            for rule in question.flag_rules:
                if (
                    rule.when is not None
                    or rule.min is None
                    or rule.max is None
                    or not (0 <= rule.min <= rule.max <= 10)
                ):
                    raise HTTPException(status_code=422, detail="validation_error")


def _store_questions(db: Session, patient_id: uuid.UUID, questions: list[QuestionIn]) -> list[Question]:
    db.query(Question).filter(Question.patient_id == patient_id).delete()
    rows = []
    for position, question in enumerate(questions, start=1):
        row = Question(
            patient_id=patient_id,
            position=position,
            text=question.text,
            answer_type=question.answer_type,
            flag_rules=[rule.model_dump(exclude_none=True) for rule in question.flag_rules],
        )
        db.add(row)
        rows.append(row)
    db.commit()
    return rows


def _to_out(question: Question) -> QuestionOut:
    return QuestionOut(
        text=question.text,
        answer_type=question.answer_type,
        flag_rules=[FlagRule(**rule) for rule in question.flag_rules],
    )


@router.get("/question-presets", response_model=list[QuestionPresetOut])
def list_question_presets() -> list[QuestionPresetOut]:
    return [QuestionPresetOut(**preset) for preset in question_presets()]


@router.get("/patients/{patient_id}/questions", response_model=list[QuestionOut])
def get_patient_questions(
    patient_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[QuestionOut]:
    ensure_patient_access(principal, patient_id, db)
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="not_found")
    questions = db.query(Question).filter(Question.patient_id == patient_id).order_by(Question.position).all()
    return [_to_out(q) for q in questions]


@router.put("/patients/{patient_id}/questions", response_model=list[QuestionOut])
def set_patient_questions(
    patient_id: uuid.UUID,
    body: list[QuestionIn],
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[QuestionOut]:
    ensure_patient_access(principal, patient_id, db)
    ensure_doctor_or_admin(principal)
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="not_found")
    _validate_question_set(body)
    rows = _store_questions(db, patient_id, body)
    return [_to_out(q) for q in rows]


@router.post("/patients/{patient_id}/questions/preset", response_model=list[QuestionOut])
def apply_question_preset(
    patient_id: uuid.UUID,
    body: dict,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[QuestionOut]:
    ensure_patient_access(principal, patient_id, db)
    ensure_doctor_or_admin(principal)
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="not_found")
    preset = preset_by_id(body["preset_id"])
    if preset is None:
        raise HTTPException(status_code=404, detail="not_found")
    questions = [QuestionIn(**q) for q in preset["questions"]]
    rows = _store_questions(db, patient_id, questions)
    return [_to_out(q) for q in rows]
