import logging

from fastapi import (
    APIRouter,
    WebSocket,
)

from decoder import decode
from transports.websocket.handler.context_int import register_context_handlers

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/ws",
    tags=["WebSocket"]
)

register_context_handlers()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

  await websocket.accept()

  while True:
      raw_data = await websocket.receive_text()
      try:
          decode(raw_data)
      except Exception as e:
          await websocket.send_json({"error": str(e)})
