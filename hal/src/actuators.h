#pragma once

#include <Arduino.h>
#include <ESP32Servo.h>
#include "protocol.h"

class RobotActuators {
public:
    void begin();
    void handlePacket(const ProtocolPacket& packet);
    void handleCommand(const ProtocolCommand& command);
    void stopAllMotors();

private:
    Servo leftArm;
    Servo rightArm;
    Servo head;

    void handleServo(PartId part, uint8_t angle);
    void handleWheel(PartId part, MotorCommand command);

    void setLeftWheel(MotorCommand command);
    void setRightWheel(MotorCommand command);

    static void driveWheel(uint8_t enablePin, uint8_t inA, uint8_t inB,
                           MotorCommand command, bool invert);
};