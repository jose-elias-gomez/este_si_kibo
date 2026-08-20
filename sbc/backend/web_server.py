import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from wifi.wifi_base import WifiError
from wifi.wifi_endpoint import router as wifi_router
from tts.tts_endpoint import router as tts_router

app = FastAPI(
    title="Web server",
    description="API para listar, conectar y desconectar redes WiFi en Linux y Windows, y reproducir mensajes por voz (TTS).",
    version="1.0.0",
)

app.include_router(wifi_router)
app.include_router(tts_router)

# 3. Exception handlers globales
@app.exception_handler(WifiError)
def wifi_error_handler(exc: WifiError):
    return JSONResponse(
        status_code=500,
        content={"message": exc.message, "detail": exc.detail},
    )

# 4. Punto de entrada
def start_webserver():
    uvicorn.run("web_server:app", host="127.0.0.1", port=8000, reload=True)
