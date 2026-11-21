from __future__ import annotations

import json
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Protocol

import websockets

from app.config import settings

RECORD_ANSWER_TOOL = {
    "type": "function",
    "name": "record_answer",
    "description": (
        "Call only with what the patient said in answer, after they said it. Never call with a "
        "guessed answer, and never in the same turn that asks the question."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "question_number": {"type": "integer", "description": "The question's number, from 1."},
            "value": {"description": "The answer value fitting the question's type, or null when none."},
        },
        "required": ["question_number", "value"],
    },
}

RECORD_CLOSING_ANSWER_TOOL = {
    "type": "function",
    "name": "record_closing_answer",
    "description": "Call only with what the patient said in answer to the closing question, word for word.",
    "parameters": {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
    },
}

END_CALL_TOOL = {
    "type": "function",
    "name": "end_call",
    "description": "Call once you have said goodbye, to end the call.",
    "parameters": {"type": "object", "properties": {}},
}


def session_update(instructions: str, voice: str, answer_wait_ms: int) -> dict:
    return {
        "type": "session.update",
        "session": {
            "instructions": instructions,
            "modalities": ["text", "audio"],
            "voice": {"name": voice, "type": "azure-standard"},
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {"model": "azure-speech", "language": "sl-SI"},
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.5,
                "silence_duration_ms": answer_wait_ms,
                "create_response": False,
            },
            "input_audio_noise_reduction": {"type": "azure_deep_noise_suppression"},
            "input_audio_echo_cancellation": {"type": "server_echo_cancellation"},
            "tools": [RECORD_ANSWER_TOOL, RECORD_CLOSING_ANSWER_TOOL, END_CALL_TOOL],
            "tool_choice": "auto",
        },
    }


class VoiceLiveConnection(Protocol):
    async def send(self, message: dict) -> None: ...

    def __aiter__(self) -> AsyncIterator[dict]: ...

    async def close(self) -> None: ...


class WebsocketVoiceLiveConnection:
    def __init__(self, ws: websockets.ClientConnection) -> None:
        self._ws = ws

    async def send(self, message: dict) -> None:
        await self._ws.send(json.dumps(message))

    async def __aiter__(self) -> AsyncIterator[dict]:
        async for raw in self._ws:
            yield json.loads(raw)

    async def close(self) -> None:
        await self._ws.close()


ConnectionFactory = Callable[[str, str, int], Awaitable[VoiceLiveConnection]]


async def connect(instructions: str, voice: str, answer_wait_ms: int) -> VoiceLiveConnection:
    base = settings.azure_voicelive_endpoint.rstrip("/").replace("https://", "wss://")
    query = f"api-version={settings.voicelive_api_version}&model={settings.voicelive_model}"
    url = f"{base}/voice-live/realtime?{query}"
    ws = await websockets.connect(
        url, additional_headers={"api-key": settings.azure_voicelive_api_key}, max_size=None
    )
    connection: VoiceLiveConnection = WebsocketVoiceLiveConnection(ws)
    await connection.send(session_update(instructions, voice, answer_wait_ms))
    return connection


_connection_factory: ConnectionFactory = connect


def set_connection_factory(factory: ConnectionFactory) -> None:
    global _connection_factory
    _connection_factory = factory


async def open_connection(instructions: str, voice: str, answer_wait_ms: int) -> VoiceLiveConnection:
    return await _connection_factory(instructions, voice, answer_wait_ms)
