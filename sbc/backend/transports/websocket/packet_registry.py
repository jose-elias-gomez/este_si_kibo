from enum import Enum, auto

class PacketId(Enum):
    SYSTEM_OPTION = 1
    JOYSTICK = 2
    GET_PARTS = 3
    MOVE_PART = 4

DECODERS = {}

def register_decoder(packet_id: PacketId, decoder_func):
    DECODERS[packet_id.value] = decoder_func

MIN_PACKET_ID = min(p.value for p in PacketId)
MAX_PACKET_ID = max(p.value for p in PacketId)
