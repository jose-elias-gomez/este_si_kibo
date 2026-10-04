#include "protocol.h"

bool isValidPart(uint8_t rawPart) {
    switch (static_cast<PartId>(rawPart)) {
        case PartId::LeftArm:
        case PartId::RightArm:
        case PartId::Head:
        case PartId::LeftWheel:
        case PartId::RightWheel:
            return true;

        default:
            return false;
    }
}

bool isServoPart(PartId part) {
    switch (part) {
        case PartId::LeftArm:
        case PartId::RightArm:
        case PartId::Head:
            return true;

        default:
            return false;
    }
}

bool isWheelPart(PartId part) {
    switch (part) {
        case PartId::LeftWheel:
        case PartId::RightWheel:
            return true;

        default:
            return false;
    }
}

bool isValidServoValue(uint8_t value) {
    return value <= 180;
}

bool isValidMotorValue(uint8_t value) {
    switch (static_cast<MotorCommand>(value)) {
        case MotorCommand::Forward:
        case MotorCommand::Backward:
        case MotorCommand::Stop:
            return true;

        default:
            return false;
    }
}

uint8_t computeChecksum(const uint8_t* data, uint8_t length) {
    uint8_t sum = 0;
    for (uint8_t i = 0; i < length; i++) {
        sum ^= data[i];
    }
    return sum;
}

DecodeStatus decodePacket(
    const uint8_t* buffer,
    uint8_t length,
    ProtocolPacket& outPacket
) {
    // Mínimo: parts + checksum.
    if (buffer == nullptr || length < 2) {
        return DecodeStatus::ErrorBufferTooShort;
    }

    if (length > MAX_PACKET_SIZE) {
        return DecodeStatus::ErrorMaxPacketSize;
    }

    const uint8_t parts = buffer[0];

    if (parts > MAX_COMMANDS) {
        return DecodeStatus::ErrorTooManyParts;
    }

    const uint8_t expectedLength = 2 + (parts * 2);

    if (length != expectedLength) {
        return DecodeStatus::ErrorInvalidSerialized;
    }

    if (computeChecksum(buffer, length - 1) != buffer[length - 1]) {
        return DecodeStatus::ErrorBadChecksum;
    }

    ProtocolPacket packet;
    packet.parts = parts;

    uint8_t index = 1;

    for (uint8_t i = 0; i < parts; i++) {
        const uint8_t rawPart = buffer[index++];
        const uint8_t value   = buffer[index++];

        if (!isValidPart(rawPart)) {
            return DecodeStatus::ErrorInvalidPart;
        }

        const PartId part = static_cast<PartId>(rawPart);

        if (isServoPart(part) && !isValidServoValue(value)) {
            return DecodeStatus::ErrorInvalidValue;
        }

        if (isWheelPart(part) && !isValidMotorValue(value)) {
            return DecodeStatus::ErrorInvalidValue;
        }

        packet.commands[i].type  = part;
        packet.commands[i].value = value;
    }

    outPacket = packet;

    return DecodeStatus::Ok;
}