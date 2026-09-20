from fastapi import APIRouter
from pydantic import BaseModel


class RecordingStatusResponse(BaseModel):
    status: str


Router = APIRouter(prefix="/assistant", tags=["Assistant"])


@Router.post("/start-recording", response_model=RecordingStatusResponse)
async def start_recording() -> RecordingStatusResponse:
    from kibo.services.assistant import AssistantService

    started = AssistantService.start_recording()
    return RecordingStatusResponse(status="recording" if started else "already_recording")


@Router.post("/stop-recording", response_model=RecordingStatusResponse)
async def stop_recording() -> RecordingStatusResponse:
    from kibo.services.assistant import AssistantService

    # The heavy STT -> LLM -> TTS pipeline runs on a background worker thread,
    # so this responds immediately with "processing" instead of blocking.
    stopped = AssistantService.stop_recording()
    return RecordingStatusResponse(status="processing" if stopped else "not_recording")
