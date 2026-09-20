from enum import Enum

class PacketId(Enum):
    PING = 0
    SYSTEM_OPTION = 1
    GET_PARTS = 2
    MOVE_PART = 3
    ASSISTANT_RESPONSE = 4

DECODERS = {}

def register_decoder(packet_id: PacketId, decoder_func):
    DECODERS[packet_id.value] = decoder_func

MIN_PACKET_ID = min(p.value for p in PacketId)
MAX_PACKET_ID = max(p.value for p in PacketId)