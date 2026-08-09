#!/bin/bash

set -e

# ============================================================
# KIBO - WPE WEBKIT INSTALLER
#
# Uso:
#   sudo ./install-wpe.sh
#
# Sin autostart:
#   sudo ./install-wpe.sh --skip-autostart
# ============================================================

SKIP_AUTOSTART=false

# ------------------------------------------------------------
# Argumentos
# ------------------------------------------------------------

for arg in "$@"; do
    case "$arg" in

        --skip-autostart)
            SKIP_AUTOSTART=true
            ;;

        -h|--help)
            echo
            echo "Uso:"
            echo
            echo "  sudo ./install-wpe.sh"
            echo
            echo "Instala WPE WebKit + Cog + autostart."
            echo
            echo "  sudo ./install-wpe.sh --skip-autostart"
            echo
            echo "Instala WPE WebKit + Cog pero NO instala autostart."
            echo
            exit 0
            ;;

        *)
            echo
            echo "ERROR: Argumento desconocido: $arg"
            echo
            echo "Usá:"
            echo "  --skip-autostart"
            echo
            echo "o:"
            echo "  --help"
            echo
            exit 1
            ;;

    esac
done


# ------------------------------------------------------------
# Banner
# ------------------------------------------------------------

echo
echo "=============================================="
echo "       KIBO - WPE WEBKIT INSTALLER"
echo "=============================================="
echo

if [ "$SKIP_AUTOSTART" = true ]; then
    echo "Modo: instalación SIN autostart"
else
    echo "Modo: instalación CON autostart"
fi

echo


# ------------------------------------------------------------
# Comprobar root
# ------------------------------------------------------------

if [ "$EUID" -ne 0 ]; then

    echo "ERROR: Este instalador necesita permisos de root."
    echo
    echo "Ejecutalo así:"
    echo
    echo "    sudo ./install-wpe.sh"
    echo

    exit 1
fi


# ------------------------------------------------------------
# Comprobar APT
# ------------------------------------------------------------

if ! command -v apt >/dev/null 2>&1; then

    echo "ERROR: No se encontró apt."
    echo
    echo "Este instalador está pensado para Armbian/Debian/Ubuntu."
    echo

    exit 1
fi


# ------------------------------------------------------------
# Información del sistema
# ------------------------------------------------------------

echo "[INFO] Sistema:"
echo

if [ -f /etc/os-release ]; then
    . /etc/os-release

    echo "  OS:      ${PRETTY_NAME:-desconocido}"
    echo "  ID:      ${ID:-desconocido}"
    echo "  Version: ${VERSION_ID:-desconocida}"
fi

echo "  Kernel:  $(uname -r)"
echo "  Arch:    $(uname -m)"

echo


# ------------------------------------------------------------
# Actualizar repositorios
# ------------------------------------------------------------

echo "=============================================="
echo "[1/7] Actualizando repositorios"
echo "=============================================="
echo

apt update


# ------------------------------------------------------------
# Herramientas básicas
# ------------------------------------------------------------

echo
echo "=============================================="
echo "[2/7] Instalando herramientas básicas"
echo "=============================================="
echo

apt install -y \
    ca-certificates \
    curl \
    wget \
    pkg-config \
    python3 \
    python3-pip \
    python3-venv


# ------------------------------------------------------------
# Buscar paquetes WPE
# ------------------------------------------------------------

echo
echo "=============================================="
echo "[3/7] Buscando paquetes WPE"
echo "=============================================="
echo

WPE_PACKAGES=""

check_package() {

    PACKAGE="$1"

    if apt-cache show "$PACKAGE" >/dev/null 2>&1; then

        echo "  [OK] $PACKAGE"

        WPE_PACKAGES="$WPE_PACKAGES $PACKAGE"

    else

        echo "  [--] $PACKAGE no disponible"

    fi
}


check_package "libwpe-1.0-1"
check_package "libwpebackend-fdo-1.0-1"
check_package "libwpewebkit-2.0-1"
check_package "cog"


echo


# ------------------------------------------------------------
# Verificar WPE
# ------------------------------------------------------------

if [ -z "$WPE_PACKAGES" ]; then

    echo "=============================================="
    echo "ERROR"
    echo "=============================================="
    echo
    echo "No se encontraron paquetes WPE en los repositorios."
    echo
    echo "Probá manualmente:"
    echo
    echo "    apt search wpe"
    echo "    apt search cog"
    echo
    echo "Si estás usando una versión particular de Armbian,"
    echo "puede que necesitemos instalar WPE desde otra fuente."
    echo

    exit 1
