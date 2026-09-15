import atexit
from transports.serial.serial_client import SerialRobotClient

robot_client: SerialRobotClient | None = None

def get_robot_client() -> SerialRobotClient:
    """Devuelve el cliente asegurando que esté inicializado."""
    if robot_client is None:
        raise RuntimeError("El cliente serial no ha sido inicializado. Llama a start_serialconnection() primero.")
    return robot_client

def start_serialconnection(port="/dev/ttyACM0", baudrate=9600) -> SerialRobotClient:
    global robot_client
    robot_client = SerialRobotClient(port, baudrate)
    try:
        robot_client.__enter__()
        print(f"✅ Conectado a {port}")
    except Exception as e:
        print(f"❌ Falló la conexión: {type(e).__name__}: {e}")
        raise
    
    atexit.register(cleanup)
    return robot_client

def cleanup():
    global robot_client
    if robot_client:
        robot_client.__exit__(None, None, None)
        robot_client = None
        print("Puerto Serial cerrado.")