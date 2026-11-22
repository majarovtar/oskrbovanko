from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_service_key
from app.infobip import place_outbound_call
from app.models import Patient

router = APIRouter(tags=["infobip"])


@router.post(
    "/patients/{patient_id}/infobip-call",
    status_code=201,
    dependencies=[Depends(require_service_key)],
)
async def start_infobip_call(
    patient_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="not_found")

    call_id = await place_outbound_call(patient, background_tasks)
    return {"call_id": call_id}
