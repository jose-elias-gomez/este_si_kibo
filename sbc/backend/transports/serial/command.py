from dataclasses import dataclass

from transports.serial.enums import PartId

@dataclass
class ProtocolCommand:
    part: PartId
    value: int
