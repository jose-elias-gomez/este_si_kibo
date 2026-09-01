import traceback
import uvicorn
from dotenv import load_dotenv

# Cargar variables de entorno al iniciar la aplicación (.env)
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from services.wifi.wifi_base import WifiError
from services.wifi.wifi_endpoint import router as wifi_router
from services.tts.tts_endpoint import router as tts_router
from transports.websocket.server import router as websocket_router
from fastapi.middleware.cors import CORSMiddleware
from services.joystick.service import JoystickService


from routers.assistant import (
    router as assistant_router,
    load_assistant,
)
from routers.translator import (
    router as translator_router,
)

app = FastAPI(
    title="Web server",
    version="1.0.0",
)

joystick_service = JoystickService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:25566",
        "http://localhost:25566",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Transcription",
        "X-Reply-Text",
    ],
)

@app.on_event("startup")
def startup():
    load_assistant()
    joystick_service.start()

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
def wifi_error_handler(request: Request, exc: WifiError):
    return JSONResponse(
        status_code=500,
        content={
            "message": exc.message,
            "detail": exc.detail,
        },
    )

app.mount(
    "",
    StaticFiles(directory="../frontend", html=True),
    name="frontend",
)

def start_webserver(
    host: str = "0.0.0.0",
    port: int = 25566,
):
    uvicorn.run(
        "web_server:app",
        host=host,
        port=port,
        reload=False,
    )

if __name__ == "__main__":
    start_webserver()