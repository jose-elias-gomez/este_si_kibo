import logging

from services.joystick.joystick import Joystick

logger = logging.getLogger("[Joystick Service]")

class JoystickService:

    def __init__(self):
        self.joystick = None

    def start(self):

        try:
            self.joystick = Joystick()
            self.joystick.start()
            logger.info("Initialized")
        except Exception as e:
            logger.error("Controller not initialized: %s", e)
            self.joystick = None

    def stop(self):
        if self.joystick:
            self.joystick.stop()
            self.joystick = None
