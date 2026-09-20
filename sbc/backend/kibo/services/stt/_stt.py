import io
import logging

import numpy as np
from scipy.io.wavfile import write

from kibo.services.groq.service import GroqClient

logger = logging.getLogger("[STT]")

# RMS por debajo del cual consideramos que el buffer es silencio/ruido de fondo.
DEFAULT_SILENCE_RMS = 0.005

# Un WAV/WebM valido con voz real nunca pesa tan poco.
MIN_AUDIO_BYTES = 1024


class SpeechRecognizer:
    """Wrapper sobre Groq Whisper que reutiliza el cliente Groq compartido (singleton)."""

    def __init__(
        self,
        language: str = "es",
        model: str = "whisper-large-v3-turbo",
        silence_rms: float = DEFAULT_SILENCE_RMS,
    ):
        """Inicializa el reconocedor a partir del GroqClient ya existente.

        Args:
            language (str): Codigo ISO del idioma esperado.
            model (str): Modelo Whisper a utilizar.
            silence_rms (float): Umbral de energia para descartar audio vacio.
        """
        self.language = language
        self.model = model
        self.silence_rms = silence_rms

        # Mismo cliente (y misma API key) que usa el resto de los servicios Groq;
        # el ciclo de vida (close) lo maneja GroqClient, no este wrapper.
        client = GroqClient.get_instance()
        self._client = client.sync_client
        self._aclient = client.async_client

        logger.info("STT listo | idioma=%s modelo=%s", self.language, self.model)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _prepare(self, audio: np.ndarray, sample_rate: int) -> bytes | None:
        """Normaliza un array de NumPy y lo empaqueta como WAV en memoria.

        Args:
            audio (np.ndarray): Muestras de audio float o int16.
            sample_rate (int): Frecuencia de muestreo en Hz.

        Returns:
            bytes | None: WAV listo para enviar, o None si el audio es silencio.
        """
        if audio is None or len(audio) == 0:
            return None

        audio = np.asarray(audio, dtype=np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        # Gate de energia: evita pagar latencia y tokens por buffers vacios.
        rms = float(np.sqrt(np.mean(np.square(audio))))
        if rms < self.silence_rms:
            logger.debug("Audio descartado por silencio (rms=%.5f)", rms)
            return None

        audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)

        byte_io = io.BytesIO()
        write(byte_io, sample_rate, audio_int16)
        return byte_io.getvalue()

    @staticmethod
    def _extract(response) -> str:
        """Lee el texto de la respuesta tolerando campos vacios."""
        return (getattr(response, "text", "") or "").strip()

    def _request_kwargs(self, filename: str, payload: bytes) -> dict:
        """Arma los parametros comunes de la llamada a Groq."""
        return {
            "file": (filename, payload),
            "model": self.model,
            "language": self.language,
            "temperature": 0.0,
            # Pedimos solo texto: menos bytes de vuelta y parsing mas barato.
            "response_format": "text",
        }

    # ------------------------------------------------------------------
    # API sincronica
    # ------------------------------------------------------------------

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> str:
        """Transcribe un array de NumPy con muestras de audio."""
        payload = self._prepare(audio, sample_rate)
        if payload is None:
            return ""
        return self.transcribe_bytes(payload, "audio.wav")

    def transcribe_bytes(self, file_bytes: bytes, filename: str = "audio.wav") -> str:
        """Transcribe bytes de audio ya codificados."""
        if self._client is None or not file_bytes or len(file_bytes) < MIN_AUDIO_BYTES:
            return ""

        try:
            response = self._client.audio.transcriptions.create(
                **self._request_kwargs(filename, file_bytes)
            )
        except Exception:
            logger.exception("Fallo la transcripcion de '%s'", filename)
            return ""

        if isinstance(response, str):
            return response.strip()
        return self._extract(response)

    # ------------------------------------------------------------------
    # API asincronica (la que deberia usar FastAPI)
    # ------------------------------------------------------------------

    async def atranscribe(self, audio: np.ndarray, sample_rate: int = 16000) -> str:
        """Version async de :meth:`transcribe`."""
        payload = self._prepare(audio, sample_rate)
        if payload is None:
            return ""
        return await self.atranscribe_bytes(payload, "audio.wav")

    async def atranscribe_bytes(
        self,
        file_bytes: bytes,
        filename: str = "audio.wav",
    ) -> str:
        """Version async de :meth:`transcribe_bytes`.

        No bloquea el event loop, por lo que varias peticiones pueden
        transcribirse en paralelo.
        """
        if self._aclient is None or not file_bytes or len(file_bytes) < MIN_AUDIO_BYTES:
            return ""

        try:
            response = await self._aclient.audio.transcriptions.create(
                **self._request_kwargs(filename, file_bytes)
            )
        except Exception:
            logger.exception("Fallo la transcripcion async de '%s'", filename)
            return ""

        if isinstance(response, str):
            return response.strip()
        return self._extract(response)
