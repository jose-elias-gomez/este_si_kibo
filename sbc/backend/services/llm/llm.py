import logging
import os
from typing import Dict, List, Any, cast

from dotenv import load_dotenv
from groq import Groq
from groq.types.chat import ChatCompletionMessageParam

load_dotenv()

SYSTEM_PROMPT = (
    "Sos Kibo, un robot pingüino asistente creado en 2026 por Facundo Benassi y Agustín Frate en el secundario Juan XXIII D76. "
    "Respondé siempre en argentino, de forma breve, clara y natural (máximo 1 a 3 oraciones). "
    "No utilices formato markdown, listas ni textos largos. "
)

logger = logging.getLogger("[LLM]")

class VoiceAssistantLLM:

    def __init__(
        self,
        model: str = "openai/gpt-oss-20b",
    ):
        api_key = os.getenv("GROQ_API_KEY_LLM") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("[LLM ERROR] Can't found GROQ_API_KEY_LLM and GROQ_API_KEY in .env file")

        self.client = Groq(api_key=api_key)
        self.model = model

        self.history: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            }
        ]

    def ask(
        self,
        user_text: str,
        max_tokens: int = 150,
    ) -> str:

        if not user_text or not user_text.strip():
            return ""

        self.history.append(
            {
                "role": "user",
                "content": user_text.strip(),
            }
        )

        try:
            output = self.client.chat.completions.create(
                messages=cast(List[ChatCompletionMessageParam], self.history),
                model=self.model,
                max_tokens=max_tokens,
                temperature=0.6,
            )
            content = output.choices[0].message.content
            reply = content.strip() if content else "No tengo respuesta para eso."
        except Exception as e:
            logger.error("Error on generate response from Groq %s", e)
            reply = "Disculpa, tuve un problema al procesar tu respuesta."

        self.history.append(
            {
                "role": "assistant",
                "content": reply,
            }
        )

        if len(self.history) > 21:
            self.history = (
                [self.history[0]]
                + self.history[-20:]
            )

        return reply

    def reset(self):
        self.history = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            }
        ]
