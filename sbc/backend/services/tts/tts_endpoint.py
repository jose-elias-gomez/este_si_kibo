from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.tts.tts import TTS
from services.tts.tts_thread import TTSThread

router = APIRouter(prefix="/speak", tags=["TTS"])

# Path to the voice model file
TTS_MODEL_PATH = "es-hikari-medium.onnx"

# Singleton instance of TTS and its dedicated worker thread
tts_instance = TTS(TTS_MODEL_PATH)
tts_thread = TTSThread(tts=tts_instance)

class SpeakResponse(BaseModel):
    status: str
    queued_text: str

@router.post(
    "", response_model=SpeakResponse, summary="Play a voice message (TTS)"
)
def speak(text: str):
    try:
        tts_thread.push_message(text)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Error queuing TTS message",
                "detail": str(e),
            },
        )

    return SpeakResponse(status="queued", queued_text=text)


@router.get("/status", summary="Check if TTS playback is currently active")
def speak_status():
    return {"pending_messages": tts_thread.pending_count}
