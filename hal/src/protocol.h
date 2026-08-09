#pragma once

#include <Arduino.h>
#include <stdint.h>

enum class PartId : uint8_t {
    LeftArm    = 0,
    RightArm   = 1,
    Head       = 2,
    LeftWheel  = 3,
    RightWheel = 4,
};

enum class MotorCommand : uint8_t {
    Left  = 0,
    Right = 1,
    Stop  = 2,
};

enum class DecodeStatus : uint8_t {
    Ok = 0,

    ErrorBufferTooShort      = 1,
    ErrorInvalidSerialized   = 2,
    ErrorMaxPacketSize       = 3,
    ErrorTooManyParts        = 4,
    ErrorInvalidPart         = 5,
    ErrorInvalidValue        = 6,
};

struct ProtocolCommand {
    PartId type;
    uint8_t value;
};

constexpr uint8_t MAX_COMMANDS = 5;
constexpr uint8_t MAX_PACKET_SIZE = 1 + (MAX_COMMANDS * 2);

struct ProtocolPacket {
    uint8_t parts = 0;
    ProtocolCommand commands[MAX_COMMANDS] = {};
};

DecodeStatus decodePacket(
    const uint8_t* buffer,
    uint8_t length,
    ProtocolPacket& outPacket
);

bool isValidPart(uint8_t rawPart);
bool isServoPart(PartId part);
bool isWheelPart(PartId part);
bool isValidServoValue(uint8_t value);
bool isValidMotorValue(uint8_t value);