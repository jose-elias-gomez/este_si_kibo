import logging

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

clients = []


async def broadcast(packet):
    disconnected = []

    for client in list(clients):
        try:
            await client.send_json(packet)

        except (
            WebSocketDisconnect,
            RuntimeError,
        ) as error:
            logger.warning(
                f"Cliente WebSocket desconectado: {error}"
            )
            disconnected.append(client)

        except Exception as error:
            logger.warning(
                f"Error enviando broadcast: {error}"
            )
            disconnected.append(client)

    for client in disconnected:
        if client in clients:
            clients.remove(client)


@router.websocket("")
async def websocket_endpoint(
    websocket: WebSocket,
):
    await websocket.accept()

    clients.append(websocket)

    logger.info(
        "Cliente WebSocket conectado. "
        f"Clientes activos: {len(clients)}"
    )

    try:
        while True:

            try:
                raw_data = await websocket.receive_json()

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

            # ---------------------------------------------
            # DECODIFICAR
            # ---------------------------------------------

            try:
                data_to_return = decode(raw_data)

            except Exception as error:
                logger.error(
                    "Error decodificando paquete: %s",
                    error,
                )

                # No intentamos enviar si el socket ya está muerto.
                try:
                    await websocket.send_json({
                        "error": str(error)
                    })
                except (
                    WebSocketDisconnect,
                    RuntimeError,
                ):
                    break

                continue

            # ---------------------------------------------
            # RESPUESTA
            # ---------------------------------------------

            if data_to_return is not None:

                try:
                    await websocket.send_json(
                        data_to_return
                    )

                except (
                    WebSocketDisconnect,
                    RuntimeError,
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

        if websocket in clients:
            clients.remove(websocket)

        logger.info(
            "Conexión finalizada. "
            f"Clientes activos: {len(clients)}"
        )
