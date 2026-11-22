"""Gumb "Pokliči" (zdravnik) in naslovi, ki jih med klicem kliče Twilio."""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app import phone_call
from app.calls_service import recompute_severity
from app.config import settings
from app.db import SessionLocal, get_db
from app.deps import Principal, ensure_doctor_or_admin, ensure_patient_access, get_principal
from app.models import Account, Answer, Call, Patient, PatientAccount, Vitals
from app.notify import send_call_notice
from app.phone_answers import assess_answer

logger = logging.getLogger("app.routers.phone_call")
router = APIRouter(tags=["phone-call"])

# Twilio Call SID -> id vrstice v tabeli calls (klic se ustvari ob prvem odgovoru)
_call_rows: dict[str, uuid.UUID] = {}
_call_rows_lock = threading.Lock()

# Klici skrbnikom (nujno obvestilo), ki jih je sprožil backend.
_guardian_calls: set[str] = set()
GUARDIAN_CALL_DELAY_S = 8  # premor po koncu klica s pacientom, preden pokličemo skrbnika

# Klici, ki jih je sprožil backend: Call SID -> (pacient, čas začetka).
# Brez podpisa (trial račun) sprejmemo Twiliove zahteve samo za te klice.
_started_calls: dict[str, tuple[uuid.UUID, float]] = {}
_STARTED_CALL_TTL_S = 2 * 60 * 60


def _remember_started_call(call_sid: str, patient_id: uuid.UUID) -> None:
    now = time.monotonic()
    with _call_rows_lock:
        for sid, (_, started) in list(_started_calls.items()):
            if now - started > _STARTED_CALL_TTL_S:
                del _started_calls[sid]
        _started_calls[call_sid] = (patient_id, now)


def _started_call_patient(call_sid: str) -> uuid.UUID | None:
    with _call_rows_lock:
        entry = _started_calls.get(call_sid)
    if entry is None or time.monotonic() - entry[1] > _STARTED_CALL_TTL_S:
        return None
    return entry[0]


# ------------------------------------------------------------------ gumb v portalu
@router.post("/patients/{patient_id}/phone-call")
def start_phone_call(
    patient_id: uuid.UUID,
    request: Request,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> dict:
    """Zdravnik sproži telefonski klic pacientu."""
    ensure_patient_access(principal, patient_id, db)
    ensure_doctor_or_admin(principal)
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="not_found")
    if not phone_call.is_configured():
        raise HTTPException(status_code=503, detail="Twilio ni nastavljen (TWILIO_* v .env).")

    try:
        phone_call.prepare_audio()
        base = phone_call.public_base_url(local_port=settings.backend_port)
        call_sid = phone_call.start_call(patient.phone_number, f"{base}/twilio/voice?patient_id={patient_id}")
    except RuntimeError as exc:
        logger.warning("phone call to patient %s failed: %s", patient_id, exc)
        raise HTTPException(status_code=502, detail=f"Klic ni uspel: {exc}") from exc

    _remember_started_call(call_sid, patient_id)
    logger.info("phone call %s started for patient %s", call_sid, patient_id)
    return {"call_sid": call_sid, "status": "queued"}


# ------------------------------------------------------------------ Twilio
def _base() -> str:
    base = phone_call.current_base_url()
    if base is None:  # npr. backend je bil med klicem ponovno zagnan
        raise HTTPException(status_code=503, detail="no_public_url")
    return base


async def _twilio_form(request: Request, patient_id: uuid.UUID) -> dict[str, str]:
    """Prebere Twiliove podatke in preveri, da zahteva res pripada klicu, ki ga je sprožil backend.

    - Če Twilio pošlje podpis (X-Twilio-Signature), mora biti veljaven.
    - Trial računi zahtev NE podpisujejo (in pošljejo le nekaj polj); takrat sprejmemo samo
      zahtevo za naš račun (AccountSid) in klic, ki smo ga sami začeli za tega pacienta.
    """
    raw = (await request.body()).decode("utf-8")
    form = {key: values[0] for key, values in parse_qs(raw, keep_blank_values=True).items()}
    signature = request.headers.get("X-Twilio-Signature")
    if signature:
        url = f"{_base()}{request.url.path}" + (f"?{request.url.query}" if request.url.query else "")
        if not phone_call.valid_signature(url, form, signature):
            logger.warning("rejected Twilio request with invalid signature: %s", request.url.path)
            raise HTTPException(status_code=403, detail="forbidden")
    elif not (form.get("AccountSid") == settings.twilio_account_sid
              and _started_call_patient(form.get("CallSid", "")) == patient_id):
        logger.warning("rejected unsigned Twilio request for unknown call: %s", request.url.path)
        raise HTTPException(status_code=403, detail="forbidden")
    return form


