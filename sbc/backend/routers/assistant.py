import os
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf

from fastapi import APIRouter, UploadFile, File, HTTPException

from services.stt.stt import SpeechRecognizer
from services.llm.llm import VoiceAssistantLLM
from services.tts.tts import TTS


router = APIRouter(
    prefix="/assistant",
    tags=["Assistant"],
)


# ============================================================
# RUTAS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

STT_MODEL_DIR = BASE_DIR / "services" / "stt"

LLM_MODEL_PATH = (
    BASE_DIR
    / "services"
    / "llm"
    / "qwen2.5-3b-instruct-q4_k_m.gguf"
)

TTS_MODEL_PATH = (
    BASE_DIR
    / "services"
    / "tts"
    / "es-hikari-medium.onnx"
)


FFMPEG_BINARY = os.environ.get(
    "FFMPEG_BINARY",
    "ffmpeg",
)


# ============================================================
# MODELOS
# ============================================================

stt_engine: SpeechRecognizer | None = None
llm_engine: VoiceAssistantLLM | None = None
tts_engine: TTS | None = None


# ============================================================
# STARTUP
# ============================================================

def load_assistant():

    global stt_engine
    global llm_engine
    global tts_engine

    print()
    print("=" * 60)
    print("CARGANDO ASISTENTE DE VOZ")
    print("=" * 60)

    # ----------------------------
    # STT
    # ----------------------------

    print("[ASSISTANT] Cargando STT...")

    stt_engine = SpeechRecognizer(
        language="es",
        model="whisper-large-v3"
    )

    # ----------------------------
    # LLM
    # ----------------------------

    print("[ASSISTANT] Cargando LLM...")

    llm_engine = VoiceAssistantLLM(
        model_path=str(LLM_MODEL_PATH),
        n_ctx=2048,
        n_threads=4,
    )

    # ----------------------------
    # TTS
    # ----------------------------

    print("[ASSISTANT] Cargando TTS...")

    if not TTS_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"No existe el modelo TTS: {TTS_MODEL_PATH}"
        )

    tts_engine = TTS(
        str(TTS_MODEL_PATH)
    )

    print("=" * 60)
    print("[ASSISTANT] ASISTENTE LISTO")
    print("=" * 60)
    print()


# ============================================================
# CONVERSIÓN AUDIO
# ============================================================

def convert_to_wav(
    input_bytes: bytes,
) -> np.ndarray:

    input_path = None
    output_path = None

    try:

        with tempfile.NamedTemporaryFile(
            suffix=".input",
            delete=False,
        ) as src:

            src.write(input_bytes)
            input_path = src.name

        with tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False,
        ) as dst:

            output_path = dst.name

        start = time.perf_counter()

        result = subprocess.run(
            [
                FFMPEG_BINARY,
                "-y",
                "-i",
                input_path,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-f",
                "wav",
                output_path,
            ],
            capture_output=True,
        )

        elapsed = time.perf_counter() - start

        print(f"[FFMPEG] {elapsed:.2f}s")

        if result.returncode != 0:

            error = result.stderr.decode(
                "utf-8",
                errors="ignore",
            )

            raise HTTPException(
                status_code=400,
                detail=f"Error convirtiendo audio: {error}",
            )

        audio, sample_rate = sf.read(
            output_path,
            dtype="float32",
        )

        if sample_rate != 16000:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"FFmpeg devolvió {sample_rate} Hz "
                    "en lugar de 16000 Hz."
                ),
            )

        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        return audio

    finally:

        if input_path and os.path.exists(input_path):
            os.remove(input_path)

        if output_path and os.path.exists(output_path):
            os.remove(output_path)


# ============================================================
# TALK
# ============================================================

@router.post("/talk")
async def talk(
    audio: UploadFile = File(...),
):

    if (
        stt_engine is None
        or llm_engine is None
        or tts_engine is None
    ):

        raise HTTPException(
            status_code=503,
            detail="El asistente todavía se está cargando.",
        )

    print()
    print("=" * 60)
    print("NUEVA CONSULTA")
    print("=" * 60)

    # ========================================================
    # AUDIO
    # ========================================================

    raw_bytes = await audio.read()

    print(
        f"[AUDIO] Recibido: {len(raw_bytes)} bytes"
    )

    # ========================================================
    # CONVERTIR
    # ========================================================

    start_audio = time.perf_counter()

    wav_array = convert_to_wav(raw_bytes)

    audio_time = time.perf_counter() - start_audio

    duration = len(wav_array) / 16000

    print()
    print("[AUDIO]")
    print("Sample rate: 16000")
    print("Samples:", len(wav_array))
    print(f"Duración: {duration:.2f}s")
    print(f"Conversión total: {audio_time:.2f}s")

    # ========================================================
    # STT
    # ========================================================

    print()
    print(
        f"[STT] Procesando audio: {duration:.2f}s"
    )

    start_stt = time.perf_counter()

    transcription = stt_engine.transcribe(
        wav_array,
        sample_rate=16000,
    )

    stt_time = time.perf_counter() - start_stt

    print(
        f"[STT] {stt_time:.2f}s"
    )

    print(
        "[STT] Resultado:",
        repr(transcription),
    )

    if not transcription:

        raise HTTPException(
            status_code=422,
            detail="No se detectó voz.",
        )

    # ========================================================
    # LLM
    # ========================================================

    start_llm = time.perf_counter()

    reply_text = llm_engine.ask(
        transcription
    )

    llm_time = time.perf_counter() - start_llm

    print(
        f"[LLM] {llm_time:.2f}s"
    )

    print(
        "[LLM] Respuesta:",
        repr(reply_text),
    )

    if not reply_text:

        raise HTTPException(
            status_code=500,
            detail="El LLM no generó una respuesta.",
        )

    # ========================================================
    # TTS
    # ========================================================

    print("[TTS] Generando respuesta...")

    start_tts = time.perf_counter()

    # Tu TTS actual reproduce directamente por sounddevice.
    tts_engine.speak(reply_text)

    tts_time = time.perf_counter() - start_tts

    print(
        f"[TTS] {tts_time:.2f}s"
    )

    # ========================================================
    # LATENCIA
    # ========================================================

    total_time = (
        audio_time
        + stt_time
        + llm_time
        + tts_time
    )

    print()
    print("-" * 48)
    print("LATENCIA")
    print("-" * 48)
    print(
        f"Audio:       {duration:.2f}s"
    )
    print(
        f"FFmpeg:      {audio_time:.2f}s"
    )
    print(
        f"STT:         {stt_time:.2f}s"
    )
    print(
        f"LLM:         {llm_time:.2f}s"
    )
    print(
        f"TTS:         {tts_time:.2f}s"
    )
    print("-" * 48)
    print(
        f"TOTAL:       {total_time:.2f}s"
    )
    print("=" * 60)

    # ========================================================
    # RESPUESTA
    # ========================================================

    return {
        "status": "ok",
        "transcription": transcription,
        "reply": reply_text,
    }


# ============================================================
# RESET
# ============================================================

@router.post("/reset")
def reset_conversation():

    if llm_engine is None:

        raise HTTPException(
            status_code=503,
            detail="LLM todavía no está cargado.",
        )

    llm_engine.reset()

    return {
        "status": "ok",
    }
