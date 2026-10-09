#pragma once

#include <Arduino.h>

namespace Pins {
    constexpr uint8_t HEAD_SERVO      = 37;
    constexpr uint8_t LEFT_ARM_SERVO  = 36;
    constexpr uint8_t RIGHT_ARM_SERVO = 35;

    constexpr uint8_t ENA = 18;
    constexpr uint8_t IN1 = 10;
    constexpr uint8_t IN2 = 11;

    constexpr uint8_t IN3 = 4;
    constexpr uint8_t IN4 = 5;
    constexpr uint8_t ENB = 17;

    constexpr uint8_t LEFT_ARM_TOUCH  = 13;
    constexpr uint8_t HEAD_TOUCH      = 14;
    constexpr uint8_t RIGHT_ARM_TOUCH = 12;

    constexpr bool INVERT_LEFT_WHEEL  = false;
    constexpr bool INVERT_RIGHT_WHEEL = false;
}