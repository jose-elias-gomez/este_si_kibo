import json
import logging
from handler.context_int import handle_set_context_int

logger = logging.getLogger(__name__)

class PacketDecodeError(Exception):
    pass

def decode(payload):
    try:
        packet = json.loads(payload)
    except json.JSONDecodeError as e:
        raise PacketDecodeError(f"JSON inválido: {e}") from e

    if not isinstance(packet, dict):
        raise PacketDecodeError("El packet debe ser un objeto JSON")

    packet_id_raw = packet["id"]
    if packet_id_raw is None:
        raise PacketDecodeError("Falta el campo 'id'")

    try:
        packet_id = int(packet_id_raw)
    except (TypeError, ValueError):
        raise PacketDecodeError(f"'id' inválido: {packet_id_raw!r}")

    if packet_id == 0:
        decode_context_int(packet)
    else:
        logger.warning("packet_id desconocido: %s", packet_id)
        raise PacketDecodeError(f"'id' inválido: {packet_id_raw!r}")

def decode_context_int(data):
    context = data.get("context")
    if not isinstance(context, str) or not context:
        raise PacketDecodeError("'context' debe ser un string no vacío")

    value_raw = data.get("value")
    try:
        value = int(value_raw)
    except (TypeError, ValueError):
        raise PacketDecodeError(f"'value' inválido: {value_raw!r}")

    handle_set_context_int(context, value)

