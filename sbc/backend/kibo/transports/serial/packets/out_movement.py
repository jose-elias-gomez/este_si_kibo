from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum

from kibo.transports.serial.protocol import MAX_COMMANDS, PACKET_HEADER, compute_checksum


class PartId(IntEnum):
    LEFT_ARM = 0
    RIGHT_ARM = 1
    HEAD = 2
    LEFT_WHEEL = 3
    RIGHT_WHEEL = 4


class MotorCommand(IntEnum):
    FORWARD = 0
    BACKWARD = 1
    STOP = 2


WHEEL_PARTS = (PartId.LEFT_WHEEL, PartId.RIGHT_WHEEL)


@dataclass
class ProtocolCommand:
    part: PartId
    value: int


class MovementPacket:
    def __init__(self) -> None:
        self.left_arm_cmd: ProtocolCommand | None = None
        self.right_arm_cmd: ProtocolCommand | None = None
        self.head_cmd: ProtocolCommand | None = None
        self.left_wheel_cmd: ProtocolCommand | None = None
        self.right_wheel_cmd: ProtocolCommand | None = None

    def left_arm(self, angle: int) -> MovementPacket:
        self._validate_servo_angle(angle)
        self.left_arm_cmd = ProtocolCommand(PartId.LEFT_ARM, angle)
        return self

    def right_arm(self, angle: int) -> MovementPacket:
        self._validate_servo_angle(angle)
        self.right_arm_cmd = ProtocolCommand(PartId.RIGHT_ARM, angle)
        return self

    def head(self, angle: int) -> MovementPacket:
        self._validate_servo_angle(angle)
        self.head_cmd = ProtocolCommand(PartId.HEAD, angle)
        return self

    def left_wheel(self, command: MotorCommand | int) -> MovementPacket:
        value = self._normalize_motor_command(command)
        self.left_wheel_cmd = ProtocolCommand(PartId.LEFT_WHEEL, value)
        return self

    def right_wheel(self, command: MotorCommand | int) -> MovementPacket:
        value = self._normalize_motor_command(command)
        self.right_wheel_cmd = ProtocolCommand(PartId.RIGHT_WHEEL, value)
        return self

    def stop_wheels(self) -> MovementPacket:
        return self.left_wheel(MotorCommand.STOP).right_wheel(MotorCommand.STOP)

    def set_command(self, command: ProtocolCommand) -> MovementPacket:
        """Coloca un comando ya construido en la ranura de su pieza."""
        slots = {
            PartId.LEFT_ARM: "left_arm_cmd",
            PartId.RIGHT_ARM: "right_arm_cmd",
            PartId.HEAD: "head_cmd",
            PartId.LEFT_WHEEL: "left_wheel_cmd",
            PartId.RIGHT_WHEEL: "right_wheel_cmd",
        }
        setattr(self, slots[PartId(command.part)], command)
        return self

    def commands(self) -> list[ProtocolCommand]:
        return [
            command
            for command in (
                self.left_arm_cmd,
                self.right_arm_cmd,
                self.head_cmd,
                self.left_wheel_cmd,
                self.right_wheel_cmd,
            )
            if command is not None
        ]

    def build(self) -> bytes:
        """[0xAA][parts][part,value]...[checksum]

        Un paquete sin comandos equivale a un heartbeat: AA 00 00.
        """
        commands = self.commands()
        if len(commands) > MAX_COMMANDS:
            raise ValueError(f"Too many commands: {len(commands)} (max {MAX_COMMANDS})")

        payload = bytearray([len(commands)])
        for command in commands:
            payload.append(int(command.part))
            payload.append(command.value)

        payload.append(compute_checksum(payload))
        return bytes([PACKET_HEADER]) + bytes(payload)

    @staticmethod
    def heartbeat() -> bytes:
        return MovementPacket().build()

    @staticmethod
    def _validate_servo_angle(angle: int) -> None:
        if not 0 <= angle <= 180:
            raise ValueError(f"Invalid servo angle: {angle}. Expected 0..180")

    @staticmethod
    def _normalize_motor_command(command: MotorCommand | int) -> int:
        value = int(command)

        if value not in {int(c) for c in MotorCommand}:
            raise ValueError(
                f"Invalid motor command: {value}. "
                f"Expected FORWARD=0, BACKWARD=1 or STOP=2"
            )

        return value
