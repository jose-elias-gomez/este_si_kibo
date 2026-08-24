from pathlib import Path
from llama_cpp import Llama


SYSTEM_PROMPT = (
    "Sos un asistente de voz que responde en español rioplatense con acento argentino, "
    "de forma breve, clara y natural, como si hablaras en voz alta. "
    "Evitá listas, markdown o respuestas largas. "
    "Respondé normalmente en 1 a 3 oraciones."
)


class VoiceAssistantLLM:

    def __init__(
        self,
        model_path: str,
        n_ctx: int = 2048,
        n_threads: int = 4,
    ):

        model_path = Path(model_path)

        if not model_path.exists():
            raise FileNotFoundError(
                f"No existe el modelo LLM: {model_path}"
            )

        print(f"[LLM] Cargando: {model_path}")

        self.llm = Llama(
            model_path=str(model_path),
            n_ctx=n_ctx,
            n_threads=n_threads,
            verbose=False,
        )

        self.history = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            }
        ]

        print("[LLM] Modelo cargado")

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

        output = self.llm.create_chat_completion(
            messages=self.history,
            max_tokens=max_tokens,
            temperature=0.6,
        )

        reply = (
            output["choices"][0]["message"]["content"]
            .strip()
        )

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