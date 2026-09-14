#include "pins.h"
using namespace Pins;

#include "actuators.h"

void RobotActuators::begin() {
    head.attach(Pins::HEAD_SERVO);
    leftArm.attach(Pins::LEFT_ARM_SERVO);
    rightArm.attach(Pins::RIGHT_ARM_SERVO);

    pinMode(Pins::ENA, OUTPUT);
    pinMode(Pins::IN1, OUTPUT);
    pinMode(Pins::IN2, OUTPUT);

    pinMode(Pins::ENB, OUTPUT);
    pinMode(Pins::IN3, OUTPUT);
    pinMode(Pins::IN4, OUTPUT);

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
            digitalWrite(Pins::ENA, HIGH);
            digitalWrite(Pins::IN1, LOW);
            digitalWrite(Pins::IN2, HIGH);
            break;

        case MotorCommand::Right:
            digitalWrite(Pins::ENA, HIGH);
            digitalWrite(Pins::IN1, HIGH);
            digitalWrite(Pins::IN2, LOW);
            break;

        case MotorCommand::Stop:
        default:
            digitalWrite(Pins::ENA, LOW);
            digitalWrite(Pins::IN1, LOW);
            digitalWrite(Pins::IN2, LOW);
            break;
    }
}

void RobotActuators::setRightWheel(MotorCommand command) {
    switch (command) {
        case MotorCommand::Left:
            digitalWrite(Pins::ENB, HIGH);
            digitalWrite(Pins::IN3, LOW);
            digitalWrite(Pins::IN4, HIGH);
            break;

        case MotorCommand::Right:
            digitalWrite(Pins::ENB, HIGH);
            digitalWrite(Pins::IN3, HIGH);
            digitalWrite(Pins::IN4, LOW);
            break;

        case MotorCommand::Stop:
        default:
            digitalWrite(Pins::ENB, LOW);
            digitalWrite(Pins::IN3, LOW);
            digitalWrite(Pins::IN4, LOW);
            break;
    }
}

void RobotActuators::stopAllMotors() {
    setLeftWheel(MotorCommand::Stop);
    setRightWheel(MotorCommand::Stop);
}