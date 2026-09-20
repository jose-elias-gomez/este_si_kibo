from fastapi import FastAPI

from kibo.config import API_ROUTE
from kibo.services.tts._tts_thread import TTSThread
from kibo.services.tts._tts import TextToSpeech
from kibo.services.tts._tts_endpoint import Router

class TTSService:

    @staticmethod
    def start(webserver: FastAPI):
        TextToSpeech.get_instance() # Trick for load model
        TTSThread.get_instance().start()

        webserver.include_router(Router, prefix=API_ROUTE)
        webserver.router.on_shutdown.append(TTSService.shutdown)

    @staticmethod
    def stop_speaking():
        return TTSThread.get_instance().flush(stop_current=True)

    @staticmethod
    def shutdown():
        TTSThread.get_instance().stop()
        TextToSpeech.get_instance().shutdown()

    @staticmethod
    def get_pending_count():
        return TTSThread.get_instance().pending_count

    @staticmethod
    def wait_until_done():
        TTSThread.get_instance().wait_until_done()

    @staticmethod
    def push_message(message):
        return TTSThread.get_instance().push_message(message)