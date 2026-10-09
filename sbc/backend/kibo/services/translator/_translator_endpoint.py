import json
import logging
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

logger = logging.getLogger("[TRANSLATOR]")


class FrameResponse(BaseModel):
    detected: bool
    prediction: Optional[str] = None
    confidence: float = 0.0
    margin: float = 0.0
    stable: bool = False
    stable_prediction: Optional[str] = None
    second_prediction: Optional[str] = None
    second_confidence: float = 0.0
    confirmed: bool = False
    confirmed_letter: Optional[str] = None
    locked: bool = False
    word: str = ""


class WordResponse(BaseModel):
    word: str


Router = APIRouter(prefix="/translator", tags=["Translator"])


# ----------------------------------------------------------------------
# WebSocket (used by translator.js)
#
# Client -> server:
#   * binary message: one JPEG frame
#   * text message:   {"action": "space" | "delete" | "clear" | "reset"}
#
# Server -> client:
#   * {"type": "prediction", ...result of process_frame...}
#   * {"type": "word", "word": "..."}
#   * {"type": "error", "message": "..."}
# ----------------------------------------------------------------------

@Router.websocket("/ws")
async def translator_ws(websocket: WebSocket):
    from kibo.services.translator import TranslatorService

    await websocket.accept()
    logger.info("Translator websocket connected")

    actions = {
        "space": TranslatorService.add_space,
        "delete": TranslatorService.delete_last,
        "clear": TranslatorService.clear_word,
        "reset": TranslatorService.reset,
    }

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            # Binary message: a JPEG frame
            if message.get("bytes") is not None:
                result = await TranslatorService.aprocess_image_bytes(message["bytes"])

                if result is None:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid or empty image"}
                    )
                    continue

                await websocket.send_json({"type": "prediction", **result})
                continue

            # Text message: a word command
            if message.get("text") is not None:
                try:
                    action = json.loads(message["text"]).get("action")
                except Exception:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid JSON"}
                    )
                    continue

                handler = actions.get(action)

                if handler is None:
                    await websocket.send_json(
                        {"type": "error", "message": f"Unknown action: {action}"}
                    )
                    continue

                handler()
                await websocket.send_json(
                    {"type": "word", "word": TranslatorService.get_word()}
                )

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Translator websocket error")
    finally:
        logger.info("Translator websocket closed")


# ----------------------------------------------------------------------
# REST (handy for testing with curl / Swagger)
# ----------------------------------------------------------------------

@Router.post("/frame", response_model=FrameResponse)
async def process_frame(file: UploadFile = File(...)) -> FrameResponse:
    from kibo.services.translator import TranslatorService

    image_bytes = await file.read()
    result = await TranslatorService.aprocess_image_bytes(image_bytes)

    if result is None:
        raise HTTPException(status_code=400, detail="Invalid or empty image")

    return FrameResponse(**result)


@Router.get("/word", response_model=WordResponse)
async def get_word() -> WordResponse:
    from kibo.services.translator import TranslatorService

    return WordResponse(word=TranslatorService.get_word())


@Router.post("/space", response_model=WordResponse)
async def add_space() -> WordResponse:
    from kibo.services.translator import TranslatorService

    TranslatorService.add_space()
    return WordResponse(word=TranslatorService.get_word())


@Router.post("/delete", response_model=WordResponse)
async def delete_last() -> WordResponse:
    from kibo.services.translator import TranslatorService

    TranslatorService.delete_last()
    return WordResponse(word=TranslatorService.get_word())


@Router.post("/clear", response_model=WordResponse)
async def clear_word() -> WordResponse:
    from kibo.services.translator import TranslatorService

    TranslatorService.clear_word()
    return WordResponse(word=TranslatorService.get_word())


@Router.post("/reset", response_model=WordResponse)
async def reset() -> WordResponse:
    from kibo.services.translator import TranslatorService

    TranslatorService.reset()
    return WordResponse(word=TranslatorService.get_word())
