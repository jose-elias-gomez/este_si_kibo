from __future__ import annotations

import re
from typing import Optional

from services.wifi.wifi_base import BaseWifiBackend, _run, WifiError


class WindowsWifiBackend(BaseWifiBackend):
    """
    Windows Wi-Fi backend basado en netsh.

    No utiliza ctypes ni wlanapi.dll directamente.
    Esto evita problemas con WlanOpenHandle y diferencias
    entre versiones/configuraciones de Windows.
    """

    def __init__(self) -> None:
        pass

    # ---------------------------------------------------------
    # INTERFACE
    # ---------------------------------------------------------

    def _interface_name(self) -> Optional[str]:
        """
        Obtiene el nombre de la interfaz Wi-Fi activa.

        Funciona independientemente del idioma de Windows
        utilizando la salida de 'netsh wlan show interfaces'.
        """

        result = _run(
            ["netsh", "wlan", "show", "interfaces"]
        )

        if result.returncode != 0:
            return None

        for line in result.stdout.splitlines():
            line = line.strip()

            # Ejemplos:
            # Name                   : Wi-Fi
            # Nombre                 : Wi-Fi
            #
            # Buscamos el valor después de ":" y evitamos
            # confundirlo con otros campos.

            if ":" not in line:
                continue

            key, value = line.split(":", 1)

            key = key.strip().lower()
            value = value.strip()

            if key in ("name", "nombre") and value:
                return value

        return None

    # ---------------------------------------------------------
    # CURRENT CONNECTION
    # ---------------------------------------------------------

    def current_connection(self) -> Optional[str]:
        """
        Devuelve el SSID actualmente conectado.
        """

        result = _run(
            ["netsh", "wlan", "show", "interfaces"]
        )

        if result.returncode != 0:
            return None

        connected = False

        for line in result.stdout.splitlines():
            line = line.strip()

            if ":" not in line:
                continue

            key, value = line.split(":", 1)

            key = key.strip().lower()
            value = value.strip()

            if key in ("state", "estado"):
                connected = value.lower() in (
                    "connected",
                    "conectado",
                )

            elif key == "ssid" and connected:
                if value:
                    return value

        return None

    # ---------------------------------------------------------
    # LIST NETWORKS
    # ---------------------------------------------------------

    def list_networks(self) -> list[dict]:
        """
        Escanea y devuelve las redes Wi-Fi disponibles.

        Utiliza:
            netsh wlan show networks mode=bssid
        """

        result = _run(
            [
                "netsh",
                "wlan",
                "show",
                "networks",
                "mode=bssid",
            ],
            timeout=30,
        )

        if result.returncode != 0:
            raise WifiError(
                "Failed to retrieve available Wi-Fi networks.",
                detail=result.stderr.strip() or result.stdout.strip(),
            )

        active = self.current_connection()

        networks: list[dict] = []
        seen: set[str] = set()

        current_ssid: Optional[str] = None
        current_signal: Optional[int] = None
        current_auth: Optional[str] = None

        lines = result.stdout.splitlines()

        for raw_line in lines:
            line = raw_line.strip()

            if not line:
                continue

            # -------------------------------------------------
            # SSID
            # -------------------------------------------------

            ssid_match = re.match(
                r"^SSID\s+\d+\s*:\s*(.*)$",
                line,
                re.IGNORECASE,
            )

            if ssid_match:
                # Guardar la red anterior si todavía no fue guardada
                if current_ssid and current_ssid not in seen:
                    networks.append(
                        {
                            "ssid": current_ssid,
                            "signal": current_signal,
                            "security": self._normalize_security(
                                current_auth
                            ),
                            "in_use": current_ssid == active,
                        }
                    )

                    seen.add(current_ssid)

                current_ssid = ssid_match.group(1).strip()
                current_signal = None
                current_auth = None

                continue

            # -------------------------------------------------
            # SIGNAL
            # -------------------------------------------------

            signal_match = re.match(
                r"^Signal\s*:\s*(\d+)%?",
                line,
                re.IGNORECASE,
            )

            if signal_match:
                current_signal = int(signal_match.group(1))
                continue

            # Español
            signal_match = re.match(
                r"^Señal\s*:\s*(\d+)%?",
                line,
                re.IGNORECASE,
            )

            if signal_match:
                current_signal = int(signal_match.group(1))
                continue

            # -------------------------------------------------
            # AUTHENTICATION
            # -------------------------------------------------

            auth_match = re.match(
                r"^Authentication\s*:\s*(.+)$",
                line,
                re.IGNORECASE,
            )

            if auth_match:
                current_auth = auth_match.group(1).strip()
                continue

            auth_match = re.match(
                r"^Autenticación\s*:\s*(.+)$",
                line,
                re.IGNORECASE,
            )

            if auth_match:
                current_auth = auth_match.group(1).strip()
                continue

        # -----------------------------------------------------
        # Guardar última red
        # -----------------------------------------------------

        if current_ssid and current_ssid not in seen:
            networks.append(
                {
                    "ssid": current_ssid,
                    "signal": current_signal,
                    "security": self._normalize_security(
                        current_auth
                    ),
                    "in_use": current_ssid == active,
                }
            )

        # Eliminar redes sin SSID
        networks = [
            network
            for network in networks
            if network["ssid"]
        ]

        # Ordenar por señal
        networks.sort(
            key=lambda network: network["signal"] or 0,
            reverse=True,
        )

        return networks

    # ---------------------------------------------------------
    # SECURITY
    # ---------------------------------------------------------

    def _normalize_security(
        self,
        authentication: Optional[str],
    ) -> str:
        """
        Convierte la autenticación de netsh al formato
        utilizado por el frontend.
        """

        if not authentication:
            return "OPEN"

        auth = authentication.upper()

        if "WPA3" in auth:
            if "ENTERPRISE" in auth:
                return "WPA3-Enterprise"

            return "WPA3-Personal"

        if "WPA2" in auth:
            if "ENTERPRISE" in auth:
                return "WPA2-Enterprise"

            return "WPA2-Personal"

        if "WPA" in auth:
            if "ENTERPRISE" in auth:
                return "WPA-Enterprise"

            return "WPA-Personal"

        if "WEP" in auth:
            return "WEP"

        if "OPEN" in auth:
            return "OPEN"

        if "OWE" in auth:
            return "OWE"

        return authentication

    # ---------------------------------------------------------
    # PROFILE
    # ---------------------------------------------------------

    def _profile_exists(self, ssid: str) -> bool:
        """
        Comprueba si existe un perfil Wi-Fi guardado.
        """

        result = _run(
            ["netsh", "wlan", "show", "profiles"]
        )

        if result.returncode != 0:
            return False

        for line in result.stdout.splitlines():

            if ":" not in line:
                continue

            _, value = line.split(":", 1)

            if value.strip() == ssid:
                return True

        return False

    # ---------------------------------------------------------
    # CONNECT
    # ---------------------------------------------------------

    def connect(
        self,
        ssid: str,
        password: Optional[str] = None,
        hidden: bool = False,
    ) -> dict:
        """
        Conecta a una red Wi-Fi.

        Si ya existe un perfil guardado, utiliza directamente
        ese perfil.

        Si se proporciona una contraseña, se intenta crear
        un perfil mediante netsh.
        """

        current = self.current_connection()

        # -----------------------------------------------------
        # Ya estamos conectados
        # -----------------------------------------------------

        if current == ssid:
            return {
                "ssid": ssid,
                "status": "connected",
                "previous": current,
            }

        # -----------------------------------------------------
        # Si hay otra red conectada, desconectar
        # -----------------------------------------------------

        if current and current != ssid:
            self.disconnect()

        # -----------------------------------------------------
        # Si no existe perfil, necesitamos contraseña
        # -----------------------------------------------------

        if not self._profile_exists(ssid):

            if not password:
                raise WifiError(
                    f"Network '{ssid}' does not have a saved profile "
                    "and requires a password."
                )

            self._create_profile(
                ssid=ssid,
                password=password,
                hidden=hidden,
            )

        # -----------------------------------------------------
        # Obtener interfaz
        # -----------------------------------------------------

        interface_name = self._interface_name()

        command = [
            "netsh",
            "wlan",
            "connect",
            f"name={ssid}",
        ]

        if interface_name:
            command.append(
                f"interface={interface_name}"
            )

        result = _run(
            command,
            timeout=30,
        )

        if result.returncode != 0:
            raise WifiError(
                f"Failed to connect to network '{ssid}'.",
                detail=(
                    result.stderr.strip()
                    or result.stdout.strip()
                ),
            )

        return {
            "ssid": ssid,
            "status": "connected",
            "previous": current,
        }

    # ---------------------------------------------------------
    # CREATE PROFILE
    # ---------------------------------------------------------

    def _create_profile(
        self,
        ssid: str,
        password: str,
        hidden: bool = False,
    ) -> None:
        """
        Crea un perfil Wi-Fi WPA2-Personal.

        Para la mayoría de routers domésticos actuales
        esto es suficiente.
        """

        import os
        import tempfile
        from xml.sax.saxutils import escape

        safe_ssid = escape(ssid)
        safe_password = escape(password)

        non_broadcast = (
            "<nonBroadcast>true</nonBroadcast>"
            if hidden
            else ""
        )

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

            <authEncryption>
                <authentication>WPA2PSK</authentication>
                <encryption>AES</encryption>
                <useOneX>false</useOneX>
            </authEncryption>

            <sharedKey>
                <keyType>passPhrase</keyType>
                <protected>false</protected>
                <keyMaterial>{safe_password}</keyMaterial>
            </sharedKey>

        </security>
    </MSM>
