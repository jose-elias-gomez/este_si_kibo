import threading
from fastapi import FastAPI
from groq import AsyncGroq, Groq
from kibo.config import GROQ_API_KEY

class GroqClient:

    _instance: "GroqClient | None" = None
    _new_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._new_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self, timeout: float = 30.0, max_retries: int = 2):
        if getattr(self, "_initialized", False):
            return

        self.sync = Groq(api_key=GROQ_API_KEY, timeout=timeout, max_retries=max_retries)
        self.async_ = AsyncGroq(api_key=GROQ_API_KEY, timeout=timeout, max_retries=max_retries)

        self._initialized = True

    async def stop(self):
        try:
            self.sync.close()
            await self.async_.close()
        except Exception:
            pass

    @property
    def sync_client(self) -> Groq | None:
        return self.sync

    @property
    def async_client(self) -> AsyncGroq | None:
        return self.async_

    @classmethod
    def _stop(cls):
        if cls._instance is not None:
            cls._instance.stop()

    @classmethod
    def start(cls, webserver: FastAPI):
        webserver.router.on_shutdown.append(GroqClient._stop)

    @classmethod
    def get_instance(cls) -> "GroqClient":
        if cls._instance is None:
            cls()
        assert cls._instance is not None
        return cls._instance