def _twiml(xml: str) -> Response:
    return Response(content=xml, media_type="text/xml; charset=utf-8")


@router.get("/twilio/health", include_in_schema=False)
def health() -> PlainTextResponse:
    return PlainTextResponse("ok")


@router.get("/twilio/audio/{name}", include_in_schema=False)
def audio(name: str) -> FileResponse:
    path = phone_call.audio_path(name)
    if path is None:
        raise HTTPException(status_code=404, detail="not_found")
    return FileResponse(path, media_type="audio/wav")


@router.post("/twilio/voice", include_in_schema=False)
async def voice(request: Request, patient_id: uuid.UUID) -> Response:
    form = await _twilio_form(request, patient_id)
    base = _base()
    call_sid = form.get("CallSid", "")
    with _call_rows_lock:
        first_time = call_sid not in _measuring
        _measuring.add(call_sid)
    if first_time:  # po MEASURE_WAIT_S preberemo meritev naprave iz baze
        started = datetime.now(UTC)
        threading.Thread(target=_record_measurement, args=(call_sid, patient_id, started), daemon=True).start()
    return _twiml(phone_call.intro_twiml(base, str(patient_id)))


# ------------------------------------------------------------------ meritev
_measuring: set[str] = set()                 # klici, pri katerih meritev že teče
_call_vitals: dict[str, uuid.UUID] = {}      # Call SID -> id meritve (vitals)
_claimed_vitals: set[uuid.UUID] = set()      # meritve, ki že pripadajo nekemu klicu
CLOCK_SKEW_S = 30                            # ura naprave je lahko malo drugačna od strežnika


def _device_reading(db: Session, patient_id: uuid.UUID, since: datetime) -> Vitals | None:
    """Zadnja meritev, ki jo je naprava za tega pacienta poslala na POST /vitals med tem klicem
    (in je ni že prevzel kak prejšnji klic)."""
    query = db.query(Vitals).filter(Vitals.patient_id == patient_id, Vitals.measured_at >= since)
    with _call_rows_lock:
        claimed = list(_claimed_vitals)
    if claimed:
        query = query.filter(Vitals.id.not_in(claimed))
    return query.order_by(Vitals.measured_at.desc()).first()


def _record_measurement(call_sid: str, patient_id: uuid.UUID, call_started: datetime) -> None:
    """Po 20 s meritve prebere meritev naprave iz baze (POST /vitals) in jo poveže s klicem.

    Če meritev naprave ne pride (niti po DEVICE_GRACE_S dodatnih sekundah), v bazo
    shranimo dve stalni vrednosti (FALLBACK_PULSE, FALLBACK_SPO2).
    """
    time.sleep(phone_call.MEASURE_WAIT_S)
    since = call_started - timedelta(seconds=CLOCK_SKEW_S)
    deadline = time.monotonic() + phone_call.DEVICE_GRACE_S
    # Branje (in čakanje) poteka izven _save_lock, da shranjevanje odgovorov ne čaka.
    device_id: uuid.UUID | None = None
    db = SessionLocal()
    try:
        while True:
            reading = _device_reading(db, patient_id, since)
            if reading is not None or time.monotonic() >= deadline:
                device_id = reading.id if reading is not None else None
                break
            db.rollback()  # naslednje branje vidi nove vrstice
            time.sleep(2)
    except Exception:
        logger.exception("reading the measurement of call %s failed", call_sid)
    finally:
        db.close()

    with _save_lock:
        db = SessionLocal()
        try:
            vitals = db.get(Vitals, device_id) if device_id else None
            if vitals is None:
                logger.warning("call %s: no measurement from the device - saving fixed values", call_sid)
                vitals = Vitals(patient_id=patient_id, pulse=phone_call.FALLBACK_PULSE,
                                spo2=phone_call.FALLBACK_SPO2, measured_at=datetime.now(UTC))
                db.add(vitals)
                db.flush()
            with _call_rows_lock:
                call_id = _call_rows.get(call_sid)
                _call_vitals[call_sid] = vitals.id
                _claimed_vitals.add(vitals.id)
            if call_id is not None:
                vitals.call_id = call_id
            db.commit()
            logger.info("call %s measurement (%s): pulse %s, SpO2 %s", call_sid,
                        "device" if device_id else "fixed fallback", vitals.pulse, vitals.spo2)
        except Exception:
            db.rollback()
            logger.exception("saving measurement of call %s failed", call_sid)
        finally:
            db.close()


