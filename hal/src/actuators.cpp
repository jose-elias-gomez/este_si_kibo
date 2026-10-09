#include "pins.h"
#include "actuators.h"

#include "pins.h"
#include "actuators.h"

void RobotActuators::begin() {
    head.setPeriodHertz(50);
    leftArm.setPeriodHertz(50);
    rightArm.setPeriodHertz(50);

    head.attach(Pins::HEAD_SERVO, 500, 2400);
    leftArm.attach(Pins::LEFT_ARM_SERVO, 500, 2400);
    rightArm.attach(Pins::RIGHT_ARM_SERVO, 500, 2400);

    headCurrent = 90;
    leftArmCurrent = 90;
    rightArmCurrent = 90;

    headTarget = 90;
    leftArmTarget = 90;
    rightArmTarget = 90;

    head.write(90);
    leftArm.write(90);
    rightArm.write(90);
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

// decodePacket ya garantiza angle <= 180.
void RobotActuators::handleServo(PartId part, uint8_t angle) {
    switch (part) {
        case PartId::LeftArm:
            leftArmTarget = constrain(angle, LEFT_ARM_MIN, LEFT_ARM_MAX);
            break;

        case PartId::RightArm:
            rightArmTarget = constrain(angle, RIGHT_ARM_MIN, RIGHT_ARM_MAX);

            // PRUEBA
            rightArm.write(rightArmTarget);
            break;

        case PartId::Head:
            headTarget = constrain(angle, HEAD_MIN, HEAD_MAX);
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

// Mapeo eléctrico original conservado: Forward = (inA LOW, inB HIGH).
// Si una rueda gira al revés, usa INVERT_*_WHEEL en pins.h.
void RobotActuators::driveWheel(uint8_t enablePin, uint8_t inA, uint8_t inB, MotorCommand command, bool invert) {
    if (command == MotorCommand::Stop) {
        digitalWrite(enablePin, LOW);
        digitalWrite(inA, LOW);
        digitalWrite(inB, LOW);
        return;
    }

    const bool forward = (command == MotorCommand::Forward) != invert;

    // Primero la dirección y al final el enable, para evitar un pulso
    // en sentido contrario al cambiar de dirección.
    digitalWrite(inA, forward ? LOW : HIGH);
    digitalWrite(inB, forward ? HIGH : LOW);
    digitalWrite(enablePin, HIGH);
}

void RobotActuators::setLeftWheel(MotorCommand command) {
    driveWheel(Pins::ENA, Pins::IN1, Pins::IN2, command, Pins::INVERT_LEFT_WHEEL);
}

void RobotActuators::setRightWheel(MotorCommand command) {
    driveWheel(Pins::ENB, Pins::IN3, Pins::IN4, command, Pins::INVERT_RIGHT_WHEEL);
}

void RobotActuators::stopAllMotors() {
    setLeftWheel(MotorCommand::Stop);
    setRightWheel(MotorCommand::Stop);
}

void RobotActuators::updateServos() {
    uint32_t now = millis();

    if (now - lastServoUpdate < SERVO_STEP_INTERVAL) {
        return;
    }

    lastServoUpdate = now;

    // Brazo izquierdo
    if (leftArmCurrent < leftArmTarget) {
        leftArmCurrent++;
        leftArm.write(leftArmCurrent);
    }
    else if (leftArmCurrent > leftArmTarget) {
        leftArmCurrent--;
        leftArm.write(leftArmCurrent);
    }

    // Brazo derecho
    if (rightArmCurrent < rightArmTarget) {
        rightArmCurrent++;
        rightArm.write(rightArmCurrent);
    }
    else if (rightArmCurrent > rightArmTarget) {
        rightArmCurrent--;
        rightArm.write(rightArmCurrent);
    }

    // Cabeza
    if (headCurrent < headTarget) {
        headCurrent++;
        head.write(headCurrent);
    }
    else if (headCurrent > headTarget) {
        headCurrent--;
        head.write(headCurrent);
    }
}