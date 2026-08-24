from pathlib import Path

import cv2
import numpy as np

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.translator.translator import SignTranslator


router = APIRouter(
    prefix="/translator",
    tags=["Translator"],
)


# ============================================================
# RUTAS
# ============================================================

BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)

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

        await websocket.send_json({
            "type": "error",
            "message": (
                "El traductor todavía "
                "no está cargado."
            ),
        })

        await websocket.close()

        return

    translator.reset()

    try:

        while True:

            # ----------------------------------------------
            # RECIBIR FRAME
            # ----------------------------------------------

            data = await websocket.receive_bytes()

            # ----------------------------------------------
            # JPEG → NUMPY
            # ----------------------------------------------

            image_array = np.frombuffer(
                data,
                dtype=np.uint8,
            )

            frame = cv2.imdecode(
                image_array,
                cv2.IMREAD_COLOR,
            )

            if frame is None:

                await websocket.send_json({
                    "type": "error",
                    "message": (
                        "No se pudo decodificar "
                        "el frame."
                    ),
                })

                continue

            # ----------------------------------------------
            # PROCESAR
            # ----------------------------------------------

            result = translator.process_frame(
                frame
            )

            # ----------------------------------------------
            # RESPUESTA
            # ----------------------------------------------

            await websocket.send_json({
                "type": "prediction",
                **result,
            })

    except WebSocketDisconnect:

        print(
            "[TRANSLATOR] WebSocket desconectado."
        )

    except Exception as error:

        print(
            "[TRANSLATOR] Error:",
            repr(error),
        )

        try:

            await websocket.send_json({
                "type": "error",
                "message": str(error),
            })

        except Exception:
            pass