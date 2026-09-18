from web_server import start_webserver
from transports.serial.client import start_serialconnection


if __name__ == "__main__":
    host = "0.0.0.0"

    start_serialconnection()
    start_webserver(host, 25566)
