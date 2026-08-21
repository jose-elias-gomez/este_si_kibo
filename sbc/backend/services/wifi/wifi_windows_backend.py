import ctypes
import os
import tempfile
import threading
from ctypes import wintypes
from typing import Optional

from services.wifi.wifi_base import _run, WifiError, BaseWifiBackend
from xml.sax.saxutils import escape as _xml_escape

WINFUNCTYPE = getattr(ctypes, "WINFUNCTYPE", ctypes.CFUNCTYPE)


# Native C structures for wlanapi.dll (used by WindowsWifiBackend)
class _GUID(ctypes.Structure):
    """Represents a Globally Unique Identifier (GUID) structure in C."""
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class _WLAN_INTERFACE_INFO(ctypes.Structure):
    """Contains information about a wireless network interface."""
    _fields_ = [
        ("InterfaceGuid", _GUID),
        ("strInterfaceDescription", ctypes.c_wchar * 256),
        ("isState", ctypes.c_uint),
    ]


class _WLAN_INTERFACE_INFO_LIST(ctypes.Structure):
    """Contains an array of wireless interface information structures."""
    _fields_ = [
        ("dwNumberOfItems", wintypes.DWORD),
        ("dwIndex", wintypes.DWORD),
        ("InterfaceInfo", _WLAN_INTERFACE_INFO * 1),
    ]


class _DOT11_SSID(ctypes.Structure):
    """Contains an IEEE 802.11 SSID."""
    _fields_ = [
        ("uSSIDLength", ctypes.c_ulong),
        ("ucSSID", ctypes.c_char * 32),
    ]


class _WLAN_AVAILABLE_NETWORK(ctypes.Structure):
    """Contains information about an available wireless network."""
    _fields_ = [
        ("strProfileName", ctypes.c_wchar * 256),
        ("dot11Ssid", _DOT11_SSID),
        ("dot11BssType", ctypes.c_uint),
        ("uNumberOfBssids", ctypes.c_ulong),
        ("bNetworkConnectable", ctypes.c_int),
        ("wlanNotConnectableReason", ctypes.c_uint),
        ("uNumberOfPhyTypes", ctypes.c_ulong),
        ("dot11PhyTypes", ctypes.c_uint * 8),
        ("bMorePhyTypes", ctypes.c_int),
        ("wlanSignalQuality", ctypes.c_ulong),
        ("bSecurityEnabled", ctypes.c_int),
        ("dot11DefaultAuthAlgorithm", ctypes.c_uint),
        ("dot11DefaultCipherAlgorithm", ctypes.c_uint),
        ("dwFlags", ctypes.c_ulong),
        ("dwReserved", ctypes.c_ulong),
    ]


class _WLAN_AVAILABLE_NETWORK_LIST(ctypes.Structure):
    """Contains an array of available network information structures."""
    _fields_ = [
        ("dwNumberOfItems", wintypes.DWORD),
        ("dwIndex", wintypes.DWORD),
        ("Network", _WLAN_AVAILABLE_NETWORK * 1),
    ]


class _WLAN_NOTIFICATION_DATA(ctypes.Structure):
    """Contains information provided during notification callbacks."""
    _fields_ = [
        ("NotificationSource", wintypes.DWORD),
        ("NotificationCode", wintypes.DWORD),
        ("InterfaceGuid", _GUID),
        ("dwDataSize", wintypes.DWORD),
        ("pData", ctypes.c_void_p),
    ]


# --- Structures for WlanQueryInterface(..., wlan_intf_opcode_current_connection, ...) ---
class _WLAN_ASSOCIATION_ATTRIBUTES(ctypes.Structure):
    """Contains association attributes for a wireless connection."""
    _fields_ = [
        ("dot11Ssid", _DOT11_SSID),
        ("dot11BssType", ctypes.c_uint),
        ("dot11Bssid", ctypes.c_ubyte * 6),
        ("dot11PhyType", ctypes.c_uint),
        ("uDot11PhyIndex", ctypes.c_ulong),
        ("wlanSignalQuality", ctypes.c_ulong),
        ("ulRxRate", ctypes.c_ulong),
        ("ulTxRate", ctypes.c_ulong),
    ]


