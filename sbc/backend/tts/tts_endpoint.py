from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from tts.tts import TTS
from tts.tts_thread import TTSThread

router = APIRouter(prefix="/speak", tags=["TTS"])

# Path to the voice model file
TTS_MODEL_PATH = "es-hikari-medium.onnx"

# Singleton instance of TTS and its dedicated worker thread
tts_instance = TTS(TTS_MODEL_PATH)
tts_thread = TTSThread(tts=tts_instance)


class SpeakRequest(BaseModel):
    text: str = Field(
        ..., min_length=1, description="Text string to produce speech audio."
    )


class SpeakResponse(BaseModel):
    status: str
    queued_text: str


@router.post(
    "", response_model=SpeakResponse, summary="Play a voice message (TTS)"
)
def speak(payload: SpeakRequest):
    try:
        tts_thread.push_message(payload.text)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Error queuing TTS message",
                "detail": str(e),
            },
        )

    return SpeakResponse(status="queued", queued_text=payload.text)


@router.get("/status", summary="Check if TTS playback is currently active")
def speak_status():
    return {"pending_messages": tts_thread.pending_count}
