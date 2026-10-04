from enum import IntEnum

# Format host -> robot:
#   [0xAA] [parts] [part0][value0] ... [partN][valueN] [checksum]
# checksum = XOR de `parts` y de todos los pares part/value (sin la cabecera).
PACKET_HEADER = 0xAA
MAX_COMMANDS = 5


class PacketId(IntEnum):
    DECODED = 0  # [0][status]            -> 2 bytes
    TOUCH = 1    # [1][pieza][evento]     -> 3 bytes


class DecodeStatus(IntEnum):
    OK = 0
    ERROR_BUFFER_TOO_SHORT = 1
    ERROR_INVALID_SERIALIZED = 2
    ERROR_MAX_PACKET_SIZE = 3
    ERROR_TOO_MANY_PARTS = 4
    ERROR_INVALID_PART = 5
    ERROR_INVALID_VALUE = 6
    ERROR_BAD_CHECKSUM = 7


def compute_checksum(data: bytes | bytearray) -> int:
    checksum = 0
    for byte in data:
        checksum ^= byte
    return checksum
