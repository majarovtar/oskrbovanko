"""Telefonski klic pacientu prek Twilio (gumb "Pokliči" v portalu).

Potek:
  1. zdravnik klikne "Pokliči" -> POST /patients/{id}/phone-call -> Twilio pokliče pacienta,
  2. Twilio med klicem kliče naše /twilio/... naslove (prek javnega URL-ja / tunela),
  3. vprašanja izgovori Azure glas (posnetki v tts_cache/), odgovore prepozna Twilio (sl-SI),
  4. vsak odgovor se takoj shrani v bazo (calls + answers); po zadnjem se pošlje e-mail.

Trial račun: brez <Redirect> (dovoli jih le nekaj), zato naslednje vprašanje Twilio dobi
v odgovoru na prejšnji odgovor; ob tišini actionOnEmptyResult pokliče isti action.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

import httpx

from app.config import settings

logger = logging.getLogger("app.phone_call")

# ------------------------------------------------------------------ vsebina klica
QUESTIONS = [
    "Kako se danes počutite?",
    "Ali z operiranim očesom vidite dobro?",
    "Ali vas oko boli? Kako močno, od nič do deset?",
    "Ali je oko bolj rdeče kot včeraj?",
    "Ali vidite bliske, pike ali temno senco?",
    "Ali vam je slabo ali ste bruhali?",
    "Ali ste danes kapali kapljice za oko?",
    "Ali ponoči nosite ščitnik za oko?",
    "Bi radi zdravniku še kaj sporočili?",
]
INTRO = ("Dober dan. Tukaj avtomatska asistentka. Kličem zaradi pregleda po operaciji. "
         "Postavila vam bom nekaj vprašanj.")
REPEAT = "Oprostite, nisem vas slišala."
GOODBYE = ("Hvala za odgovore. Posredovali jih bomo zdravniku. "
           "V nujnem primeru pokličite sto dvanajst. Na svidenje.")

LANGUAGE = "sl-SI"
WAIT_FOR_ANSWER_S = 6   # koliko sekund čaka, da pacient začne govoriti
SILENCE_ENDS_ANSWER_S = 1  # koliko sekund tišine pomeni konec odgovora

TTS_DIR = Path(__file__).resolve().parent.parent / "tts_cache"
_AUDIO_NAME = re.compile(r"^[0-9a-f]{16}\.wav$")


def is_configured() -> bool:
    return bool(settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number)


# ------------------------------------------------------------------ glas (Azure TTS)
def audio_name(text: str) -> str:
    return hashlib.sha1(f"{settings.tts_voice}|{text}".encode()).hexdigest()[:16] + ".wav"


def audio_path(name: str) -> Path | None:
    if not _AUDIO_NAME.match(name):
        return None
    path = TTS_DIR / name
    return path if path.exists() else None


def prepare_audio() -> None:
    """Vsa besedila enkrat pretvori v govor (8 kHz WAV za telefon); obstoječa preskoči."""
    TTS_DIR.mkdir(exist_ok=True)
    resource = httpx.URL(settings.azure_voicelive_endpoint).host.split(".")[0]
    url = f"https://{resource}.cognitiveservices.azure.com/tts/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": settings.azure_voicelive_api_key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "riff-8khz-16bit-mono-pcm",
        "User-Agent": "mojodpust-backend",
    }
    for text in [INTRO, REPEAT, GOODBYE, *QUESTIONS]:
        path = TTS_DIR / audio_name(text)
        if path.exists():
            continue
        ssml = (f'<speak version="1.0" xml:lang="{LANGUAGE}"><voice name="{settings.tts_voice}">'
                f'<prosody rate="-10%">{escape(text)}</prosody></voice></speak>')
        response = httpx.post(url, headers=headers, content=ssml.encode("utf-8"), timeout=30)
        if response.status_code != 200:
            raise RuntimeError(f"Azure TTS failed ({response.status_code})")
        path.write_bytes(response.content)


# ------------------------------------------------------------------ javni naslov (tunel)
_TUNNEL_URL = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
_tunnel_lock = threading.Lock()
_tunnel: subprocess.Popen | None = None
_tunnel_url: str | None = None


def _find_cloudflared() -> str:
    candidates = [
        shutil.which("cloudflared"),
        r"C:\Program Files (x86)\cloudflared\cloudflared.exe",
        r"C:\Program Files\cloudflared\cloudflared.exe",
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "cloudflared.exe"),
    ]
    for path in candidates:
        if path and Path(path).exists():
            return path
    raise RuntimeError("cloudflared ni nameščen (winget install --id Cloudflare.cloudflared)")


def public_base_url(local_port: int) -> str:
    """Javni naslov backenda za Twilio: PUBLIC_BASE_URL ali (samodejno) cloudflared tunel."""
    global _tunnel, _tunnel_url
    if settings.public_base_url:
        return settings.public_base_url.rstrip("/")
    with _tunnel_lock:
        if _tunnel is not None and _tunnel.poll() is None and _tunnel_url:
            return _tunnel_url
        process = subprocess.Popen(
            # 127.0.0.1 in ne "localhost": na Windows je localhost lahko ::1 (IPv6), uvicorn
            # z --host 0.0.0.0 pa posluša samo na IPv4 -> Twilio "could not reach your URL".
            [_find_cloudflared(), "tunnel", "--url", f"http://127.0.0.1:{local_port}", "--no-autoupdate"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        found: list[str] = []
        got_url = threading.Event()
        connected = threading.Event()

        def read_output() -> None:
            assert process.stdout is not None
            for line in process.stdout:  # brati do konca, da se izhod ne zamaši
                if not found:
                    match = _TUNNEL_URL.search(line)
                    if match:
                        found.append(match.group(0))
                        got_url.set()
                if "Registered tunnel connection" in line:
                    connected.set()

        threading.Thread(target=read_output, daemon=True).start()
        if not got_url.wait(timeout=45):
            process.terminate()
            raise RuntimeError("tunel se ni zagnal (ni naslova)")
        # Pripravljenost beremo iz cloudflared, ne s klicem na lasten javni naslov:
        # Windows si za čisto nov naslov zapomni "ne obstaja" (DNS), Twilio pa ga doseže.
        if not connected.wait(timeout=45):
            process.terminate()
            raise RuntimeError("tunel se ni povezal s Cloudflare")
        url = found[0]
        # Twilio mora naslov najti v javnem DNS; nov naslov se tam pojavi z zamikom.
        # Preverjamo pri javnem DNS (Google), ne pri Windows, ki si zapomni "ne obstaja".
        if not _wait_for_public_dns(httpx.URL(url).host, timeout_s=90):
            logger.warning("tunnel hostname not yet visible in public DNS; Twilio may not reach it")
        _tunnel, _tunnel_url = process, url
        logger.info("cloudflared tunnel ready: %s", url)
        return url


def _wait_for_public_dns(host: str, timeout_s: int) -> bool:
    """Čaka, da javni DNS (dns.google) pozna naslov tunela; nato še nekaj sekund rezerve."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            answer = httpx.get("https://dns.google/resolve", params={"name": host, "type": "A"}, timeout=5).json()
            if answer.get("Status") == 0 and answer.get("Answer"):
                time.sleep(5)
                return True
        except (httpx.HTTPError, ValueError):
            pass
        time.sleep(3)
    return False


