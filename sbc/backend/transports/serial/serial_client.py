import threading
import queue
import time
import serial

from transports.serial.errors import (
    ProtocolDecodeError,
    SerialConnectionError,
    SerialTimeoutError,
    UnknownProtocolStatusError,
)
from transports.serial.status import DecodeStatus

class SerialRobotClient:
    def __init__(
        self,
        port: str,
        baudrate: int = 9600,
        timeout: float = 1.0,
        startup_delay: float = 2.0,
        on_touch_event=None  # Callback opcional para manejar eventos touch
    ) -> None:
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.startup_delay = startup_delay
        self.on_touch_event = on_touch_event

        self.connection: serial.Serial | None = None
        self._rx_thread: threading.Thread | None = None
        self._running = False
        self._status_queue: queue.Queue[int] = queue.Queue()

    def connect(self) -> None:
        self.connection = serial.Serial(
            port=self.port,
            baudrate=self.baudrate,
            timeout=self.timeout,
            write_timeout=self.timeout,
        )

        time.sleep(self.startup_delay)
        self.connection.reset_input_buffer()
        self.connection.reset_output_buffer()

        # Iniciar el hilo de lectura continua
        self._running = True
        self._rx_thread = threading.Thread(target=self._listen_serial, daemon=True)
        self._rx_thread.start()

    def _listen_serial(self) -> None:
        """Bucle en segundo plano procesando los paquetes entrantes."""
        while self._running and self.connection and self.connection.is_open:
            try:
                if self.connection.in_waiting > 0:
                    # Leer el ID del paquete (Header)
                    header_byte = self.connection.read(1)
                    if not header_byte:
                        continue

                    packet_id = header_byte[0]

                    # PacketId::DECODED (0)
                    if packet_id == 0:
                        status_byte = self.connection.read(1)
                        if status_byte:
                            self._status_queue.put(status_byte[0])

                    # PacketId::TOUCH (1)
                    elif packet_id == 1:
                        touch_data = self.connection.read(2) # tipo y evento
                        if len(touch_data) == 2 and self.on_touch_event:
                            sensor_type, event = touch_data[0], touch_data[1]
                            self.on_touch_event(sensor_type, event)

            except serial.SerialException:
                break
            time.sleep(0.005) # Evitar consumo alto de CPU

    def send(self, packet: bytes) -> DecodeStatus:
        self._ensure_connected()

        if len(packet) == 0:
            raise ValueError("Cannot send empty packet")

        # Limpiar cualquier status viejo pendiente en la cola
        while not self._status_queue.empty():
            self._status_queue.get_nowait()

        try:
            self.connection.write(packet)
            self.connection.flush()
        except serial.SerialTimeoutException as exc:
            raise SerialTimeoutError("Serial write timed out") from exc
        except serial.SerialException as exc:
            raise SerialConnectionError(f"Serial write failed: {exc}") from exc

        return self._wait_for_status()

    def _wait_for_status(self) -> DecodeStatus:
        try:
            # Esperar a que el hilo _listen_serial reciba la respuesta del status
            raw_status = self._status_queue.get(timeout=self.timeout)
        except queue.Empty:
            raise SerialTimeoutError("Timed out waiting for Arduino status byte")

        try:
            status = DecodeStatus(raw_status)
        except ValueError as exc:
            raise UnknownProtocolStatusError(raw_status) from exc

        if status != DecodeStatus.OK:
            raise ProtocolDecodeError(status)

        return status

    def close(self) -> None:
        self._running = False
        if self._rx_thread and self._rx_thread.is_alive():
            self._rx_thread.join(timeout=1.0)

        if self.connection is not None and self.connection.is_open:
            self.connection.close()

    def _ensure_connected(self) -> None:
        if self.connection is None or not self.connection.is_open:
            raise SerialConnectionError("Serial connection is not open")

    def __enter__(self) -> "SerialRobotClient":
        self.connect()
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.close()