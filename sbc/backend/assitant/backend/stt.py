"""
Speech-to-Text usando sherpa-onnx + Whisper Tiny.

Modelo esperado:

models/stt/
├── tiny-encoder.int8.onnx
├── tiny-decoder.int8.onnx
└── tiny-tokens.txt
"""

from pathlib import Path

import numpy as np
import sherpa_onnx


class SpeechRecognizer:

    def __init__(
        self,
        model_dir: str,
        language: str = "es",
        num_threads: int = 4,
    ):

        model_dir = Path(model_dir)

        encoder = model_dir / "tiny-encoder.int8.onnx"
        decoder = model_dir / "tiny-decoder.int8.onnx"
        tokens = model_dir / "tiny-tokens.txt"

        # --------------------------------------------------
        # Verificar archivos
        # --------------------------------------------------

        print(f"Directorio STT: {model_dir}")

        for file in [encoder, decoder, tokens]:

            if not file.exists():
                raise FileNotFoundError(
                    f"No se encontró el archivo STT:\n{file}"
                )

            print(f"[OK] {file.name}")

        # --------------------------------------------------
        # Cargar Whisper
        # --------------------------------------------------

        print("Cargando Whisper Tiny INT8...")

        self.recognizer = (
            sherpa_onnx.OfflineRecognizer.from_whisper(
                encoder=str(encoder),
                decoder=str(decoder),
                tokens=str(tokens),
                language=language,
                task="transcribe",
                num_threads=num_threads,
            )
        )

        print("[OK] Whisper Tiny cargado")

    # ------------------------------------------------------
    # TRANSCRIBIR
    # ------------------------------------------------------

    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int = 16000,
    ) -> str:

        if audio is None or len(audio) == 0:
            return ""

        # Asegurar float32
        audio = np.asarray(
            audio,
            dtype=np.float32,
        )

        # Asegurar mono
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        # Verificar sample rate
        if sample_rate != 16000:
            raise ValueError(
                f"Whisper espera audio a 16000 Hz. "
                f"Recibido: {sample_rate} Hz"
            )

        # Crear stream
        stream = self.recognizer.create_stream()

        # Pasar audio
        stream.accept_waveform(
            sample_rate,
            audio,
        )

        # Decodificar
        self.recognizer.decode_stream(
            stream
        )

        # Resultado
        text = stream.result.text.strip()

        return text