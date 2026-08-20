import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from decoder import decode, PacketDecodeError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["WebSocket"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                decode(raw_data)
            except PacketDecodeError as e:
                logger.warning("Packet rechazado: %s", e)
                await websocket.send_json({"error": str(e)})
            except Exception:
                logger.exception("Error inesperado procesando packet")
                await websocket.send_json({"error": "internal_error"})
    except WebSocketDisconnect:
        logger.info("Client disconnected")
