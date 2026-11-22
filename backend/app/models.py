from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    type_annotation_map = {datetime: DateTime(timezone=True)}


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(UTC)


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_uuid)
    name: Mapped[str]
    phone_number: Mapped[str]
    call_time: Mapped[str]
    consent: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(default=_now)

    questions: Mapped[list[Question]] = relationship(
        back_populates="patient", cascade="all, delete-orphan", order_by="Question.position"
    )
    calls: Mapped[list[Call]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    vitals: Mapped[list[Vitals]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    accounts: Mapped[list[PatientAccount]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    position: Mapped[int]
    text: Mapped[str]
    answer_type: Mapped[str]
    flag_rules: Mapped[list] = mapped_column(JSON, default=list)

    patient: Mapped[Patient] = relationship(back_populates="questions")


class Vitals(Base):
    __tablename__ = "vitals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    pulse: Mapped[int]
    spo2: Mapped[int]
    measured_at: Mapped[datetime]
    call_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("calls.id"), default=None)

    patient: Mapped[Patient] = relationship(back_populates="vitals")
    call: Mapped[Call | None] = relationship(back_populates="vitals_record")


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    started_at: Mapped[datetime]
    closing_answer: Mapped[str]
    transcript: Mapped[str]
    emergency_heard: Mapped[bool] = mapped_column(default=False)
    emergency_question: Mapped[int | None] = mapped_column(default=None)
    severity: Mapped[str] = mapped_column(default="normal")
    severity_reasons: Mapped[list] = mapped_column(JSON, default=list)
    critical_notified: Mapped[bool] = mapped_column(default=False)
    # Stolpec "answers" iz prvotnega prototipa je v bazi obvezen (NOT NULL), zato ga
    # vedno zapolnimo. Posamezni odgovori so v tabeli answers (relacija spodaj).
    legacy_answers: Mapped[list] = mapped_column("answers", JSON, default=list)

    patient: Mapped[Patient] = relationship(back_populates="calls")
    answers: Mapped[list[Answer]] = relationship(
        back_populates="call", cascade="all, delete-orphan", order_by="Answer.position"
    )
    vitals_record: Mapped[Vitals | None] = relationship(back_populates="call", uselist=False)


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_uuid)
    call_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("calls.id"))
    position: Mapped[int]
    question_text: Mapped[str]
    answer_type: Mapped[str]
    value_json: Mapped[Any] = mapped_column(JSON)
    flag: Mapped[str | None] = mapped_column(default=None)

    call: Mapped[Call] = relationship(back_populates="answers")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    name: Mapped[str]
    role: Mapped[str]
    # Telefon za nujna obvestila (skrbnika pokličemo, ko je klic pacienta nujen). Neobvezno.
    phone_number: Mapped[str | None] = mapped_column(default=None)

    patients: Mapped[list[PatientAccount]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class PatientAccount(Base):
    __tablename__ = "patient_accounts"
    __table_args__ = (UniqueConstraint("patient_id", "account_id", name="uq_patient_account"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))

    patient: Mapped[Patient] = relationship(back_populates="accounts")
    account: Mapped[Account] = relationship(back_populates="patients")
