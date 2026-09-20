import asyncio
import io
import logging
import queue
import threading

import numpy as np
import sounddevice as sd
from scipy.io.wavfile import write

from kibo.services.stt.service import STTService
from kibo.services.llm.service import LLMService
from kibo.services.tts.service import TTSService
from kibo.transports.websocket.packet_registry import PacketId
from kibo.transports.websocket.server import broadcast

logger = logging.getLogger("[ASSISTANT]")

SAMPLE_RATE = 16000
CHANNELS = 1

# Recording is force-stopped after this many seconds even if "stop" never arrives.
MAX_RECORD_SECONDS = 10.0

class AssistantRecorder:
    """Owns the microphone lifecycle and the STT -> LLM -> TTS pipeline.

    Recording happens on the audio callback thread. Once stopped, the captured
    audio is dropped into a queue and processed on a single dedicated worker
    thread, so start/stop-recording endpoints return immediately while the
    actual transcription/answer/speech pipeline runs in the background.
    """

    _instance: "AssistantRecorder | None" = None
    _instance_lock = threading.Lock()

    def __init__(self, loop: asyncio.AbstractEventLoop | None = None):
        self._record_lock = threading.Lock()
        self._recording = False

        # Guarda la referencia al event loop de asyncio
        try:
            self._loop = loop or asyncio.get_running_loop()
        except RuntimeError:
            self._loop = None

        self._stream: sd.InputStream | None = None
        self._frames: list[np.ndarray] = []
        self._safety_timer: threading.Timer | None = None

        self._job_queue: "queue.Queue[np.ndarray]" = queue.Queue()
        self._worker = threading.Thread(target=self._process_loop, daemon=True)
        self._worker.start()

    @classmethod
    def get_instance(cls, loop: asyncio.AbstractEventLoop | None = None) -> "AssistantRecorder":
        """Returns the shared singleton instance."""
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls(loop=loop)
        return cls._instance

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        """Asigna el event loop principal si no estaba disponible al instanciar."""
        self._loop = loop

    def start_recording(self) -> bool:
        """Opens the default microphone and starts capturing audio.

        Returns:
            bool: False if a recording is already in progress.
        """
        with self._record_lock:
            if self._recording:
                logger.warning("start_recording called while already recording")
                return False

            self._frames = []
            self._recording = True

            self._stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                dtype="float32",
                callback=self._on_audio_block,
            )
            self._stream.start()

            # Hard safety limit: auto-stop if nobody calls stop-recording in time.
            self._safety_timer = threading.Timer(MAX_RECORD_SECONDS, self._on_max_duration)
            self._safety_timer.daemon = True
            self._safety_timer.start()

        logger.info("Recording started (max %.0fs)", MAX_RECORD_SECONDS)
        return True

    def _on_audio_block(self, indata, frames, time_info, status):
        if status:
            logger.warning("Input stream status: %s", status)
        self._frames.append(indata.copy())

    def _on_max_duration(self):
        logger.info("Max recording duration reached, stopping automatically")
        self.stop_recording()

    def stop_recording(self) -> bool:
        """Stops capturing and queues the recorded audio for processing.

        Returns:
            bool: False if there was no active recording to stop.
        """
        with self._record_lock:
            if not self._recording:
                logger.warning("stop_recording called with no active recording")
                return False

            self._recording = False

            if self._safety_timer is not None:
                self._safety_timer.cancel()
                self._safety_timer = None

            if self._stream is not None:
                self._stream.stop()
                self._stream.close()
                self._stream = None

            audio = (
                np.concatenate(self._frames, axis=0).flatten()
                if self._frames
                else np.array([], dtype=np.float32)
            )
            self._frames = []

        self._job_queue.put(audio)
        logger.info("Recording stopped, queued for processing")
        return True

    def _process_loop(self):
        while True:
            audio = self._job_queue.get()
            try:
                self._run_pipeline(audio)
            except Exception:
                logger.exception("Assistant pipeline failed")
            finally:
                self._job_queue.task_done()

    def _run_pipeline(self, audio: np.ndarray):
        wav_bytes = self._to_wav_bytes(audio)
        if wav_bytes is None:
            logger.info("No audio captured, skipping pipeline")
            return

        text = STTService.transcribe(wav_bytes)
        if not text:
            logger.info("Empty transcription, skipping pipeline")
            return
        logger.info("Transcribed: %s", text)

        reply = LLMService.ask(text)
        if not reply:
            logger.info("Empty LLM reply, nothing to speak")
            return
        logger.info("LLM reply: %s", reply)

        TTSService.push_message(reply)

        packet = {"id": PacketId.ASSISTANT_RESPONSE.value, "text": reply}
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(broadcast(packet), self._loop)
        else:
            logger.error("No hay un asyncio event loop activo para ejecutar broadcast")

    @staticmethod
    def _to_wav_bytes(audio: np.ndarray) -> bytes | None:
        """Encodes captured float32 samples as an in-memory WAV file."""
        if audio is None or len(audio) == 0:
            return None

        audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
        byte_io = io.BytesIO()
        write(byte_io, SAMPLE_RATE, audio_int16)
        return byte_io.getvalue()