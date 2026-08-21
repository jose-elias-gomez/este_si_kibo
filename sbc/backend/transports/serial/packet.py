from __future__ import annotations

from transports.serial.command import ProtocolCommand
from transports.serial.enums import PartId, MotorCommand


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

    def build(self) -> bytes:
        commands = self._commands()

        raw = bytearray()
        raw.append(len(commands))

        for command in commands:
            raw.append(command.part)
            raw.append(command.value)

        return bytes(raw)

    def _commands(self) -> list[ProtocolCommand]:
        return [
            command
            for command in [
                self.left_arm_cmd,
                self.right_arm_cmd,
                self.head_cmd,
                self.left_wheel_cmd,
                self.right_wheel_cmd,
            ]
            if command is not None
        ]

    @staticmethod
    def _validate_servo_angle(angle: int) -> None:
        if not 0 <= angle <= 180:
            raise ValueError(f"Invalid servo angle: {angle}. Expected 0..180")

    @staticmethod
    def _normalize_motor_command(command: MotorCommand | int) -> int:
        value = int(command)

        valid_values = {
            int(MotorCommand.LEFT),
            int(MotorCommand.RIGHT),
            int(MotorCommand.STOP),
        }

        if value not in valid_values:
            raise ValueError(
                f"Invalid motor command: {value}. "
                f"Expected LEFT=0, RIGHT=1 or STOP=2"
            )

        return value
