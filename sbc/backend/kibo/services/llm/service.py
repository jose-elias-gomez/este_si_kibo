from fastapi import FastAPI

from kibo.config import API_ROUTE
from kibo.services.llm._llm import LargeLanguageModel
from kibo.services.llm._llm_endpoint import Router

llm: LargeLanguageModel = LargeLanguageModel()

class LLMService:

    @staticmethod
    def start(webserver: FastAPI):
        webserver.include_router(Router, prefix=API_ROUTE)

    @staticmethod
    def ask(text: str) -> str:
        return llm.ask(text)