import logging
import asyncio

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from .decoder import decode

logger = logging.getLogger(__name__)

Router = APIRouter(
    prefix="/ws",
    tags=["WebSocket"],
)

clients = set()
clients_lock = asyncio.Lock()

async def add_client(websocket):
    async with clients_lock:
        clients.add(websocket)

async def remove_client(websocket):
    async with clients_lock:
        clients.discard(websocket)


async def broadcast(packet):
    async with clients_lock:
        current_clients = list(clients)

    if not current_clients:
        return

    disconnected = []

    for client in current_clients:
        try:
            await asyncio.wait_for(client.send_json(packet), timeout=0.3)
        except (WebSocketDisconnect, RuntimeError, ConnectionError, asyncio.TimeoutError):
            disconnected.append(client)
        except Exception as error:
            logger.error("Error en broadcast: %s", error)
            disconnected.append(client)

    if disconnected:
        async with clients_lock:
            for client in disconnected:
                clients.discard(client)

@Router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await add_client(websocket)

    try:
        while True:

            try:
                raw_data = await websocket.receive()
            except WebSocketDisconnect:
                break
            except RuntimeError as error:
                logger.warning("Websocket disconnected: %s", error)
                break

            if raw_data.get("type") == "websocket.disconnect":
                logger.info("Client disconnected.")
                break

            if "text" not in raw_data:
                continue

            try:
                import json
                data = json.loads(raw_data["text"])
            except Exception as error:
                logger.warning("Invalid JSON: %s", error)
                continue

            try:
                data_to_return = decode(data)
            except Exception as error:
                logger.error("Error on decode: %s", error)

                try:
                    await websocket.send_json({"error": str(error)})
                except (WebSocketDisconnect, RuntimeError, ConnectionError):
                    break

                continue

            if data_to_return is None:
                continue

            try:
                await websocket.send_json(data_to_return)
            except (WebSocketDisconnect, RuntimeError, ConnectionError) as error:
                logger.info("Websocket disconnected while a response is sent: %s", error)
                break

    except WebSocketDisconnect:
        return
    except Exception as error:
        logger.error("Error on broadcast: %s", error)
    finally:
        await remove_client(websocket)