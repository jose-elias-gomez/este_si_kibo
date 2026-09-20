from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

Router = APIRouter(prefix="/networks", tags=["WiFi"])

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


@Router.get("", response_model=list[NetworkInfo], summary="List available WiFi networks")
def list_networks():
    from kibo.services.wifi import WifiService
    backend = WifiService.get_backend()
    return backend.list_networks()


@Router.get("/current", summary="Get currently connected WiFi network")
def get_current_network():
    from kibo.services.wifi import WifiService
    backend = WifiService.get_backend()
    ssid = backend.current_connection()
    return {"ssid": ssid, "connected": ssid is not None}


@Router.post("/connect", response_model=ConnectResponse, summary="Connect to a network")
def connect_network(payload: ConnectRequest):
    from kibo.services.wifi import WifiService
    backend = WifiService.get_backend()
    return backend.connect(payload.ssid, payload.password)


@Router.post("/disconnect", response_model=DisconnectResponse, summary="Disconnect network")
def disconnect_network():
    from kibo.services.wifi import WifiService
    backend = WifiService.get_backend()
    return backend.disconnect()