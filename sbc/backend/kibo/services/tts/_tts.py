import io
import os
import threading
import wave

# Factor de aceleracion aplicado a la reproduccion (no al pitch de sintesis).
PLAYBACK_SPEEDUP = 1.2

from collections import OrderedDict
from typing import Iterator

import numpy as np
import sounddevice as sd
from piper import PiperVoice

from kibo.config import TTS_MODEL_PATH

class TextToSpeech:
    """Singleton class managing text-to-speech synthesis and audio playback."""

    _instance = None
    _new_lock = threading.Lock()

    def __new__(cls, route: str = None, cache_size: int = 32):
        """Controls Singleton instantiation.

        Args:
            route (str, optional): Path to the ONNX voice model file.
            cache_size (int, optional): Number of phrases kept in memory.

        Returns:
            TextToSpeech: The singleton instance of the class.
        """
        with cls._new_lock:
            if cls._instance is None:
                cls._instance = super(TextToSpeech, cls).__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self, route: str = None, cache_size: int = 32):
        """Initializes the TTS engine once.

        Args:
            route (str, optional): Path to the ONNX voice model file.
            cache_size (int, optional): Number of phrases kept in memory.
        """
        if getattr(self, "_initialized", False):
            return

        self.route = route
        self.voice = self._load_model_once()
        self.sample_rate = self._detect_sample_rate()

        self._stream = None
        self._device_lock = threading.Lock()
        self._cache: "OrderedDict[str, np.ndarray]" = OrderedDict()
        self._cache_size = max(0, cache_size)
        self._initialized = True

    def _load_model_once(self) -> PiperVoice | None:
        """Loads the Piper voice model from disk.

        Returns:
            PiperVoice | None: Loaded model object or None if initialization failed.
        """
        if not self.route or not os.path.exists(self.route):
            print(f"[TTS Alert] Cannot find model in: '{self.route}'")
            return None

        try:
            return PiperVoice.load(self.route)
        except Exception as e:
            print(f"[TTS Error] Error loading the model '{self.route}': {e}")
            return None

    def _detect_sample_rate(self) -> int:
        """Reads the model sample rate, falling back to a common default.

        Returns:
            int: Sample rate in Hz.
        """
        if self.voice is None:
            return 22050
        config = getattr(self.voice, "config", None)
        return int(getattr(config, "sample_rate", 22050))

    def _iter_pcm(self, texto: str) -> Iterator[np.ndarray]:
        """Yields int16 PCM chunks as the model produces them.

        Supports the modern Piper API (``synthesize`` -> AudioChunk), the older
        streaming API (``synthesize_stream_raw``) and, as a last resort, the
        blocking WAV path.

        Args:
            texto (str): Text phrase to synthesize.

        Yields:
            np.ndarray: Mono int16 audio chunk.
        """
        if hasattr(self.voice, "synthesize"):
            for chunk in self.voice.synthesize(texto):
                rate = getattr(chunk, "sample_rate", None)
                if rate:
                    self.sample_rate = int(rate)

                raw = getattr(chunk, "audio_int16_bytes", None)
                if raw is not None:
                    yield np.frombuffer(raw, dtype=np.int16)
                    continue

                floats = getattr(chunk, "audio_float_array", None)
                if floats is not None:
                    yield (np.asarray(floats) * 32767).astype(np.int16)
            return

        if hasattr(self.voice, "synthesize_stream_raw"):
            for raw in self.voice.synthesize_stream_raw(texto):
                yield np.frombuffer(raw, dtype=np.int16)
            return

        yield self._synthesize_wav_array(texto)

    def _synthesize_wav_array(self, texto: str) -> np.ndarray:
        """Synthesizes the whole phrase into a WAV buffer and returns its samples.

        Args:
            texto (str): Text phrase to synthesize.

        Returns:
            np.ndarray: Mono int16 audio data.
        """
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            self.voice.synthesize_wav(texto, wav_file)

        wav_buffer.seek(0)
        with wave.open(wav_buffer, "rb") as wav_file:
            self.sample_rate = wav_file.getframerate()
            num_channels = wav_file.getnchannels()
            frames = wav_file.readframes(wav_file.getnframes())

        audio_data = np.frombuffer(frames, dtype=np.int16)
        if num_channels > 1:
            # Mix down to mono so the output stream config stays constant.
            audio_data = audio_data.reshape(-1, num_channels).mean(axis=1)
            audio_data = audio_data.astype(np.int16)
        return audio_data

    def _get_stream(self) -> sd.OutputStream:
        """Returns a started OutputStream, creating it if needed.

        Returns:
            sd.OutputStream: Active mono int16 output stream.
        """
        target_rate = int(self.sample_rate * PLAYBACK_SPEEDUP)
        # Bug original: comparaba self._stream.samplerate contra self.sample_rate,
        # pero el stream se crea con target_rate. Como nunca eran iguales, el
        # stream se cerraba y volvia a abrir en CADA llamada a speak().
        if self._stream is not None and self._stream.samplerate != target_rate:
            self._close_stream()

        if self._stream is None:
            self._stream = sd.OutputStream(
                samplerate=target_rate,
                channels=1,
                dtype="int16",
            )
            self._stream.start()
        return self._stream

    def _close_stream(self):
        """Closes the output stream if it is open."""
        if self._stream is None:
            return
        try:
            self._stream.stop()
            self._stream.close()
        except Exception:
            pass
        finally:
            self._stream = None

    def speak(self, texto: str):
        """Synthesizes text to speech and plays audio through the output device.

        Audio is streamed chunk by chunk, so playback begins before synthesis
        has finished. If no model is loaded, fallback prints text to stdout.

        Args:
            texto (str): Text phrase to synthesize into speech.
        """
        if not texto:
            return

        if self.voice is None:
            print(f"[TTS] {texto}")
            return

        with self._device_lock:
            cached = self._cache.get(texto) if self._cache_size else None
            if cached is not None:
                self._cache.move_to_end(texto)
                self._play_chunks([cached])
                return

            collected: list[np.ndarray] = []
            try:
                stream = self._get_stream()
                for chunk in self._iter_pcm(texto):
                    if chunk.size == 0:
                        continue
                    stream.write(chunk)
                    if self._cache_size:
                        collected.append(chunk)
            except Exception as e:
                print(f"[TTS Error] Playback failed for '{texto}': {e}")
                self._close_stream()
                return

            if self._cache_size and collected:
                self._store_in_cache(texto, np.concatenate(collected))

    def _play_chunks(self, chunks: list[np.ndarray]):
        """Writes already synthesized audio to the output stream.

        Args:
            chunks (list[np.ndarray]): Int16 audio blocks to play in order.
        """
        try:
            stream = self._get_stream()
            for chunk in chunks:
                stream.write(chunk)
        except Exception as e:
            print(f"[TTS Error] Playback failed: {e}")
            self._close_stream()

    def _store_in_cache(self, texto: str, audio: np.ndarray):
        """Saves a synthesized phrase, evicting the least recently used entry.

        Args:
            texto (str): Phrase used as cache key.
            audio (np.ndarray): Full int16 audio for the phrase.
        """
        self._cache[texto] = audio
        self._cache.move_to_end(texto)
        while len(self._cache) > self._cache_size:
            self._cache.popitem(last=False)

    def stop_playback(self):
        """Corta la reproduccion actual cerrando el stream de salida.

        No es instantaneo a nivel de muestra: si hay un `stream.write()` en
        curso dentro de `speak()` (que sostiene `_device_lock`), esta llamada
        espera a que ese chunk termine de escribirse antes de cerrar. Corta
        entre chunk y chunk, no a mitad de uno. Para corte inmediato de
        verdad, haria falta una bandera de cancelacion chequeada dentro de
        `_iter_pcm`/`speak()` entre cada chunk.
        """
        with self._device_lock:
            self._close_stream()

    def shutdown(self):
        with self._device_lock:
            self._close_stream()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls(TTS_MODEL_PATH)
        return cls._instance