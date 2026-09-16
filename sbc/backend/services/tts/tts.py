import io
import os
import subprocess
import tempfile
import wave

from piper import PiperVoice


class TTS:
    _instance = None

    def __new__(cls, route: str = None):
        if cls._instance is None:
            cls._instance = super(TTS, cls).__new__(cls)
            cls._instance._initialized = False

        return cls._instance

    def __init__(self, route: str = None):
        if self._initialized:
            return

        self.route = route
        self.voice = self._load_model_once()
        self._initialized = True

    def _load_model_once(self):
        if not self.route or not os.path.exists(self.route):
            print(f"[TTS Alert] No se encuentra el modelo: {self.route}")
            return None

        try:
            print(f"[TTS] Cargando modelo: {self.route}")

            voice = PiperVoice.load(self.route)

            print("[TTS] Modelo cargado correctamente")

            return voice

        except Exception as e:
            print(f"[TTS Error] Error cargando el modelo: {e}")
            return None

    def speak(self, texto: str):

        if self.voice is None:
            print(f"[TTS] {texto}")
            return

        print("[TTS] 1. Comenzando síntesis...")

        wav_buffer = io.BytesIO()

        with wave.open(wav_buffer, "wb") as wav_file:
            self.voice.synthesize_wav(texto, wav_file)

        print("[TTS] 2. Piper terminó")

        wav_buffer.seek(0)

        # Crear WAV temporal
        with tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False
        ) as temp_file:

            temp_path = temp_file.name
            temp_file.write(wav_buffer.read())

        print(f"[TTS] 3. Audio generado: {temp_path}")

        try:
            print("[TTS] 4. Reproduciendo por ES8388...")

            subprocess.run(
                [
                    "paplay",
                    "--device=alsa_output.platform-es8388-sound.stereo-fallback",
                    temp_path
                ],
                check=True
            )

            print("[TTS] 5. Reproducción terminada")

        except subprocess.CalledProcessError as e:

            print(f"[TTS Error] paplay terminó con error: {e}")

        except Exception as e:

            print(f"[TTS Error] Error reproduciendo audio: {e}")

        finally:

            try:
                os.remove(temp_path)
            except OSError:
                pass