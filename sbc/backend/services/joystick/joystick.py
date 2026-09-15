import threading
import time
from evdev import InputDevice, ecodes

# Mapeo según la prueba en tu Orange Pi 5 Pro
DEV_PATH = '/dev/input/event12'

# Códigos de evdev
BTN_CONFIRM = 308  # BTN_WEST
BTN_BACK = 304     # BTN_A

ABS_X_CODE = 16    # ABS_HAT0X
ABS_Y_CODE = 17    # ABS_HAT0Y


class Joystick:

    def __init__(self, on_input=None, dev_path=DEV_PATH):
        self.on_input = on_input
        self.dev_path = dev_path
        self.device = None
        self.running = False
        self.thread = None

        self._connect()
    
    def _connect(self):
        try:
            self.device = InputDevice(self.dev_path)
            print(f"[JOYSTICK] Conectado a: {self.device.name} ({self.device.path})")
        except Exception as e:
            raise RuntimeError(f"[JOYSTICK] No se pudo abrir {self.dev_path}: {e}")

    def start(self):
        if self.running:
            return

        self.running = True
        self.thread = threading.Thread(
            target=self._loop,
            daemon=True
        )
        self.thread.start()
        print("[JOYSTICK] Listener iniciado (evdev)")

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
        # Verificación para Pylance: asegura que self.device existe
        if self.device is None:
            print("[JOYSTICK] No se puede iniciar el loop: dispositivo no conectado")
            return

        while self.running:
            try:
                for event in self.device.read_loop():
                    if not self.running:
                        break

                    # ----------------------------------
                    # BOTONES (EV_KEY)
                    # ----------------------------------
                    if event.type == ecodes.EV_KEY:
                        if event.value == 1:
                            if event.code == BTN_CONFIRM:
                                self._emit("CONFIRM")
                            elif event.code == BTN_BACK:
                                self._emit("BACK")

                    # ----------------------------------
                    # PALANQUITA / EJES (EV_ABS)
                    # ----------------------------------
                    elif event.type == ecodes.EV_ABS:
                        # Eje 16 (ABS_HAT0X) -> ARRIBA / ABAJO
                        if event.code == ABS_X_CODE:
                            if event.value == -1:
                                self._emit("UP")
                            elif event.value == 1:
                                self._emit("DOWN")

                        # Eje 17 (ABS_HAT0Y) -> DERECHA / IZQUIERDA
                        elif event.code == ABS_Y_CODE:
                            if event.value == -1:
                                self._emit("RIGHT")
                            elif event.value == 1:
                                self._emit("LEFT")

            except Exception as e:
                print(f"[JOYSTICK] Error en lectura evdev: {e}")
                time.sleep(1)
            while self.running:
                try:
                    for event in self.device.read_loop():
                        if not self.running:
                            break

                        # ----------------------------------
                        # BOTONES (EV_KEY)
                        # ----------------------------------
                        if event.type == ecodes.EV_KEY:
                            if event.value == 1:
                                if event.code == BTN_CONFIRM:
                                    self._emit("CONFIRM")
                                elif event.code == BTN_BACK:
                                    self._emit("BACK")

                        # ----------------------------------
                        # PALANQUITA / EJES (EV_ABS)
                        # ----------------------------------
                        elif event.type == ecodes.EV_ABS:
                            # Eje 16 (ABS_HAT0X) ahora controla ARRIBA / ABAJO
                            if event.code == ABS_X_CODE:  # Código 16
                                if event.value == -1:
                                    self._emit("UP")
                                elif event.value == 1:
                                    self._emit("DOWN")

                            # Eje 17 (ABS_HAT0Y) ahora controla DERECHA / IZQUIERDA
                            elif event.code == ABS_Y_CODE:  # Código 17
                                if event.value == -1:
                                    self._emit("RIGHT")
                                elif event.value == 1:
                                    self._emit("LEFT")

                except Exception as e:
                    print(f"[JOYSTICK] Error en lectura evdev: {e}")
                    time.sleep(1)
            while self.running:
                try:
                    # read_loop() bloquea hasta que hay un nuevo evento
                    for event in self.device.read_loop():
                        if not self.running:
                            break

                        # ----------------------------------
                        # BOTONES (EV_KEY)
                        # ----------------------------------
                        if event.type == ecodes.EV_KEY:
                            # event.value == 1 es evento de presión (0 es soltar, 2 mantener)
                            if event.value == 1:
                                if event.code == BTN_CONFIRM:
                                    self._emit("CONFIRM")
                                elif event.code == BTN_BACK:
                                    self._emit("BACK")

                        # ----------------------------------
                        # PALANQUITA / EJES (EV_ABS)
                        # ----------------------------------
                        elif event.type == ecodes.EV_ABS:
                            # Eje Y (Arriba / Abajo)
                            if event.code == ABS_Y_CODE:
                                if event.value == -1:
                                    self._emit("UP")
                                elif event.value == 1:
                                    self._emit("DOWN")

                            # Eje X (Izquierda / Derecha)
                            elif event.code == ABS_X_CODE:
                                if event.value == 1:
                                    self._emit("LEFT")
                                elif event.value == -1:
                                    self._emit("RIGHT")

                except Exception as e:
                    print(f"[JOYSTICK] Error en lectura evdev: {e}")
                    time.sleep(1)
