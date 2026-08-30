import hid
import threading
import time


VID = 0x05AC
PID = 0x022C


# Botones
BUTTON_B = 1
BUTTON_D = 2
BUTTON_C = 8
BUTTON_A = 16


# Palanquita
DIRECTION_CENTER = 0
DIRECTION_RIGHT = 1
DIRECTION_DOWN = 3
DIRECTION_LEFT = 5
DIRECTION_UP = 7


class Joystick:

    def __init__(self, on_input=None):

        self.on_input = on_input

        self.device = None
        self.running = False
        self.thread = None

        self.previous_direction = DIRECTION_CENTER
        self.previous_buttons = 0

        self._connect()

    def _connect(self):

        for device in hid.enumerate(VID, PID):

            if (
                device["usage_page"] == 0x01
                and device["usage"] == 0x05
            ):

                self.device = hid.device()
                self.device.open_path(device["path"])

                print(
                    "[JOYSTICK] Conectado:",
                    device["product_string"]
                )

                return

        raise RuntimeError(
            "[JOYSTICK] No se encontró el gamepad"
        )

    def start(self):

        if self.running:
            return

        self.running = True

        self.thread = threading.Thread(
            target=self._loop,
            daemon=True
        )

        self.thread.start()

        print("[JOYSTICK] Listener iniciado")

    def stop(self):

        self.running = False

        if self.thread:
            self.thread.join(timeout=1)

        if self.device:
            self.device.close()
            self.device = None

        print("[JOYSTICK] Listener detenido")

    def _emit(self, action):

        if self.on_input:
            self.on_input(action)

    def _loop(self):

        while self.running:

            try:

                data = self.device.read(
                    64,
                    timeout_ms=100
                )

                if not data:
                    continue

                data = list(data)

                buttons = data[5]
                direction = data[7]

                # ----------------------------------
                # PALANQUITA
                # ----------------------------------

                if direction != self.previous_direction:

                    self.previous_direction = direction

                    directions = {
                        DIRECTION_UP: "UP",
                        DIRECTION_DOWN: "DOWN",
                        DIRECTION_LEFT: "LEFT",
                        DIRECTION_RIGHT: "RIGHT",
                    }

                    action = directions.get(direction)

                    if action:
                        self._emit(action)

                # ----------------------------------
                # BOTONES
                # ----------------------------------

                if buttons != self.previous_buttons:

                    self.previous_buttons = buttons

                    if buttons & BUTTON_A:
                        self._emit("CONFIRM")

                    elif buttons & BUTTON_B:
                        self._emit("BACK")

            except Exception as e:

                print(
                    "[JOYSTICK] Error:",
                    e
                )

                time.sleep(1)