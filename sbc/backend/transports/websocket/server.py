import logging
import asyncio

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from .decoder import decode
from services.system_options.websocket.websocket_connector import (
    register as register_system_options_packets,
)
from services.hal_conector.movement_connector import (
    register as register_hal_connector_packets,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/ws",
    tags=["WebSocket"],
)


register_system_options_packets()
register_hal_connector_packets()


# ============================================================
# CLIENTES
# ============================================================

clients = set()

clients_lock = asyncio.Lock()


# ============================================================
# REGISTRAR CLIENTE
# ============================================================

async def add_client(websocket):

    async with clients_lock:
        clients.add(websocket)

        logger.info(
            "Cliente WebSocket conectado. "
            f"Clientes activos: {len(clients)}"
        )


# ============================================================
# ELIMINAR CLIENTE
# ============================================================

async def remove_client(websocket):

    async with clients_lock:

        clients.discard(websocket)

        logger.info(
            "Conexión finalizada. "
            f"Clientes activos: {len(clients)}"
        )


# ============================================================
# BROADCAST
# ============================================================
# En server.py

async def broadcast(packet):
    # 1. Copiar rápidamente los clientes bajo el Lock y liberarlo DE INMEDIATO
    async with clients_lock:
        current_clients = list(clients)

    if not current_clients:
        return

    disconnected = []

    # 2. Enviar datos a cada cliente sin mantener el Lock retenido
    for client in current_clients:
        try:
            # Enviar con timeout corto individual por cliente
            await asyncio.wait_for(client.send_json(packet), timeout=0.3)

        except (
            WebSocketDisconnect,
            RuntimeError,
            ConnectionError,
            asyncio.TimeoutError
        ) as error:
            logger.info("Cliente WebSocket desconectado/bloqueado en broadcast: %s", error)
            disconnected.append(client)

        except Exception as error:
            logger.warning("Error enviando broadcast: %s", error)
            disconnected.append(client)

    # 3. Limpiar conexiones muertas recuperando el Lock brevemente
    if disconnected:
        async with clients_lock:
            for client in disconnected:
                clients.discard(client)

# ============================================================
# WEBSOCKET PRINCIPAL
# ============================================================

@router.websocket("")
async def websocket_endpoint(
    websocket: WebSocket,
):

    await websocket.accept()

    await add_client(websocket)

    try:

        while True:

            # =================================================
            # RECIBIR
            # =================================================

            try:

                raw_data = await websocket.receive()

            except WebSocketDisconnect:

                logger.info(
                    "Cliente WebSocket desconectado."
                )

                break

            except RuntimeError as error:

                logger.info(
                    "WebSocket cerrado: %s",
                    error,
                )

                break

            # =================================================
            # DESCONEXIÓN
            # =================================================

            if raw_data.get("type") == "websocket.disconnect":

                logger.info(
                    "Cliente envió disconnect."
                )

                break

            # =================================================
            # SOLO PROCESAR JSON
            # =================================================

            if "text" not in raw_data:

                continue

            try:

                import json

                data = json.loads(
                    raw_data["text"]
                )

            except Exception as error:

                logger.warning(
                    "JSON inválido: %s",
                    error,
                )

                continue

            # =================================================
            # DECODIFICAR
            # =================================================

            try:

                data_to_return = decode(data)

            except Exception as error:

                logger.error(
                    "Error decodificando paquete: %s",
                    error,
                )

                # -----------------------------------------
                # Intentar responder solamente porque
                # sabemos que todavía estamos dentro del
                # loop de recepción.
                # -----------------------------------------

                try:

                    await websocket.send_json({
                        "error": str(error)
                    })

                except (
                    WebSocketDisconnect,
                    RuntimeError,
                    ConnectionError,
                ):

                    break

                continue

            # =================================================
            # RESPUESTA
            # =================================================

            if data_to_return is None:

                continue

            try:

                await websocket.send_json(
                    data_to_return
                )

            except (
                WebSocketDisconnect,
                RuntimeError,
                ConnectionError,
            ) as error:

                logger.info(
                    "WebSocket cerrado "
                    "mientras enviaba respuesta: %s",
                    error,
                )

                break

    except WebSocketDisconnect:

        logger.info(
            "Cliente desconectado normalmente."
        )

    except Exception as error:

        logger.error(
            "Error inesperado en WebSocket: %s",
            error,
        )

    finally:

        await remove_client(websocket)