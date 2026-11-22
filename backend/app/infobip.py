from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import BackgroundTasks
from infobip_api_client import ApiClient, Configuration
from infobip_api_client.api.calls_api import CallsApi
from infobip_api_client.exceptions import OpenApiException
from infobip_api_client.models.call_request import CallRequest
from infobip_api_client.models.call_state import CallState
from infobip_api_client.models.calls_media_stream import CallsMediaStream
from infobip_api_client.models.calls_media_stream_audio_properties import (
    CallsMediaStreamAudioProperties,
)
from infobip_api_client.models.calls_phone_endpoint import CallsPhoneEndpoint
from infobip_api_client.models.calls_start_media_stream_request import (
    CallsStartMediaStreamRequest,
)
from infobip_api_client.models.calls_websocket_endpoint_config_request import (
    CallsWebsocketEndpointConfigRequest,
)

from app.config import settings
from app.models import Patient

logger = logging.getLogger("app.infobip")

# VoiceLive speaks/listens at 24kHz PCM16 - ask Infobip's media stream for the same
# rate so no resampling is needed on either leg of the bridge.
MEDIA_STREAM_SAMPLE_RATE = "24000"

# Infobip's event-subscription API needs account permissions this (trial) key doesn't
# have, so instead of a CALL_ESTABLISHED webhook we poll the call's own state - no
# extra account setup required, just this one GET endpoint.
_POLL_INTERVAL_SECONDS = 1.5
_POLL_MAX_ATTEMPTS = 25  # ~37s, comfortably past the call's own 30s connect_timeout
_TERMINAL_STATES = {
    CallState.FINISHED,
    CallState.FAILED,
    CallState.CANCELLED,
    CallState.NO_ANSWER,
    CallState.BUSY,
}


def _calls_api() -> CallsApi:
    config = Configuration(host=settings.infobip_base_url, api_key=settings.infobip_api_key)
    return CallsApi(ApiClient(config))


def _call_stream_url(patient_id: uuid.UUID) -> str:
    base = settings.infobip_public_ws_base_url.rstrip("/")
    return f"{base}/patients/{patient_id}/call-stream?service_key={settings.service_api_key}"


def _create_media_stream_config(patient_id: uuid.UUID) -> str:
    request = CallsWebsocketEndpointConfigRequest(
        name=f"mojodpust-{patient_id}",
        url=_call_stream_url(patient_id),
        sampleRate=MEDIA_STREAM_SAMPLE_RATE,
    )
    response = _calls_api().create_media_stream_config(request)
    assert response.id is not None
    return response.id


def _start_call(patient: Patient) -> str:
    # CallRequest.endpoint is typed as the base CallEndpoint - going through normal
    # validation (model_validate/__init__ with a plain dict) re-coerces it to that
    # base type and silently drops phoneNumber. model_construct() skips validation
    # and keeps the actual CallsPhoneEndpoint instance, which the SDK's own
    # to_dict() (used for the real HTTP body) serializes correctly via polymorphism.
    fields: dict = {
        "endpoint": CallsPhoneEndpoint(phoneNumber=patient.phone_number),
        "calls_configuration_id": settings.infobip_application_id,
        "connect_timeout": 30,
    }
    # No leased number configured - omit "from" so Infobip falls back to its
    # shared trial sender (only works for numbers verified during onboarding).
    if settings.infobip_caller_number:
        fields["var_from"] = settings.infobip_caller_number
    request = CallRequest.model_construct(**fields)
    call = _calls_api().create_call(request)
    assert call.id is not None
    return call.id


def _get_call_state(call_id: str) -> CallState | None:
    return _calls_api().get_call(call_id).state


def _start_media_stream(call_id: str, media_stream_config_id: str) -> None:
    request = CallsStartMediaStreamRequest(
        mediaStream=CallsMediaStream(
            audioProperties=CallsMediaStreamAudioProperties(
                mediaStreamConfigId=media_stream_config_id,
                replaceMedia=True,
            )
        )
    )
    _calls_api().start_media_stream(call_id, request)


def _place_outbound_call_sync(patient: Patient) -> tuple[str, str]:
    media_stream_config_id = _create_media_stream_config(patient.id)
    call_id = _start_call(patient)
    return call_id, media_stream_config_id


async def _wait_for_answer_and_start_stream(call_id: str, media_stream_config_id: str) -> None:
    for _ in range(_POLL_MAX_ATTEMPTS):
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)
        try:
            state = await asyncio.to_thread(_get_call_state, call_id)
        except OpenApiException:
            logger.exception("failed to poll state for call %s", call_id)
            return

        if state == CallState.ESTABLISHED:
            try:
                await asyncio.to_thread(_start_media_stream, call_id, media_stream_config_id)
            except OpenApiException:
                logger.exception("failed to start media stream on call %s", call_id)
            return
        if state in _TERMINAL_STATES:
            logger.info("call %s ended before being answered: %s", call_id, state)
            return

    logger.warning("call %s never reached ESTABLISHED within the polling window", call_id)


async def place_outbound_call(patient: Patient, background_tasks: BackgroundTasks) -> str:
    """Start an outbound call to `patient` and arrange for VoiceLive to join it.

    Creating the call and attaching the media stream are two separate Infobip API
    calls - we can only start streaming once the callee has picked up, so a
    background task polls the call's state until it's ESTABLISHED.
    """
    call_id, media_stream_config_id = await asyncio.to_thread(_place_outbound_call_sync, patient)
    background_tasks.add_task(_wait_for_answer_and_start_stream, call_id, media_stream_config_id)
    return call_id
