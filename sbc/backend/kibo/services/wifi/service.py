import platform

from fastapi import FastAPI
from starlette.responses import JSONResponse

from kibo.config import API_ROUTE
from kibo.services.wifi._wifi_endpoint import Router
from kibo.services.wifi.wifi_base import BaseWifiBackend, WifiError

backend: BaseWifiBackend | None = None
system = platform.system()
if system == "Linux":
    from kibo.services.wifi._wifi_linux_backend import LinuxWifiBackend
    backend = LinuxWifiBackend()
if system == "Windows":
    from kibo.services.wifi._wifi_windows_backend import WindowsWifiBackend
    backend = WindowsWifiBackend()
else:
    raise WifiError(f"Unsupported operating system: {system}")

class WifiService:

    @staticmethod
    def register(webserver: FastAPI):
        webserver.include_router(Router, prefix=API_ROUTE)

        @webserver.exception_handler(WifiError)
        def wifi_error_handler(exc: WifiError):
            return JSONResponse(
                status_code=500,
                content={"message": exc.message, "detail": exc.detail},
            )

    @staticmethod
    def get_backend():
        return backend