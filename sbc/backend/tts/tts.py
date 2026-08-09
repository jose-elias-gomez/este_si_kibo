import io
import os
import wave
import numpy as np
import sounddevice as sd
from piper import PiperVoice

class TTS:
    _instance = None

    def __new__(cls, route: str = None):
        if cls._instance is None:
            cls._instance = super(TTS, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, route: str = None):
        if hasattr(self, '_initialized') and self._initialized:
            return

        self.route = route
        self.voice = self._load_model_once()
        self._initialized = True

    def _load_model_once(self):
        if not self.route or not os.path.exists(self.route):
            print(f"[TTS Alert] Can't found model in: '{self.route}'")
            return None

        try:
            return PiperVoice.load(self.route)
        except Exception as e:
            print(f"[TTS Error] Error on load the model '{self.route}': {e}")
            return None

    def speak(self, texto: str):
        if self.voice is None:
            print(f"[TTS] {texto}")
            return

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            self.voice.synthesize_wav(texto, wav_file)

        wav_buffer.seek(0)
        with wave.open(wav_buffer, "rb") as wav_file:
            sample_rate = wav_file.getframerate()
            num_channels = wav_file.getnchannels()
            frames = wav_file.readframes(wav_file.getnframes())
            audio_data = np.frombuffer(frames, dtype=np.int16)
            if num_channels > 1:
                audio_data = audio_data.reshape(-1, num_channels)

        sd.play(audio_data, samplerate=sample_rate)
        sd.wait()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls("es-hikari-medium.onnx")
        return cls._instance