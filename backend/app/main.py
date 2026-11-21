from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.logging_config import configure_logging
from app.routers import (
    accounts,
    auth,
    call_page,
    call_script,
    call_stream,
    calls,
    info,
    patient_accounts,
    patients,
    questions,
    vitals,
)

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(title="MojOdpust", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(info.router)
app.include_router(patients.router)
app.include_router(vitals.router)
app.include_router(questions.router)
app.include_router(calls.router)
app.include_router(accounts.router)
app.include_router(auth.router)
app.include_router(patient_accounts.router)
app.include_router(call_script.router)
app.include_router(call_stream.router)
app.include_router(call_page.router)
