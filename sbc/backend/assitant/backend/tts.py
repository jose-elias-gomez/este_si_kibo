"""
Text-to-Speech usando piper-tts directamente desde Python.

Compatible con piper-tts 1.7.0.
"""

import io
import wave
from pathlib import Path

from piper import PiperVoice


class SpeechSynthesizer:

    def __init__(self, model_path: str):
        self.model_path = Path(model_path)

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"No se encontró el modelo de voz en: {self.model_path}"
            )

        print(f"Cargando Piper: {self.model_path}")

        self.voice = PiperVoice.load(str(self.model_path))

        print("[OK] Piper cargado")

    def synthesize(self, text: str) -> bytes:
        """
        Genera audio WAV y devuelve los bytes.
        """

        if not text or not text.strip():
            raise ValueError("No se puede sintetizar texto vacío.")

        buffer = io.BytesIO()

        wav_file = wave.open(buffer, "wb")

        first_chunk = True

        try:
            for audio_chunk in self.voice.synthesize(text):

                if first_chunk:
                    wav_file.setframerate(audio_chunk.sample_rate)
                    wav_file.setsampwidth(audio_chunk.sample_width)
                    wav_file.setnchannels(audio_chunk.sample_channels)

                    first_chunk = False

                wav_file.writeframes(
                    audio_chunk.audio_int16_bytes
                )

        finally:
            wav_file.close()

        audio = buffer.getvalue()

        if not audio:
            raise RuntimeError(
                "Piper no generó ningún audio."
            )

        print(f"[TTS] Generados {len(audio)} bytes")

        return audio