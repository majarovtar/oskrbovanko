from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks
from starlette.websockets import WebSocket

from app.call_stream import CallSession
from app.db import SessionLocal
from app.deps import account_from_token
from app.models import Patient, PatientAccount, Question
from app.security import is_service_key

router = APIRouter(tags=["call-stream"])


@router.websocket("/patients/{patient_id}/call-stream")
async def call_stream(websocket: WebSocket, patient_id: uuid.UUID) -> None:
    token = websocket.query_params.get("token")
    service_key = websocket.query_params.get("service_key")

    db = SessionLocal()
    try:
        if service_key:
            if not is_service_key(service_key):
                await websocket.close(code=4401)
                return
        elif token:
            account = account_from_token(token, db)
            if account is None:
                await websocket.close(code=4401)
                return
            linked = db.query(PatientAccount).filter_by(patient_id=patient_id, account_id=account.id).first()
            if linked is None:
                await websocket.close(code=4403)
                return
        else:
            await websocket.close(code=4401)
            return

        patient = db.get(Patient, patient_id)
        if patient is None:
            await websocket.close(code=4401)
            return

        questions = (
            db.query(Question).filter(Question.patient_id == patient_id).order_by(Question.position).all()
        )

        await websocket.accept()
        background_tasks = BackgroundTasks()
        session = CallSession(db, background_tasks, patient, questions, websocket)
        await session.run()
        await background_tasks()
    finally:
        db.close()
