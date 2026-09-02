"""
Conector de WebSocket para el paquete de movimiento (MOVE_PART) y para la
consulta de posición de las partes (GET_PARTS).

Sigue el mismo patrón que transports/websocket/system_options
(websocket_connector.py): se registra un decoder contra un PacketId, y ese
decoder arma el resultado a partir del payload recibido por WebSocket.

A diferencia de system_options, este conector necesita una instancia de
SerialRobotClient ya conectada para poder reenviar el comando al Arduino,
así que `register` la recibe como parámetro en vez de importarla directamente.

Al registrarse, se envía un paquete inicial que lleva brazos y cabeza a 0° y
detiene ambas ruedas. Ese estado (sin contar las ruedas) queda cacheado en
`_cached_angles`, que es lo que responde GET_PARTS sin tener que
preguntarle al Arduino cada vez.
"""

from transports.serial.packet import MovementPacket
from transports.serial.serial_client import SerialRobotClient
from transports.serial.enums import MotorCommand
from transports.serial.errors import (
    ProtocolDecodeError,
    SerialConnectionError,
    SerialTimeoutError,
    UnknownProtocolStatusError,
)
from transports.websocket.packet_registry import register_decoder, PacketId
from decoder import PacketDecodeError

_serial_client: SerialRobotClient | None = None

# Caché de ángulos de las partes que NO son ruedas (0..180)
_cached_angles = {
    "left_arm": 0,
    "right_arm": 0,
    "head": 0,
}

# Campos de ángulo del payload -> método de MovementPacket a invocar
_ANGLE_FIELDS = (
    ("left_arm", "left_arm"),
    ("right_arm", "right_arm"),
    ("head", "head"),
)

# Campos de rueda del payload -> método de MovementPacket a invocar
_WHEEL_FIELDS = (
    ("left_wheel", "left_wheel"),
    ("right_wheel", "right_wheel"),
)


def register(serial_client: SerialRobotClient) -> None:
    global _serial_client
    _serial_client = serial_client

    print("register movement")
    register_decoder(PacketId.MOVE_PART, decode)
    register_decoder(PacketId.GET_PARTS, decode_get_parts)

    _reset_parts()


def decode(data):
    if _serial_client is None:
        raise PacketDecodeError(
            "El conector de movimiento no fue inicializado con un SerialRobotClient"
        )

    packet, angle_updates = _build_movement_packet(data)

    _send_packet(packet)
    _cached_angles.update(angle_updates)

    return {"status": "OK"}


def decode_get_parts():
    return dict(_cached_angles)


def _reset_parts() -> None:
    """Al iniciar el servicio: brazos y cabeza a 0°, ruedas detenidas."""
    packet = (
        MovementPacket()
        .left_arm(0)
        .right_arm(0)
        .head(0)
        .left_wheel(MotorCommand.STOP)
        .right_wheel(MotorCommand.STOP)
    )

    _send_packet(packet)
    _cached_angles.update({"left_arm": 0, "right_arm": 0, "head": 0})


def _send_packet(packet: MovementPacket):
    try:
        status = _serial_client.send(packet.build())
    except ProtocolDecodeError as exc:
        raise PacketDecodeError(
            f"El Arduino rechazó el paquete de movimiento: {exc}"
        ) from exc
    except (SerialConnectionError, SerialTimeoutError, UnknownProtocolStatusError) as exc:
        raise PacketDecodeError(f"Error al enviar el paquete de movimiento: {exc}") from exc

    return status


def _build_movement_packet(data):
    packet = MovementPacket()
    angle_updates = {}
    any_command = False

    for field_name, method_name in _ANGLE_FIELDS:
        raw_value = data.get(field_name)
        if raw_value is None:
            continue

        value = _as_int(raw_value, field_name)

        try:
            getattr(packet, method_name)(value)
        except ValueError as exc:
            raise PacketDecodeError(f"'{field_name}' inválido: {exc}") from exc

        angle_updates[field_name] = value
        any_command = True

    for field_name, method_name in _WHEEL_FIELDS:
        raw_value = data.get(field_name)
        if raw_value is None:
            continue

        value = _as_motor_command(raw_value, field_name)

        try:
            getattr(packet, method_name)(value)
        except ValueError as exc:
            raise PacketDecodeError(f"'{field_name}' inválido: {exc}") from exc

        any_command = True

    if not any_command:
        campos = ", ".join(f for f, _ in (*_ANGLE_FIELDS, *_WHEEL_FIELDS))
        raise PacketDecodeError(
            f"El paquete de movimiento no tiene ningún comando (campos esperados: {campos})"
        )

    return packet, angle_updates


def _as_int(value, field_name):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise PacketDecodeError(f"'{field_name}' inválido: {value!r}")


def _as_motor_command(value, field_name):
    """Acepta tanto el int (0/1/2) como el nombre LEFT/RIGHT/STOP."""
    if isinstance(value, str):
        try:
            return MotorCommand[value.strip().upper()]
        except KeyError:
            raise PacketDecodeError(
                f"'{field_name}' inválido: {value!r}. Esperado LEFT, RIGHT o STOP"
            )

    try:
        return int(value)
    except (TypeError, ValueError):
        raise PacketDecodeError(f"'{field_name}' inválido: {value!r}")
