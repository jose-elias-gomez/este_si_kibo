import asyncio

import numpy as np
from fastapi import FastAPI

from kibo.config import API_ROUTE
from kibo.services.translator._translator import SignTranslator
from kibo.services.translator._translator_endpoint import Router

translator: SignTranslator = SignTranslator()


class TranslatorService:

    @staticmethod
    def start(webserver: FastAPI):
        webserver.include_router(Router, prefix=API_ROUTE)

    @staticmethod
    def process_frame(frame: np.ndarray) -> dict:
        return translator.process_frame(frame)

    @staticmethod
    def process_image_bytes(image_bytes: bytes) -> dict | None:
        return translator.process_image_bytes(image_bytes)

    @staticmethod
    async def aprocess_image_bytes(image_bytes: bytes) -> dict | None:
        # MediaPipe + scikit-learn are CPU-bound and blocking, so run them
        # in a worker thread to keep the event loop free.
        return await asyncio.to_thread(translator.process_image_bytes, image_bytes)

    @staticmethod
    def get_word() -> str:
        return translator.get_word()

    @staticmethod
    def add_space() -> None:
        translator.add_space()

    @staticmethod
    def delete_last() -> None:
        translator.delete_last()

    @staticmethod
    def clear_word() -> None:
        translator.clear_word()

    @staticmethod
    def reset() -> None:
        translator.reset()

    @staticmethod
    def close() -> None:
        translator.close()
