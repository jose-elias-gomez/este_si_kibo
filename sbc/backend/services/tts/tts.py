import io
import os
import wave
import numpy as np
import sounddevice as sd
from piper import PiperVoice


class TTS:
    """Singleton class managing text-to-speech synthesis and audio playback[cite: 8]."""

    _instance = None

    def __new__(cls, route: str = None):
        """Controls Singleton instantiation[cite: 8].

        Args:
            route (str, optional): Path to the ONNX voice model file[cite: 8].

        Returns:
            TTS: The singleton instance of the class[cite: 8].
        """
        if cls._instance is None:
            cls._instance = super(TTS, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, route: str = None):
        """Initializes the TTS engine once[cite: 8].

        Args:
            route (str, optional): Path to the ONNX voice model file[cite: 8].
        """
        if hasattr(self, "_initialized") and self._initialized:
            return

        self.route = route
        self.voice = self._load_model_once()
        self._initialized = True

    def _load_model_once(self) -> PiperVoice | None:
        """Loads the Piper voice model from disk[cite: 8].

        Returns:
            PiperVoice | None: Loaded model object or None if initialization failed[cite: 8].
        """
        if not self.route or not os.path.exists(self.route):
            print(f"[TTS Alert] Cannot find model in: '{self.route}'")
            return None

        try:
            return PiperVoice.load(self.route)
        except Exception as e:
            print(f"[TTS Error] Error loading the model '{self.route}': {e}")
            return None

    def speak(self, texto: str):
        """Synthesizes text to speech and plays audio through the output device[cite: 8].

        If no model is loaded, fallback prints text to standard output[cite: 8].

        Args:
            texto (str): Text phrase to synthesize into speech[cite: 8].
        """
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
        """Retrieves or creates the default singleton instance[cite: 8].

        Returns:
            TTS: The standard singleton TTS instance[cite: 8].
        """
        if cls._instance is None:
            cls("es-hikari-medium.onnx")
        return cls._instance
