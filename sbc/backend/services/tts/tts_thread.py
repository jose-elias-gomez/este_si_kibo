import queue
import threading
from services.tts.tts import TTS


class TTSThread(threading.Thread):
    """Background worker thread processing speech synthesis queue sequentially."""

    def __init__(self, tts: TTS = None, name: str = "TTSThread"):
        """Initializes the background thread daemon.

        Args:
            tts (TTS, optional): Active TTS instance. Defaults to Singleton instance.
            name (str, optional): Identification name for the thread.
        """
        super().__init__(name=name, daemon=True)
        self.tts = tts or TTS.get_instance()
        self._queue: "queue.Queue[str | None]" = queue.Queue()

    def push_message(self, message: str):
        """Enqueues a text message and ensures the daemon thread is running.

        Args:
            message (str): Text string to synthesize and play.
        """
        if not message:
            return

        if not self.is_alive():
            try:
                self.start()
            except RuntimeError:
                pass  # Thread is already running or starting

        self._queue.put(message)

    def run(self):
        """Worker execution loop that pops queued items and invokes TTS audio synthesis."""
        while True:
            # Blocks and sleeps until a message or sentinel value (None) arrives
            message = self._queue.get()

            if message is None:
                self._queue.task_done()
                break

            try:
                self.tts.speak(message)
            except Exception as e:
                print(f"[TTSThread Error] Failed to play '{message}': {e}")
            finally:
                self._queue.task_done()

    def stop(self, wait: bool = True):
        """Signals the thread loop to terminate safely.

        Args:
            wait (bool, optional): If True, blocks execution until the thread exits.
        """
        self._queue.put(None)  # Awakens queue.get() immediately
        if wait and self.is_alive():
            self.join()

    def wait_until_done(self):
        """Blocks until all items in the queue have been fully processed."""
        self._queue.join()

    @property
    def pending_count(self) -> int:
        """Gets the total count of uncompleted tasks currently queued.

        Returns:
            int: Number of queued text messages.
        """
        return self._queue.qsize()
