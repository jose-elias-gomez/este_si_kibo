from enum import IntEnum

class PartId(IntEnum):
    LEFT_ARM = 0
    RIGHT_ARM = 1
    HEAD = 2
    LEFT_WHEEL = 3
    RIGHT_WHEEL = 4

class MotorCommand(IntEnum):
    LEFT = 0
    RIGHT = 1
    STOP = 2

LEFT = MotorCommand.LEFT
RIGHT = MotorCommand.RIGHT
STOP = MotorCommand.STOP