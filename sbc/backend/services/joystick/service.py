import asyncio
from transports.websocket.packet_registry import PacketId
from services.joystick.joystick import Joystick
from transports.websocket.server import broadcast


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
            print(f"[JOYSTICK SERVICE] Controller no disponible: {e}")
            self.joystick = None

    def stop(self):
        if self.joystick:
            self.joystick.stop()
            self.joystick = None

# En service.py

    def _on_input(self, action):
        if self.loop is None or not self.loop.is_running():
            return

        # Función auxiliar para ejecutar broadcast sin bloquear el hilo
        async def send_action():
            try:
                # Timeout estricto de 200ms para evitar que se quede esperando sockets colgados
                await asyncio.wait_for(
                    broadcast({
                        "id": PacketId.JOYSTICK.value,
                        "action": action
                    }),
                    timeout=0.2
                )
            except asyncio.TimeoutError:
                print("[JOYSTICK SERVICE] Broadcast descartado por timeout (socket bloqueado)")
            except Exception as e:
                print(f"[JOYSTICK SERVICE] Error enviando acción: {e}")

        # Programar la tarea asíncrona de forma independiente
        asyncio.run_coroutine_threadsafe(send_action(), self.loop)