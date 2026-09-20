from pathlib import Path

import screen_brightness_control as sbc

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
  try:
    sbc.set_brightness(level)
  except Exception as err:
    print(f"Failed to adjust desktop display brightness: {err}")

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

def get_brightness() -> int | None:
  backlight_paths = list(Path("/sys/class/backlight/").glob("*"))
  if backlight_paths:
    return _get_brightness_raspberry_pi(backlight_paths[0])

  try:
    brightness_list = sbc.get_brightness()
    if brightness_list:
      primary_brightness = brightness_list[0]
      if primary_brightness is not None:
        return int(primary_brightness)
  except Exception as err:
    print(f"Failed to retrieve desktop display brightness: {err}")

  return None

def _get_brightness_raspberry_pi(backlight_path: Path) -> int | None:
  brightness_file = backlight_path / "actual_brightness"
  if not brightness_file.exists():
    brightness_file = backlight_path / "brightness"

  max_brightness_file = backlight_path / "max_brightness"

  try:
    current_val = int(brightness_file.read_text().strip())
    max_val = (
      int(max_brightness_file.read_text().strip())
      if max_brightness_file.exists()
      else 255
    )

    if max_val == 0:
      return 0

    percentage = (current_val / max_val) * 100
    return int(max(0, min(100, percentage)))
  except Exception as err:
    print(f"Failed to read Raspberry Pi brightness: {err}")
    return None
