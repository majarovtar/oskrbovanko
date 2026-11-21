from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_account
from app.models import Account
from app.schemas import AccountOut, LoginIn, TokenOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    account = db.query(Account).filter(Account.email == body.email.lower()).first()
    if account is None or not verify_password(body.password, account.password_hash):
        raise HTTPException(status_code=401, detail="unauthenticated")
    token = create_access_token(account.id, account.role)
    return TokenOut(access_token=token)


@router.get("/me", response_model=AccountOut)
def me(account: Account = Depends(get_current_account)) -> AccountOut:
    return AccountOut(id=account.id, email=account.email, name=account.name, role=account.role)
