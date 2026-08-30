import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

SYSTEM_PROMPT = (
    "Sos un asistente de voz que responde en español rioplatense con acento argentino, "
    "de forma breve, clara y natural, como si hablaras en voz alta. "
    "Evitá listas, markdown o respuestas largas. "
    "Respondé normalmente en 1 a 3 oraciones."
)


class VoiceAssistantLLM:

    def __init__(
        self,
        model_path: str = None,  # Mantenido por compatibilidad
        model: str = "openai/gpt-oss-20b",  # Modelo activo y ultra rápido de Groq
        n_ctx: int = 2048,
        n_threads: int = 4,
        **kwargs  # Previene errores si se envían parámetros obsoletos
    ):
        # Busca primero la clave específica o usa la clave por defecto de Groq
        api_key = os.getenv("GROQ_API_KEY_LLM") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("[LLM Error] No se encontró GROQ_API_KEY_LLM ni GROQ_API_KEY en el archivo .env")

        self.client = Groq(api_key=api_key)
        self.model = model

        self.history = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            }
        ]

        print(f"[LLM] Groq Cloud cargado ({self.model})")

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
                messages=self.history,
                model=self.model,
                max_tokens=max_tokens,
                temperature=0.6,
            )

            reply = output.choices[0].message.content.strip()
        except Exception as e:
            print(f"[LLM Error] Fallo al generar respuesta en Groq: {e}")
            reply = "Disculpa, tuve un problema al procesar tu respuesta."

        self.history.append(
            {
                "role": "assistant",
                "content": reply,
            }
        )

        # Recorte de historial
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