import inspect
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.staticfiles import StaticFiles

from kibo.config import API_ROUTE
from kibo.services.assistant import AssistantService
from kibo.services.groq.service import GroqClient
from kibo.services.joystick import JoystickService
from kibo.services.llm import LLMService
from kibo.services.stt import STTService
from kibo.services.system_options import SystemOptionsService
from kibo.services.tts import TTSService
from kibo.services.wifi import WifiService
from kibo import __webserverstartup__ as webserver
from kibo.transports.websocket.server import Router as WebSocketRouter

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(fastapi: FastAPI):
    logger.info("Starting Kibo")

    GroqClient.start(fastapi)
    SystemOptionsService.start()
    TTSService.start(fastapi)
    JoystickService.start(fastapi)
    LLMService.start(fastapi)
    STTService.start(fastapi)
    AssistantService.start(fastapi)
    WifiService.register(fastapi)

    fastapi.include_router(WebSocketRouter, prefix=API_ROUTE)
    fastapi.mount("/", StaticFiles(directory="../../frontend", html=True), "frontend")

    yield

    logger.info("Stopping Kibo")
    for shutdown_task in fastapi.router.on_shutdown:
        res = shutdown_task()
        if inspect.isawaitable(res):
            await res

if __name__ == '__main__':
    webserver.start("0.0.0.0", 25566, lifespan)
