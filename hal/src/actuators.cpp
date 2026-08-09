#include "actuators.h"
#include "pins.h"

using namespace Pins;

void RobotActuators::begin() {
    head.attach(HEAD_SERVO);
    leftArm.attach(LEFT_ARM_SERVO);
    rightArm.attach(RIGHT_ARM_SERVO);

    pinMode(ENA, OUTPUT);
    pinMode(IN1, OUTPUT);
    pinMode(IN2, OUTPUT);

    pinMode(ENB, OUTPUT);
    pinMode(IN3, OUTPUT);
    pinMode(IN4, OUTPUT);

    stopAllMotors();
}

void RobotActuators::handlePacket(const ProtocolPacket& packet) {
    for (uint8_t i = 0; i < packet.parts; i++) {
        handleCommand(packet.commands[i]);
    }
}

void RobotActuators::handleCommand(const ProtocolCommand& command) {
    if (isServoPart(command.type)) {
        handleServo(command.type, command.value);
        return;
    }

    if (isWheelPart(command.type)) {
        handleWheel(command.type, static_cast<MotorCommand>(command.value));
        return;
    }
}

void RobotActuators::handleServo(PartId part, uint8_t angle) {
    angle = constrain(angle, 0, 180);

    switch (part) {
        case PartId::LeftArm:
            leftArm.write(angle);
            break;

        case PartId::RightArm:
            rightArm.write(angle);
            break;

        case PartId::Head:
            head.write(angle);
            break;

        default:
            break;
    }
}

void RobotActuators::handleWheel(PartId part, MotorCommand command) {
    switch (part) {
        case PartId::LeftWheel:
            setLeftWheel(command);
            break;

        case PartId::RightWheel:
            setRightWheel(command);
            break;

        default:
            break;
    }
}

void RobotActuators::setLeftWheel(MotorCommand command) {
    switch (command) {
        case MotorCommand::Left:
            digitalWrite(ENA, HIGH);
            digitalWrite(IN1, LOW);
            digitalWrite(IN2, HIGH);
            break;

        case MotorCommand::Right:
            digitalWrite(ENA, HIGH);
            digitalWrite(IN1, HIGH);
            digitalWrite(IN2, LOW);
            break;

        case MotorCommand::Stop:
        default:
            digitalWrite(ENA, LOW);
            digitalWrite(IN1, LOW);
            digitalWrite(IN2, LOW);
            break;
    }
}

void RobotActuators::setRightWheel(MotorCommand command) {
    switch (command) {
        case MotorCommand::Left:
            digitalWrite(ENB, HIGH);
            digitalWrite(IN3, LOW);
            digitalWrite(IN4, HIGH);
            break;

        case MotorCommand::Right:
            digitalWrite(ENB, HIGH);
            digitalWrite(IN3, HIGH);
            digitalWrite(IN4, LOW);
            break;

        case MotorCommand::Stop:
        default:
            digitalWrite(ENB, LOW);
            digitalWrite(IN3, LOW);
            digitalWrite(IN4, LOW);
            break;
    }
}

void RobotActuators::stopAllMotors() {
    setLeftWheel(MotorCommand::Stop);
    setRightWheel(MotorCommand::Stop);
}