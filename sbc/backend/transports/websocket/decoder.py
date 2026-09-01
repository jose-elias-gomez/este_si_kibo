import logging
from packet_registry import PacketId, DECODERS

logger = logging.getLogger(__name__)

class PacketDecodeError(Exception):
    pass

def decode(packet):
    packet_id_raw = packet["id"]
    if packet_id_raw is None:
        raise PacketDecodeError("Falta el campo 'id'")

    try:
        packet_id = int(packet_id_raw)
    except (TypeError, ValueError):
        raise PacketDecodeError(f"'id' inválido: {packet_id_raw!r}")

    if len(DECODERS) < packet_id or len(DECODERS) > len(PacketId):
      raise PacketDecodeError(f"Packet ${packet_id} fuera de rango, debe estar entre 0 y ${len(DECODERS)}")

    return {
      "id": packet_id,
      "payload": DECODERS[packet_id].decode(packet)
    }