def start_tunnel_in_background(local_port: int) -> None:
    """Ob zagonu backenda pripravi tunel, da je prvi klic hiter (napake samo zabeleži)."""
    if settings.public_base_url or not is_configured():
        return

    def run() -> None:
        try:
            public_base_url(local_port)
            prepare_audio()
        except Exception as exc:  # noqa: BLE001 - ob kliku se poskusi znova
            logger.warning("tunnel/audio preparation at startup failed: %s", exc)

    threading.Thread(target=run, daemon=True).start()


def current_base_url() -> str | None:
    """Javni naslov, ki že obstaja (brez zagona tunela) - za Twiliove zahteve med klicem."""
    if settings.public_base_url:
        return settings.public_base_url.rstrip("/")
    return _tunnel_url


def stop_tunnel() -> None:
    global _tunnel, _tunnel_url
    with _tunnel_lock:
        if _tunnel is not None and _tunnel.poll() is None:
            _tunnel.terminate()
        _tunnel, _tunnel_url = None, None


# ------------------------------------------------------------------ Twilio
def start_call(to_number: str, voice_url: str) -> str:
    """Twilio naj pokliče številko; vrne Call SID. Ob zavrnitvi sproži RuntimeError s Twiliovim sporočilom."""
    sid = settings.twilio_account_sid
    response = httpx.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Calls.json",
        auth=(sid, settings.twilio_auth_token),
        data={"To": to_number.replace(" ", ""), "From": settings.twilio_from_number, "Url": voice_url},
        timeout=30,
    )
    if response.status_code >= 300:
        try:
            message = response.json().get("message", response.text)
        except ValueError:
            message = response.text
        raise RuntimeError(message)
    return response.json()["sid"]


def valid_signature(url: str, params: dict[str, str], signature: str | None) -> bool:
    """Preveri X-Twilio-Signature: zahtevo je res poslal Twilio z našim Auth Tokenom."""
    if not signature:
        return False
    payload = url + "".join(key + params[key] for key in sorted(params))
    digest = hmac.new(settings.twilio_auth_token.encode(), payload.encode("utf-8"), hashlib.sha1).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


# ------------------------------------------------------------------ TwiML
def _play(base: str, text: str) -> str:
    return f"<Play>{escape(f'{base}/twilio/audio/{audio_name(text)}')}</Play>"


def question_twiml(base: str, patient_id: str, number: int, repeat: bool, before: str = "") -> str:
    action = f"{base}/twilio/answer?patient_id={patient_id}&st={number}&rep={int(repeat)}"
    return (
        "<Response>"
        f"{before}"
        f'<Gather input="speech" language="{LANGUAGE}" speechTimeout="{SILENCE_ENDS_ANSWER_S}" '
        f'timeout="{WAIT_FOR_ANSWER_S}" actionOnEmptyResult="true" action={quoteattr(action)} method="POST">'
        f"{_play(base, REPEAT) if repeat else ''}{_play(base, QUESTIONS[number - 1])}"
        "</Gather>"
        "</Response>"
    )


def intro_twiml(base: str, patient_id: str) -> str:
    return question_twiml(base, patient_id, 1, repeat=False, before=_play(base, INTRO))


def goodbye_twiml(base: str) -> str:
    return f"<Response>{_play(base, GOODBYE)}<Hangup/></Response>"
