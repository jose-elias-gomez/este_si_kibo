from transports.serial.enums import STOP, LEFT, RIGHT
from transports.serial.packet import MovementPacket

# Movement definition (LEFT Motor - Right Motor)
move_motor = {
    "down" : (LEFT, LEFT),
    "up" : (RIGHT, RIGHT),
    "left" : (LEFT, RIGHT),
    "right" : (RIGHT, LEFT),
    "stop" : (STOP, STOP),
}

# Movement Function
def movement(parts, packet_builder: MovementPacket):
    for part in parts:
        if "=" not in part:
            continue
        type_, value = part.split("=")

        if type_ == "motor":
            l_motor, r_motor = move_motor[value]
            packet_builder.left_wheel(l_motor)
            packet_builder.right_wheel(r_motor)

            # if value == "rotate-left":
            #     continue
            # if value == "rotate-right":
            #     continue
        else:
            angle = int(value)

            match (type_):
                case "head":     packet_builder.head(angle)
                case"left-arm":  packet_builder.left_arm(angle)
                case"right-arm": packet_builder.right_arm(angle)
    built_packet = packet_builder.build()
    return built_packet
