import numpy as np
from faster_whisper import WhisperModel


class SpeechRecognizer:

    def __init__(
        self,
        language: str = "es",
        num_threads: int = 4,
    ):

        self.language = language

        print("=" * 40)
        print("Cargando Faster-Whisper")
        print("Modelo: Large-v3 Turbo")
        print("Idioma:", language)
        print("CPU / INT8")
        print("=" * 40)

        self.model = WhisperModel(
            "h2oai/faster-whisper-large-v3-turbo",
            device="cpu",
            compute_type="int8",
            cpu_threads=num_threads,
            num_workers=1,
        )

        print("[STT] Whisper cargado")

    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int = 16000,
    ) -> str:

        if audio is None or len(audio) == 0:
            return ""

        audio = np.asarray(
            audio,
            dtype=np.float32
        )

        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        if sample_rate != 16000:
            raise ValueError(
                "El audio debe estar a 16000 Hz"
            )

        segments, _ = self.model.transcribe(
            audio,
            language=self.language,
            task="transcribe",
            beam_size=1,
            best_of=1,
            temperature=0,
            condition_on_previous_text=False,
        )

        parts = []

        for segment in segments:

            text = segment.text.strip()

            if text:
                parts.append(text)

        return " ".join(parts).strip()