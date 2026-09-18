import os
import time
from pathlib import Path

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

TTS_MODEL_PATH = (
    BASE_DIR
    / "services"
    / "tts"
    / "es-hikari-medium.onnx"
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


    # ========================================================
    # STT
    # ========================================================

    print()
    print("[ASSISTANT] Cargando STT...")

    stt_engine = SpeechRecognizer(
        language="es",
        model="whisper-large-v3",
    )


    # ========================================================
    # LLM
    # ========================================================

    print()
    print("[ASSISTANT] Cargando LLM...")

    llm_engine = VoiceAssistantLLM(
        model="openai/gpt-oss-20b",
    )


    # ========================================================
    # TTS
    # ========================================================

    print()
    print("[ASSISTANT] Cargando TTS...")

    if not TTS_MODEL_PATH.exists():

        raise FileNotFoundError(
            f"No existe el modelo TTS: {TTS_MODEL_PATH}"
        )


    tts_engine = TTS(
        str(TTS_MODEL_PATH)
    )


    # ========================================================
    # LISTO
    # ========================================================

    print()
    print("=" * 60)
    print("[ASSISTANT] ASISTENTE LISTO")
    print("=" * 60)
    print()


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


    if not raw_bytes:

        raise HTTPException(
            status_code=400,
            detail="No se recibió audio.",
        )


    print()
    print("[AUDIO] Archivo recibido")
    print("[AUDIO] Nombre:", audio.filename)
    print("[AUDIO] Content-Type:", audio.content_type)
    print("[AUDIO] Bytes:", len(raw_bytes))


    # ========================================================
    # STT
    # ========================================================

    print()
    print("[STT] Enviando audio a Groq...")


    start_stt = time.perf_counter()


    transcription = stt_engine.transcribe_bytes(
        file_bytes=raw_bytes,
        filename=audio.filename or "voice.webm",
    )


    stt_time = (
        time.perf_counter()
        - start_stt
    )


    print(
        f"[STT] Tiempo: {stt_time:.2f}s"
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

    print()
    print("[LLM] Generando respuesta...")


    start_llm = time.perf_counter()


    reply_text = llm_engine.ask(
        transcription
    )


    llm_time = (
        time.perf_counter()
        - start_llm
    )


    print(
        f"[LLM] Tiempo: {llm_time:.2f}s"
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

    print()
    print("[TTS] Reproduciendo respuesta...")


    start_tts = time.perf_counter()


    try:

        tts_engine.speak(
            reply_text
        )

    except Exception as error:

        print(
            "[TTS] Error:",
            error
        )

        # No hacemos fallar toda la conversación
        # si el TTS tiene un problema.
        

    tts_time = (
        time.perf_counter()
        - start_tts
    )


    print(
        f"[TTS] Tiempo: {tts_time:.2f}s"
    )


    # ========================================================
    # LATENCIA
    # ========================================================

    total_time = (
        stt_time
        + llm_time
        + tts_time
    )


    print()
    print("-" * 48)
    print("LATENCIA")
    print("-" * 48)

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
    # RESPUESTA AL FRONTEND
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