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
        case MotorCommand::Left:
        case MotorCommand::Right:
        case MotorCommand::Stop:
            return true;

        default:
            return false;
    }
}

DecodeStatus decodePacket(
    const uint8_t* buffer,
    uint8_t length,
    ProtocolPacket& outPacket
) {
    if (buffer == nullptr) {
        return DecodeStatus::ErrorBufferTooShort;
    }

    if (length < 1) {
        return DecodeStatus::ErrorBufferTooShort;
    }

    if (length > MAX_PACKET_SIZE) {
        return DecodeStatus::ErrorMaxPacketSize;
    }

    const uint8_t parts = buffer[0];

    if (parts > MAX_COMMANDS) {
        return DecodeStatus::ErrorTooManyParts;
    }

    const uint8_t expectedLength = 1 + (parts * 2);

    if (length != expectedLength) {
        return DecodeStatus::ErrorInvalidSerialized;
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

        packet.commands[i] = ProtocolCommand {
            .type = part,
            .value = value
        };
    }

    outPacket = packet;

    return DecodeStatus::Ok;
}