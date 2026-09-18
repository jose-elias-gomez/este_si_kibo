import json
import logging
from pathlib import Path

import cv2
import numpy as np

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from services.translator.translator import SignTranslator

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/translator",
    tags=["Translator"],
)

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR
    / "services"
    / "translator"
    / "model.pkl"
)

# ============================================================
# MODELO
# ============================================================

translator = None


def load_translator():
    global translator
    try:
        translator = SignTranslator(str(MODEL_PATH))
    except Exception as e:
        logger.error(f"[TRANSLATOR] Error cargando modelo: {e}")


load_translator()


# ============================================================
# WEBSOCKET
# ============================================================

@router.websocket("/ws")
async def translator_ws(
    websocket: WebSocket,
):
    await websocket.accept()

    print("[TRANSLATOR] WebSocket conectado.")

    if translator is None:
        try:
            await websocket.send_json({
                "type": "error",
                "message": "El traductor todavía no está cargado.",
            })
            await websocket.close()
        except Exception:
            pass
        return

    # Resetear estado para esta nueva sesión
    translator.reset()
    connected = True

    try:
        while connected:

            # =================================================
            # RECIBIR DATOS
            # =================================================
            try:
                data = await websocket.receive()
            except (WebSocketDisconnect, RuntimeError, ConnectionError, OSError):
                connected = False
                break
            except Exception as error:
                print(f"[TRANSLATOR] Error al recibir: {repr(error)}")
                connected = False
                break

            # Desconexión explícita de FastAPI
            if data.get("type") == "websocket.disconnect":
                connected = False
                break

            # =================================================
            # COMANDOS DE TEXTO
            # =================================================
            if "text" in data:
                try:
                    command_payload = json.loads(data["text"])
                    command_type = command_payload.get("command")

                    if command_type == "SPACE":
                        translator.add_space()
                    elif command_type == "DELETE":
                        translator.delete_last()
                    elif command_type == "CLEAR":
                        translator.clear_word()
                    else:
                        continue

                    if connected:
                        await websocket.send_json({
                            "type": "word",
                            "word": translator.word,
                        })

                except (WebSocketDisconnect, RuntimeError, ConnectionError, OSError):
                    connected = False
                    break
                except Exception as error:
                    print(f"[TRANSLATOR] Command error: {repr(error)}")

                continue

            # =================================================
            # PROCESAR FRAME DE CÁMARA
            # =================================================
            if "bytes" not in data or not connected:
                continue

            image_array = np.frombuffer(
                data["bytes"],
                dtype=np.uint8,
            )

            frame = cv2.imdecode(
                image_array,
                cv2.IMREAD_COLOR,
            )

            if frame is None:
                continue

            # Inferencia del modelo
            result = translator.process_frame(frame)

            if not connected:
                break

            # =================================================
            # ENVIAR PREDICCIÓN Y LETRA CONFIRMADA
            # =================================================
            try:
                await websocket.send_json({
                    "type": "prediction",
                    **result,
                    "word": translator.word,
                })

                if result.get("confirmed") and connected:
                    await websocket.send_json({
                        "type": "word",
                        "word": translator.word,
                    })

            except (WebSocketDisconnect, RuntimeError, ConnectionError, OSError):
                connected = False
                break
            except Exception as error:
                connected = False
                print(f"[TRANSLATOR] Error enviando datos: {repr(error)}")
                break

    finally:
        connected = False
        print("[TRANSLATOR] Sesión del WebSocket finalizada.")