fi


# ------------------------------------------------------------
# Instalar WPE
# ------------------------------------------------------------

echo "=============================================="
echo "[4/7] Instalando WPE WebKit + Cog"
echo "=============================================="
echo

apt install -y $WPE_PACKAGES


# ------------------------------------------------------------
# Dependencias DRM/KMS
# ------------------------------------------------------------

echo
echo "=============================================="
echo "[5/7] Instalando dependencias DRM/KMS"
echo "=============================================="
echo

apt install -y \
    libdrm2 \
    libgbm1 \
    libegl1 \
    libgles2 \
    mesa-utils


# ------------------------------------------------------------
# Comprobar instalación
# ------------------------------------------------------------

echo
echo "=============================================="
echo "[6/7] Comprobando instalación"
echo "=============================================="
echo


echo "WPE:"
echo

dpkg -l | grep -E 'libwpe|wpewebkit|wpebackend' || true


echo
echo "Cog:"
echo

if command -v cog >/dev/null 2>&1; then

    COG_PATH="$(command -v cog)"

    echo "  [OK] Cog encontrado"
    echo "  Ruta: $COG_PATH"

else

    echo "  [ERROR] Cog no está instalado."
    echo

    exit 1

fi


echo
echo "DRM:"
echo

if [ -d /dev/dri ]; then

    echo "  [OK] /dev/dri existe"

    ls -la /dev/dri

else

    echo "  [AVISO] /dev/dri no existe."
    echo
    echo "  El modo DRM/KMS probablemente no funcionará"
    echo "  hasta configurar el driver gráfico."

fi


# ------------------------------------------------------------
# Comprobar usuario orangepi
# ------------------------------------------------------------

echo
echo "Usuario:"
echo

if id "orangepi" >/dev/null 2>&1; then

    echo "  [OK] Usuario orangepi encontrado"

else

    echo "  [AVISO] El usuario orangepi no existe."
    echo "  El autostart necesitará configurarse manualmente."

fi


# ------------------------------------------------------------
# Autostart
# ------------------------------------------------------------

echo
echo "=============================================="
echo "[7/7] Configuración del autostart"
echo "=============================================="
echo


if [ "$SKIP_AUTOSTART" = true ]; then

    echo "Autostart omitido."
    echo
    echo "Para instalarlo posteriormente:"
    echo
    echo "    sudo ./install-autostart.sh"
    echo

else

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    AUTOSTART_SCRIPT="$SCRIPT_DIR/install-autostart.sh"


    if [ ! -f "$AUTOSTART_SCRIPT" ]; then

        echo "ERROR: No se encontró:"
        echo
        echo "    $AUTOSTART_SCRIPT"
        echo
        echo "WPE/Cog se instalaron correctamente,"
        echo "pero el autostart NO fue instalado."
        echo
        echo "Colocá install-autostart.sh junto a este script"
        echo "y ejecutalo nuevamente."
        echo

        exit 1

    fi


    echo "Instalando autostart..."
    echo

    chmod +x "$AUTOSTART_SCRIPT"

    "$AUTOSTART_SCRIPT"

fi


# ------------------------------------------------------------
# Final
# ------------------------------------------------------------

echo
echo
echo "=============================================="
echo "       INSTALACIÓN COMPLETADA"
echo "=============================================="
echo

echo "WPE WebKit:      INSTALADO"
echo "Cog:             INSTALADO"
echo "DRM/KMS libs:    INSTALADAS"

if [ "$SKIP_AUTOSTART" = true ]; then
    echo "Autostart:       OMITIDO"
else
    echo "Autostart:       INSTALADO"
fi

echo
echo "=============================================="
echo "Prueba manual"
echo "=============================================="
echo

echo "Podés probar Cog con:"
echo
echo "    cog https://example.com"
echo

echo "Y para probar DRM/KMS:"
echo
echo "    WPE_DISPLAY=wpe-display-drm cog https://example.com"
echo

echo "=============================================="
echo "Aplicación local"
echo "=============================================="
echo

echo "Si tu Kibo está en:"
echo
echo "    /home/orangepi/kibo"
echo
echo "podés levantar el servidor:"
echo
echo "    cd /home/orangepi/kibo"
echo "    python3 -m http.server 8080"
echo
echo "y probar:"
echo
echo "    WPE_DISPLAY=wpe-display-drm cog http://127.0.0.1:8080"
echo

echo "=============================================="
echo "Listo."
echo "=============================================="
echo