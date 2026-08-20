import platform
import subprocess

def set_volume(level: int):
  level = max(0, min(100, level))
  system = platform.system()

  if system == "Windows":
    _set_volume_windows(level)
  elif system == "Darwin":
    _set_volume_macos(level)
  elif system == "Linux":
    _set_volume_linux(level)
  else:
    raise NotImplementedError(f"Operating system not supported: {system}")


def _set_volume_windows(level: int):
  from pycaw.pycaw import AudioUtilities

  devices = AudioUtilities.GetSpeakers()
  volume = devices.EndpointVolume
  volume.SetMasterVolumeLevelScalar(level / 100.0, None)

def _set_volume_macos(level: int):
  subprocess.run(
    ["osascript", "-e", f"set volume output volume {level}"],
    check=True
  )


def _set_volume_linux(level: int):
  try:
    subprocess.run(
      ["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{level}%"],
      check=True
    )
  except (subprocess.CalledProcessError, FileNotFoundError):
    # Alternative with amixer (ALSA)
    subprocess.run(
      ["amixer", "-D", "pulse", "sset", "Master", f"{level}%"],
      check=True
    )