@router.post("/twilio/answer", include_in_schema=False)
async def answer(
    request: Request,
    patient_id: uuid.UUID,
    st: int,
    rep: int,
    background_tasks: BackgroundTasks,
) -> Response:
    """Twilio pošlje odgovor; takoj vrnemo naslednje vprašanje, shranjevanje teče v ozadju.

    Baza (skupni Supabase) je lahko počasna; če bi Twilio čakal nanjo, bi po ~15 s klic
    prekinil ("could not reach your URL"). Zato ta pot baze sploh ne uporablja.
    """
    form = await _twilio_form(request, patient_id)
    base = _base()
    if not 1 <= st <= len(phone_call.QUESTIONS):
        raise HTTPException(status_code=400, detail="bad_question")

    text = (form.get("SpeechResult") or "").strip()
    if not text and not rep:
        # pacient ni nič rekel: isto vprašanje še enkrat
        return _twiml(phone_call.question_twiml(base, str(patient_id), st, repeat=True))

    last = st == len(phone_call.QUESTIONS)
    background_tasks.add_task(_save_answer_in_background, form.get("CallSid", ""), patient_id, st, text, last)

    if last:
        return _twiml(phone_call.goodbye_twiml(base))
    return _twiml(phone_call.question_twiml(base, str(patient_id), st + 1, repeat=False))


# ------------------------------------------------------------------ shranjevanje
# Odgovore istega klica shranjujemo enega za drugim (vrstni red in en sam zapis klica).
_save_lock = threading.Lock()


def _save_answer_in_background(call_sid: str, patient_id: uuid.UUID, number: int, text: str, last: bool) -> None:
    with _save_lock:
        db = SessionLocal()
        try:
            _save_answer(db, call_sid, patient_id, number, text, last)
            logger.info("call %s answer %s: %r", call_sid, number, text)
        except Exception:
            db.rollback()
            logger.exception("saving answer %s of call %s failed", number, call_sid)
        finally:
            db.close()


def _save_answer(
    db: Session,
    call_sid: str,
    patient_id: uuid.UUID,
    number: int,
    text: str,
    last: bool,
) -> None:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="not_found")

    with _call_rows_lock:
        call_id = _call_rows.get(call_sid)
    call = db.get(Call, call_id) if call_id else None
    if call is None:
        call = Call(
            patient_id=patient_id,
            started_at=datetime.now(UTC),
            closing_answer="",
            transcript="",
            legacy_answers=[],
        )
        db.add(call)
        db.flush()
        with _call_rows_lock:
            _call_rows[call_sid] = call.id
            vitals_id = _call_vitals.get(call_sid)
        vitals = db.get(Vitals, vitals_id) if vitals_id else None
        if vitals is not None:  # meritev z začetka klica pripada temu klicu
            vitals.call_id = call.id
        # Ob prvem odgovoru začnemo spremljati klic: ko se konča (tudi predčasno),
        # preverimo, ali je nujen (e-pošta zdravniku, klic skrbniku).
        threading.Thread(target=_after_call, args=(call.id, call_sid), daemon=True).start()

    flag = assess_answer(phone_call.QUESTIONS[number - 1], text)  # rdeče/oranžno/rumeno
    existing = db.query(Answer).filter(Answer.call_id == call.id, Answer.position == number).first()
    if existing is None:
        db.add(Answer(call_id=call.id, position=number, question_text=phone_call.QUESTIONS[number - 1],
                      answer_type="free_text", value_json=text or None, flag=flag))
    else:
        existing.value_json = text or None
        existing.flag = flag

    entries = [e for e in (call.legacy_answers or []) if e.get("position") != number]
    entries.append({"position": number, "question": phone_call.QUESTIONS[number - 1],
                    "answer": text, "twilio_call_sid": call_sid})
    entries.sort(key=lambda e: e["position"])
    call.legacy_answers = entries  # nov seznam, da SQLAlchemy zazna spremembo
    if patient.consent:
        call.transcript = "\n".join(f"AGENT: {e['question']}\nPACIENT: {e['answer']}" for e in entries)
    if last:
        call.closing_answer = text
    db.commit()


