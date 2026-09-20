import logging
from fastapi import FastAPI

logger = logging.getLogger("[Joystick Service]")

try:
    from kibo.services.joystick._joystick import Joystick
except ImportError as e:
    Joystick = None
    logger.warning("Not running in linux distribution or dependencies not installed for joystick service: %s", e)

joystick = None  # type: "Joystick | None"

class JoystickService:

    @staticmethod
    def start(webserver: FastAPI):
        global joystick
        if Joystick is None:
            return

        try:
            joystick = Joystick()
            joystick.start()
            logger.info("Joystick started successfully")
            webserver.router.on_shutdown.append(JoystickService.stop)
        except Exception as e:
            logger.error("Joystick not initialized: %s", e)
            if joystick is not None:
                try:
                    joystick.stop()
                except Exception:
                    logger.exception("Error cleaning up partially-initialized joystick")
            joystick = None

    @staticmethod
    def stop():
        global joystick
        if joystick is not None:
            joystick.stop()
            joystick = None