import json
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

# Event loop principal de FastAPI. Se guarda para poder hacer broadcast
# desde otros hilos (por ejemplo, el callback del SerialClient).
main_loop = None


def set_main_loop(loop):
    global main_loop
    main_loop = loop


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


def broadcast_threadsafe(packet):
    """Se puede llamar desde cualquier hilo."""
    if main_loop is None:
        logger.warning("No hay event loop disponible para el broadcast.")
        return

    asyncio.run_coroutine_threadsafe(broadcast(packet), main_loop)


@Router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    # Respaldo: si no se configuró en el startup, se guarda al conectar.
    if main_loop is None:
        set_main_loop(asyncio.get_running_loop())

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
                data = json.loads(raw_data["text"])
            except Exception as error:
                logger.warning("Invalid JSON: %s", error)
                continue

            try:
                data_to_return = decode(data)
            except Exception as error:
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
        logger.error("Error on websocket: %s", error)
    finally:
        await remove_client(websocket)