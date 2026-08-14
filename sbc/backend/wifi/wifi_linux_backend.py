import re
from typing import Optional

from wifi.wifi_base import BaseWifiBackend, _run, WifiError


def _normalize_linux_security(raw: str) -> str:
    """
    Normaliza el string de seguridad que devuelve nmcli (p. ej. 'WPA2', 'WPA1 WPA2',
    'WEP', 'WPA2 802.1X') al mismo esquema que usa _AUTH_ALGO_MAP en Windows
    ('WPA2-Personal', 'WPA2-Enterprise', 'OPEN', etc.), para que el campo 'security'
    sea comparable entre backends.
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
        # Nota: en Windows, _AUTH_ALGO_MAP no distingue WEP de forma explícita
        # (queda como OPEN/SHARED según el algoritmo de autenticación, ya que la
        # WLAN API separa autenticación de cifrado). Es una limitación conocida
        # de esa API, no de este normalizador.
        return "WEP"
    # Desconocido: devolvemos el valor crudo para no perder información.
    return raw

class LinuxWifiBackend(BaseWifiBackend):
    """Implementación basada en NetworkManager (nmcli)."""

    def _interface(self) -> Optional[str]:
        """Devuelve el nombre de la primera interfaz wifi disponible."""
        result = _run(["nmcli", "-t", "-f", "DEVICE,TYPE", "device"])
        if result.returncode != 0:
            raise WifiError("No se pudo listar dispositivos de red.", detail=result.stderr)
        for line in result.stdout.strip().splitlines():
            if not line:
                continue
            # Igual que el resto del archivo: nmcli separa con ':' y escapa los ':'
            # internos con '\:' (un nombre de interfaz virtual podría, en teoría,
            # contener uno).
            parts = re.split(r"(?<!\\):", line)
            parts = [p.replace("\\:", ":") for p in parts]
            device, dtype = (parts + [""])[:2]
            if dtype == "wifi":
                return device
        return None

    def list_networks(self) -> list[dict]:
        # 'nmcli device wifi list --rescan yes' le pide a NetworkManager que intente
        # actualizar la lista. Si está bloqueado por rate-limiting, utiliza el caché
        # reciente sin lanzar una excepción de comando fallido.
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
            # Con --rescan yes, nmcli espera a que termine un escaneo real de
            # hardware; 20s por defecto puede quedarse corto con tarjetas lentas
            # o muchas redes vecinas, así que lo alineamos con el timeout de connect().
            timeout=30,
        )
        if result.returncode != 0:
            # Fallback sin la bandera --rescan por compatibilidad con versiones antiguas de nmcli
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
                raise WifiError("No se pudo obtener la lista de redes WiFi.", detail=result.stderr)

        networks = []
        seen = set()
        for line in result.stdout.strip().splitlines():
            if not line:
                continue
            # nmcli separa campos con ':' y escapa los ':' internos con '\:'
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
        # Consulta directamente el estado de los APs para obtener el SSID activo real.
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
        current = self.current_connection()

        # NetworkManager gestiona el cambio de red automáticamente.
        # No es necesario llamar a disconnect() previamente.
        cmd = ["nmcli", "device", "wifi", "connect", ssid]
        if password:
            cmd += ["password", password]
        if hidden:
            # Sin esto, nmcli no intenta conectar a una red que no aparece en el
            # scan pasivo/activo normal (SSID no difundido).
            cmd += ["hidden", "yes"]

        result = _run(cmd, timeout=30)
        if result.returncode != 0:
            raise WifiError(
                f"No se pudo conectar a la red '{ssid}'.",
                detail=result.stderr.strip() or result.stdout.strip(),
            )
        return {"ssid": ssid, "status": "connected", "previous": current}

    def disconnect(self) -> dict:
        current = self.current_connection()
        if not current:
            return {"status": "disconnected", "previous": None}

        # Desactivamos la conexión activa por perfil/SSID para no dejar la
        # interfaz en estado 'unmanaged' ni deshabilitar la reconexión automática.
        result = _run(["nmcli", "connection", "down", "id", current])
        if result.returncode != 0:
            # Fallback en caso de que el ID del perfil difiera del SSID
            iface = self._interface()
            if iface:
                _run(["nmcli", "device", "disconnect", iface])

        return {"status": "disconnected", "previous": current}
