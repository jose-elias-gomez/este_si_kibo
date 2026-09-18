#include "touch.h"
#include "pins.h"

using namespace Pins;

int TouchSensors::readFiltered(uint8_t pin) const {
    int samples[SAMPLES_PER_READ];

    for (uint8_t i = 0; i < SAMPLES_PER_READ; i++) {
        samples[i] = touchRead(pin);
        delayMicroseconds(500);
    }

    // Ordenar y devolver la mediana: más robusta que el promedio frente
    // a picos de ruido puntuales.
    for (uint8_t i = 0; i < SAMPLES_PER_READ - 1; i++) {
        for (uint8_t j = 0; j < SAMPLES_PER_READ - 1 - i; j++) {
            if (samples[j] > samples[j + 1]) {
                const int tmp = samples[j];
                samples[j] = samples[j + 1];
                samples[j + 1] = tmp;
            }
        }
    }

    return samples[SAMPLES_PER_READ / 2];
}

void TouchSensors::begin() {
    pins_[static_cast<uint8_t>(TouchPiece::Piece1)] = LEFT_ARM_TOUCH;
    pins_[static_cast<uint8_t>(TouchPiece::Piece2)] = HEAD_TOUCH;
    pins_[static_cast<uint8_t>(TouchPiece::Piece3)] = RIGHT_ARM_TOUCH;

    float sum[NUM_PIECES] = {0, 0, 0};

    for (uint16_t s = 0; s < CALIBRATION_SAMPLES; s++) {
        for (uint8_t p = 0; p < NUM_PIECES; p++) {
            sum[p] += readFiltered(pins_[p]);
        }
        delay(20);
    }

    for (uint8_t p = 0; p < NUM_PIECES; p++) {
        baseline_[p] = sum[p] / CALIBRATION_SAMPLES;
        threshold_[p] = baseline_[p] * (1.0f + THRESHOLD_PERCENT);
        releaseLevel_[p] = baseline_[p] * (1.0f + RELEASE_PERCENT);
        touched_[p] = false;
        lastChangeTime_[p] = 0;
    }
}

uint8_t TouchSensors::update(TouchChange* changes) {
    uint8_t numChanges = 0;
    const unsigned long now = millis();

    for (uint8_t p = 0; p < NUM_PIECES; p++) {
        const int value = readFiltered(pins_[p]);

        if (!touched_[p] && value >= threshold_[p]) {
            if (now - lastChangeTime_[p] > DEBOUNCE_MS) {
                touched_[p] = true;
                lastChangeTime_[p] = now;

                changes[numChanges].type = static_cast<TouchPiece>(p);
                changes[numChanges].event = TouchEvent::Touched;
                numChanges++;
            }
        } else if (touched_[p] && value < releaseLevel_[p]) {
            if (now - lastChangeTime_[p] > DEBOUNCE_MS) {
                touched_[p] = false;
                lastChangeTime_[p] = now;

                changes[numChanges].type = static_cast<TouchPiece>(p);
                changes[numChanges].event = TouchEvent::Released;
                numChanges++;
            }
        }
    }

    return numChanges;
}
