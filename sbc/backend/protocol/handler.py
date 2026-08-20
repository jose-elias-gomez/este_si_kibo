import logging
from options.sound_editor import set_volume
from options.screen_brightness import set_brightness
from options.power import shutdown_computer

logger = logging.getLogger(__name__)
CONTEXT_HANDLERS = {}

def handle_context_int_packet(context: str, value: int):
    handler = CONTEXT_HANDLERS.get(context)
    if handler is None:
        logger.warning("No hay handler registrado para contexto '%s'", context)
        return
    try:
        handler(value)
    except Exception:
        logger.exception("Error ejecutando handler para '%s' con value=%s", context, value)

def register_context_int(context_name: str, handler_func):
    CONTEXT_HANDLERS[context_name] = handler_func

def register_handlers():
    register_context_int("volume", set_volume)
    register_context_int("brightness", set_brightness)
    register_context_int("shutdown", shutdown_computer)

register_handlers()
