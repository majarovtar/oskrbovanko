from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.call_script import build_instructions
from app.db import get_db
from app.deps import Principal, ensure_patient_access, get_principal
from app.models import Patient, Question

router = APIRouter(tags=["call-script"])


@router.get("/patients/{patient_id}/call-script")
def get_call_script(
    patient_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> dict:
    ensure_patient_access(principal, patient_id, db)
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="not_found")
    questions = db.query(Question).filter(Question.patient_id == patient_id).order_by(Question.position).all()
    return {"instructions": build_instructions(patient.name, questions)}
