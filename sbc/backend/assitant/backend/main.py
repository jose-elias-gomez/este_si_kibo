"""
Backend del asistente de voz.

Flujo del endpoint /api/talk:
  1. Recibe un audio grabado desde el navegador (webm/ogg).
  2. Lo convierte a WAV 16kHz mono con ffmpeg.
  3. Lo transcribe con sherpa-onnx (STT).
  4. Genera una respuesta con Qwen2.5-0.5B (LLM).
  5. Sintetiza la respuesta con Piper (TTS).
  6. Devuelve el audio de respuesta + el texto (en headers).

Correr con:
  uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote

import numpy as np
import soundfile as sf
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from stt import SpeechRecognizer
from llm import VoiceAssistantLLM
from tts import SpeechSynthesizer

BASE_DIR = Path(__file__).resolve().parent.parent

# ---- Configuración de rutas a modelos ----
# Se pueden overridear con variables de entorno, así el mismo código sirve
# para probar en Windows y después correr en la Orange Pi sin tocar nada.
STT_MODEL_DIR = Path(os.environ.get("STT_MODEL_DIR", BASE_DIR / "models" / "stt"))
LLM_MODEL_PATH = Path(os.environ.get(
    "LLM_MODEL_PATH", BASE_DIR / "models" / "llm" / "qwen2.5-0.5b-instruct-q4_k_m.gguf"
))
TTS_MODEL_PATH = Path(os.environ.get(
    "TTS_MODEL_PATH",
    BASE_DIR / "models" / "tts" / "es-hikari-medium.onnx"
))
FFMPEG_BINARY = os.environ.get(
    "FFMPEG_BINARY",
    r"C:\Users\agust\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe"
)

app = FastAPI(title="Asistente de voz local")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # uso local en la misma red; ajustar si se expone afuera
    allow_methods=["*"],
    allow_headers=["*"],
)

# Los modelos se cargan una sola vez al arrancar el server
stt_engine: SpeechRecognizer | None = None
llm_engine: VoiceAssistantLLM | None = None
tts_engine: SpeechSynthesizer | None = None


@app.on_event("startup")
def load_models():
    global stt_engine, llm_engine, tts_engine
    print("Cargando STT (sherpa-onnx)...")
    stt_engine = SpeechRecognizer(str(STT_MODEL_DIR))

    print("Cargando LLM (Qwen2.5-0.5B)...")
    llm_engine = VoiceAssistantLLM(str(LLM_MODEL_PATH))

    print("Cargando TTS (Piper)...")
    tts_engine = SpeechSynthesizer(
        str(TTS_MODEL_PATH)
    )

    print("Todo listo.")


def _convert_to_wav_16k_mono(input_bytes: bytes) -> np.ndarray:
    """
    Convierte audio WebM/OGG/etc. a WAV 16 kHz mono usando FFmpeg.
    Compatible con Windows y Linux.
    """

    input_path = None
    output_path = None

    try:
        # Crear archivos temporales cerrados
        with tempfile.NamedTemporaryFile(
            suffix=".input",
            delete=False
        ) as src:
            src.write(input_bytes)
            input_path = src.name

        with tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False
        ) as dst:
            output_path = dst.name

        # FFmpeg procesa los archivos ya cerrados
        result = subprocess.run(
            [
                FFMPEG_BINARY,
                "-y",
                "-i", input_path,
                "-ar", "16000",
                "-ac", "1",
                "-f", "wav",
                output_path,
            ],
            capture_output=True,
        )

        if result.returncode != 0:
            error = result.stderr.decode("utf-8", errors="ignore")

            raise HTTPException(
                status_code=400,
                detail=f"No se pudo convertir el audio: {error}",
            )

        audio, sample_rate = sf.read(
            output_path,
            dtype="float32"
        )

        import shutil

        shutil.copy2(
            output_path,
            "debug_audio.wav"
        )

        return audio

    finally:
        # Limpiar archivos temporales
        if input_path and os.path.exists(input_path):
            os.remove(input_path)

        if output_path and os.path.exists(output_path):
            os.remove(output_path)


@app.post("/api/talk")
async def talk(audio: UploadFile = File(...)):
    if stt_engine is None or llm_engine is None or tts_engine is None:
        raise HTTPException(status_code=503, detail="Los modelos todavía se están cargando.")

    raw_bytes = await audio.read()
    wav_array = _convert_to_wav_16k_mono(raw_bytes)

    transcription = stt_engine.transcribe(wav_array)
    if not transcription:
        raise HTTPException(status_code=422, detail="No se detectó voz en el audio.")

    reply_text = llm_engine.ask(transcription)
    reply_audio = tts_engine.synthesize(reply_text)

    print("Transcripción:", transcription)
    print("Respuesta:", reply_text)
    print("Audio generado:", len(reply_audio), "bytes")
    print("Cabecera WAV:", reply_audio[:12])

    return Response(
        content=reply_audio,
        media_type="audio/wav",
        headers={
            # URL-encodeados porque los headers HTTP no aceptan tildes/ñ directo
            "X-Transcription": quote(transcription),
            "X-Reply-Text": quote(reply_text),
            "Access-Control-Expose-Headers": "X-Transcription, X-Reply-Text",
        },
    )


@app.post("/api/reset")
def reset_conversation():
    llm_engine.reset()
    return {"status": "ok"}


# Sirve el frontend estático (index.html, style.css, script.js)
app.mount("/", StaticFiles(directory=str(BASE_DIR / "frontend"), html=True), name="frontend")