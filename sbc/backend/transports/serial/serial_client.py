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
    ) -> None:
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.startup_delay = startup_delay

        self.connection: serial.Serial | None = None

    def connect(self) -> None:
        self.connection = serial.Serial(
            port=self.port,
            baudrate=self.baudrate,
            timeout=self.timeout,
            write_timeout=self.timeout,
        )

        # Arduino normalmente se reinicia al abrir el puerto serial.
        time.sleep(self.startup_delay)

        # Limpia bytes viejos que pudieran haber quedado.
        self.connection.reset_input_buffer()
        self.connection.reset_output_buffer()


    def send(self, packet: bytes) -> DecodeStatus:
        self._ensure_connected()

        if len(packet) == 0:
            raise ValueError("Cannot send empty packet")

        try:
            self.connection.write(packet)
            self.connection.flush()
        except serial.SerialTimeoutException as exc:
            raise SerialTimeoutError("Serial write timed out") from exc
        except serial.SerialException as exc:
            raise SerialConnectionError(f"Serial write failed: {exc}") from exc

        status = self._read_status()

        if status != DecodeStatus.OK:
            raise ProtocolDecodeError(status)

        return status

    def close(self) -> None:
        if self.connection is not None and self.connection.is_open:
            self.connection.close()

    def _read_status(self) -> DecodeStatus:
        self._ensure_connected()

        try:
            raw = self.connection.read(1)
        except serial.SerialException as exc:
            raise SerialConnectionError(f"Serial read failed: {exc}") from exc

        if len(raw) != 1:
            raise SerialTimeoutError("Timed out waiting for Arduino status byte")

        raw_status = raw[0]

        try:
            return DecodeStatus(raw_status)
        except ValueError as exc:
            raise UnknownProtocolStatusError(raw_status) from exc

    def _ensure_connected(self) -> None:
        if self.connection is None:
            raise SerialConnectionError("Serial connection was not initialized")

        if not self.connection.is_open:
            raise SerialConnectionError("Serial connection is not open")

    def __enter__(self) -> "SerialRobotClient":
        self.connect()
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.close()
