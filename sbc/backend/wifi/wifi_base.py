from __future__ import annotations

import subprocess
from abc import ABC, abstractmethod
from typing import Optional

class BaseWifiBackend(ABC):
    @abstractmethod
    def list_networks(self) -> list[dict]:
        ...

    @abstractmethod
    def connect(self, ssid: str, password: Optional[str] = None, hidden: bool = False) -> dict:
        ...

    @abstractmethod
    def disconnect(self) -> dict:
        ...

    @abstractmethod
    def current_connection(self) -> Optional[str]:
        ...

class WifiError(Exception):
    def __init__(self, message: str, detail: Optional[str] = None):
        self.message = message
        self.detail = detail
        super().__init__(message)

def _run(cmd: list[str], timeout: int = 20) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as e:
        raise WifiError(
            f"No se encontró el comando '{cmd[0]}'. ¿Está instalado y en el PATH?",
            detail=str(e),
        )
    except subprocess.TimeoutExpired as e:
        raise WifiError(f"El comando '{' '.join(cmd)}' superó el tiempo de espera.", detail=str(e))