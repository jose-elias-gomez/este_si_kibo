import json
from pathlib import Path

import cv2
import numpy as np

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from services.translator.translator import SignTranslator


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

    translator = SignTranslator(
        str(MODEL_PATH)
    )


load_translator()


# ============================================================
# WEBSOCKET
# ============================================================

@router.websocket("/ws")
async def translator_ws(
    websocket: WebSocket,
):
    await websocket.accept()

    print(
        "[TRANSLATOR] WebSocket conectado."
    )

    if translator is None:
        try:
            await websocket.send_json({
                "type": "error",
                "message": (
                    "El traductor todavía "
                    "no está cargado."
                ),
            })

            await websocket.close()

        except Exception:
            pass

        return

    # --------------------------------------------------------
    # Estado nuevo para esta conexión
    # --------------------------------------------------------

    translator.reset()

    connected = True

    try:

        while connected:

            # =================================================
            # RECIBIR
            # =================================================

            try:
                data = await websocket.receive()

            except WebSocketDisconnect:
                connected = False

                print(
                    "[TRANSLATOR] "
                    "WebSocket desconectado."
                )

                break

            except RuntimeError as error:
                connected = False

                print(
                    "[TRANSLATOR] "
                    "WebSocket cerrado:",
                    repr(error),
                )

                break

            # -------------------------------------------------
            # FastAPI puede indicar explícitamente disconnect
            # -------------------------------------------------

            if data.get("type") == "websocket.disconnect":
                connected = False

                print(
                    "[TRANSLATOR] "
                    "WebSocket desconectado."
                )

                break

            # =================================================
            # COMMANDS FROM FRONTEND
            # =================================================

            if "text" in data:

                try:
                    command = json.loads(
                        data["text"]
                    )

                    command_type = command.get(
                        "command"
                    )

                    if command_type == "SPACE":

                        translator.add_space()

                    elif command_type == "DELETE":

                        translator.delete_last()

                    elif command_type == "CLEAR":

                        translator.clear_word()

                    else:
                        continue

                    # -----------------------------------------
                    # Solo enviar si seguimos conectados
                    # -----------------------------------------

                    if connected:

                        await websocket.send_json({
                            "type": "word",
                            "word": translator.word,
                        })

                except WebSocketDisconnect:
                    connected = False

                    print(
                        "[TRANSLATOR] "
                        "WebSocket desconectado "
                        "durante comando."
                    )

                    break

                except RuntimeError as error:
                    connected = False

                    print(
                        "[TRANSLATOR] "
                        "WebSocket cerrado "
                        "durante comando:",
                        repr(error),
                    )

                    break

                except Exception as error:

                    print(
                        "[TRANSLATOR] "
                        "Command error:",
                        repr(error),
                    )

                continue

            # =================================================
            # IMAGE FRAME
            # =================================================

            if "bytes" not in data:
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

                if not connected:
                    break

                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": (
                            "No se pudo decodificar "
                            "el frame."
                        ),
                    })

                except (
                    WebSocketDisconnect,
                    RuntimeError,
                ) as error:

                    connected = False

                    print(
                        "[TRANSLATOR] "
                        "WebSocket cerrado "
                        "enviando error:",
                        repr(error),
                    )

                    break

                continue

            # =================================================
            # PROCESAR TRADUCCIÓN
            # =================================================

            result = translator.process_frame(
                frame
            )

            # =================================================
            # ENVIAR PREDICCIÓN
            # =================================================

            if not connected:
                break

            try:

                await websocket.send_json({
                    "type": "prediction",
                    **result,
                    "word": translator.word,
                })

            except WebSocketDisconnect:
                connected = False

                print(
                    "[TRANSLATOR] "
                    "WebSocket desconectado "
                    "enviando predicción."
                )

                break

            except RuntimeError as error:
                connected = False

                print(
                    "[TRANSLATOR] "
                    "WebSocket cerrado "
                    "enviando predicción:",
                    repr(error),
                )

                break

            # =================================================
            # LETRA CONFIRMADA
            # =================================================

            if result.get("confirmed"):

                if not connected:
                    break

                try:

                    await websocket.send_json({
                        "type": "word",
                        "word": translator.word,
                    })

                except WebSocketDisconnect:
                    connected = False

                    print(
                        "[TRANSLATOR] "
                        "WebSocket desconectado "
                        "enviando palabra."
                    )

                    break

                except RuntimeError as error:
                    connected = False

                    print(
                        "[TRANSLATOR] "
                        "WebSocket cerrado "
                        "enviando palabra:",
                        repr(error),
                    )

                    break

    # ========================================================
    # DESCONEXIÓN NORMAL
    # ========================================================

    except WebSocketDisconnect:

        print(
            "[TRANSLATOR] "
            "WebSocket desconectado."
        )

    # ========================================================
    # ERROR INESPERADO
    # ========================================================

    except Exception as error:

        print(
            "[TRANSLATOR] Error:",
            repr(error),
        )

        # IMPORTANTE:
        # NO intentar websocket.send_json() aquí.
        #
        # Si llegamos a este bloque por un problema de socket,
        # el socket puede estar ya cerrado.
        #
        # Intentar enviar otro mensaje es precisamente lo que
        # provoca los:
        #
        # socket.send() raised exception.

    finally:

        connected = False

        print(
            "[TRANSLATOR] "
            "Sesión del WebSocket finalizada."
        )
