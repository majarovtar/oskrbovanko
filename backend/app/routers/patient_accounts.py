from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_admin_key
from app.models import Account, Patient, PatientAccount
from app.schemas import AccountOut, LinkAccountIn

router = APIRouter(
    prefix="/patients/{patient_id}/accounts",
    tags=["patient-accounts"],
    dependencies=[Depends(require_admin_key)],
)


def _linked_accounts(db: Session, patient_id: uuid.UUID) -> list[AccountOut]:
    links = db.query(PatientAccount).filter(PatientAccount.patient_id == patient_id).all()
    return [
        AccountOut(
            id=link.account.id, email=link.account.email, name=link.account.name, role=link.account.role
        )
        for link in links
    ]


@router.post("", response_model=list[AccountOut])
def link_account(
    patient_id: uuid.UUID,
    body: LinkAccountIn,
    db: Session = Depends(get_db),
) -> list[AccountOut]:
    patient = db.get(Patient, patient_id)
    account = db.get(Account, body.account_id)
    if patient is None or account is None:
        raise HTTPException(status_code=404, detail="not_found")

    if account.role == "doctor":
        existing_doctor = (
            db.query(PatientAccount)
            .join(Account, Account.id == PatientAccount.account_id)
            .filter(PatientAccount.patient_id == patient_id, Account.role == "doctor")
            .first()
        )
        if existing_doctor is not None:
            raise HTTPException(status_code=409, detail="conflict")

    already_linked = (
        db.query(PatientAccount)
        .filter(PatientAccount.patient_id == patient_id, PatientAccount.account_id == account.id)
        .first()
    )
    if already_linked is None:
        db.add(PatientAccount(patient_id=patient_id, account_id=account.id))
        db.commit()

    return _linked_accounts(db, patient_id)


@router.get("", response_model=list[AccountOut])
def list_linked_accounts(patient_id: uuid.UUID, db: Session = Depends(get_db)) -> list[AccountOut]:
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="not_found")
    return _linked_accounts(db, patient_id)


@router.delete("/{account_id}", status_code=204)
def unlink_account(patient_id: uuid.UUID, account_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    if db.get(Patient, patient_id) is None or db.get(Account, account_id) is None:
        raise HTTPException(status_code=404, detail="not_found")
    db.query(PatientAccount).filter(
        PatientAccount.patient_id == patient_id, PatientAccount.account_id == account_id
    ).delete()
    db.commit()
    return Response(status_code=204)
