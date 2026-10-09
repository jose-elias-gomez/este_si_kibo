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

    // Actualiza los servos progresivamente
    void updateServos();

private:
    Servo leftArm;
    Servo rightArm;
    Servo head;

    // Posición actual de cada servo
    int leftArmCurrent = 90;
    int rightArmCurrent = 90;
    int headCurrent = 90;

    // Posición objetivo de cada servo
    int leftArmTarget = 90;
    int rightArmTarget = 90;
    int headTarget = 90;

    static constexpr int LEFT_ARM_MIN = 0;
    static constexpr int LEFT_ARM_MAX = 180;

    static constexpr int RIGHT_ARM_MIN = 0;
    static constexpr int RIGHT_ARM_MAX = 180;

    static constexpr int HEAD_MIN = 0;
    static constexpr int HEAD_MAX = 180;

    // Cada cuánto avanza 1 grado
    static constexpr uint32_t SERVO_STEP_INTERVAL = 20;

    uint32_t lastServoUpdate = 0;

    void handleServo(PartId part, uint8_t angle);
    void handleWheel(PartId part, MotorCommand command);

    void setLeftWheel(MotorCommand command);
    void setRightWheel(MotorCommand command);

    static void driveWheel(uint8_t enablePin, uint8_t inA, uint8_t inB,
                           MotorCommand command, bool invert);
};