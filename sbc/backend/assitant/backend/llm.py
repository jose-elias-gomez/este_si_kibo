"""
LLM local usando Qwen2.5-0.5B-Instruct en formato GGUF (cuantizado),
cargado con llama-cpp-python. Es liviano y corre bien en CPU (Raspberry Pi).

Descargá el modelo GGUF, por ejemplo:
  qwen2.5-0.5b-instruct-q4_k_m.gguf
desde Hugging Face (repo: Qwen/Qwen2.5-0.5B-Instruct-GGUF)
y colocalo en models/llm/
"""

from llama_cpp import Llama


SYSTEM_PROMPT = (
    "Sos un asistente de voz que responde en español rioplatense, "
    "de forma breve, clara y natural, como si hablaras en voz alta. "
    "Evitá listas, markdown o respuestas largas: máximo 2-3 oraciones, "
    "salvo que el usuario pida explícitamente más detalle."
)


class VoiceAssistantLLM:
    def __init__(self, model_path: str, n_ctx: int = 2048, n_threads: int = 4):
        self.llm = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_threads=n_threads,
            verbose=False,
        )
        self.history = [{"role": "system", "content": SYSTEM_PROMPT}]

    def ask(self, user_text: str, max_tokens: int = 200) -> str:
        self.history.append({"role": "user", "content": user_text})

        output = self.llm.create_chat_completion(
            messages=self.history,
            max_tokens=max_tokens,
            temperature=0.6,
        )
        reply = output["choices"][0]["message"]["content"].strip()

        self.history.append({"role": "assistant", "content": reply})
        # Evitar que el contexto crezca sin límite: nos quedamos con
        # el system prompt + últimos 10 turnos (20 mensajes)
        if len(self.history) > 21:
            self.history = [self.history[0]] + self.history[-20:]

        return reply

    def reset(self):
        self.history = [{"role": "system", "content": SYSTEM_PROMPT}]
