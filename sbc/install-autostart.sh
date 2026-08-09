#!/bin/bash

set -e

APP_DIR="/home/orangepi/kibo"
USER_NAME="orangepi"

SERVER_SERVICE="kibo-server.service"
COG_SERVICE="kibo-cog.service"

echo
echo "========================================="
echo "       KIBO - AUTOSTART INSTALLER"
echo "========================================="
echo

# --------------------------------------------------
# Comprobar root
# --------------------------------------------------

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Ejecutá este script con sudo:"
    echo
    echo "    sudo ./install-autostart.sh"
    exit 1
fi

# --------------------------------------------------
# Comprobar usuario
# --------------------------------------------------

if ! id "$USER_NAME" >/dev/null 2>&1; then
    echo "ERROR: El usuario '$USER_NAME' no existe."
    echo
    echo "Cambiá USER_NAME en este script por tu usuario."
    exit 1
fi

# --------------------------------------------------
# Comprobar aplicación
# --------------------------------------------------

if [ ! -f "$APP_DIR/index.html" ]; then
    echo "ERROR: No se encontró:"
    echo
    echo "    $APP_DIR/index.html"
    echo
    echo "Creá tu aplicación primero."
    exit 1
fi

# --------------------------------------------------
# Comprobar Cog
# --------------------------------------------------

if ! command -v cog >/dev/null 2>&1; then
    echo "ERROR: Cog no está instalado."
    echo
    echo "Instalá WPE/Cog primero."
    exit 1
fi

COG_PATH=$(command -v cog)

echo "Usuario:       $USER_NAME"
echo "Aplicación:    $APP_DIR"
echo "Cog:           $COG_PATH"
echo

# --------------------------------------------------
# Crear servicio Python
# --------------------------------------------------

echo "[1/5] Creando servicio del servidor web..."

cat > "/etc/systemd/system/$SERVER_SERVICE" <<EOF
[Unit]
Description=Kibo Web Server
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$APP_DIR

ExecStart=/usr/bin/python3 -m http.server 8080 --bind 127.0.0.1

Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# --------------------------------------------------
# Crear servicio Cog
# --------------------------------------------------

echo "[2/5] Creando servicio Cog/WPE..."

cat > "/etc/systemd/system/$COG_SERVICE" <<EOF
[Unit]
Description=Kibo WPE Web Interface
After=$SERVER_SERVICE
Requires=$SERVER_SERVICE

[Service]
Type=simple
User=$USER_NAME

Environment=WPE_DISPLAY=wpe-display-drm

ExecStart=$COG_PATH http://127.0.0.1:8080

Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# --------------------------------------------------
# Recargar systemd
# --------------------------------------------------

echo "[3/5] Recargando systemd..."

systemctl daemon-reload

# --------------------------------------------------
# Habilitar servicios
# --------------------------------------------------

echo "[4/5] Habilitando servicios..."

systemctl enable "$SERVER_SERVICE"
systemctl enable "$COG_SERVICE"

# --------------------------------------------------
# Iniciar servicios
# --------------------------------------------------

echo "[5/5] Iniciando servicios..."

systemctl restart "$SERVER_SERVICE"

sleep 1

systemctl restart "$COG_SERVICE"

echo
echo "========================================="
echo "       AUTOSTART INSTALADO"
echo "========================================="
echo
echo "Servidor:"
echo "  systemctl status $SERVER_SERVICE"
echo
echo "Cog:"
echo "  systemctl status $COG_SERVICE"
echo
echo "Logs del servidor:"
echo "  journalctl -u $SERVER_SERVICE -f"
echo
echo "Logs de Cog:"
echo "  journalctl -u $COG_SERVICE -f"
echo
echo "========================================="
echo "Kibo arrancará automáticamente al iniciar."
echo "========================================="