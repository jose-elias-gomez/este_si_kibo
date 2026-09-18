import threading
import time

from evdev import InputDevice, ecodes, list_devices

# -----------------------------------------
# IDENTIFICACIÓN DEL CONTROL
# -----------------------------------------

VENDOR_ID = 0x05AC
PRODUCT_ID = 0x022C

# -----------------------------------------
# CÓDIGOS DEL CONTROL
# -----------------------------------------

BTN_CONFIRM = 308
BTN_BACK = 304
BTN_RELOAD = 307  # Botón asignado para reiniciar (F5)

ABS_X_CODE = 16
ABS_Y_CODE = 17

# Tiempo mínimo entre pulsaciones (evita ráfagas)
DEBOUNCE_INTERVAL = 0.25


class Joystick:

    def __init__(self, on_input=None):
        self.on_input = on_input
        self.device = None
        self.running = False
        self.thread = None
        self._last_emit_time = 0

    def _find_device(self):
        for path in list_devices():
            try:
                device = InputDevice(path)
                if (
                    device.info.vendor == VENDOR_ID
                    and device.info.product == PRODUCT_ID
                ):
                    print(
                        f"[JOYSTICK] Control encontrado: "
                        f"{device.name} -> {path}"
                    )
                    return device
                device.close()
            except Exception:
                pass
        return None

    def _connect(self):
        device = self._find_device()
        if device is None:
            return False

        self.device = device
        print(f"[JOYSTICK] Conectado: {self.device.name}")
        print(f"[JOYSTICK] Device: {self.device.path}")
        return True

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

        if self.device:
            try:
                self.device.close()
            except Exception:
                pass
            self.device = None

        if self.thread:
            self.thread.join(timeout=1)

        print("[JOYSTICK] Listener detenido")

    def _emit(self, action):
        now = time.time()
        if now - self._last_emit_time < DEBOUNCE_INTERVAL:
            return

        self._last_emit_time = now

        if self.on_input:
            self.on_input(action)

    def _handle_event(self, event):
        # BOTONES
        if event.type == ecodes.EV_KEY:
            if event.value == 1:
                if event.code == BTN_RELOAD:
                    self._emit("RELOAD")
                elif event.code == BTN_CONFIRM:
                    self._emit("CONFIRM")
                elif event.code == BTN_BACK:
                    self._emit("BACK")

        # DIRECCIONES
        elif event.type == ecodes.EV_ABS:
            if event.code == ABS_X_CODE:
                if event.value == -1:
                    self._emit("UP")
                elif event.value == 1:
                    self._emit("DOWN")

            elif event.code == ABS_Y_CODE:
                if event.value == -1:
                    self._emit("RIGHT")
                elif event.value == 1:
                    self._emit("LEFT")

    def _loop(self):
        while self.running:
            if self.device is None:
                print("[JOYSTICK] Buscando control...")
                if not self._connect():
                    time.sleep(2)
                    continue

            try:
                for event in self.device.read_loop():
                    if not self.running:
                        break
                    self._handle_event(event)

            except Exception as e:
                print(f"[JOYSTICK] Control desconectado: {e}")

            if self.device:
                try:
                    self.device.close()
                except Exception:
                    pass
                self.device = None

            if self.running:
                print("[JOYSTICK] Control perdido. Buscando nuevamente...")
                time.sleep(1)