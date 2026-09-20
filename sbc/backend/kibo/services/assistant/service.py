import asyncio

from fastapi import FastAPI

from kibo.config import API_ROUTE
from kibo.services.assistant._assistant import AssistantRecorder
from kibo.services.assistant._assistant_endpoint import Router

recorder: AssistantRecorder = AssistantRecorder.get_instance()


class AssistantService:

    @staticmethod
    def start(webserver: FastAPI):
        webserver.include_router(Router, prefix=API_ROUTE)
        loop = asyncio.get_running_loop()
        AssistantRecorder.get_instance().set_loop(loop)

    @staticmethod
    def start_recording() -> bool:
        return recorder.start_recording()

    @staticmethod
    def stop_recording() -> bool:
        return recorder.stop_recording()
