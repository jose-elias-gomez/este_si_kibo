from fastapi import APIRouter, Query
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
async def stop_recording(
    process: bool = Query(
        True,
        description="Si es False, detiene la grabación e ignora/cancela el audio sin procesarlo."
    )
) -> RecordingStatusResponse:
    from kibo.services.assistant import AssistantService

    stopped = AssistantService.stop_recording(process=process)
    if not stopped:
        return RecordingStatusResponse(status="not_recording")

    return RecordingStatusResponse(status="processing" if process else "stopped")
