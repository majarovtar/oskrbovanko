from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import logging
from datetime import UTC, datetime

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.call_script import CLOSING_QUESTION, EMERGENCY_MESSAGE, build_instructions
from app.calls_service import reassess_and_notify
from app.models import Answer, Call, Patient, Question
from app.phrases import contains_emergency_phrase, text_contains
from app.severity import flag_for_answer
from app.timeutils import ljubljana_time_of_day
from app.voicelive import VoiceLiveConnection, open_connection

logger = logging.getLogger("app.call_stream")

_AUDIO_DELTA_EVENTS = {"response.audio.delta", "response.output_audio.delta"}
_AGENT_TRANSCRIPT_EVENTS = {"response.audio_transcript.done", "response.output_audio_transcript.done"}


class TranscriptLine:
    __slots__ = ("at", "speaker", "text")

    def __init__(self, speaker: str, text: str, at: datetime) -> None:
        self.speaker = speaker
        self.text = text
        self.at = at


class CallSession:
    def __init__(
        self,
        db: Session,
        background_tasks: BackgroundTasks,
        patient: Patient,
        questions: list[Question],
        client_ws: WebSocket,
    ) -> None:
        self.db = db
        self.background_tasks = background_tasks
        self.patient = patient
        self.questions = questions
        self.client_ws = client_ws

        self.voicelive: VoiceLiveConnection | None = None
        self.started_at = datetime.now(UTC)

        self._active_response = False
        self._pending: dict | None = None
        self._current_is_emergency = False
        self._current_had_audio = False
        self._current_had_tool_call = False
        self._end_requested = False
        self._finalized = False
        self._client_connected = True

        self.transcript: list[TranscriptLine] = []
        self.answers: dict[int, object] = {}
        self.closing_answer: str | None = None
        self.emergency_heard = False
        self.emergency_question: int | None = None

    async def run(self) -> None:
        instructions = build_instructions(self.patient.name, self.questions)
        self.voicelive = await open_connection(
            instructions, voice=_voice_setting(), answer_wait_ms=_answer_wait_setting()
        )
        await self._want_response()

        try:
            await asyncio.gather(self._pump_client_audio(), self._pump_voicelive_events())
        except WebSocketDisconnect:
            pass
        finally:
            await self._finalize("disconnect")

    async def _pump_client_audio(self) -> None:
        while not self._finalized:
            try:
                message = await self.client_ws.receive()
            except WebSocketDisconnect:
                self._client_connected = False
                await self._finalize("disconnect")
                return
            if message.get("type") == "websocket.disconnect":
                self._client_connected = False
                await self._finalize("disconnect")
                return
            audio = message.get("bytes")
            if audio and self.voicelive is not None:
                await self.voicelive.send(
                    {
                        "type": "input_audio_buffer.append",
                        "audio": base64.b64encode(audio).decode("ascii"),
                    }
                )

    async def _pump_voicelive_events(self) -> None:
        assert self.voicelive is not None
        async for event in self.voicelive:
            if self._finalized:
                break
            await self._handle_event(event)
            if self._finalized:
                break

    async def _handle_event(self, event: dict) -> None:
        etype = event.get("type", "")
        if etype not in _AUDIO_DELTA_EVENTS:
            logger.info("voicelive event: %s", etype)

        if etype in _AUDIO_DELTA_EVENTS:
            self._current_had_audio = True
            await self._send_client_bytes(base64.b64decode(event["delta"]))
        elif etype == "input_audio_buffer.speech_started":
            await self._send_client_json({"type": "clear"})
        elif etype == "conversation.item.input_audio_transcription.completed":
            await self._on_patient_line(event.get("transcript", "").strip())
        elif etype in _AGENT_TRANSCRIPT_EVENTS:
            await self._on_agent_line(event.get("transcript", "").strip())
        elif etype == "response.function_call_arguments.done":
            await self._on_function_call(event)
        elif etype == "response.done":
            await self._on_response_done()
        elif etype == "error":
            logger.info("voicelive error: %s", event.get("error"))

    async def _send_client_bytes(self, data: bytes) -> None:
        if self._client_connected:
            try:
                await self.client_ws.send_bytes(data)
            except Exception:
                self._client_connected = False

    async def _send_client_json(self, payload: dict) -> None:
        if self._client_connected:
            try:
                await self.client_ws.send_json(payload)
            except Exception:
                self._client_connected = False

    async def _on_patient_line(self, text: str) -> None:
        if not text:
            return
        now = datetime.now(UTC)
        self.transcript.append(TranscriptLine("patient", text, now))
        await self._send_client_json(
            {"type": "transcript", "speaker": "patient", "text": text, "at": now.isoformat()}
        )
        if contains_emergency_phrase(text):
            await self._on_emergency()
        else:
            await self._want_response()

    async def _on_agent_line(self, text: str) -> None:
        if not text:
            return
        now = datetime.now(UTC)
        self.transcript.append(TranscriptLine("agent", text, now))
        await self._send_client_json(
            {"type": "transcript", "speaker": "agent", "text": text, "at": now.isoformat()}
        )

    async def _on_function_call(self, event: dict) -> None:
        name = event.get("name")
        call_id = event.get("call_id")
        try:
            arguments = json.loads(event.get("arguments") or "{}")
        except json.JSONDecodeError:
            arguments = {}

        if name == "record_answer":
            number = arguments.get("question_number")
            if isinstance(number, int):
                self.answers[number] = arguments.get("value")
        elif name == "record_closing_answer":
            self.closing_answer = arguments.get("text", "")
        elif name == "end_call":
            self._end_requested = True

        if self.voicelive is not None and call_id:
            await self.voicelive.send(
                {
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": "ok",
                    },
                }
            )

        if name != "end_call":
            self._current_had_tool_call = True

    async def _on_response_done(self) -> None:
        was_emergency = self._current_is_emergency
        had_followup_tool_call = self._current_had_tool_call
        had_audio = self._current_had_audio
        self._active_response = False
        if was_emergency:
            await self._finalize("emergency")
            return
        if self._end_requested:
            await self._finalize("end_call")
            return
        if had_followup_tool_call and not had_audio:
            await self._want_response()
        else:
            await self._flush_pending()

    async def _on_emergency(self) -> None:
        if self.emergency_heard:
            return
        self.emergency_heard = True
        self.emergency_question = self._find_emergency_question()
        await self._send_client_json({"type": "clear"})
        await self._send_client_json({"type": "emergency"})
        if self.voicelive is not None and self._active_response:
            await self.voicelive.send({"type": "response.cancel"})
        await self._want_response(override_instructions=EMERGENCY_MESSAGE, is_emergency=True)

    def _find_emergency_question(self) -> int | None:
        matched: list[int] = []
        for line in self.transcript:
            if line.speaker != "agent":
                continue
            for question in self.questions:
                if text_contains(question.text, line.text):
                    matched.append(question.position)
        return max(matched) if matched else None

    async def _want_response(
        self, override_instructions: str | None = None, is_emergency: bool = False
    ) -> None:
        self._pending = {"override_instructions": override_instructions, "is_emergency": is_emergency}
        await self._flush_pending()

    async def _flush_pending(self) -> None:
        if self._pending is None or self._active_response or self.voicelive is None:
            return
        pending = self._pending
        self._pending = None
        self._current_is_emergency = pending["is_emergency"]
        self._current_had_audio = False
        self._current_had_tool_call = False
        self._active_response = True
        message: dict = {"type": "response.create"}
        if pending["override_instructions"]:
            message["response"] = {"instructions": pending["override_instructions"]}
        await self.voicelive.send(message)

    async def _finalize(self, reason: str) -> None:
        if self._finalized:
            return
        self._finalized = True

        call = Call(
            patient_id=self.patient.id,
            started_at=self.started_at,
            closing_answer=self.closing_answer or "",
            transcript=self._render_transcript(),
            emergency_heard=self.emergency_heard,
            emergency_question=self.emergency_question,
        )
        self.db.add(call)
        self.db.flush()

        for question in self.questions:
            value = self.answers.get(question.position)
            is_emergency_question = self.emergency_question == question.position
            flag = (
                "high"
                if is_emergency_question
                else flag_for_answer(question.answer_type, value, question.flag_rules)
            )
            self.db.add(
                Answer(
                    call_id=call.id,
                    position=question.position,
                    question_text=question.text,
                    answer_type=question.answer_type,
                    value_json=value,
                    flag=flag,
                )
            )
        self.db.commit()
        self.db.refresh(call)

        reassess_and_notify(self.db, call, self.patient.name, self.background_tasks)

        await self._send_client_json({"type": "call_saved", "call_id": str(call.id)})

        if self.voicelive is not None:
            with contextlib.suppress(Exception):
                await self.voicelive.close()

        if self._client_connected:
            with contextlib.suppress(Exception):
                await self.client_ws.close(code=1000)

    def _render_transcript(self) -> str:
        if not self.patient.consent:
            return ""
        lines = []
        for line in self.transcript:
            label = "AGENT" if line.speaker == "agent" else "PACIENT"
            lines.append(f"[{ljubljana_time_of_day(line.at)}] {label}: {line.text}")
        return "\n".join(lines)


def _voice_setting() -> str:
    from app.config import settings

    return settings.voicelive_voice


def _answer_wait_setting() -> int:
    from app.config import settings

    return settings.answer_wait_ms


__all__ = ["CLOSING_QUESTION", "CallSession"]
