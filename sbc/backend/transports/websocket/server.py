import logging

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from .decoder import decode, PacketDecodeError


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/ws",
    tags=["WebSocket"]
)


class ConnectionManager:

    def __init__(self):

        self.connections = set()

    async def connect(self, websocket):

        await websocket.accept()

        self.connections.add(websocket)

        logger.info(
            "WebSocket conectado. Clientes: %d",
            len(self.connections)
        )

    def disconnect(self, websocket):

        self.connections.discard(websocket)

    async def broadcast_json(self, data):

        disconnected = []

        for websocket in self.connections:

            try:

                await websocket.send_json(data)

            except Exception:

                disconnected.append(websocket)

        for websocket in disconnected:

            self.disconnect(websocket)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await manager.connect(websocket)

    try:

        while True:

            raw_data = await websocket.receive_text()

            try:

                decode(raw_data)

            except PacketDecodeError as e:

                logger.warning(
                    "Packet rechazado: %s",
                    e
                )

                await websocket.send_json({
                    "error": str(e)
                })

            except Exception:

                logger.exception(
                    "Error inesperado procesando packet"
                )

                await websocket.send_json({
                    "error": "internal_error"
                })

    except WebSocketDisconnect:

        manager.disconnect(websocket)