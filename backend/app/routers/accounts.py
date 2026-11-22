from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_admin_key
from app.models import Account
from app.schemas import AccountIn, AccountOut
from app.security import hash_password

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.post("", status_code=201, response_model=AccountOut, dependencies=[Depends(require_admin_key)])
def create_account(body: AccountIn, db: Session = Depends(get_db)) -> AccountOut:
    email = body.email.lower()
    existing = db.query(Account).filter(Account.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="conflict")

    account = Account(
        email=email,
        password_hash=hash_password(body.password),
        name=body.name,
        role=body.role,
        phone_number=body.phone_number,
    )
    db.add(account)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="conflict") from exc

    return AccountOut(id=account.id, email=account.email, name=account.name, role=account.role)
