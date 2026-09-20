import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("tts.endpoint")

Router = APIRouter(prefix="/speak", tags=["TTS"])

class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class SpeakResponse(BaseModel):
    status: str
    queued_text: str


@Router.post("", response_model=SpeakResponse)
def speak(payload: SpeakRequest):
    from kibo.services.tts.service import TTSService

    try:
        queued = TTSService.push_message(payload.text)
    except Exception as error:
        logger.exception("Error on add the message to queue")
        raise HTTPException(
            status_code=500,
            detail={"message": "Error encolando el mensaje de TTS", "detail": str(error)},
        )

    if not queued:
        raise HTTPException(
            status_code=429,
            detail="La cola de TTS esta saturada, reintentar en unos segundos.",
        )

    return SpeakResponse(status="queued", queued_text=payload.text)

@Router.post("/stop")
def stop_speaking():
    from kibo.services.tts.service import TTSService

    dropped = TTSService.stop_speaking()
    return {"status": "stopped", "dropped_messages": dropped}


@Router.get("/status")
def speak_status():
    from kibo.services.tts.service import TTSService

    return {"pending_messages": TTSService.get_pending_count()}