# ------------------------------------------------------------------ po klicu
def _after_call(call_id: uuid.UUID, call_sid: str) -> None:
    """Počaka, da se klic pacienta konča. Če je nujen: e-pošta zdravniku in klic skrbniku.

    Nenujni klici ne sprožijo ničesar (zdravnik jih vidi v portalu).
    """
    status = phone_call.wait_until_call_ended(call_sid)
    logger.info("call %s ended (%s), checking severity", call_sid, status)
    time.sleep(2)  # da se v ozadju shrani še zadnji odgovor
    with _save_lock:  # počakamo, da se vsi odgovori shranijo
        pass
    with _call_rows_lock:
        _call_rows.pop(call_sid, None)
        _call_vitals.pop(call_sid, None)
        _measuring.discard(call_sid)
    db = SessionLocal()
    try:
        call = db.get(Call, call_id)
        if call is None:
            return
        patient = db.get(Patient, call.patient_id)
        assert patient is not None
        recompute_severity(call)
        db.commit()
        if call.severity != "critical":
            logger.info("call %s is %s - no email, no guardian call", call_sid, call.severity)
            return

        if not call.critical_notified:
            call.critical_notified = True
            db.commit()
            asyncio.run(send_call_notice(
                call_id=call.id, patient_id=call.patient_id, patient_name=patient.name,
                started_at=call.started_at, severity=call.severity, severity_reasons=call.severity_reasons,
            ))
            logger.info("critical call %s: email sent to doctor", call_sid)

        # Skrbnik ima lahko isto številko kot pacient: počakamo, da se linija sprosti.
        time.sleep(GUARDIAN_CALL_DELAY_S)
        _call_guardians(db, call, patient)
    except Exception:
        logger.exception("after-call handling for %s failed", call_sid)
    finally:
        db.close()


def _call_guardians(db: Session, call: Call, patient: Patient) -> None:
    """Pokliče vse skrbnike pacienta, ki imajo vpisan telefon, in jim pove, kaj je narobe."""
    guardians = (
        db.query(Account)
        .join(PatientAccount, PatientAccount.account_id == Account.id)
        .filter(PatientAccount.patient_id == patient.id, Account.role == "caregiver",
                Account.phone_number.is_not(None))
        .all()
    )
    if not guardians:
        logger.info("no guardian with a phone number for patient %s", patient.id)
        return
    phone_call.synthesize(phone_call.GUARDIAN_MESSAGE)
    base = phone_call.current_base_url()
    if base is None:
        logger.warning("no public URL - cannot call guardians")
        return
    for guardian in guardians:
        try:
            sid = phone_call.start_call(guardian.phone_number or "", f"{base}/twilio/guardian")
            with _call_rows_lock:
                _guardian_calls.add(sid)
            logger.info("calling guardian %s about critical call (%s)", guardian.id, sid)
        except RuntimeError as exc:
            logger.warning("calling guardian %s failed: %s", guardian.id, exc)


@router.post("/twilio/guardian", include_in_schema=False)
async def guardian_message(request: Request) -> Response:
    """Twilio vpraša, kaj naj pove skrbniku: stalno sporočilo, da je oskrbovanec morda v težavah."""
    raw = (await request.body()).decode("utf-8")
    form = {key: values[0] for key, values in parse_qs(raw, keep_blank_values=True).items()}
    signature = request.headers.get("X-Twilio-Signature")
    if signature:
        allowed = phone_call.valid_signature(f"{_base()}{request.url.path}", form, signature)
    else:  # trial račun: brez podpisa sprejmemo samo klic skrbniku, ki smo ga sami začeli
        with _call_rows_lock:
            started_by_us = form.get("CallSid", "") in _guardian_calls
        allowed = form.get("AccountSid") == settings.twilio_account_sid and started_by_us
    if not allowed:
        raise HTTPException(status_code=403, detail="forbidden")
    return _twiml(phone_call.guardian_twiml(_base()))
