import uvicorn

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from services.wifi.wifi_base import WifiError
from services.wifi.wifi_endpoint import router as wifi_router
from services.tts.tts_endpoint import router as tts_router

from transports.websocket.server import router as websocket_router
from fastapi.middleware.cors import CORSMiddleware


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


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
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


app.include_router(assistant_router)
app.include_router(wifi_router)
app.include_router(tts_router)
app.include_router(websocket_router)
app.include_router(
    translator_router
)


@app.exception_handler(WifiError)
def wifi_error_handler(exc: WifiError):

    return JSONResponse(
        status_code=500,
        content={
            "message": exc.message,
            "detail": exc.detail,
        },
    )


def start_webserver(
    host: str,
    port: int,
):

    uvicorn.run(
        "web_server:app",
        host=host,
        port=port,
        reload=True,
    )