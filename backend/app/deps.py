from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Account, PatientAccount
from app.security import InvalidToken, decode_access_token, is_admin_key, is_service_key


def require_service_key(x_service_key: str | None = Header(default=None)) -> None:
    if not is_service_key(x_service_key):
        raise HTTPException(status_code=401, detail="unauthenticated")


def require_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    if not is_admin_key(x_admin_key):
        raise HTTPException(status_code=401, detail="unauthenticated")


@dataclass
class Principal:
    is_admin: bool
    account: Account | None = None


def account_from_token(token: str, db: Session) -> Account | None:
    try:
        payload = decode_access_token(token)
    except InvalidToken:
        return None
    return db.get(Account, uuid.UUID(payload["sub"]))


def _account_from_bearer(authorization: str | None, db: Session) -> Account | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return account_from_token(authorization[len("Bearer ") :], db)


def get_principal(
    authorization: str | None = Header(default=None),
    x_admin_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Principal:
    if is_admin_key(x_admin_key):
        return Principal(is_admin=True)
    account = _account_from_bearer(authorization, db)
    if account is not None:
        return Principal(is_admin=False, account=account)
    raise HTTPException(status_code=401, detail="unauthenticated")


def get_current_account(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Account:
    account = _account_from_bearer(authorization, db)
    if account is None:
        raise HTTPException(status_code=401, detail="unauthenticated")
    return account


def ensure_patient_access(principal: Principal, patient_id: uuid.UUID, db: Session) -> None:
    if principal.is_admin:
        return
    assert principal.account is not None
    linked = (
        db.query(PatientAccount).filter_by(patient_id=patient_id, account_id=principal.account.id).first()
    )
    if linked is None:
        raise HTTPException(status_code=403, detail="forbidden")


def ensure_doctor_or_admin(principal: Principal) -> None:
    if principal.is_admin:
        return
    assert principal.account is not None
    if principal.account.role != "doctor":
        raise HTTPException(status_code=403, detail="forbidden")
