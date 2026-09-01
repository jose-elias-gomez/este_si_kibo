import io
import os
import numpy as np
from dotenv import load_dotenv
from groq import Groq
from scipy.io.wavfile import write

load_dotenv()

class SpeechRecognizer:
    def __init__(
        self,
        language: str = "es",
        model: str = "whisper-large-v3",
    ):
        self.language = language
        self.model = model

        api_key = os.getenv("GROQ_API_KEY_STT")
        if not api_key:
            raise ValueError("[STT Error] No se encontró GROQ_API_KEY en el archivo .env")

        self.client = Groq(api_key=api_key)
        print(f"[STT] Groq Whisper Cloud inicializado ({self.model})")

    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int = 16000,
    ) -> str:
        """Transcribe un array de NumPy conteniendo muestras de audio."""
        if audio is None or len(audio) == 0:
            return ""

        audio = np.asarray(audio, dtype=np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        # Convertir float a int16 para formato WAV
        audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)

        byte_io = io.BytesIO()
        write(byte_io, sample_rate, audio_int16)
        byte_io.seek(0)
        byte_io.name = "audio.wav"

        try:
            response = self.client.audio.transcriptions.create(
                file=(byte_io.name, byte_io.read()),
                model=self.model,
                language=self.language,
                temperature=0.0,
            )
            return response.text.strip()
        except Exception as e:
            print(f"[STT Error] Error al comunicarse con Groq: {e}")
            return ""

    def transcribe_bytes(self, file_bytes: bytes, filename: str = "audio.wav") -> str:
        """Transcribe directamente bytes de audio (para endpoints FastAPI / UploadFile)."""
        if not file_bytes:
            return ""

        try:
            response = self.client.audio.transcriptions.create(
                file=(filename, file_bytes),
                model=self.model,
                language=self.language,
                temperature=0.0,
            )
            return response.text.strip()
        except Exception as e:
            print(f"[STT Error] Error al transcribir archivo: {e}")
            return ""