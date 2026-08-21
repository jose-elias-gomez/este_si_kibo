import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from services.wifi.wifi_base import WifiError
from services.wifi.wifi_endpoint import router as wifi_router
from services.tts.tts_endpoint import router as tts_router
from transports.websocket.server import router as websocket_router

app = FastAPI(
    title="Web server",
    version="1.0.0",
)

app.include_router(wifi_router)
app.include_router(tts_router)
app.include_router(websocket_router)

@app.exception_handler(WifiError)
def wifi_error_handler(exc: WifiError):
    return JSONResponse(
        status_code=500,
        content={"message": exc.message, "detail": exc.detail},
    )

def start_webserver(host: str, port: int):
    uvicorn.run("web_server:app", host=host, port=port, reload=True)
