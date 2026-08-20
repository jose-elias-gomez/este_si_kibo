import re
from typing import Optional

from wifi.wifi_base import BaseWifiBackend, _run, WifiError


def _normalize_linux_security(raw: str) -> str:
    """
    Normalizes the security string returned by `nmcli` (e.g., 'WPA2', 'WPA1 WPA2',
    'WEP', 'WPA2 802.1X') into the standardized scheme used across platforms.

    Maps values to match the Windows `_AUTH_ALGO_MAP` format ('WPA2-Personal',
    'WPA2-Enterprise', 'OPEN', etc.) ensuring cross-backend consistency.

    :param raw: The raw security string from nmcli output.
    :type raw: str
    :return: The normalized security protocol string.
    :rtype: str
    """
    if not raw or not raw.strip():
        return "OPEN"

    upper = raw.upper()
    enterprise = "802.1X" in upper or "EAP" in upper

    if "WPA3" in upper:
        return "WPA3-Enterprise" if enterprise else "WPA3-Personal"
    if "WPA2" in upper:
        return "WPA2-Enterprise" if enterprise else "WPA2-Personal"
    if "WPA1" in upper or "WPA" in upper:
        return "WPA-Enterprise" if enterprise else "WPA-Personal"
    if "OWE" in upper:
        return "OWE"
    if "WEP" in upper:
        # Note: On Windows, _AUTH_ALGO_MAP does not explicitly distinguish WEP
        # (it defaults to OPEN/SHARED depending on authentication algorithm, since
        # the WLAN API separates authentication from encryption). This is a known
        # limitation of that API, not this normalizer.
        return "WEP"
    # Unknown format: return raw value to preserve details.
    return raw


class LinuxWifiBackend(BaseWifiBackend):
    """
    Linux Wi-Fi backend implementation based on NetworkManager (`nmcli`).
    """

    def _interface(self) -> Optional[str]:
        """
        Retrieves the interface name of the first available Wi-Fi device.

        :return: The interface name (e.g., 'wlan0'), or None if no Wi-Fi device is found.
        :rtype: Optional[str]
        :raises WifiError: If querying network devices via nmcli fails.
        """
        result = _run(["nmcli", "-t", "-f", "DEVICE,TYPE", "device"])
        if result.returncode != 0:
            raise WifiError("Failed to list network devices.", detail=result.stderr)
        for line in result.stdout.strip().splitlines():
            if not line:
                continue
            # nmcli separates fields with ':' and escapes internal colons with '\:'
            parts = re.split(r"(?<!\\):", line)
            parts = [p.replace("\\:", ":") for p in parts]
            device, dtype = (parts + [""])[:2]
            if dtype == "wifi":
                return device
        return None

    def list_networks(self) -> list[dict]:
        """
        Scans and lists available Wi-Fi networks on Linux.

        Uses `nmcli device wifi list --rescan yes` to trigger an updated hardware scan.
        If rate-limited or using older nmcli versions, falls back to non-rescan mode.

        :return: A list of dictionaries sorted by signal strength in descending order.
                 Each dictionary contains 'ssid', 'signal', 'security', and 'in_use'.
        :rtype: list[dict]
        :raises WifiError: If nmcli fails to retrieve Wi-Fi networks.
        """
        # 'nmcli device wifi list --rescan yes' requests NetworkManager to refresh the list.
        # If rate-limited, it falls back to recent cache without throwing an error.
        result = _run(
            [
                "nmcli",
                "-t",
                "-f",
                "SSID,SIGNAL,SECURITY,IN-USE",
                "device",
                "wifi",
                "list",
                "--rescan",
                "yes",
            ],
            # Allow 30s timeout to account for hardware scan delays on slow cards
            timeout=30,
        )
        if result.returncode != 0:
            # Fallback without --rescan for backward compatibility with legacy nmcli versions
            result = _run(
                [
                    "nmcli",
                    "-t",
                    "-f",
                    "SSID,SIGNAL,SECURITY,IN-USE",
                    "device",
                    "wifi",
                    "list",
                ]
            )
            if result.returncode != 0:
                raise WifiError("Failed to retrieve Wi-Fi network list.", detail=result.stderr)

        networks = []
        seen = set()
        for line in result.stdout.strip().splitlines():
            if not line:
                continue
            # nmcli separates fields with ':' and escapes internal colons with '\:'
            parts = re.split(r"(?<!\\):", line)
            parts = [p.replace("\\:", ":") for p in parts]
            if len(parts) < 4:
                continue
            ssid, signal, security, in_use = parts[0], parts[1], parts[2], parts[3]
            if not ssid or ssid in seen:
                continue
            seen.add(ssid)
            networks.append(
                {
                    "ssid": ssid,
                    "signal": int(signal) if signal.isdigit() else None,
                    "security": _normalize_linux_security(security),
                    "in_use": in_use.strip() == "*",
                }
            )
        return sorted(networks, key=lambda n: (n["signal"] or 0), reverse=True)

    def current_connection(self) -> Optional[str]:
        """
        Queries active access points to determine the currently connected SSID.

        :return: The active network SSID, or None if not connected or upon error.
        :rtype: Optional[str]
        """
        # Directly queries AP status for the true active SSID
        result = _run(["nmcli", "-t", "-f", "ACTIVE,SSID", "device", "wifi"])
        if result.returncode != 0:
            return None
        for line in result.stdout.strip().splitlines():
            if not line:
                continue
            parts = re.split(r"(?<!\\):", line)
            parts = [p.replace("\\:", ":") for p in parts]
            if len(parts) >= 2 and parts[0].strip().lower() == "yes":
                return parts[1]
        return None

    def connect(self, ssid: str, password: Optional[str] = None, hidden: bool = False) -> dict:
        """
        Connects to a Wi-Fi network using NetworkManager.

        :param ssid: The target network SSID.
        :type ssid: str
        :param password: The Wi-Fi passphrase, if required.
        :type password: Optional[str], optional
        :param hidden: Whether to scan explicitly for hidden non-broadcasting SSIDs, defaults to False.
        :type hidden: bool, optional
        :return: Connection state details including target SSID, status, and previous SSID.
        :rtype: dict
        :raises WifiError: If connection attempt fails.
        """
        current = self.current_connection()

        # NetworkManager manages network switching automatically without requiring disconnect()
        cmd = ["nmcli", "device", "wifi", "connect", ssid]
        if password:
            cmd += ["password", password]
        if hidden:
            # Required for connecting to non-broadcasting (hidden) networks
            cmd += ["hidden", "yes"]

        result = _run(cmd, timeout=30)
        if result.returncode != 0:
            raise WifiError(
                f"Failed to connect to network '{ssid}'.",
                detail=result.stderr.strip() or result.stdout.strip(),
            )
        return {"ssid": ssid, "status": "connected", "previous": current}

    def disconnect(self) -> dict:
        """
        Disconnects the current active Wi-Fi connection via nmcli.

        :return: Disconnection result details including status and previous SSID.
        :rtype: dict
        """
        current = self.current_connection()
        if not current:
            return {"status": "disconnected", "previous": None}

        # Deactivate connection profile/SSID directly to avoid unmanaged interface state
        result = _run(["nmcli", "connection", "down", "id", current])
        if result.returncode != 0:
            # Fallback if profile ID differs from SSID
            iface = self._interface()
            if iface:
                _run(["nmcli", "device", "disconnect", iface])

        return {"status": "disconnected", "previous": current}