</WLANProfile>
"""

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".xml",
            delete=False,
            encoding="utf-8",
        ) as file:
            file.write(profile_xml)
            temp_path = file.name

        try:

            command = [
                "netsh",
                "wlan",
                "add",
                "profile",
                f"filename={temp_path}",
                "user=current",
            ]

            interface_name = self._interface_name()

            if interface_name:
                command.append(
                    f"interface={interface_name}"
                )

            result = _run(command)

            if result.returncode != 0:
                raise WifiError(
                    f"Failed to create Wi-Fi profile for '{ssid}'.",
                    detail=(
                        result.stderr.strip()
                        or result.stdout.strip()
                    ),
                )

        finally:

            try:
                os.unlink(temp_path)
            except OSError:
                pass

    # ---------------------------------------------------------
    # DISCONNECT
    # ---------------------------------------------------------

    def disconnect(self) -> dict:
        """
        Desconecta la interfaz Wi-Fi actual.
        """

        current = self.current_connection()

        interface_name = self._interface_name()

        command = [
            "netsh",
            "wlan",
            "disconnect",
        ]

        if interface_name:
            command.append(
                f"interface={interface_name}"
            )

        result = _run(command)

        if result.returncode != 0:
            raise WifiError(
                "Failed to disconnect Wi-Fi interface.",
                detail=(
                    result.stderr.strip()
                    or result.stdout.strip()
                ),
            )

        return {
            "status": "disconnected",
            "previous": current,
        }