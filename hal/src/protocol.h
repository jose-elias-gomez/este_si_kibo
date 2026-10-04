#pragma once

#include <Arduino.h>
#include <stdint.h>

// Formato de paquete host -> robot:
//
//   [0xAA] [parts] [part0][value0] ... [partN][valueN] [checksum]
//
// checksum = XOR de todos los bytes entre la cabecera (excluida) y el
// checksum (excluido), es decir: parts y todos los pares part/value.
// Un paquete con parts = 0 sirve como "heartbeat": [0xAA][0x00][0x00].
constexpr uint8_t PACKET_HEADER = 0xAA;

enum class PacketId : uint8_t {
    DECODED = 0,
    TOUCH = 1,
};

enum class PartId : uint8_t {
    LeftArm    = 0,
    RightArm   = 1,
    Head       = 2,
    LeftWheel  = 3,
    RightWheel = 4,
};

enum class MotorCommand : uint8_t {
    Forward  = 0,
    Backward = 1,
    Stop     = 2,
};

enum class DecodeStatus : uint8_t {
    Ok = 0,

    ErrorBufferTooShort      = 1,
    ErrorInvalidSerialized   = 2,
    ErrorMaxPacketSize       = 3,
    ErrorTooManyParts        = 4,
    ErrorInvalidPart         = 5,
    ErrorInvalidValue        = 6,
    ErrorBadChecksum         = 7,
};

struct ProtocolCommand {
    PartId type;
    uint8_t value;
};

constexpr uint8_t MAX_COMMANDS = 5;

// Tamaño del paquete SIN la cabecera: parts + pares + checksum.
constexpr uint8_t MAX_PACKET_SIZE = 1 + (MAX_COMMANDS * 2) + 1;

struct ProtocolPacket {
    uint8_t parts = 0;
    ProtocolCommand commands[MAX_COMMANDS] = {};
};

// 'buffer' contiene parts + pares + checksum (sin la cabecera).
DecodeStatus decodePacket(
    const uint8_t* buffer,
    uint8_t length,
    ProtocolPacket& outPacket
);

uint8_t computeChecksum(const uint8_t* data, uint8_t length);

bool isValidPart(uint8_t rawPart);
bool isServoPart(PartId part);
bool isWheelPart(PartId part);
bool isValidServoValue(uint8_t value);
bool isValidMotorValue(uint8_t value);