import ctypes
import os
import tempfile
import threading
from ctypes import wintypes
from typing import Optional

from wifi.wifi_base import _run, WifiError, BaseWifiBackend
from xml.sax.saxutils import escape as _xml_escape

# WINFUNCTYPE solo existe en Windows. Para evitar ImportError al importar/probar en Linux:
WINFUNCTYPE = getattr(ctypes, "WINFUNCTYPE", ctypes.CFUNCTYPE)

# --- Estructuras nativas de wlanapi.dll (usadas solo por WindowsWifiBackend) ---
class _GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class _WLAN_INTERFACE_INFO(ctypes.Structure):
    _fields_ = [
        ("InterfaceGuid", _GUID),
        ("strInterfaceDescription", ctypes.c_wchar * 256),
        ("isState", ctypes.c_uint),
    ]


class _WLAN_INTERFACE_INFO_LIST(ctypes.Structure):
    _fields_ = [
        ("dwNumberOfItems", wintypes.DWORD),
        ("dwIndex", wintypes.DWORD),
        ("InterfaceInfo", _WLAN_INTERFACE_INFO * 1),
    ]


class _DOT11_SSID(ctypes.Structure):
    _fields_ = [
        ("uSSIDLength", ctypes.c_ulong),
        ("ucSSID", ctypes.c_char * 32),
    ]


class _WLAN_AVAILABLE_NETWORK(ctypes.Structure):
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
    _fields_ = [
        ("dwNumberOfItems", wintypes.DWORD),
        ("dwIndex", wintypes.DWORD),
        ("Network", _WLAN_AVAILABLE_NETWORK * 1),
    ]


class _WLAN_NOTIFICATION_DATA(ctypes.Structure):
    _fields_ = [
        ("NotificationSource", wintypes.DWORD),
        ("NotificationCode", wintypes.DWORD),
        ("InterfaceGuid", _GUID),
        ("dwDataSize", wintypes.DWORD),
        ("pData", ctypes.c_void_p),
    ]


# --- Estructuras para WlanQueryInterface(..., wlan_intf_opcode_current_connection, ...) ---
# Permiten leer el SSID activo directamente de la API en vez de parsear el texto
# (localizado) de 'netsh wlan show interfaces'.
class _WLAN_ASSOCIATION_ATTRIBUTES(ctypes.Structure):
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
    _fields_ = [
        ("bSecurityEnabled", ctypes.c_int),
        ("bOneXEnabled", ctypes.c_int),
        ("dot11AuthAlgorithm", ctypes.c_uint),
        ("dot11CipherAlgorithm", ctypes.c_uint),
    ]


class _WLAN_CONNECTION_ATTRIBUTES(ctypes.Structure):
    _fields_ = [
        ("isState", ctypes.c_uint),
        ("wlanConnectionMode", ctypes.c_uint),
        ("strProfileName", ctypes.c_wchar * 256),
        ("wlanAssociationAttributes", _WLAN_ASSOCIATION_ATTRIBUTES),
        ("wlanSecurityAttributes", _WLAN_SECURITY_ATTRIBUTES),
    ]


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
# Este es el "esquema común" al que también normalizamos la salida del backend de
# Linux (ver _normalize_linux_security), para que 'security' sea comparable entre
# plataformas.


