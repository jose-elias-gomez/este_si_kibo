from __future__ import annotations

import collections
import logging
import queue
import threading
import time
from concurrent.futures import Future
from dataclasses import dataclass
from typing import Callable

import serial

from kibo.transports.serial.packets.in_touch import TouchEvent, TouchPart
from kibo.transports.serial.packets.out_movement import (
    WHEEL_PARTS,
    MotorCommand,
    MovementPacket,
    PartId,
    ProtocolCommand,
)
from kibo.transports.serial.protocol import DecodeStatus, PacketId

log = logging.getLogger(__name__)

TouchCallback = Callable[[TouchPart, TouchEvent], None]


class SerialClientError(Exception):
    pass


class AckTimeout(SerialClientError):
    """El ESP no respondió con un paquete DECODED a tiempo."""


class PacketCancelled(SerialClientError):
    """El paquete se descartó antes de enviarse (p. ej. por stop_all())."""


class PacketRejected(SerialClientError):
    """El ESP respondió con un estado distinto de OK."""

    def __init__(self, status: DecodeStatus) -> None:
        super().__init__(f"ESP rejected packet: {status.name}")
        self.status = status


@dataclass
class _Pending:
    data: bytes
    future: Future
    updates: dict[PartId, int]  # estado que quedará registrado tras el ACK OK


