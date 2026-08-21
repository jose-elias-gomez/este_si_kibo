import atexit

from transports.serial.serial_client import SerialRobotClient

robot_client: SerialRobotClient | None = None

def start_serialconnection(
  port = "/dev/ttyUSB0",
  baudrate = 9600,
):
  global robot_client
  robot_client = SerialRobotClient(port, baudrate)
  robot_client.__enter__()

  # Registramos la función para que se ejecute al salir del runtime
  atexit.register(cleanup)

def cleanup():
    if robot_client:
        robot_client.__exit__(None, None, None)
        print("Puerto Serial cerrado.")
