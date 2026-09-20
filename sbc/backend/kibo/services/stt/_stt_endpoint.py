from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

class TranscribeResponse(BaseModel):
    text: str

Router = APIRouter(prefix="/stt", tags=["STT"])

@Router.post("", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)) -> TranscribeResponse:
    from kibo.services.stt import STTService

    audio_bytes = await file.read()
    text = await STTService.atranscribe(audio_bytes, file.filename or "audio.wav")
    return TranscribeResponse(text=text)
