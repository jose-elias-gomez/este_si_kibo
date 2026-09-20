from fastapi import APIRouter
from pydantic import BaseModel, Field

class AskRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)

class AskResponse(BaseModel):
    response: str

Router = APIRouter(prefix="/ask", tags=["TTS"])

@Router.post("")
def ask(request: AskRequest) -> AskResponse:
    from kibo.services.llm import LLMService
    return AskResponse(response=LLMService.ask(request.text))