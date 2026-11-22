from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class FlagRule(BaseModel):
    when: str | None = None
    min: int | None = None
    max: int | None = None
    level: str


class QuestionIn(BaseModel):
    text: str
    answer_type: str
    flag_rules: list[FlagRule] = Field(default_factory=list)


class QuestionOut(BaseModel):
    text: str
    answer_type: str
    flag_rules: list[FlagRule]


class QuestionPresetOut(BaseModel):
    id: str
    name: str
    questions: list[QuestionOut]


class PatientIn(BaseModel):
    name: str
    phone_number: str
    call_time: str
    consent: bool


class PatientOut(PatientIn):
    id: uuid.UUID


class VitalsIn(BaseModel):
    patient_id: uuid.UUID
    pulse: int
    spo2: int
    measured_at: datetime


class VitalsOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    pulse: int
    spo2: int
    measured_at: datetime


class VitalsSummary(BaseModel):
    pulse: int
    spo2: int
    measured_at: datetime


class QuestionRef(BaseModel):
    text: str


class AnswerOut(BaseModel):
    question: QuestionRef
    value: Any
    flag: str | None


class CallIn(BaseModel):
    started_at: datetime
    answers: list[Any]
    closing_answer: str
    transcript: str
    emergency_heard: bool = False
    emergency_question: int | None = None


class CallOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    started_at: datetime
    answers: list[AnswerOut]
    closing_answer: str
    transcript: str
    emergency_heard: bool
    emergency_question: int | None
    vitals: VitalsSummary | None
    severity: str
    severity_reasons: list[str]


class AccountIn(BaseModel):
    email: str
    password: str
    name: str
    role: str
    phone_number: str | None = None


class AccountOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LinkAccountIn(BaseModel):
    account_id: uuid.UUID
