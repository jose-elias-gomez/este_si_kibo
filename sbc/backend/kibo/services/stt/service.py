from fastapi import FastAPI

from kibo.config import API_ROUTE
from kibo.services.stt._stt import SpeechRecognizer
from kibo.services.stt._stt_endpoint import Router

recognizer: SpeechRecognizer = SpeechRecognizer()

class STTService:

    @staticmethod
    def start(webserver: FastAPI):
        webserver.include_router(Router, prefix=API_ROUTE)

    @staticmethod
    def transcribe(file_bytes: bytes, filename: str = "audio.wav") -> str:
        return recognizer.transcribe_bytes(file_bytes, filename)

    @staticmethod
    async def atranscribe(file_bytes: bytes, filename: str = "audio.wav") -> str:
        return await recognizer.atranscribe_bytes(file_bytes, filename)
