import asyncio

from services.joystick.joystick import Joystick
from transports.websocket.server import manager


class JoystickService:

    def __init__(self):

        self.loop = None
        self.joystick = None

    def start(self):

        self.loop = asyncio.get_running_loop()

        try:

            self.joystick = Joystick(
                on_input=self._on_input
            )

            self.joystick.start()

            print("[JOYSTICK SERVICE] Iniciado")

        except Exception as e:

            print(
                "[JOYSTICK SERVICE] Controller no disponible:",
                e
            )

            self.joystick = None

    def stop(self):

        if self.joystick:

            self.joystick.stop()

            self.joystick = None

    def _on_input(self, action):

        if self.loop is None:
            return

        asyncio.run_coroutine_threadsafe(
            manager.broadcast_json({
                "type": "input",
                "action": action,
            }),
            self.loop
        )