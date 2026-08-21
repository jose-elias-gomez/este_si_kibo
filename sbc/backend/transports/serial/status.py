from enum import IntEnum

class DecodeStatus(IntEnum):
    OK = 0

    ERROR_BUFFER_TOO_SHORT = 1
    ERROR_INVALID_SERIALIZED = 2
    ERROR_MAX_PACKET_SIZE = 3
    ERROR_TOO_MANY_PARTS = 4
    ERROR_INVALID_PART = 5
    ERROR_INVALID_VALUE = 6

DECODE_STATUS_MESSAGES: dict[DecodeStatus, str] = {
    DecodeStatus.OK: "OK",

    DecodeStatus.ERROR_BUFFER_TOO_SHORT: "Buffer too short",
    DecodeStatus.ERROR_INVALID_SERIALIZED: "Invalid serialized packet",
    DecodeStatus.ERROR_MAX_PACKET_SIZE: "Packet exceeded max packet size",
    DecodeStatus.ERROR_TOO_MANY_PARTS: "Too many parts in packet",
    DecodeStatus.ERROR_INVALID_PART: "Invalid part id",
    DecodeStatus.ERROR_INVALID_VALUE: "Invalid value for part",
}