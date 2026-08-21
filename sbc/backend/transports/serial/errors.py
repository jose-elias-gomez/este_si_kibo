from status import DecodeStatus, DECODE_STATUS_MESSAGES

class SerialConnectionError(RuntimeError):
    pass

class SerialTimeoutError(TimeoutError):
    pass

class ProtocolDecodeError(RuntimeError):
    def __init__(self, status: DecodeStatus) -> None:
        self.status = status
        message = DECODE_STATUS_MESSAGES.get(status, f"Unknown decode status: {int(status)}")
        super().__init__(message)

class UnknownProtocolStatusError(RuntimeError):
    def __init__(self, raw_status: int) -> None:
        self.raw_status = raw_status
        super().__init__(f"Unknown protocol status received: {raw_status}")
