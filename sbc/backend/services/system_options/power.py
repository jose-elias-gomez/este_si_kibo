
import platform
import subprocess


def shutdown_computer(delay_seconds: int = 0) -> None:
    """Initiates a graceful system shutdown across supported operating systems.

    Supports Windows, macOS (Darwin), and Linux. Optionally accepts a delay
    in seconds before the shutdown procedure begins.

    Args:
        delay_seconds (int, optional): Delay time in seconds before shutdown.
            Defaults to 0 (immediate shutdown). Must be a non-negative integer.

    Raises:
        ValueError: Raised if delay_seconds is a negative integer.
        NotImplementedError: Raised if running on an unsupported OS.
        subprocess.CalledProcessError: Raised if the underlying OS command fails.

    Example:
        >>> shutdown_computer()  # Immediate shutdown
        >>> shutdown_computer(delay_seconds=60)  # Shutdown after 1 minute
    """
    if delay_seconds < 0:
        raise ValueError("delay_seconds must be a non-negative integer.")

    system = platform.system()

    if system == "Windows":
        _shutdown_windows(delay_seconds)
    elif system == "Darwin":
        _shutdown_macos(delay_seconds)
    elif system == "Linux":
        _shutdown_linux(delay_seconds)
    else:
        raise NotImplementedError(f"Unsupported operating system: {system}")


def _shutdown_windows(delay_seconds: int) -> None:
    """Executes the Windows native shutdown command.

    Args:
        delay_seconds (int): Delay in seconds before shutting down.
    """
    # /s = shutdown, /t = set timer in seconds
    subprocess.run(
        ["shutdown", "/s", "/t", str(delay_seconds)],
        check=True
    )


def _shutdown_macos(delay_seconds: int) -> None:
    """Executes the macOS shutdown sequence using osascript or shutdown CLI.

    Args:
        delay_seconds (int): Delay in seconds before shutting down.

    Note:
        Immediate shutdowns use AppleScript to prompt native OS confirmation.
        Delayed shutdowns fall back to the system `shutdown` utility, which
        requires administrative (sudo) permissions.
    """
    if delay_seconds == 0:
        # Uses native Finder AppleScript to request immediate shutdown
        script = 'tell application "System Events" to shut down'
        subprocess.run(["osascript", "-e", script], check=True)
    else:
        # Convert seconds to minutes (minimum resolution for macOS shutdown CLI)
        minutes = max(1, delay_seconds // 60)
        subprocess.run(["sudo", "shutdown", "-h", f"+{minutes}"], check=True)


def _shutdown_linux(delay_seconds: int) -> None:
    """Executes the Linux systemctl or shutdown CLI command.

    Args:
        delay_seconds (int): Delay in seconds before shutting down.

    Note:
        Modern systemd distributions (Ubuntu, Fedora, Arch, Raspberry Pi OS)
        allow non-root shutdowns via systemctl if running in an active user session.
    """
    if delay_seconds == 0:
        try:
            # Preferred modern method (systemd)
            subprocess.run(["systemctl", "poweroff"], check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            # Fallback to standard shutdown utility
            subprocess.run(["shutdown", "-h", "now"], check=True)
    else:
        minutes = max(1, delay_seconds // 60)
        subprocess.run(["shutdown", "-h", f"+{minutes}"], check=True)


def cancel_shutdown() -> None:
    """Aborts a previously scheduled system shutdown.

    Raises:
        NotImplementedError: Raised if running on an unsupported OS.
        subprocess.CalledProcessError: Raised if no shutdown is active or command fails.

    Example:
        >>> cancel_shutdown()
    """
    system = platform.system()

    if system == "Windows":
        subprocess.run(["shutdown", "/a"], check=True)
    elif system in ("Linux", "Darwin"):
        subprocess.run(["shutdown", "-c"], check=True)
    else:
        raise NotImplementedError(f"Unsupported operating system: {system}")
