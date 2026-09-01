import platform
import subprocess

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

def get_volume() -> int | None:
  """
  Returns:
      level (int): Target volume percentage. an integer between 0 and 100 or None.
  """
  system = platform.system()

  try:
    if system == "Windows":
      return _get_volume_windows()
    if system == "Darwin":
      return _get_volume_macos()
    if system == "Linux":
      return _get_volume_linux()
  except Exception as err:
    print(f"Error retrieving volume on {system}: {err}")

  return None


def _get_volume_windows() -> int:
  devices = AudioUtilities.GetSpeakers()
  interface = devices.Activate(
    getattr(IAudioEndpointVolume, "_iid_"), CLSCTX_ALL, None
  )
  volume = interface.QueryInterface(IAudioEndpointVolume)

  scalar_vol = volume.GetMasterVolumeLevelScalar()
  return int(round(scalar_vol * 100))


def _get_volume_macos() -> int:
  result = subprocess.run(
    ["osascript", "-e", "output volume of (get volume settings)"],
    capture_output=True,
    text=True,
    check=True,
  )
  return int(result.stdout.strip())


def _get_volume_linux() -> int:
  try:
    result = subprocess.run(
      ["pactl", "get-sink-volume", "@DEFAULT_SINK@"],
      capture_output=True,
      text=True,
      check=True,
    )
    # Extract first percentage. eg: "Volume: front-left: 32768 /  50% / ..."
    for part in result.stdout.split("/"):
      if "%" in part:
        return int(part.replace("%", "").strip())
  except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
    pass

  result = subprocess.run(
    ["amixer", "-D", "pulse", "sget", "Master"],
    capture_output=True,
    text=True,
    check=True,
  )
  # Search patterns like "[50%]" in amixer
  import re
  match = re.search(r"\[(\d+)%\]", result.stdout)
  if match:
    return int(match.group(1))

  raise RuntimeError("Could not parse volume output from Linux audio backends")


def _set_volume_windows(level: int) -> None:
  devices = AudioUtilities.GetSpeakers()
  interface = devices.Activate(
    getattr(IAudioEndpointVolume, "_iid_"), CLSCTX_ALL, None
  )
  volume = interface.QueryInterface(IAudioEndpointVolume)

  volume.SetMasterVolumeLevelScalar(level / 100.0, None)


def _set_volume_macos(level: int) -> None:
  subprocess.run(
    ["osascript", "-e", f"set volume output volume {level}"],
    check=True
  )


def _set_volume_linux(level: int) -> None:
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
