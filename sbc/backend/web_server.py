from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from services.wifi.wifi_base import WifiError
from services.wifi.wifi_endpoint import router as wifi_router
from services.tts.tts_endpoint import router as tts_router
from transports.websocket.server import router as websocket_router
from services.joystick.service import JoystickService
from routers.assistant import (
    router as assistant_router,
    load_assistant,
)
from routers.translator import (
    router as translator_router,
)

# ============================================================
# JOYSTICK
# ============================================================
joystick_service = JoystickService()

# ============================================================
# CICLO DE VIDA
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ========================================================
    # ARRANQUE
    # ========================================================
    print()
    print("=" * 60)
    print("[SERVER] INICIANDO KIBO")
    print("=" * 60)

    # --------------------------------------------------------
    # JOYSTICK
    # --------------------------------------------------------
    print("[SERVER] Iniciando JoystickService...")
    joystick_service.start()

    # --------------------------------------------------------
    # ASISTENTE
    # --------------------------------------------------------
    print()
    print("[SERVER] Cargando asistente de voz...")

    # DESCOMENTAR PARA USAR

    # try:
    #    load_assistant()
    # except Exception as error:
    #    print()
    #    print("=" * 60)
    #    print("[SERVER] ERROR CARGANDO ASISTENTE")
    #    print("=" * 60)
    #    print(error)
    #    print("=" * 60)

    print()
    print()
    print("=" * 60)
    print("[SERVER] KIBO LISTO")
    print("=" * 60)
    print()

    yield

    # ========================================================
    # APAGADO
    # ========================================================
    print()
    print("=" * 60)
    print("[SERVER] APAGANDO KIBO")
    print("=" * 60)
    print("[SERVER] Deteniendo JoystickService...")
    joystick_service.stop()

# ============================================================
# FASTAPI
# ============================================================
app = FastAPI(
    title="Web server",
    version="1.0.0",
    lifespan=lifespan,
)

# ============================================================
# CORS
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Transcription",
        "X-Reply-Text",
    ],
)

# ============================================================
# API
# ============================================================
API_PREFIX = "/api"

app.include_router(
    assistant_router,
    prefix=API_PREFIX,
)
app.include_router(
    wifi_router,
    prefix=API_PREFIX,
)
app.include_router(
    tts_router,
    prefix=API_PREFIX,
)
app.include_router(
    websocket_router,
    prefix=API_PREFIX,
)
app.include_router(
    translator_router,
    prefix=API_PREFIX,
)

# ============================================================
# PING
# ============================================================
@app.get("/api/ping")
def ping():
    return "pong"

# ============================================================
# WIFI ERRORS
# ============================================================
@app.exception_handler(WifiError)
def wifi_error_handler(
    exc: WifiError,
):
    return JSONResponse(
        status_code=500,
        content={
            "message": exc.message,
            "detail": exc.detail,
        },
    )

# ============================================================
# FRONTEND
# ============================================================
app.mount(
    "/",
    StaticFiles(
        directory="../frontend",
        html=True,
    ),
    name="frontend",
)

# ============================================================
# SERVER
# ============================================================
def start_webserver(
    host: str = "0.0.0.0",
    port: int = 25566,
):
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
    )

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    start_webserver()