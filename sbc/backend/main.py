import platform
from typing import Optional
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from wifi.wifi_base import WifiError, BaseWifiBackend
from wifi.wifi_linux_backend import LinuxWifiBackend
from wifi.wifi_windows_backend import WindowsWifiBackend

# 1. Instancia de FastAPI
app = FastAPI(
    title="WiFi Manager API",
    description="API para listar, conectar y desconectar redes WiFi en Linux y Windows.",
    version="1.0.0",
)

# 2. Modelos Pydantic (deben estar declarados antes de usarlos en las rutas)
class ConnectRequest(BaseModel):
    ssid: str = Field(..., min_length=1, description="Nombre (SSID) de la red a la que conectarse")
    password: Optional[str] = Field(
        None, description="Contraseña de la red. Omitir para redes abiertas."
    )

class NetworkInfo(BaseModel):
    ssid: str
    signal: Optional[int] = None
    security: Optional[str] = None
    in_use: bool = False

class ConnectResponse(BaseModel):
    ssid: str
    status: str
    previous: Optional[str] = None

class DisconnectResponse(BaseModel):
    status: str
    previous: Optional[str] = None

def get_backend() -> BaseWifiBackend:
    system = platform.system()
    if system == "Linux":
        return LinuxWifiBackend()
    if system == "Windows":
        return WindowsWifiBackend()
    raise WifiError(f"Sistema operativo no soportado: {system}")

# 3. Helpers y Exception Handlers
def _handle_wifi_error(e: WifiError):
    raise HTTPException(status_code=500, detail={"message": e.message, "detail": e.detail})

@app.exception_handler(WifiError)
def wifi_error_handler(request, exc: WifiError):
    return JSONResponse(
        status_code=500,
        content={"message": exc.message, "detail": exc.detail},
    )

# 4. Endpoints
@app.get("/networks", response_model=list[NetworkInfo], summary="Listar redes WiFi disponibles")
def list_networks():
    """Escanea y devuelve las redes WiFi visibles, ordenadas por intensidad de señal."""
    backend = get_backend()
    try:
        return backend.list_networks()
    except WifiError as e:
        _handle_wifi_error(e)

@app.get("/networks/current", summary="Obtener la red WiFi actualmente conectada")
def get_current_network():
    backend = get_backend()
    try:
        ssid = backend.current_connection()
    except WifiError as e:
        _handle_wifi_error(e)
    return {"ssid": ssid, "connected": ssid is not None}

@app.post("/networks/connect", response_model=ConnectResponse, summary="Conectar a una red")
def connect_network(payload: ConnectRequest):
    backend = get_backend()
    try:
        result = backend.connect(payload.ssid, payload.password)
    except WifiError as e:
        _handle_wifi_error(e)
    return result

@app.post("/networks/disconnect", response_model=DisconnectResponse, summary="Desconectar red")
def disconnect_network():
    backend = get_backend()
    try:
        result = backend.disconnect()
    except WifiError as e:
        _handle_wifi_error(e)
    return result

# 5. Punto de entrada (Siempre al final)
def start():
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    start()