from enum import Enum

class PacketId(Enum):
    PING = 0
    SYSTEM_OPTION = 1
    ASSISTANT_RESPONSE = 2
    GET_PARTS = 3
    MOVE_PART = 4
    MOVE_PART_LAST = 5
    RESET_MOVEMENT = 6
    TOUCH_PART = 7
    RELEASE_TOUCH_PART = 8

DECODERS = {}

def register_decoder(packet_id: PacketId, decoder_func):
    DECODERS[packet_id.value] = decoder_func

MIN_PACKET_ID = min(p.value for p in PacketId)
MAX_PACKET_ID = max(p.value for p in PacketId)
