from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["call-page"])

_PAGE = """<!doctype html>
<html lang="sl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MojOdpust - klic</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.25rem; }
  input { display: block; width: 100%; margin-bottom: 0.75rem; padding: 0.5rem; box-sizing: border-box; }
  button { padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }
  #error { color: #b00020; margin-top: 0.75rem; }
  #status { color: #555; margin-top: 0.5rem; }
  #transcript { margin-top: 1rem; border-top: 1px solid #ddd; padding-top: 0.5rem; }
  .line { margin-bottom: 0.4rem; }
  .line b { margin-right: 0.3rem; }
  #end-call { display: none; margin-top: 1rem; }
</style>
</head>
<body>
  <h1>MojOdpust - dnevni klic</h1>
  <div id="login-form">
    <input id="email" type="email" placeholder="E-poštni naslov" autocomplete="username" />
    <input id="password" type="password" placeholder="Geslo" autocomplete="current-password" />
    <button id="start-call">Začni klic</button>
  </div>
  <button id="end-call">Končaj klic</button>
  <div id="status"></div>
  <div id="error"></div>
  <div id="transcript"></div>

<script>
const API_URL = window.location.origin;
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const transcriptEl = document.getElementById("transcript");
const startBtn = document.getElementById("start-call");
const endBtn = document.getElementById("end-call");

let audioCtx = null;
let micStream = null;
let micNode = null;
let ws = null;
let playing = false;
let mutedUntil = 0;
let playHead = 0;

function showError(message) {
  errorEl.textContent = message;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function addLine(speaker, text) {
  const div = document.createElement("div");
  div.className = "line";
  const label = speaker === "agent" ? "Asistentka" : "Vi";
  div.innerHTML = "<b>" + label + ":</b> " + text;
  transcriptEl.appendChild(div);
}

function floatTo16BitPCM(float32) {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function downsample(buffer, inRate, outRate) {
  if (outRate === inRate) return buffer;
  const ratio = inRate / outRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    result[i] = buffer[Math.round(i * ratio)];
  }
  return result;
}

async function startAudioAndMic() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  playHead = audioCtx.currentTime;

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const source = audioCtx.createMediaStreamSource(micStream);
  micNode = audioCtx.createScriptProcessor(4096, 1, 1);
  source.connect(micNode);
  micNode.connect(audioCtx.destination === undefined ? audioCtx.destination : audioCtx.destination);
  micNode.onaudioprocess = (event) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (playing || performance.now() < mutedUntil) return;
    const input = event.inputBuffer.getChannelData(0);
    const down = downsample(input, audioCtx.sampleRate, 24000);
    ws.send(floatTo16BitPCM(down));
  };
}

function playAgentAudio(arrayBuffer) {
  const int16 = new Int16Array(arrayBuffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
  const buffer = audioCtx.createBuffer(1, float32.length, 24000);
  buffer.copyToChannel(float32, 0);
  const node = audioCtx.createBufferSource();
  node.buffer = buffer;
  node.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  if (playHead < now) playHead = now;
  node.start(playHead);
  playing = true;
  playHead += buffer.duration;
  node.onended = () => {
    if (audioCtx.currentTime >= playHead - 0.01) {
      playing = false;
      mutedUntil = performance.now() + 500;
    }
  };
}

function clearAgentAudio() {
  playHead = audioCtx ? audioCtx.currentTime : 0;
  playing = false;
  mutedUntil = performance.now() + 500;
}

async function login(email, password) {
  const response = await fetch(API_URL + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error("login_failed");
  }
  return await response.json();
}

async function firstPatient(token) {
  const response = await fetch(API_URL + "/patients", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!response.ok) {
    throw new Error("patients_failed");
  }
  const patients = await response.json();
  if (!patients.length) {
    throw new Error("no_patient");
  }
  return patients[0];
}

function openCallStream(patientId, token) {
  const wsUrl = API_URL.replace("http://", "ws://").replace("https://", "wss://");
  ws = new WebSocket(wsUrl + "/patients/" + patientId + "/call-stream?token=" + encodeURIComponent(token));
  ws.binaryType = "arraybuffer";

  ws.onmessage = (event) => {
    if (typeof event.data === "string") {
      const message = JSON.parse(event.data);
      if (message.type === "transcript") {
        addLine(message.speaker, message.text);
      } else if (message.type === "clear") {
        clearAgentAudio();
      } else if (message.type === "emergency") {
        setStatus("Zaznan nujen primer.");
      } else if (message.type === "call_saved") {
        setStatus("Klic je shranjen.");
        endBtn.style.display = "none";
      }
    } else {
      playAgentAudio(event.data);
    }
  };

  ws.onclose = () => {
    endBtn.style.display = "none";
  };
}

startBtn.addEventListener("click", async () => {
  showError("");
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await startAudioAndMic();
  } catch (err) {
    showError("Klic ni uspel. Poskusite znova.");
    return;
  }

  try {
    const { access_token } = await login(email, password);
    const patient = await firstPatient(access_token);
    openCallStream(patient.id, access_token);
    document.getElementById("login-form").style.display = "none";
    endBtn.style.display = "inline-block";
    setStatus("Klic poteka ...");
  } catch (err) {
    if (err.message === "login_failed") {
      showError("Napačen e-poštni naslov ali geslo.");
    } else if (err.message === "no_patient") {
      showError("Ta račun nima pacienta.");
    } else {
      showError("Klic ni uspel. Poskusite znova.");
    }
  }
});

endBtn.addEventListener("click", () => {
  if (ws) ws.close();
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  endBtn.style.display = "none";
});
</script>
</body>
</html>
"""


@router.get("/call", response_class=HTMLResponse)
def call_page() -> str:
    return _PAGE