class SerialClient:
    """Cliente serie singleton.

    - send() encola el paquete y devuelve un Future (se resuelve con el
      DecodeStatus cuando el ESP confirma, o con excepción si falla).
    - Un único hilo escribe, lee y procesa: nunca hay dos paquetes en vuelo;
      hasta que no llega el ACK del anterior no se envía el siguiente.
    - Mientras alguna rueda esté en marcha y no haya tráfico, envía heartbeats
      para que no salte el failsafe del firmware (500 ms).
    - Los eventos táctiles se entregan a los callbacks registrados con on_touch().
    - Al arrancar (start) pone los servos en su ángulo inicial y las ruedas en STOP.
    - Mantiene un registro del último estado CONFIRMADO por el ESP (get_state()).
    - stop_all() cancela lo pendiente y detiene las ruedas con máxima prioridad.
    """

    _instance: SerialClient | None = None
    _instance_lock = threading.Lock()

    @classmethod
    def instance(cls, port: str | None = None, **kwargs) -> SerialClient:
        """Devuelve el singleton. La primera llamada necesita `port`."""
        with cls._instance_lock:
            if cls._instance is None:
                if port is None:
                    raise ValueError("First call to SerialClient.instance() needs a port")
                cls._instance = cls(port, **kwargs)
            return cls._instance

    def __init__(
        self,
        port: str,
        baudrate: int = 115200,
        ack_timeout: float = 0.5,
        heartbeat_interval: float = 0.2,
        boot_delay: float = 2.5,
        queue_size: int = 100,
        reset_on_start: bool = True,
        initial_servo_angle: int = 0,
    ) -> None:
        self._port = port
        self._baudrate = baudrate
        self._ack_timeout = ack_timeout
        self._heartbeat_interval = heartbeat_interval
        self._boot_delay = boot_delay
        self._reset_on_start = reset_on_start
        self._initial_servo_angle = initial_servo_angle

        self._queue: queue.Queue[_Pending] = queue.Queue(maxsize=queue_size)
        # Paquetes de máxima prioridad (stop_all); se envían antes que nada.
        self._urgent: collections.deque[_Pending] = collections.deque()
        self._touch_callbacks: list[TouchCallback] = []

        # Último valor pedido por pieza (send_latest) y el Future compartido
        # del lote pendiente.
        self._latest_lock = threading.Lock()
        self._latest: dict[PartId, ProtocolCommand] = {}
        self._latest_future: Future | None = None

        self._ser: serial.Serial | None = None
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        self._rx = bytearray()
        self._current: _Pending | None = None
        self._sent_at = 0.0
        self._last_tx = 0.0

        # Registro del último estado confirmado (ACK OK) de cada pieza.
        # None = desconocido (aún no se ha confirmado ningún comando).
        self._state_lock = threading.Lock()
        self._state: dict[PartId, int | None] = {part: None for part in PartId}

        # Si es False no se mandan heartbeats (así el failsafe del firmware
        # para las ruedas aunque falle el paquete de stop). Se reactiva al
        # enviar un comando de rueda distinto de STOP.
        self._heartbeat_enabled = True

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return

        self._ser = serial.Serial(self._port, self._baudrate, timeout=0.01)

        # Abrir el puerto suele resetear el ESP, y luego calibra los sensores
        # táctiles (~1.5 s) sin atender el serie. Esperamos a que termine.
        time.sleep(self._boot_delay)
        self._ser.reset_input_buffer()
        self._rx.clear()

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="SerialClient", daemon=True)
        self._thread.start()

        if self._reset_on_start:
            try:
                self.reset_to_initial_state().result(timeout=self._ack_timeout * 2 + 1)
            except Exception as exc:
                self.close()
                raise SerialClientError(f"Initial reset failed: {exc}") from exc

    def close(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None

        # Parar ruedas al salir (el failsafe del ESP también lo haría a los 500 ms).
        if self._ser is not None and self._ser.is_open:
            try:
                self._ser.write(MovementPacket().stop_wheels().build())
                self._ser.flush()
            except serial.SerialException:
                pass
            self._ser.close()

        self._fail_all(SerialClientError("SerialClient closed"))

        with self._instance_lock:
            if SerialClient._instance is self:
                SerialClient._instance = None

    def __enter__(self) -> SerialClient:
        self.start()
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def send(self, packet: MovementPacket | bytes) -> Future:
        """Encola un paquete. Lanza queue.Full si la cola está llena."""
        if self._thread is None or not self._thread.is_alive():
            raise SerialClientError("SerialClient is not running; call start() first")

        if isinstance(packet, MovementPacket):
            data = packet.build()
            commands = packet.commands()
            updates = {PartId(c.part): c.value for c in commands}
            self._note_wheel_intent(commands)
        else:
            data = bytes(packet)
            updates = {}

        future: Future = Future()
        self._queue.put_nowait(_Pending(data, future, updates))
        return future

    def send_latest(self, packet: MovementPacket) -> Future:
        """Para sliders / seguimiento en vivo: solo importa el valor más reciente.

        En vez de encolar, guarda el último valor pedido de CADA pieza del
        paquete. Cuando el hilo queda libre envía un único paquete que combina
        lo más reciente de cada pieza; los valores intermedios se descartan.

        - Si llamas con la cabeza y luego con un brazo, ambos viajan en el mismo
          paquete (no se pisan, solo se pisa la misma pieza).
        - El Future devuelto es compartido por todas las llamadas del mismo lote
          y se resuelve cuando el ESP confirma el paquete combinado.
        - Los paquetes de send() (cola FIFO) tienen prioridad sobre este lote.
        - Es seguro llamarlo desde varios hilos.
        """
        if self._thread is None or not self._thread.is_alive():
            raise SerialClientError("SerialClient is not running; call start() first")

        commands = packet.commands()
        if not commands:
            raise ValueError("Packet has no commands")

        self._note_wheel_intent(commands)

        with self._latest_lock:
            for command in commands:
                self._latest[PartId(command.part)] = command
            if self._latest_future is None:
                self._latest_future = Future()
            return self._latest_future

    def reset_to_initial_state(self) -> Future:
        """Servos al ángulo inicial (0 por defecto) y ruedas en STOP.

        Se llama solo al hacer start() (si reset_on_start=True), pero puedes
        invocarlo cuando quieras. Va por la cola normal (FIFO).
        """
        angle = self._initial_servo_angle
        packet = (
            MovementPacket()
            .left_arm(angle)
            .right_arm(angle)
            .head(angle)
            .stop_wheels()
        )
        return self.send(packet)

    def stop_all(self) -> Future:
        """Parada de emergencia.

        - Descarta todo lo pendiente (cola FIFO y lote de send_latest); esos
          Futures fallan con PacketCancelled.
        - Detiene las ruedas con prioridad sobre cualquier otro paquete (solo
          espera a que termine el paquete que ya esté en vuelo).
        - Deja de mandar heartbeats: si el paquete de stop se perdiera, el
          failsafe del firmware para las ruedas a los 500 ms.
        - Los servos NO se mueven: mantienen su última posición.
        - El cliente sigue aceptando comandos después.
        """
        if self._thread is None or not self._thread.is_alive():
            raise SerialClientError("SerialClient is not running; call start() first")

        self._heartbeat_enabled = False
        self._discard_pending(PacketCancelled("Cancelled by stop_all()"))

        future: Future = Future()
        updates = {part: int(MotorCommand.STOP) for part in WHEEL_PARTS}
        self._urgent.append(
            _Pending(MovementPacket().stop_wheels().build(), future, updates)
        )
        return future

    def get_state(self) -> dict[PartId, int | MotorCommand | None]:
        """Último estado confirmado por el ESP para cada pieza.

        Servos: ángulo (0..180). Ruedas: MotorCommand. None = desconocido.
        Es el estado ORDENADO y confirmado, no una lectura real del servo
        (que puede seguir moviéndose hacia esa posición).
        """
        with self._state_lock:
            snapshot = dict(self._state)
        return {
            part: MotorCommand(value) if part in WHEEL_PARTS and value is not None else value
            for part, value in snapshot.items()
        }

    def get_part_state(self, part: PartId) -> int | MotorCommand | None:
        return self.get_state()[PartId(part)]

    def on_touch(self, callback: TouchCallback) -> None:
        """Registra un callback(part, event). Se llama desde el hilo del cliente:
        no lo bloquees."""
        self._touch_callbacks.append(callback)

    # ------------------------------------------------------------ internals

    def _run(self) -> None:
        try:
            while not self._stop_event.is_set():
                self._read_serial()
                self._check_ack_timeout()
                if self._current is None:
                    self._dispatch_next()
        except serial.SerialException as exc:
            log.error("Serial error, stopping client: %s", exc)
            self._fail_all(SerialClientError(f"Serial error: {exc}"))
        except Exception:
            log.exception("Unexpected error in SerialClient thread")
            self._fail_all(SerialClientError("SerialClient thread crashed"))

    def _read_serial(self) -> None:
        assert self._ser is not None
        chunk = self._ser.read(self._ser.in_waiting or 1)  # bloquea como mucho 10 ms
        if chunk:
            self._rx.extend(chunk)
            self._parse()

    def _parse(self) -> None:
        while self._rx:
            packet_id = self._rx[0]

            if packet_id == PacketId.DECODED:
                if len(self._rx) < 2:
                    return
                status = self._rx[1]
                del self._rx[:2]
                self._on_ack(status)

            elif packet_id == PacketId.TOUCH:
                if len(self._rx) < 3:
                    return
                part, event = self._rx[1], self._rx[2]
                del self._rx[:3]
                self._on_touch(part, event)

            else:
                log.warning("Unknown byte from ESP: 0x%02X (discarded)", packet_id)
                del self._rx[0]

    def _on_ack(self, raw_status: int) -> None:
        pending = self._current
        if pending is None:
            log.debug("Unsolicited DECODED status %d (ignored)", raw_status)
            return

        self._current = None

        try:
            status = DecodeStatus(raw_status)
        except ValueError:
            self._resolve(pending.future, exc=SerialClientError(f"Unknown status {raw_status}"))
            return

        if status == DecodeStatus.OK:
            with self._state_lock:
                self._state.update(pending.updates)
            self._resolve(pending.future, result=status)
        else:
            self._resolve(pending.future, exc=PacketRejected(status))
    def _on_touch(self, raw_part: int, raw_event: int) -> None:
        print(f"[TOUCH DEBUG] part={raw_part} event={raw_event}")

        try:
            part = TouchPart(raw_part)
            event = TouchEvent(raw_event)
        except ValueError:
            print(f"[TOUCH DEBUG] INVALIDO part={raw_part} event={raw_event}")
            return

        print(f"[TOUCH DEBUG] {part.name} -> {event.name}")

        for callback in list(self._touch_callbacks):
            try:
                callback(part, event)
            except Exception:
                log.exception("Touch callback failed")

    def _check_ack_timeout(self) -> None:
        pending = self._current
        if pending is not None and time.monotonic() - self._sent_at > self._ack_timeout:
            log.warning("ACK timeout")
            self._current = None
            self._resolve(pending.future, exc=AckTimeout("No ACK from ESP"))

    def _dispatch_next(self) -> None:
        # 1) Paquetes urgentes (stop_all).
        try:
            urgent = self._urgent.popleft()
        except IndexError:
            pass
        else:
            urgent.future.set_running_or_notify_cancel()
            self._write(urgent)
            return

        # 2) Cola FIFO.
        while True:
            try:
                pending = self._queue.get_nowait()
            except queue.Empty:
                break

            # Si el Future fue cancelado mientras esperaba en cola, se salta.
            if pending.future.set_running_or_notify_cancel():
                self._write(pending)
                return

        # Cola vacía: ¿hay un lote "último valor" pendiente?
        latest = self._take_latest()
        if latest is not None:
            self._write(latest)
            return

        # Nada más que enviar: heartbeat si hay ruedas en marcha.
        if self._wheels_moving() and time.monotonic() - self._last_tx > self._heartbeat_interval:
            heartbeat = _Pending(MovementPacket.heartbeat(), Future(), {})
            heartbeat.future.set_running_or_notify_cancel()
            self._write(heartbeat)

    def _take_latest(self) -> _Pending | None:
        with self._latest_lock:
            if not self._latest:
                return None
            commands = list(self._latest.values())
            future = self._latest_future
            self._latest = {}
            self._latest_future = None

        packet = MovementPacket()
        for command in commands:
            packet.set_command(command)

        if future is None:
            future = Future()
        # Se envía igualmente aunque el caller haya cancelado el Future
        # (el lote es compartido); _resolve ignora Futures ya terminados.
        future.set_running_or_notify_cancel()

        updates = {PartId(c.part): c.value for c in commands}
        return _Pending(packet.build(), future, updates)

    def _write(self, pending: _Pending) -> None:
        assert self._ser is not None
        self._ser.write(pending.data)
        self._ser.flush()
        now = time.monotonic()
        self._sent_at = now
        self._last_tx = now
        self._current = pending

    def _wheels_moving(self) -> bool:
        if not self._heartbeat_enabled:
            return False
        with self._state_lock:
            return any(
                self._state[part] not in (None, int(MotorCommand.STOP))
                for part in WHEEL_PARTS
            )

    def _note_wheel_intent(self, commands: list[ProtocolCommand]) -> None:
        if any(c.part in WHEEL_PARTS and c.value != MotorCommand.STOP for c in commands):
            self._heartbeat_enabled = True

    def _fail_all(self, exc: Exception) -> None:
        if self._current is not None:
            self._resolve(self._current.future, exc=exc)
            self._current = None
        self._discard_pending(exc)

    def _discard_pending(self, exc: Exception) -> None:
        """Descarta todo lo que aún no se ha enviado, fallando sus Futures."""
        while True:
            try:
                pending = self._queue.get_nowait()
            except queue.Empty:
                break
            self._resolve(pending.future, exc=exc)

        while True:
            try:
                pending = self._urgent.popleft()
            except IndexError:
                break
            self._resolve(pending.future, exc=exc)

        with self._latest_lock:
            future = self._latest_future
            self._latest = {}
            self._latest_future = None
        if future is not None:
            self._resolve(future, exc=exc)

    @staticmethod
    def _resolve(future: Future, result=None, exc: Exception | None = None) -> None:
        if future.done():
            return
        if exc is not None:
            future.set_exception(exc)
        else:
            future.set_result(result)
