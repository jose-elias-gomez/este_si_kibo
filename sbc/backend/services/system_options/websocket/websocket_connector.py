from screen_brightness_control import set_brightness

from services.system_options.power import shutdown_computer
from services.system_options.sound_editor import set_volume
from transports.websocket.handler.context_int import register_set_context_int

def register_system_options_packets():
  register_set_context_int("volume", set_volume)
  register_set_context_int("brightness", set_brightness)
  register_set_context_int("shutdown", shutdown_computer)
