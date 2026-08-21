from web_server import start_webserver
from transports.serial.client import start_serialconnection

if __name__ == "__main__":
    host = "127.0.0.1"

    start_webserver(host, 25566)

    start_serialconnection()
