Subir el código al ESP32 (controlador de motores):
    1) En una PC aparte descargue VsCode o cualquier herramienta que permite utilizar PlatformIO
    2) Conecte el ESP32 a algun puerto de la PC y suba el código

Instalar el OS desde el SBC (orangepi/raspberry/etc):
    1) Descargue los archivos pertenecientes a la carpeta SBC

    2) Ejecute:
        chmod +x install-wpe.sh install-autostart.sh

    3) Ejecute: sudo ./install-wpe.sh
        (Puede skipear el autostart usando el argumento "--skip-autostart" para comprobar si funciona,
        en cuyo caso luego ejecute sudo ./install-autostart.sh si anda)
