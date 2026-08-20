import queue
import threading
from tts import TTS

class TTSThread(threading.Thread):
    def __init__(self, tts: TTS = None, name: str = "TTSThread"):
        super().__init__(name=name, daemon=True)
        self.tts = tts or TTS.get_instance()
        self._queue: "queue.Queue[str | None]" = queue.Queue()

    def push_message(self, message: str):
        if not message:
            return

        if not self.is_alive():
            try:
                self.start()
            except RuntimeError:
                pass  # El hilo ya está corriendo o iniciando

        self._queue.put(message)

    def run(self):
        while True:
            # Se bloquea y duerme el thread hasta que entra un mensaje o None
            message = self._queue.get()

            if message is None:
                self._queue.task_done()
                break

            try:
                self.tts.speak(message)
            except Exception as e:
                print(f"[TTSThread Error] Fallo al reproducir '{message}': {e}")
            finally:
                self._queue.task_done()

    def stop(self, wait: bool = True):
        """Detiene el hilo inmediatamente o tras procesar lo pendiente."""
        self._queue.put(None)  # Despierta el get() al instante
        if wait and self.is_alive():
            self.join()

    def wait_until_done(self):
        self._queue.join()
