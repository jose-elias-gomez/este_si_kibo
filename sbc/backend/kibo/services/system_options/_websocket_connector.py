from kibo.transports.websocket.decoder import PacketDecodeError
from kibo.transports.websocket.packet_registry import register_decoder, PacketId

HANDLERS = {}
def register():
    from kibo.services.system_options._power import shutdown_computer
    from kibo.services.system_options._sound_editor import set_volume, get_volume
    from kibo.services.system_options._screen_brightness import set_brightness, get_brightness

    HANDLERS["get_volume"] = get_volume
    HANDLERS["get_brightness"] = get_brightness

    HANDLERS["set_volume"] = set_volume
    HANDLERS["set_brightness"] = set_brightness

    HANDLERS["shutdown"] = shutdown_computer

    print("register system options")
    register_decoder(PacketId.SYSTEM_OPTION, decode)

def decode(data):
    context = data["context"]
    if not isinstance(context, str) or not context:
        raise PacketDecodeError("'context' debe ser un string no vacío")

    handler = HANDLERS[context]
    if not handler:
        raise PacketDecodeError(f"El contexto de {context} no es parte del system_options")

    if context.startswith("get"):
        return handler()

    value_raw = data["value"]
    try:
        value = int(value_raw)
    except (TypeError, ValueError):
        raise PacketDecodeError(f"'value' inválido: {value_raw!r}")
    return handler(value)
