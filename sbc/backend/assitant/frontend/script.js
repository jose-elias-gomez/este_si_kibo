const talkBtn = document.getElementById("talk-btn");
const talkLabel = document.getElementById("talk-label");
const statusEl = document.getElementById("status");
const chatEl = document.getElementById("chat");

// El backend (FastAPI) sirve el frontend directamente en el puerto 8000.
// Si por algún motivo abrís este archivo desde otro puerto (ej. un live
// server para desarrollo), esto apunta las llamadas igual al backend.
const API_BASE = window.location.port === "8000" ? "" : "http://localhost:8000";

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingRequested = false; // true mientras el usuario mantiene el botón presionado

function setStatus(text) {
  statusEl.textContent = text;
}

function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function startRecording() {
  if (isRecording || recordingRequested) return;
  recordingRequested = true;
  talkBtn.classList.add("recording");
  talkLabel.textContent = "Soltá para enviar";
  setStatus("Pidiendo acceso al micrófono...");

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error("Error accediendo al micrófono:", err);
    setStatus(`No se pudo acceder al micrófono (${err.name}). Revisá permisos.`);
    recordingRequested = false;
    talkBtn.classList.remove("recording");
    talkLabel.textContent = "Mantené presionado para hablar";
    return;
  }

  // El usuario pudo haber soltado el botón mientras esperábamos el permiso.
  if (!recordingRequested) {
    stream.getTracks().forEach((track) => track.stop());
    talkBtn.classList.remove("recording");
    talkLabel.textContent = "Mantené presionado para hablar";
    setStatus("Listo.");
    return;
  }

  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    handleRecordingStop();
  };

  mediaRecorder.start();
  isRecording = true;
  setStatus("Escuchando...");
}

function stopRecording() {
  recordingRequested = false;
  talkBtn.classList.remove("recording");
  talkLabel.textContent = "Mantené presionado para hablar";

  if (!isRecording || !mediaRecorder) {
    // getUserMedia todavía no resolvió: startRecording va a detectar
    // recordingRequested = false apenas termine y va a descartar todo.
    return;
  }
  mediaRecorder.stop();
  isRecording = false;
}

async function handleRecordingStop() {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  console.log(`Audio grabado: ${audioBlob.size} bytes, ${audioChunks.length} chunks`);

  if (audioBlob.size < 1000) {
    setStatus("No se detectó audio, intentá de nuevo.");
    return;
  }

  setStatus("Procesando...");

  const formData = new FormData();
  formData.append("audio", audioBlob, "grabacion.webm");

  try {
    const response = await fetch(`${API_BASE}/api/talk`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.detail || `Error ${response.status}`);
    }

    const transcription = decodeURIComponent(response.headers.get("X-Transcription") || "");
    const replyText = decodeURIComponent(response.headers.get("X-Reply-Text") || "");

    if (transcription) addBubble("user", transcription);
    if (replyText) addBubble("assistant", replyText);

    const audioReplyBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioReplyBlob);
    const audio = new Audio(audioUrl);

    setStatus("Respondiendo...");
    audio.onended = () => setStatus("Listo.");
    await audio.play();
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
}

// Mantener presionado (mouse) para grabar
talkBtn.addEventListener("mousedown", startRecording);
talkBtn.addEventListener("mouseup", stopRecording);
talkBtn.addEventListener("mouseleave", () => {
  if (isRecording) stopRecording();
});

// Soporte táctil (para pantalla conectada a la Raspberry Pi)
talkBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startRecording();
});
talkBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  stopRecording();
});