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

ABS_X_CODE = 16
ABS_Y_CODE = 17


class Joystick:

    def __init__(self, on_input=None):

        self.on_input = on_input

        self.device = None

        self.running = False
        self.thread = None

    # -----------------------------------------
    # BUSCAR CONTROL
    # -----------------------------------------

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

    # -----------------------------------------
    # CONECTAR
    # -----------------------------------------

    def _connect(self):

        device = self._find_device()

        if device is None:
            return False

        self.device = device

        print(
            f"[JOYSTICK] Conectado: "
            f"{self.device.name}"
        )

        print(
            f"[JOYSTICK] Device: "
            f"{self.device.path}"
        )

        return True

    # -----------------------------------------
    # START
    # -----------------------------------------

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

    # -----------------------------------------
    # STOP
    # -----------------------------------------

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

    # -----------------------------------------
    # EMITIR ACCIÓN
    # -----------------------------------------

    def _emit(self, action):

        if self.on_input:
            self.on_input(action)

    # -----------------------------------------
    # PROCESAR EVENTO
    # -----------------------------------------

    def _handle_event(self, event):

        # -----------------------------
        # BOTONES
        # -----------------------------

        if event.type == ecodes.EV_KEY:

            if event.value == 1:

                if event.code == BTN_CONFIRM:

                    self._emit("CONFIRM")

                elif event.code == BTN_BACK:

                    self._emit("BACK")

        # -----------------------------
        # DIRECCIONES
        # -----------------------------

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

    # -----------------------------------------
    # LOOP PRINCIPAL
    # -----------------------------------------

    def _loop(self):

        while self.running:

            # ---------------------------------
            # SI NO HAY CONTROL → BUSCAR
            # ---------------------------------

            if self.device is None:

                print("[JOYSTICK] Buscando control...")

                if not self._connect():

                    time.sleep(2)
                    continue

            # ---------------------------------
            # ESCUCHAR CONTROL
            # ---------------------------------

            try:

                for event in self.device.read_loop():

                    if not self.running:
                        break

                    self._handle_event(event)

            except Exception as e:

                print(
                    f"[JOYSTICK] Control desconectado: {e}"
                )

            # ---------------------------------
            # LIMPIAR DISPOSITIVO
            # ---------------------------------

            if self.device:

                try:
                    self.device.close()
                except Exception:
                    pass

                self.device = None

            # ---------------------------------
            # VOLVER A BUSCAR
            # ---------------------------------

            if self.running:

                print(
                    "[JOYSTICK] Control perdido. "
                    "Buscando nuevamente..."
                )

                time.sleep(1)