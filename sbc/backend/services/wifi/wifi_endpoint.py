import platform
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.wifi.wifi_base import BaseWifiBackend, WifiError
from services.wifi.wifi_linux_backend import LinuxWifiBackend
from services.wifi.wifi_windows_backend import WindowsWifiBackend

router = APIRouter(prefix="/networks", tags=["WiFi"])


class ConnectRequest(BaseModel):
    ssid: str = Field(
        ..., min_length=1, description="Network name (SSID) to connect to."
    )
    password: Optional[str] = Field(
        None, description="Network password. Omit for open networks."
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
    raise WifiError(f"Unsupported operating system: {system}")


def _handle_wifi_error(e: WifiError):
    raise HTTPException(
        status_code=500, detail={"message": e.message, "detail": e.detail}
    )


@router.get(
    "", response_model=list[NetworkInfo], summary="List available WiFi networks"
)
def list_networks():
    backend = get_backend()
    try:
        return backend.list_networks()
    except WifiError as e:
        _handle_wifi_error(e)


@router.get("/current", summary="Get currently connected WiFi network")
def get_current_network():
    backend = get_backend()
    try:
        ssid = backend.current_connection()
    except WifiError as e:
        _handle_wifi_error(e)
    return {"ssid": ssid, "connected": ssid is not None}


@router.post(
    "/connect", response_model=ConnectResponse, summary="Connect to a network"
)
def connect_network(payload: ConnectRequest):
    backend = get_backend()
    try:
        result = backend.connect(payload.ssid, payload.password)
    except WifiError as e:
        _handle_wifi_error(e)
    return result


@router.post(
    "/disconnect",
    response_model=DisconnectResponse,
    summary="Disconnect network",
)
def disconnect_network():
    backend = get_backend()
    try:
        result = backend.disconnect()
    except WifiError as e:
        _handle_wifi_error(e)
    return result
