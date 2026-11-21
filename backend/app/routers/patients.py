from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Principal, ensure_doctor_or_admin, ensure_patient_access, get_principal
from app.models import Patient, PatientAccount
from app.schemas import PatientIn, PatientOut

router = APIRouter(prefix="/patients", tags=["patients"])


def _to_out(patient: Patient) -> PatientOut:
    return PatientOut(
        id=patient.id,
        name=patient.name,
        phone_number=patient.phone_number,
        call_time=patient.call_time,
        consent=patient.consent,
    )


@router.post("", status_code=201, response_model=PatientOut)
def create_patient(
    body: PatientIn,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> PatientOut:
    ensure_doctor_or_admin(principal)

    patient = Patient(
        name=body.name,
        phone_number=body.phone_number,
        call_time=body.call_time,
        consent=body.consent,
    )
    db.add(patient)
    db.flush()

    if principal.account is not None:
        db.add(PatientAccount(patient_id=patient.id, account_id=principal.account.id))

    db.commit()
    return _to_out(patient)


@router.get("", response_model=list[PatientOut])
def list_patients(
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[PatientOut]:
    query = db.query(Patient)
    if not principal.is_admin:
        assert principal.account is not None
        query = query.join(PatientAccount, PatientAccount.patient_id == Patient.id).filter(
            PatientAccount.account_id == principal.account.id
        )
    patients = query.order_by(Patient.name).all()
    return [_to_out(p) for p in patients]


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> PatientOut:
    ensure_patient_access(principal, patient_id, db)
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="not_found")
    return _to_out(patient)
