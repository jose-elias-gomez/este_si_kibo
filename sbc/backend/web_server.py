from contextlib import asynccontextmanager
import uvicorn

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from services.wifi.wifi_base import WifiError
from services.wifi.wifi_endpoint import router as wifi_router
from services.tts.tts_endpoint import router as tts_router
from transports.websocket.server import router as websocket_router
from fastapi.middleware.cors import CORSMiddleware
from services.joystick.service import JoystickService


from routers.assistant import (
    router as assistant_router,
)
from routers.translator import (
    router as translator_router,
)

# Instancia del servicio de Joystick
joystick_service = JoystickService()

# Manejador del ciclo de vida de la app
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- AL ARRANCAR EL SERVIDOR ---
    print("[SERVER] Iniciando JoystickService...")
    joystick_service.start()
    
    yield
    
    # --- AL APAGAR EL SERVIDOR ---
    print("[SERVER] Deteniendo JoystickService...")
    joystick_service.stop()

app = FastAPI(
    title="Web server",
    version="1.0.0",
    lifespan=lifespan,
)

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

API_PREFIX = "/api"
app.include_router(assistant_router, prefix=API_PREFIX)
app.include_router(wifi_router, prefix=API_PREFIX)
app.include_router(tts_router, prefix=API_PREFIX)
app.include_router(websocket_router, prefix=API_PREFIX)
app.include_router(translator_router, prefix=API_PREFIX)

@app.get("/api/ping")
def ping():
    return "pong"

@app.exception_handler(WifiError)
def wifi_error_handler(exc: WifiError):
    return JSONResponse(
        status_code=500,
        content={
            "message": exc.message,
            "detail": exc.detail,
        },
    )

app.mount(
    "/",
    StaticFiles(directory="../frontend", html=True),
    name="frontend",
)

def start_webserver(
    host: str = "0.0.0.0",
    port: int = 25566,
):
    uvicorn.run(
        app,  # Pasamos el objeto app directamente para asegurar que reconozca el lifespan
        host=host,
        port=port,
        reload=False,
    )

if __name__ == "__main__":
    start_webserver()