import logging

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from decoder import decode
from services.system_options.websocket.websocket_connector import register as register_system_options_packets

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/ws",
    tags=["WebSocket"]
)

register_system_options_packets()
clients = []

async def broadcast(packet):
    for client in list(clients):
        try:
            await client.send_json(packet)
        except Exception as e:
            logger.warning(f"Error al enviar datos a cliente: {e}")

@router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    try:
        while True:
            try:
              raw_data = await websocket.receive_json()
              data_to_return = decode(raw_data)
              if data_to_return is not None:
                await websocket.send_json(data_to_return)
            except Exception as e:
                await websocket.send_json({"error": str(e)})
    except WebSocketDisconnect:
        logger.info("Cliente desconectado normalmente.")
    except Exception as e:
        logger.error(f"Error inesperado en la conexión WebSocket: {e}")
    finally:
        if websocket in clients:
            clients.remove(websocket)
