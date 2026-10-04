from enum import IntEnum


class TouchPart(IntEnum):
    LEFT_ARM = 0
    RIGHT_ARM = 1
    HEAD = 2


class TouchEvent(IntEnum):
    TOUCHED = 0
    RELEASED = 1
