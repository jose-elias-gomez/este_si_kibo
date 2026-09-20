import logging
import queue
import threading

from kibo.services.tts._tts import TextToSpeech

logger = logging.getLogger("tts.worker")

# Si se encolan mas frases que esto, algo se descontrolo: descartamos las viejas
# en lugar de acumular minutos de audio pendiente.
DEFAULT_MAX_QUEUE = 32


class TTSThread:
    """Worker en segundo plano que procesa la cola de sintesis en orden.

    Singleton de proceso, igual que ``TTS``: todos los que necesiten encolar
    audio (_tts_endpoint.py, assistant.py) llaman a ``TTSThread.get_instance()``
    y comparten el mismo hilo y la misma cola, en el mismo orden.
    """

    _instance: "TTSThread | None" = None
    _new_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._new_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        name: str = "TTSThread",
        max_queue: int = DEFAULT_MAX_QUEUE,
    ):
        if getattr(self, "_initialized", False):
            return

        self.tts = TextToSpeech.get_instance()
        self.name = name
        self._queue: "queue.Queue[str | None]" = queue.Queue(maxsize=max_queue)
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._initialized = True

    # ------------------------------------------------------------------
    # Estado
    # ------------------------------------------------------------------

    @property
    def is_running(self) -> bool:
        """Indica si el hilo esta vivo."""
        return self._thread is not None and self._thread.is_alive()

    @property
    def pending_count(self) -> int:
        """Cantidad aproximada de frases pendientes en la cola."""
        return self._queue.qsize()

    # ------------------------------------------------------------------
    # Control
    # ------------------------------------------------------------------

    def start(self):
        """Arranca el hilo si no esta corriendo (idempotente y thread-safe)."""
        with self._lock:
            if self.is_running:
                return
            self._thread = threading.Thread(
                target=self._run,
                name=self.name,
                daemon=True,
            )
            self._thread.start()

    def push_message(self, message: str) -> bool:
        """Encola una frase y asegura que el worker este corriendo.

        Args:
            message (str): Texto a sintetizar y reproducir.

        Returns:
            bool: True si se encolo, False si se descarto por cola llena.
        """
        if not message or not message.strip():
            return False

        self.start()

        try:
            self._queue.put_nowait(message)
            return True
        except queue.Full:
            # Descartamos la frase mas vieja para priorizar lo mas reciente.
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except queue.Empty:
                pass
            try:
                self._queue.put_nowait(message)
                logger.warning("Cola de TTS llena: se descarto la frase mas vieja")
                return True
            except queue.Full:
                logger.warning("Cola de TTS llena: se descarto '%s'", message[:40])
                return False

    def flush(self, stop_current: bool = True) -> int:
        """Vacia la cola y opcionalmente corta lo que se esta reproduciendo.

        Args:
            stop_current (bool): Si True, interrumpe la frase en curso.

        Returns:
            int: Cantidad de frases descartadas.
        """
        dropped = 0
        while True:
            try:
                item = self._queue.get_nowait()
            except queue.Empty:
                break
            self._queue.task_done()
            if item is not None:
                dropped += 1

        if stop_current:
            self.tts.stop_playback()

        return dropped

    def stop(self, wait: bool = True, timeout: float = 5.0):
        """Le pide al hilo que termine de forma ordenada.

        Args:
            wait (bool): Si True, bloquea hasta que el hilo salga.
            timeout (float): Segundos maximos de espera.
        """
        thread = self._thread
        if thread is None:
            return

        try:
            self._queue.put_nowait(None)
        except queue.Full:
            self.flush(stop_current=False)
            self._queue.put_nowait(None)

        if wait and thread.is_alive():
            thread.join(timeout=timeout)

    def wait_until_done(self):
        """Bloquea hasta que se procesen todos los items de la cola."""
        self._queue.join()

    # ------------------------------------------------------------------
    # Loop
    # ------------------------------------------------------------------

    def _run(self):
        """Loop del worker: consume la cola e invoca la sintesis."""
        while True:
            message = self._queue.get()

            if message is None:
                self._queue.task_done()
                break

            try:
                self.tts.speak(message)
            except Exception:
                logger.exception("Fallo al reproducir '%s'", message[:60])
            finally:
                self._queue.task_done()

    @classmethod
    def get_instance(cls) -> "TTSThread":
        """Devuelve el worker unico del proceso, creandolo si hace falta.

        Requiere que ``TTS`` ya se haya instanciado al menos una vez (ver
        ``TTS.get_instance``), porque de eso toma la voz a usar.
        """
        return cls()