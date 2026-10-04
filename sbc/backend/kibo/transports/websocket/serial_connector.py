from kibo.transports.serial.client import SerialClient
from kibo.transports.serial.packets.in_touch import TouchPart, TouchEvent
from kibo.transports.serial.packets.out_movement import MovementPacket, PartId, MotorCommand
from kibo.transports.websocket.packet_registry import register_decoder, PacketId

def _create_movement_packet(data) -> MovementPacket:
    part = PartId[data["part"]]
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

def _on_touch_callback(part: TouchPart, event: TouchEvent):
    from kibo.transports.websocket.server import broadcast
    if event.RELEASED:
        broadcast({"id": PacketId.RELEASE_TOUCH_PART.value, "part": part.name})
    else:
        broadcast({"id": PacketId.TOUCH_PART.value, "part": part.name})


def register_decoders():
    try:
        _serial_client: SerialClient = SerialClient.instance()
    except ValueError:
        def error(packet):
            raise Exception("Serial port is not connected")
        register_decoder(PacketId.MOVE_PART, error)
        register_decoder(PacketId.MOVE_PART_LAST, error)
        register_decoder(PacketId.GET_PARTS, error)
        register_decoder(PacketId.RESET_MOVEMENT, error)
        return

    register_decoder(PacketId.MOVE_PART, lambda packet: _serial_client.send(_create_movement_packet(packet)))
    register_decoder(PacketId.MOVE_PART_LAST, lambda packet: _serial_client.send_latest(_create_movement_packet(packet)))
    register_decoder(PacketId.GET_PARTS, lambda packet: _serial_client.get_state())
    register_decoder(PacketId.RESET_MOVEMENT, lambda packet: _serial_client.reset_to_initial_state())

    _serial_client.on_touch(_on_touch_callback)
