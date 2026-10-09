import logging

from kibo.transports.serial.client import SerialClient
from kibo.transports.serial.packets.in_touch import TouchPart, TouchEvent
from kibo.transports.serial.packets.out_movement import (
    MovementPacket,
    PartId,
    MotorCommand,
)
from kibo.transports.websocket.packet_registry import (
    register_decoder,
    PacketId,
)

logger = logging.getLogger(__name__)

_serial_client = None


# ============================================================
# MOVEMENT
# ============================================================

def _create_movement_packet(data) -> MovementPacket:
    part = PartId[data["partName"]]

    packet = MovementPacket()

    if part == PartId.LEFT_WHEEL:
        packet.left_wheel(MotorCommand[data["command"]])

    elif part == PartId.RIGHT_WHEEL:
        packet.right_wheel(MotorCommand[data["command"]])

    else:
        angle = int(data["angle"])

        if part == PartId.LEFT_ARM:
            packet.left_arm(angle)
        elif part == PartId.RIGHT_ARM:
            packet.right_arm(angle)
        elif part == PartId.HEAD:
            packet.head(angle)

    return packet


def _send_movement(packet):
    future = _serial_client.send(_create_movement_packet(packet))
    future.result(timeout=2)
    return "ok"


def _send_movement_latest(packet):
    future = _serial_client.send_latest(_create_movement_packet(packet))
    future.result(timeout=2)
    return "ok"


# ============================================================
# TOUCH
# ============================================================

def _on_touch_callback(part: TouchPart, event: TouchEvent):
    # Import perezoso para evitar imports circulares con server.py
    from kibo.transports.websocket.server import broadcast_threadsafe

    packet = {
        "id": (
            PacketId.RELEASE_TOUCH_PART.value
            if event == TouchEvent.RELEASED
            else PacketId.TOUCH_PART.value
        ),
        "part": part.name,
    }

    logger.info("[TOUCH CONNECTOR] %s -> %s", part.name, event.name)
    broadcast_threadsafe(packet)


# ============================================================
# REGISTRO
# ============================================================

def register_decoders():
    global _serial_client

    _serial_client = SerialClient.instance()

    register_decoder(PacketId.MOVE_PART, _send_movement)
    register_decoder(PacketId.MOVE_PART_LAST, _send_movement_latest)
    register_decoder(PacketId.GET_PARTS, lambda packet: _serial_client.get_state())
    register_decoder(PacketId.RESET_MOVEMENT, lambda packet: _serial_client.reset_to_initial_state())

    _serial_client.on_touch(_on_touch_callback)