"""System settings controller module for cross-platform hardware management.

This module provides unified access to master volume and display brightness
controls across Windows, macOS, Linux, and Raspberry Pi hardware.

Dependencies:
    - pycaw (Windows audio)
    - comtypes (Windows COM interface)
    - screen-brightness-control (Cross-platform brightness)
"""

import os
import platform
import subprocess
from pathlib import Path

# Optional dependency imports with graceful fallback for non-Windows platforms
try:
  from comtypes import CLSCTX_ALL
  from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
except ImportError:
  pass

try:
  import screen_brightness_control as sbc
except ImportError:
  sbc = None


def set_volume(level: int) -> None:
  """Sets the system master volume.

  Args:
      level (int): Target volume percentage. Must be an integer between 0 and 100.

  Raises:
      NotImplementedError: Raised if the running operating system is unsupported.
      subprocess.CalledProcessError: Raised if Linux audio backend commands fail.

  Example:
      >>> set_volume(50)
  """
  # Clamp value within the valid range [0, 100]
  level = max(0, min(100, level))
  system = platform.system()

  if system == "Windows":
    _set_volume_windows(level)
  elif system == "Darwin":
    _set_volume_macos(level)
  elif system == "Linux":
    _set_volume_linux(level)
  else:
    raise NotImplementedError(f"Unsupported operating system: {system}")


def _set_volume_windows(level: int) -> None:
  """Adjusts master volume on Windows using Windows Core Audio APIs (pycaw).

  Args:
      level (int): Normalized volume level (0 to 100).
  """
  devices = AudioUtilities.GetSpeakers()
  interface = devices.Activate(
    getattr(IAudioEndpointVolume, "_iid_"), CLSCTX_ALL, None
  )
  volume = interface.QueryInterface(IAudioEndpointVolume)

  # pycaw expects a scalar float from 0.0 to 1.0
  volume.SetMasterVolumeLevelScalar(level / 100.0, None)


def _set_volume_macos(level: int) -> None:
  """Adjusts output volume on macOS using native AppleScript execution.

  Args:
      level (int): Volume percentage (0 to 100).
  """
  subprocess.run(
    ["osascript", "-e", f"set volume output volume {level}"],
    check=True
  )


def _set_volume_linux(level: int) -> None:
  """Adjusts master volume on Linux systems using PulseAudio or ALSA fallback.

  Args:
      level (int): Volume percentage (0 to 100).
  """
  try:
    # Default target for PulseAudio / PipeWire
    subprocess.run(
      ["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{level}%"],
      check=True
    )
  except (subprocess.CalledProcessError, FileNotFoundError):
    # Fallback to ALSA if pactl is unavailable
    subprocess.run(
      ["amixer", "-D", "pulse", "sset", "Master", f"{level}%"],
      check=True
    )


def set_brightness(level: int) -> None:
  """Sets the display brightness across desktop monitors or Raspberry Pi displays.

  Handles cross-platform desktop monitors using DDC/CI or OS interfaces, with
  a native sysfs fallback for Raspberry Pi DSI displays.

  Args:
      level (int): Target brightness percentage (0 to 100).

  Example:
      >>> set_brightness(75)
  """
  level = max(0, min(100, level))

  # Check for Raspberry Pi sysfs display interface first
  backlight_paths = list(Path("/sys/class/backlight/").glob("*"))
  if backlight_paths:
    _set_brightness_raspberry_pi(level, backlight_paths[0])
    return

  # Standard desktop monitor brightness control
  if sbc is not None:
    try:
      sbc.set_brightness(level)
    except Exception as err:
      print(f"Failed to adjust desktop display brightness: {err}")
  else:
    print("Error: 'screen-brightness-control' library is not installed.")


def _set_brightness_raspberry_pi(level: int, backlight_path: Path) -> None:
  """Writes raw brightness scalar directly to the Linux sysfs kernel interface.

  Args:
      level (int): Percentage value (0 to 100).
      backlight_path (Path): Path to the active backlight device under sysfs.

  Note:
      Requires root privileges (sudo) or configured udev rules granting write
      access to the sysfs brightness attribute.
  """
  max_brightness_file = backlight_path / "max_brightness"
  brightness_file = backlight_path / "brightness"

  # Read hardware max_brightness (defaults to 255 on official Pi displays)
  max_val = int(max_brightness_file.read_text().strip()) if max_brightness_file.exists() else 255
  target_value = int((max_val * level) / 100)

  try:
    brightness_file.write_text(str(target_value))
  except PermissionError:
    print(
      "Permission denied: Writing to /sys/class/backlight requires root "
      "privileges or udev rule permission."
    )
