import logging

import select
import threading
import time

from evdev import InputDevice, ecodes, list_devices
from pynput.keyboard import Controller, Key

logger = logging.getLogger("[Joystick]")

VENDOR_ID = 0x05AC
PRODUCT_ID = 0x022C

BTN_CONFIRM = 308
BTN_BACK = 304
BTN_RELOAD = 307

ABS_HAT0X = ecodes.ABS_HAT0X
ABS_HAT0Y = ecodes.ABS_HAT0Y

DEBOUNCE_INTERVAL = 0.25

# How long to wait for input on each select() call before checking
# self.running again. Keeps the loop responsive to stop() and lets us
# notice a silently-dead Bluetooth connection
READ_TIMEOUT = 1.0

BUTTON_MAP = {
    BTN_CONFIRM: Key.enter,
    BTN_BACK: Key.esc,
}

AXIS_MAP = {
    (ABS_HAT0X, -1): Key.up,
    (ABS_HAT0X, 1): Key.down,
    (ABS_HAT0Y, -1): Key.right,
    (ABS_HAT0Y, 1): Key.left,
}


def _find_device():
    for path in list_devices():
        try:
            device = InputDevice(path)
            if device.info.vendor == VENDOR_ID and device.info.product == PRODUCT_ID:
                return device
            device.close()
        except OSError:
            pass
    return None


class Joystick:

    def __init__(self):
        self.device = None
        self.running = False
        self.thread = None
        self._keyboard = Controller()
        self._last_emit = {}  # key -> last emit timestamp, for per-key debounce
        self._device_lock = threading.Lock()

    def _connect(self):
        device = _find_device()
        if device is None:
            return False

        with self._device_lock:
            self.device = device

        return True

    def start(self):
        if self.running:
            return

        self.running = True
        self.thread = threading.Thread(
            target=self._loop,
            name="Joystick Thread",
            daemon=True
        )
        self.thread.start()

    def stop(self):
        self.running = False

        with self._device_lock:
            device = self.device
            self.device = None

        if device:
            try:
                device.close()
            except OSError:
                pass

        if self.thread:
            self.thread.join(timeout=1)

    def press(self, key):
        now = time.time()
        last = self._last_emit.get(key, 0)
        if now - last < DEBOUNCE_INTERVAL:
            return

        self._last_emit[key] = now

        self._keyboard.press(key)
        self._keyboard.release(key)

    def _handle_event(self, event):
        key = None

        if event.type == ecodes.EV_KEY:
            if event.value == 1:
                key = BUTTON_MAP.get(event.code)

        elif event.type == ecodes.EV_ABS:
            key = AXIS_MAP.get((event.code, event.value))

        if key is not None:
            self.press(key)

    def _read_events(self):
        """Reads and dispatches pending events, blocking at most
        READ_TIMEOUT seconds. Returns False if the device appears dead
        (fd closed/invalid) so the caller can reconnect."""
        try:
            r, _, _ = select.select([self.device.fd], [], [], READ_TIMEOUT)
        except (OSError, ValueError):
            # Bad file descriptor: device is gone.
            return False

        if not r:
            # Timeout, no data. Device might still be alive; let the
            # caller re-check self.running and loop again.
            return True

        try:
            for event in self.device.read():
                self._handle_event(event)
        except BlockingIOError:
            # Woke up but nothing to read yet; not an error.
            pass
        except OSError as e:
            logger.warning("Control desconectado: %s", e)
            return False

        return True

    def _loop(self):
        while self.running:
            if self.device is None:
                logger.info("Searching for device...")
                if not self._connect():
                    time.sleep(2)
                    continue

            logger.info("Connected")

            device_alive = True
            while self.running and device_alive:
                device_alive = self._read_events()

            with self._device_lock:
                device = self.device
                self.device = None

            if device:
                try:
                    device.close()
                except OSError:
                    pass

            if self.running:
                logger.info("Device lost. Trying again...")
                time.sleep(1)