def _load_wlanapi() -> ctypes.WinDLL:
    """
    Carga wlanapi.dll declarando restype/argtypes explícitamente en las funciones
    que usamos. No es estrictamente necesario (ctypes puede inferir la mayoría de
    los casos), pero evita marshalling incorrecto silencioso y documenta la firma
    real de cada función nativa.
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
    """Implementación basada en Native WLAN API y netsh."""

    # Mapea el esquema de seguridad normalizado (mismo que devuelve list_networks,
    # ver _AUTH_ALGO_MAP / _normalize_linux_security) a (authentication, encryption)
    # tal como los espera el XML de perfil de netsh.
    _WINDOWS_AUTH_XML_MAP = {
        "OPEN": ("open", "none"),
        "SHARED": ("shared", "WEP"),
        "OWE": ("OWE", "GCMP256"),
        "WPA-Personal": ("WPAPSK", "TKIP"),
        "WPA2-Personal": ("WPA2PSK", "AES"),
        "WPA3-Personal": ("WPA3SAE", "AES"),
    }

    # Estos requieren credenciales 802.1X/Enterprise (certificados, RADIUS, etc.),
    # no solo una passphrase, así que no los soportamos con el flujo actual.
    _UNSUPPORTED_WINDOWS_SECURITY = {
        "WPA-Enterprise",
        "WPA2-Enterprise",
        "WPA3-Enterprise",
        "WPA3-Enterprise-192",
        "WPA-None",
    }

    def __init__(self) -> None:
        self._scan_callback = None  # ver comentario en list_networks()

    def _interface_name(self) -> Optional[str]:
        result = _run(["netsh", "wlan", "show", "interfaces"])
        if result.returncode != 0:
            return None
        for line in result.stdout.splitlines():
            if "Name" in line and ":" in line:
                return line.split(":", 1)[1].strip()
        return None

    def _select_interface(self, iface_list_ptr) -> _GUID:
        """
        Elige qué interfaz WLAN usar cuando hay más de un adaptador Wi-Fi.

        WlanEnumInterfaces() puede devolver varias; antes el código siempre tomaba
        InterfaceInfo[0] (además, indexarlo con [0] directamente sobre un array de
        tamaño fijo 1 en ctypes solo "funciona por casualidad" con una interfaz).
        Acá casteamos el array a su tamaño real y, si hay más de una interfaz,
        preferimos la que ya está conectada; si ninguna lo está, caemos al primer
        elemento (mismo comportamiento que antes, pero explícito y documentado).
        """
        count = iface_list_ptr.contents.dwNumberOfItems
        if count == 0:
            raise WifiError("No se encontró ninguna interfaz WiFi en el equipo.")

        interfaces = ctypes.cast(
            iface_list_ptr.contents.InterfaceInfo,
            ctypes.POINTER(_WLAN_INTERFACE_INFO * count),
        ).contents

        for iface in interfaces:
            if iface.isState == WLAN_INTERFACE_STATE_CONNECTED:
                return iface.InterfaceGuid
        return interfaces[0].InterfaceGuid

    def _fetch_available_networks(self, wlanapi, handle, iface_guid, active: Optional[str]) -> list[dict]:
        """Una sola consulta a WlanGetAvailableNetworkList, parseada a dicts."""
        net_list_ptr = ctypes.POINTER(_WLAN_AVAILABLE_NETWORK_LIST)()
        if (
            wlanapi.WlanGetAvailableNetworkList(
                handle, ctypes.byref(iface_guid), 1, None, ctypes.byref(net_list_ptr)
            )
            != 0
        ):
            raise WifiError("No se pudo obtener la lista de redes disponibles.")

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
        Obtiene la lista de redes Wi-Fi disponibles usando wlanapi.dll.

        Registra un callback a eventos del servicio ACM (AutoConfig Module) de Windows
        para esperar de forma precisa cuando el driver complete el escaneo de canales
        de hardware que dispara WlanScan().
        """
        wlanapi = _load_wlanapi()

        handle = wintypes.HANDLE()
        negotiated_version = wintypes.DWORD()
        if wlanapi.WlanOpenHandle(2, None, ctypes.byref(negotiated_version), ctypes.byref(handle)) != 0:
            raise WifiError("No se pudo abrir un handle a la WLAN API de Windows.")

        try:
            iface_list_ptr = ctypes.POINTER(_WLAN_INTERFACE_INFO_LIST)()
            if wlanapi.WlanEnumInterfaces(handle, None, ctypes.byref(iface_list_ptr)) != 0:
                raise WifiError("No se pudieron enumerar las interfaces WLAN.")

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

                # Guardado como atributo de instancia (no variable local): si el
                # WlanRegisterNotification de desregistro más abajo fallara sin que
                # lo notemos, este trampolín de ctypes seguiría vivo mientras exista
                # el backend, en vez de ser recolectado por el GC y crashear el
                # proceso ante una notificación tardía de Windows.
                self._scan_callback = WLAN_NOTIFICATION_CALLBACK(_notification_handler)

                # Registrar notificación para detectar cuando el escaneo físico concluya
                wlanapi.WlanRegisterNotification(
                    handle,
                    WLAN_NOTIFICATION_SOURCE_ACM,
                    True,
                    self._scan_callback,
                    None,
                    None,
                    None,
                )

                # Disparar escaneo asincrónico
                scan_rc = wlanapi.WlanScan(handle, ctypes.byref(iface_guid), None, None, None)

                if scan_rc == 0:
                    # Espera a que Windows emita la notificación de escaneo finalizado (máx. 4.0s)
                    scan_done_event.wait(timeout=4.0)

                # Desregistrar notificaciones. Si esto falla, mantenemos la referencia
                # en self._scan_callback (ver comentario arriba) en vez de descartarla.
                #
                # Nota: con argtypes declarado como WLAN_NOTIFICATION_CALLBACK (ver
                # _load_wlanapi), ctypes ya no acepta 'None' pelado para ese
                # parámetro como sí hacía sin argtypes -- hay que castear
                # explícitamente a un puntero a función nulo del tipo correcto.
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
        """Lee el SSID activo con WlanQueryInterface, dado un handle/GUID ya abiertos."""
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
        Devuelve el SSID activo consultando wlanapi.dll directamente
        (WlanQueryInterface), no parseando el texto de 'netsh wlan show interfaces'.

        La razón: varias etiquetas de esa salida de netsh están localizadas según
        el idioma de Windows (p. ej. "Signal"/"Segnale", "Authentication"/
        "Autenticazione" en italiano). La etiqueta "SSID" en particular no parece
        traducirse, pero seguir parseándola es apostar a que ningún locale la
        cambie. Consultar la API directamente es 100% independiente del idioma.
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
        Compara nombres de perfil exactos, no un 'in' contra toda la salida.

        Antes, buscar 'Casa' con substring matcheaba también un perfil llamado
        'Casa Fibra' (falso positivo). Acá tomamos, por línea, todo lo que sigue
        a los ':' y lo comparamos exacto contra el SSID.
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
        Detecta el tipo de seguridad real de la red escaneando con list_networks(),
        en vez de asumir siempre WPA2PSK/AES al armar el perfil (lo que hacía
        fallar la conexión contra redes WPA3-only, abiertas, WEP, etc.).
        """
        try:
            for net in self.list_networks():
                if net["ssid"] == ssid:
                    return net["security"]
        except WifiError:
            pass
        # Red oculta o fuera de alcance en el momento del escaneo: no hay forma de
        # saber el tipo real. Asumimos según si nos pasaron password o no.
        return "WPA2-Personal" if password else "OPEN"

    def _create_profile(
        self,
        ssid: str,
        password: Optional[str],
        security: str = "WPA2-Personal",
        hidden: bool = False,
    ) -> None:
        """Crea (o reemplaza) un perfil XML temporal para poder conectar por SSID."""
        if security in self._UNSUPPORTED_WINDOWS_SECURITY:
            raise WifiError(
                f"La red '{ssid}' usa seguridad '{security}', que requiere "
                "credenciales 802.1X/Enterprise y no está soportada por este "
                "método de conexión basado solo en contraseña."
            )

        auth_algo, encryption = self._WINDOWS_AUTH_XML_MAP.get(security, ("WPA2PSK", "AES"))

        needs_key = auth_algo not in ("open", "OWE")
        if needs_key and not password:
            raise WifiError(
                f"La red '{ssid}' requiere contraseña (seguridad detectada: {security})."
            )
        if not needs_key:
            # Red abierta / OWE: no corresponde mandar keyMaterial aunque nos hayan
            # pasado un password.
            password = None

        # Los SSID y passphrases WPA2 pueden contener &, <, >, comillas, etc.
        # (válido en la especificación), lo que rompía el XML antes de escapar.
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
            # user=current: sin esto, netsh crea el perfil "para todos los usuarios"
            # por defecto, lo que en la práctica exige permisos de Administrador.
            cmd = ["netsh", "wlan", "add", "profile", f"filename={tmp_path}", "user=current"]
            interface_name = self._interface_name()
            if interface_name:
                cmd.append(f"interface={interface_name}")

            result = _run(cmd)
            if result.returncode != 0:
                raise WifiError(
                    f"No se pudo crear el perfil de red para '{ssid}'.",
                    detail=result.stderr.strip() or result.stdout.strip(),
                )
        finally:
            os.unlink(tmp_path)

    def connect(self, ssid: str, password: Optional[str] = None, hidden: bool = False) -> dict:
        current = self.current_connection()
        if current and current != ssid:
            self.disconnect()

        # Si no existe un perfil guardado (o se pasó password nuevo), lo creamos/actualizamos.
        # Solo en ese caso hace falta escanear para detectar la seguridad real
        # (ver _detect_security): reconectar a un perfil ya guardado no dispara scan.
        if password or not self._profile_exists(ssid):
            security = self._detect_security(ssid, password)
            self._create_profile(ssid, password, security, hidden=hidden)

        interface_name = self._interface_name()
        cmd = ["netsh", "wlan", "connect", f"name={ssid}", f"ssid={ssid}"]
        if interface_name:
            # Necesario para desambiguar si el equipo tiene más de un adaptador
            # Wi-Fi; sin esto, netsh puede quejarse de comando ambiguo.
            cmd.append(f"interface={interface_name}")

        result = _run(cmd)
        if result.returncode != 0:
            raise WifiError(
                f"No se pudo conectar a la red '{ssid}'.",
                detail=result.stderr.strip() or result.stdout.strip(),
            )
        return {"ssid": ssid, "status": "connected", "previous": current}

    def disconnect(self) -> dict:
        current = self.current_connection()
        interface_name = self._interface_name()
        cmd = ["netsh", "wlan", "disconnect"]
        if interface_name:
            cmd.append(f"interface={interface_name}")

        result = _run(cmd)
        if result.returncode != 0:
            raise WifiError("No se pudo desconectar la interfaz WiFi.", detail=result.stderr)
        return {"status": "disconnected", "previous": current}