class _WLAN_SECURITY_ATTRIBUTES(ctypes.Structure):
    """Contains security attributes for a wireless connection."""
    _fields_ = [
        ("bSecurityEnabled", ctypes.c_int),
        ("bOneXEnabled", ctypes.c_int),
        ("dot11AuthAlgorithm", ctypes.c_uint),
        ("dot11CipherAlgorithm", ctypes.c_uint),
    ]


class _WLAN_CONNECTION_ATTRIBUTES(ctypes.Structure):
    """Contains attributes for an active wireless connection."""
    _fields_ = [
        ("isState", ctypes.c_uint),
        ("wlanConnectionMode", ctypes.c_uint),
        ("strProfileName", ctypes.c_wchar * 256),
        ("wlanAssociationAttributes", _WLAN_ASSOCIATION_ATTRIBUTES),
        ("wlanSecurityAttributes", _WLAN_SECURITY_ATTRIBUTES),
    ]


# Native API Constants
WLAN_NOTIFICATION_SOURCE_ACM = 0x00000008
WLAN_NOTIFICATION_ACM_SCAN_COMPLETE = 7
WLAN_NOTIFICATION_ACM_SCAN_FAIL = 8

WLAN_INTERFACE_STATE_CONNECTED = 1
WLAN_OPCODE_CURRENT_CONNECTION = 7  # wlan_intf_opcode_current_connection

WLAN_NOTIFICATION_CALLBACK = WINFUNCTYPE(
    None,
    ctypes.POINTER(_WLAN_NOTIFICATION_DATA),
    ctypes.c_void_p,
)

_AUTH_ALGO_MAP = {
    1: "OPEN",
    2: "SHARED",
    3: "WPA-Enterprise",
    4: "WPA-Personal",
    5: "WPA-None",
    6: "WPA2-Enterprise",
    7: "WPA2-Personal",
    8: "WPA3-Enterprise",
    9: "WPA3-Personal",
    10: "OWE",
    11: "WPA3-Enterprise-192",
}


def _load_wlanapi() -> ctypes.WinDLL:
    """
    Loads `wlanapi.dll` and explicitly defines return types and argument types.

    Explicit definition prevents silent marshalling errors and documents native signatures.

    :return: Loaded WinDLL handle for wlanapi.dll.
    :rtype: ctypes.WinDLL
    """
    wlanapi = ctypes.WinDLL("wlanapi.dll")

    wlanapi.WlanOpenHandle.restype = wintypes.DWORD
    wlanapi.WlanOpenHandle.argtypes = [
        wintypes.DWORD,
        ctypes.c_void_p,
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(wintypes.HANDLE),
    ]

    wlanapi.WlanCloseHandle.restype = wintypes.DWORD
    wlanapi.WlanCloseHandle.argtypes = [wintypes.HANDLE, ctypes.c_void_p]

    wlanapi.WlanEnumInterfaces.restype = wintypes.DWORD
    wlanapi.WlanEnumInterfaces.argtypes = [
        wintypes.HANDLE,
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.POINTER(_WLAN_INTERFACE_INFO_LIST)),
    ]

    wlanapi.WlanGetAvailableNetworkList.restype = wintypes.DWORD
    wlanapi.WlanGetAvailableNetworkList.argtypes = [
        wintypes.HANDLE,
        ctypes.POINTER(_GUID),
        wintypes.DWORD,
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.POINTER(_WLAN_AVAILABLE_NETWORK_LIST)),
    ]

    wlanapi.WlanFreeMemory.restype = None
    wlanapi.WlanFreeMemory.argtypes = [ctypes.c_void_p]

    wlanapi.WlanRegisterNotification.restype = wintypes.DWORD
    wlanapi.WlanRegisterNotification.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.BOOL,
        WLAN_NOTIFICATION_CALLBACK,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.POINTER(wintypes.DWORD),
    ]

    wlanapi.WlanScan.restype = wintypes.DWORD
    wlanapi.WlanScan.argtypes = [
        wintypes.HANDLE,
        ctypes.POINTER(_GUID),
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
    ]

    wlanapi.WlanQueryInterface.restype = wintypes.DWORD
    wlanapi.WlanQueryInterface.argtypes = [
        wintypes.HANDLE,
        ctypes.POINTER(_GUID),
        ctypes.c_uint,
        ctypes.c_void_p,
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.POINTER(ctypes.c_uint),
    ]

    return wlanapi


