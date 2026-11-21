from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.calls_service import reassess_and_notify
from app.db import get_db
from app.deps import Principal, ensure_patient_access, get_principal, require_service_key
from app.models import Call, Patient, Vitals
from app.schemas import VitalsIn, VitalsOut
from app.timeutils import ljubljana_date

router = APIRouter(tags=["vitals"])


def _to_out(vitals: Vitals) -> VitalsOut:
    return VitalsOut(
        id=vitals.id,
        patient_id=vitals.patient_id,
        pulse=vitals.pulse,
        spo2=vitals.spo2,
        measured_at=vitals.measured_at,
    )


@router.post(
    "/vitals", status_code=201, response_model=VitalsOut, dependencies=[Depends(require_service_key)]
)
def record_vitals(
    body: VitalsIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> VitalsOut:
    patient = db.get(Patient, body.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="not_found")

    vitals = Vitals(
        patient_id=body.patient_id,
        pulse=body.pulse,
        spo2=body.spo2,
        measured_at=body.measured_at,
    )

    target_date = ljubljana_date(body.measured_at)
    candidate_call = (
        db.query(Call)
        .filter(Call.patient_id == body.patient_id, Call.started_at < body.measured_at)
        .order_by(Call.started_at.desc())
        .all()
    )
    matching_call = next((c for c in candidate_call if ljubljana_date(c.started_at) == target_date), None)
    if matching_call is not None:
        vitals.call_id = matching_call.id

    db.add(vitals)
    db.commit()

    if matching_call is not None:
        reassess_and_notify(db, matching_call, patient.name, background_tasks)

    return _to_out(vitals)


@router.get("/patients/{patient_id}/vitals", response_model=list[VitalsOut])
def list_patient_vitals(
    patient_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[VitalsOut]:
    ensure_patient_access(principal, patient_id, db)
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="not_found")
    rows = db.query(Vitals).filter(Vitals.patient_id == patient_id).order_by(Vitals.measured_at.desc()).all()
    return [_to_out(v) for v in rows]
