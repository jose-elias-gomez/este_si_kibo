from __future__ import annotations

import subprocess
from abc import ABC, abstractmethod
from typing import Optional


class BaseWifiBackend(ABC):
    """
    Abstract base class defining the standard interface for Wi-Fi backend
    implementations across different operating systems.
    """

    @abstractmethod
    def list_networks(self) -> list[dict]:
        """
        Scans and lists available Wi-Fi networks.

        :return: A list of dictionaries, where each dictionary contains network details
                 such as 'ssid', 'signal', 'security', and 'in_use'.
        :rtype: list[dict]
        """
        ...

    @abstractmethod
    def connect(self, ssid: str, password: Optional[str] = None, hidden: bool = False) -> dict:
        """
        Connects to a Wi-Fi network with the specified SSID.

        :param ssid: The SSID (network name) to connect to.
        :type ssid: str
        :param password: Optional passphrase required for secured networks, defaults to None.
        :type password: Optional[str], optional
        :param hidden: Indicates whether the network is hidden (non-broadcasting SSID), defaults to False.
        :type hidden: bool, optional
        :return: A dictionary containing connection status information (e.g., 'ssid', 'status', 'previous').
        :rtype: dict
        """
        ...

    @abstractmethod
    def disconnect(self) -> dict:
        """
        Disconnects the active Wi-Fi connection.

        :return: A dictionary containing the result of the disconnection operation.
        :rtype: dict
        """
        ...

    @abstractmethod
    def current_connection(self) -> Optional[str]:
        """
        Retrieves the SSID of the currently connected Wi-Fi network.

        :return: The SSID of the active Wi-Fi connection, or None if disconnected.
        :rtype: Optional[str]
        """
        ...


class WifiError(Exception):
    """
    Custom exception raised for Wi-Fi operational failures across backends.

    :param message: Human-readable error description.
    :type message: str
    :param detail: Optional low-level technical details or standard error output, defaults to None.
    :type detail: Optional[str], optional
    """

    def __init__(self, message: str, detail: Optional[str] = None):
        self.message = message
        self.detail = detail
        super().__init__(message)


def _run(cmd: list[str], timeout: int = 20) -> subprocess.CompletedProcess:
    """
    Executes a system command as a subprocess with execution timeout and error handling.

    :param cmd: List of command arguments to execute.
    :type cmd: list[str]
    :param timeout: Maximum execution time in seconds, defaults to 20.
    :type timeout: int, optional
    :return: The completed process object containing stdout, stderr, and returncode.
    :rtype: subprocess.CompletedProcess
    :raises WifiError: If the executable command is not found in PATH or if execution times out.
    """
    try:
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as e:
        raise WifiError(
            f"Command '{cmd[0]}' was not found. Is it installed and included in PATH?",
            detail=str(e),
        )
    except subprocess.TimeoutExpired as e:
        raise WifiError(
            f"Command '{' '.join(cmd)}' timed out after {timeout} seconds.",
            detail=str(e),
        )
