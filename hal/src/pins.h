#pragma once

#include <Arduino.h>

namespace Pins {
    constexpr uint8_t HEAD_SERVO      = 41;
    constexpr uint8_t LEFT_ARM_SERVO  = 39;
    constexpr uint8_t RIGHT_ARM_SERVO = 6;

    constexpr uint8_t ENA = 18;
    constexpr uint8_t IN1 = 10;
    constexpr uint8_t IN2 = 11;

    constexpr uint8_t IN3 = 12;
    constexpr uint8_t IN4 = 13;
    constexpr uint8_t ENB = 17;

    constexpr uint8_t LEFT_ARM_TOUCH = 5;
    constexpr uint8_t HEAD_TOUCH = 6;
    constexpr uint8_t RIGHT_ARM_TOUCH = 7;
}