class WindowsWifiBackend(BaseWifiBackend):
    """
    Windows Wi-Fi backend implementation using Native WLAN API (`wlanapi.dll`) and `netsh`.
    """

    # Maps normalized security scheme to (authentication, encryption) pair for netsh XML profile
    _WINDOWS_AUTH_XML_MAP = {
        "OPEN": ("open", "none"),
        "SHARED": ("shared", "WEP"),
        "OWE": ("OWE", "GCMP256"),
        "WPA-Personal": ("WPAPSK", "TKIP"),
        "WPA2-Personal": ("WPA2PSK", "AES"),
        "WPA3-Personal": ("WPA3SAE", "AES"),
    }

    # Unsupported security types requiring 802.1X/Enterprise credentials (certificates, RADIUS)
    _UNSUPPORTED_WINDOWS_SECURITY = {
        "WPA-Enterprise",
        "WPA2-Enterprise",
        "WPA3-Enterprise",
        "WPA3-Enterprise-192",
        "WPA-None",
    }

    def __init__(self) -> None:
        """
        Initializes the Windows Wi-Fi backend instance.
        """
        self._scan_callback = None

    def _interface_name(self) -> Optional[str]:
        """
        Retrieves the name of the primary wireless interface via `netsh`.

        :return: Interface name string (e.g., 'Wi-Fi'), or None if not found.
        :rtype: Optional[str]
        """
        result = _run(["netsh", "wlan", "show", "interfaces"])
        if result.returncode != 0:
            return None
        for line in result.stdout.splitlines():
            if "Name" in line and ":" in line:
                return line.split(":", 1)[1].strip()
        return None

    def _select_interface(self, iface_list_ptr) -> _GUID:
        """
        Selects appropriate WLAN interface GUID when multiple adapters are present.

        Prefers an active/connected interface if available; otherwise defaults to the first interface.

        :param iface_list_ptr: Pointer to `_WLAN_INTERFACE_INFO_LIST`.
        :return: Interface GUID structure.
        :rtype: _GUID
        :raises WifiError: If no Wi-Fi interfaces are present.
        """
        count = iface_list_ptr.contents.dwNumberOfItems
        if count == 0:
            raise WifiError("No Wi-Fi interface found on the device.")

        interfaces = ctypes.cast(
            iface_list_ptr.contents.InterfaceInfo,
            ctypes.POINTER(_WLAN_INTERFACE_INFO * count),
        ).contents

        for iface in interfaces:
            if iface.isState == WLAN_INTERFACE_STATE_CONNECTED:
                return iface.InterfaceGuid
        return interfaces[0].InterfaceGuid

    def _fetch_available_networks(
        self, wlanapi, handle, iface_guid, active: Optional[str]
    ) -> list[dict]:
        """
        Queries `WlanGetAvailableNetworkList` and parses output into dictionary format.

        :param wlanapi: Loaded WinDLL handle.
        :param handle: Open WLAN handle.
        :param iface_guid: GUID of selected interface.
        :param active: SSID of current active connection, if any.
        :return: List of parsed network dictionary objects.
        :rtype: list[dict]
        :raises WifiError: If Native API call fails.
        """
        net_list_ptr = ctypes.POINTER(_WLAN_AVAILABLE_NETWORK_LIST)()
        if (
            wlanapi.WlanGetAvailableNetworkList(
                handle, ctypes.byref(iface_guid), 1, None, ctypes.byref(net_list_ptr)
            )
            != 0
        ):
            raise WifiError("Failed to retrieve available network list.")

        try:
            count = net_list_ptr.contents.dwNumberOfItems
            networks_array = ctypes.cast(
                net_list_ptr.contents.Network,
                ctypes.POINTER(_WLAN_AVAILABLE_NETWORK * count),
            ).contents

            results = []
            seen = set()
            for net in networks_array:
                raw = bytes(net.dot11Ssid.ucSSID[: net.dot11Ssid.uSSIDLength])
                ssid = raw.decode("utf-8", errors="replace")
                if not ssid or ssid in seen:
                    continue
                seen.add(ssid)
                security = (
                    _AUTH_ALGO_MAP.get(
                        net.dot11DefaultAuthAlgorithm,
                        f"UNKNOWN({net.dot11DefaultAuthAlgorithm})",
                    )
                    if net.bSecurityEnabled
                    else "OPEN"
                )
                results.append(
                    {
                        "ssid": ssid,
                        "signal": int(net.wlanSignalQuality),
                        "security": security,
                        "in_use": ssid == active,
                    }
                )
            return results
        finally:
            wlanapi.WlanFreeMemory(net_list_ptr)

    def list_networks(self) -> list[dict]:
        """
        Scans and returns available Wi-Fi networks using Windows Native WLAN API (`wlanapi.dll`).

        Registers a callback with the AutoConfig Module (ACM) service to await hardware scan completion.

        :return: List of network dicts sorted by signal quality descending.
        :rtype: list[dict]
        :raises WifiError: If handle opening or interface enumeration fails.
        """
        wlanapi = _load_wlanapi()

        handle = wintypes.HANDLE()
        negotiated_version = wintypes.DWORD()
        if wlanapi.WlanOpenHandle(2, None, ctypes.byref(negotiated_version), ctypes.byref(handle)) != 0:
            raise WifiError("Failed to open handle to Windows WLAN API.")

        try:
            iface_list_ptr = ctypes.POINTER(_WLAN_INTERFACE_INFO_LIST)()
            if wlanapi.WlanEnumInterfaces(handle, None, ctypes.byref(iface_list_ptr)) != 0:
                raise WifiError("Failed to enumerate WLAN interfaces.")

            try:
                iface_guid = self._select_interface(iface_list_ptr)
                active = self._query_current_connection(wlanapi, handle, iface_guid)

                scan_done_event = threading.Event()

                def _notification_handler(data_ptr, context):
                    if not data_ptr:
                        return
                    data = data_ptr.contents
                    if data.NotificationSource == WLAN_NOTIFICATION_SOURCE_ACM:
                        if data.NotificationCode in (
                            WLAN_NOTIFICATION_ACM_SCAN_COMPLETE,
                            WLAN_NOTIFICATION_ACM_SCAN_FAIL,
                        ):
                            scan_done_event.set()

                # Retained on instance to prevent GC cleanup prior to unregistration
                self._scan_callback = WLAN_NOTIFICATION_CALLBACK(_notification_handler)

                # Register event callback for completed scan
                wlanapi.WlanRegisterNotification(
                    handle,
                    WLAN_NOTIFICATION_SOURCE_ACM,
                    True,
                    self._scan_callback,
                    None,
                    None,
                    None,
                )

                # Trigger asynchronous scan
                scan_rc = wlanapi.WlanScan(handle, ctypes.byref(iface_guid), None, None, None)

                if scan_rc == 0:
                    # Wait for Windows ACM event completion (max 4 seconds)
                    scan_done_event.wait(timeout=4.0)

                null_callback = ctypes.cast(None, WLAN_NOTIFICATION_CALLBACK)
                unregister_rc = wlanapi.WlanRegisterNotification(
                    handle,
                    0,
                    True,
                    null_callback,
                    None,
                    None,
                    None,
                )
                if unregister_rc == 0:
                    self._scan_callback = None

                results = self._fetch_available_networks(wlanapi, handle, iface_guid, active)
                return sorted(results, key=lambda n: n["signal"], reverse=True)
            finally:
                wlanapi.WlanFreeMemory(iface_list_ptr)
        finally:
            wlanapi.WlanCloseHandle(handle, None)

    def _query_current_connection(self, wlanapi, handle, iface_guid: _GUID) -> Optional[str]:
        """
        Queries active SSID directly via `WlanQueryInterface`.

        :param wlanapi: Loaded WinDLL handle.
        :param handle: Open WLAN handle.
        :param iface_guid: Selected interface GUID.
        :return: Active network SSID string, or None if disconnected/failed.
        :rtype: Optional[str]
        """
        data_size = wintypes.DWORD()
        data_ptr = ctypes.c_void_p()
        opcode_type = ctypes.c_uint()
        rc = wlanapi.WlanQueryInterface(
            handle,
            ctypes.byref(iface_guid),
            WLAN_OPCODE_CURRENT_CONNECTION,
            None,
            ctypes.byref(data_size),
            ctypes.byref(data_ptr),
            ctypes.byref(opcode_type),
        )
        if rc != 0 or not data_ptr.value:
            return None
        try:
            conn = ctypes.cast(data_ptr, ctypes.POINTER(_WLAN_CONNECTION_ATTRIBUTES)).contents
            if conn.isState != WLAN_INTERFACE_STATE_CONNECTED:
                return None
            ssid_struct = conn.wlanAssociationAttributes.dot11Ssid
            raw = bytes(ssid_struct.ucSSID[: ssid_struct.uSSIDLength])
            return raw.decode("utf-8", errors="replace") or None
        finally:
            wlanapi.WlanFreeMemory(data_ptr)

    def current_connection(self) -> Optional[str]:
        """
        Retrieves active network SSID directly via Native API (`WlanQueryInterface`).

        Bypasses localized `netsh wlan show interfaces` output to remain language-independent.

        :return: Active SSID, or None if disconnected/unavailable.
        :rtype: Optional[str]
        """
        try:
            wlanapi = _load_wlanapi()
        except OSError:
            return None

        handle = wintypes.HANDLE()
        negotiated_version = wintypes.DWORD()
        if wlanapi.WlanOpenHandle(2, None, ctypes.byref(negotiated_version), ctypes.byref(handle)) != 0:
            return None

        try:
            iface_list_ptr = ctypes.POINTER(_WLAN_INTERFACE_INFO_LIST)()
            if wlanapi.WlanEnumInterfaces(handle, None, ctypes.byref(iface_list_ptr)) != 0:
                return None
            try:
                try:
                    iface_guid = self._select_interface(iface_list_ptr)
                except WifiError:
                    return None
                return self._query_current_connection(wlanapi, handle, iface_guid)
            finally:
                wlanapi.WlanFreeMemory(iface_list_ptr)
        finally:
            wlanapi.WlanCloseHandle(handle, None)

    def _profile_exists(self, ssid: str) -> bool:
        """
        Checks whether an exact netsh profile name exists.

        :param ssid: SSID string to match.
        :return: True if exact matching profile exists, False otherwise.
        :rtype: bool
        """
        result = _run(["netsh", "wlan", "show", "profiles"])
        if result.returncode != 0:
            return False
        for line in result.stdout.splitlines():
            if ":" not in line:
                continue
            _, _, value = line.partition(":")
            if value.strip() == ssid:
                return True
        return False

    def _detect_security(self, ssid: str, password: Optional[str]) -> str:
        """
        Detects security type of target SSID via active scanning.

        :param ssid: Target network SSID.
        :param password: Provided password.
        :return: Security type string (e.g., 'WPA2-Personal', 'OPEN').
        :rtype: str
        """
        try:
            for net in self.list_networks():
                if net["ssid"] == ssid:
                    return net["security"]
        except WifiError:
            pass
        # Fallback for hidden or out-of-range networks
        return "WPA2-Personal" if password else "OPEN"

    def _create_profile(
        self,
        ssid: str,
        password: Optional[str],
        security: str = "WPA2-Personal",
        hidden: bool = False,
    ) -> None:
        """
        Generates and registers a temporary XML network profile using `netsh`.

        :param ssid: Target network SSID.
        :type ssid: str
        :param password: Passphrase for secure networks.
        :type password: Optional[str]
        :param security: Detected security type, defaults to 'WPA2-Personal'.
        :type security: str, optional
        :param hidden: Whether network is hidden, defaults to False.
        :type hidden: bool, optional
        :raises WifiError: If profile creation fails or security scheme is unsupported.
        """
        if security in self._UNSUPPORTED_WINDOWS_SECURITY:
            raise WifiError(
                f"Network '{ssid}' uses '{security}' security, which requires "
                "802.1X/Enterprise credentials and is not supported by this password-based method."
            )

        auth_algo, encryption = self._WINDOWS_AUTH_XML_MAP.get(security, ("WPA2PSK", "AES"))

        needs_key = auth_algo not in ("open", "OWE")
        if needs_key and not password:
            raise WifiError(
                f"Network '{ssid}' requires a password (detected security: {security})."
            )
        if not needs_key:
            password = None

        safe_ssid = _xml_escape(ssid)

        if password:
            key_type = "networkKey" if security == "SHARED" else "passPhrase"
            safe_password = _xml_escape(password)
            auth_block = f"""
            <authEncryption>
                <authentication>{auth_algo}</authentication>
                <encryption>{encryption}</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
            <sharedKey>
                <keyType>{key_type}</keyType>
                <protected>false</protected>
                <keyMaterial>{safe_password}</keyMaterial>
            </sharedKey>
            """
        else:
            auth_block = f"""
            <authEncryption>
                <authentication>{auth_algo}</authentication>
                <encryption>{encryption}</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
            """

        non_broadcast = "<nonBroadcast>true</nonBroadcast>" if hidden else ""

        profile_xml = f"""<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>{safe_ssid}</name>
    <SSIDConfig>
        <SSID>
            <name>{safe_ssid}</name>
        </SSID>
        {non_broadcast}
    </SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM>
        <security>
            {auth_block}
        </security>
    </MSM>
</WLANProfile>"""

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".xml", delete=False, encoding="utf-8"
        ) as f:
            f.write(profile_xml)
            tmp_path = f.name

        try:
            cmd = ["netsh", "wlan", "add", "profile", f"filename={tmp_path}", "user=current"]
            interface_name = self._interface_name()
            if interface_name:
                cmd.append(f"interface={interface_name}")

            result = _run(cmd)
            if result.returncode != 0:
                raise WifiError(
                    f"Failed to create network profile for '{ssid}'.",
                    detail=result.stderr.strip() or result.stdout.strip(),
                )
        finally:
            os.unlink(tmp_path)

    def connect(self, ssid: str, password: Optional[str] = None, hidden: bool = False) -> dict:
        """
        Connects to a Wi-Fi network on Windows using `netsh`.

        :param ssid: Target network SSID.
        :type ssid: str
        :param password: Passphrase, if required.
        :type password: Optional[str], optional
        :param hidden: Whether network is hidden, defaults to False.
        :type hidden: bool, optional
        :return: Dict containing status details ('ssid', 'status', 'previous').
        :rtype: dict
        :raises WifiError: If connection fails.
        """
        current = self.current_connection()
        if current and current != ssid:
            self.disconnect()

        if password or not self._profile_exists(ssid):
            security = self._detect_security(ssid, password)
            self._create_profile(ssid, password, security, hidden=hidden)

        interface_name = self._interface_name()
        cmd = ["netsh", "wlan", "connect", f"name={ssid}", f"ssid={ssid}"]
        if interface_name:
            cmd.append(f"interface={interface_name}")

        result = _run(cmd)
        if result.returncode != 0:
            raise WifiError(
                f"Failed to connect to network '{ssid}'.",
                detail=result.stderr.strip() or result.stdout.strip(),
            )
        return {"ssid": ssid, "status": "connected", "previous": current}

    def disconnect(self) -> dict:
        """
        Disconnects the active Wi-Fi interface on Windows.

        :return: Dict containing disconnection status ('status', 'previous').
        :rtype: dict
        :raises WifiError: If disconnection fails.
        """
        current = self.current_connection()
        interface_name = self._interface_name()
        cmd = ["netsh", "wlan", "disconnect"]
        if interface_name:
            cmd.append(f"interface={interface_name}")

        result = _run(cmd)
        if result.returncode != 0:
            raise WifiError("Failed to disconnect Wi-Fi interface.", detail=result.stderr)
        return {"status": "disconnected", "previous": current}
