#include <Arduino.h>
#include "protocol.h"
#include "actuators.h"

constexpr uint32_t SERIAL_BAUD_RATE = 9600;
constexpr uint16_t SERIAL_TIMEOUT_MS = 25;

static RobotActuators robot;
static uint8_t buffer[MAX_PACKET_SIZE];

static void writeStatus(DecodeStatus status) {
    Serial.write(static_cast<uint8_t>(status));
}

static bool readExactBytes(uint8_t* destination, uint8_t length) {
    if (destination == nullptr || length == 0) {
        return false;
    }

    const size_t bytesRead = Serial.readBytes(destination, length);
    return bytesRead == length;
}

static void discardSerialInput() {
    while (Serial.available() > 0) {
        Serial.read();
    }
}

static void processSerialPacket() {
    if (Serial.available() <= 0) {
        return;
    }

    const int rawParts = Serial.read();

    if (rawParts < 0) {
        writeStatus(DecodeStatus::ErrorBufferTooShort);
        return;
    }

    const uint8_t parts = static_cast<uint8_t>(rawParts);

    if (parts > MAX_COMMANDS) {
        discardSerialInput();
        writeStatus(DecodeStatus::ErrorTooManyParts);
        return;
    }

    const uint8_t packetLength = 1 + (parts * 2);

    if (packetLength > MAX_PACKET_SIZE) {
        discardSerialInput();
        writeStatus(DecodeStatus::ErrorMaxPacketSize);
        return;
    }

    buffer[0] = parts;

    const uint8_t remainingBytes = packetLength - 1;

    if (remainingBytes > 0) {
        const bool ok = readExactBytes(&buffer[1], remainingBytes);

        if (!ok) {
            discardSerialInput();
            writeStatus(DecodeStatus::ErrorInvalidSerialized);
            return;
        }
    }

    ProtocolPacket packet;
    const DecodeStatus status = decodePacket(buffer, packetLength, packet);

    if (status != DecodeStatus::Ok) {
        writeStatus(status);
        return;
    }

    robot.handlePacket(packet);
    writeStatus(DecodeStatus::Ok);
}

void setup() {
    Serial.begin(SERIAL_BAUD_RATE);
    Serial.setTimeout(SERIAL_TIMEOUT_MS);

    robot.begin();
}

void loop() {
    processSerialPacket();
}