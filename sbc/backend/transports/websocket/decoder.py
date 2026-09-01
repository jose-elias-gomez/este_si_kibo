import logging
from transports.websocket.packet_registry import MIN_PACKET_ID, MAX_PACKET_ID, DECODERS

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
    if not (MIN_PACKET_ID <= packet_id <= MAX_PACKET_ID):
        raise PacketDecodeError(
            f"Packet ${packet_id} fuera de rango, debe estar entre {MIN_PACKET_ID} y {MAX_PACKET_ID}")

    decoder = DECODERS[packet_id]
    if not decoder:
        raise PacketDecodeError(f"Packet ${packet_id} no tiene un decodificador registrado")

    return {
      "id": packet_id,
      "payload": decoder(packet)
    }
