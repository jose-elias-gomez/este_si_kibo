import sys
from evdev import InputDevice, ecodes, list_devices

# Mismos identificadores de tu control
VENDOR_ID = 0x05AC
PRODUCT_ID = 0x022C


def find_device():
    """Busca el dispositivo por VENDOR_ID y PRODUCT_ID."""
    for path in list_devices():
        try:
            dev = InputDevice(path)
            if dev.info.vendor == VENDOR_ID and dev.info.product == PRODUCT_ID:
                return dev
            dev.close()
        except Exception:
            pass
    return None


def main():
    print("=" * 60)
    print("   PROBADOR DE BOTONES Y EJES DEL JOYSTICK")
    print("=" * 60)
    print("[BUSCANDO] Esperando a que el control esté conectado...")

    device = find_device()

    if not device:
        print(
            "[ERROR] No se encontró el joystick con VENDOR_ID 0x05AC y PRODUCT_ID 0x022C."
        )
        print("Asegúrate de ejecutar con permisos (ej: sudo python test_joystick.py)")
        sys.exit(1)

    print(f"\n[CONECTADO] {device.name} en {device.path}")
    print("Presiona botones o mueve la cruceta (Ctrl + C para salir)\n")
    print("-" * 60)

    try:
        for event in device.read_loop():
            # BOTONES
            if event.type == ecodes.EV_KEY:
                estado = (
                    "PRESIONADO"
                    if event.value == 1
                    else "SOLTADO"
                    if event.value == 0
                    else "MANTENIDO"
                )
                print(
                    f"-> [BOTÓN] Código: {event.code:<5} | Estado: {estado:<10} | Nombre interno: {ecodes.KEY.get(event.code, 'Desconocido')}"
                )

            # EJES / CRUCETA / ANALÓGICOS
            elif event.type == ecodes.EV_ABS:
                print(
                    f"-> [EJE/ABS] Código: {event.code:<4} | Valor: {event.value:<5} | Nombre interno: {ecodes.ABS.get(event.code, 'Desconocido')}"
                )

    except KeyboardInterrupt:
        print("\nPrueba finalizada.")
    finally:
        device.close()


if __name__ == "__main__":
    main()