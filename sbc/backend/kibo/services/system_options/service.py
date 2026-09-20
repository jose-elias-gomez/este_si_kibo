from kibo.services.system_options import _websocket_connector

class SystemOptionsService:

    @staticmethod
    def start():
        _websocket_connector.register()