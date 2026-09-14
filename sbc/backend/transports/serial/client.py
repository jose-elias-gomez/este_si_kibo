import atexit

from transports.serial.serial_client import SerialRobotClient

robot_client: SerialRobotClient | None = None

def start_serialconnection(port="/dev/ttyACM0", baudrate=9600):
    global robot_client
    robot_client = SerialRobotClient(port, baudrate)
    try:
        robot_client.__enter__()
        print(f"✅ Conectado a {port}, is_open={robot_client.connection.is_open}")
    except Exception as e:
        print(f"❌ Falló la conexión: {type(e).__name__}: {e}")
        raise
    atexit.register(cleanup)

def cleanup():
    if robot_client:
        robot_client.__exit__(None, None, None)
        print("Puerto Serial cerrado.")
