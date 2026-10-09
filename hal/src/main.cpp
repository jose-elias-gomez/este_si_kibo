#include <Arduino.h>
#include "protocol.h"
#include "actuators.h"
#include "touch.h"

constexpr uint32_t SERIAL_BAUD_RATE = 115200;

// Si un paquete queda a medias más de este tiempo, se descarta y se resincroniza.
constexpr uint32_t RX_TIMEOUT_MS = 50;

// Si no llega ningún paquete válido en este tiempo, se paran las ruedas.
// El host debe enviar comandos o heartbeats ([0xAA][0x00][0x00]) más seguido.
constexpr uint32_t WHEEL_FAILSAFE_MS = 500;

static RobotActuators robot;
static TouchSensors touchSensors;

// Parser de paquetes (máquina de estados no bloqueante).
enum class RxState : uint8_t { WaitHeader, WaitParts, WaitBody };

static RxState rxState = RxState::WaitHeader;
static uint8_t rxBuffer[MAX_PACKET_SIZE];
static uint8_t rxIndex = 0;
static uint8_t rxExpected = 0;
static uint32_t lastByteMs = 0;

// Failsafe
static uint32_t lastValidPacketMs = 0;
static bool failsafeArmed = false;

static void writeStatus(DecodeStatus status) {
    const uint8_t packet[2] = {
        static_cast<uint8_t>(PacketId::DECODED),
        static_cast<uint8_t>(status)
    };
    Serial.write(packet, sizeof(packet));
}

static void sendTouchEvent(const TouchChange& change) {
    const uint8_t packet[3] = {
        static_cast<uint8_t>(PacketId::TOUCH),
        static_cast<uint8_t>(change.type),
        static_cast<uint8_t>(change.event)
    };

    Serial.write(packet, sizeof(packet));
}

static void processTouchSensors() {
    TouchChange changes[3];
    const uint8_t numChanges = touchSensors.update(changes);

    for (uint8_t i = 0; i < numChanges; i++) {
        sendTouchEvent(changes[i]);
    }
}

static void resetParser() {
    rxState = RxState::WaitHeader;
    rxIndex = 0;
    rxExpected = 0;
}

static void finishPacket() {
    ProtocolPacket packet;
    const DecodeStatus status = decodePacket(rxBuffer, rxExpected, packet);

    resetParser();

    if (status != DecodeStatus::Ok) {
        writeStatus(status);
        return;
    }

    robot.handlePacket(packet);
    lastValidPacketMs = millis();
    failsafeArmed = true;
    writeStatus(DecodeStatus::Ok);
}

static void processByte(uint8_t b) {
    switch (rxState) {
        case RxState::WaitHeader:
            if (b == PACKET_HEADER) {
                rxState = RxState::WaitParts;
            }
            break;

        case RxState::WaitParts:
            if (b > MAX_COMMANDS) {
                resetParser();
                writeStatus(DecodeStatus::ErrorTooManyParts);
                // El byte inesperado podría ser el inicio de un paquete nuevo.
                if (b == PACKET_HEADER) {
                    rxState = RxState::WaitParts;
                }
                break;
            }

            rxBuffer[0] = b;
            rxIndex = 1;
            rxExpected = 2 + (b * 2);  // parts + pares + checksum
            rxState = RxState::WaitBody;
            break;

        case RxState::WaitBody:
            rxBuffer[rxIndex++] = b;
            if (rxIndex >= rxExpected) {
                finishPacket();
            }
            break;
    }
}

static void processSerialPacket() {
    const uint32_t now = millis();

    while (Serial.available() > 0) {
        const int raw = Serial.read();
        if (raw < 0) {
            break;
        }
        lastByteMs = now;
        processByte(static_cast<uint8_t>(raw));
    }

    // Paquete incompleto: descartar y volver a buscar la cabecera.
    if (rxState != RxState::WaitHeader && (now - lastByteMs) > RX_TIMEOUT_MS) {
        resetParser();
        writeStatus(DecodeStatus::ErrorInvalidSerialized);
    }
}

static void processFailsafe() {
    if (failsafeArmed && (millis() - lastValidPacketMs) > WHEEL_FAILSAFE_MS) {
        robot.stopAllMotors();
        failsafeArmed = false;
    }
}

void setup() {
    Serial.begin(SERIAL_BAUD_RATE);

    robot.begin();
    touchSensors.begin();  // ~1.5 s bloqueado: el host no debe enviar nada ahora.
}

void loop() {
    processSerialPacket();
    processFailsafe();
    processTouchSensors();

    robot.updateServos();
}