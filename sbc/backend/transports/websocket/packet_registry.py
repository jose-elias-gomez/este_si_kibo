from enum import Enum, auto

class PacketId(Enum):
    SYSTEM_OPTION = auto()
    JOYSTICK = auto()

DECODERS = [len(PacketId)]
