import logging

from services.joystick.joystick import Joystick

logger = logging.getLogger(__name__)

class JoystickService:

    def __init__(self):
        self.joystick = None

    def start(self):

        try:
            self.joystick = Joystick()
            self.joystick.start()
            logger.info("[JOYSTICK SERVICE] Initialized")
        except Exception as e:
            logger.error("[JOYSTICK SERVICE] Controller not initialized: %s", e)
            self.joystick = None

    def stop(self):
        if self.joystick:
            self.joystick.stop()
            self.joystick = None
