#include "touch.h"
#include "pins.h"

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

void TouchSensors::updateLevels(uint8_t piece) {
    threshold_[piece]    = baseline_[piece] + delta_[piece];
    releaseLevel_[piece] = baseline_[piece] + delta_[piece] * RELEASE_RATIO;
}

void TouchSensors::begin() {
    pins_[static_cast<uint8_t>(TouchPiece::Head)]     = Pins::HEAD_TOUCH;
    pins_[static_cast<uint8_t>(TouchPiece::LeftArm)]  = Pins::LEFT_ARM_TOUCH;
    pins_[static_cast<uint8_t>(TouchPiece::RightArm)] = Pins::RIGHT_ARM_TOUCH;

    float sum[NUM_PIECES]  = {0, 0, 0};
    int   minV[NUM_PIECES] = {INT32_MAX, INT32_MAX, INT32_MAX};
    int   maxV[NUM_PIECES] = {0, 0, 0};

    for (uint16_t s = 0; s < CALIBRATION_SAMPLES; s++) {
        for (uint8_t p = 0; p < NUM_PIECES; p++) {
            const int v = readFiltered(pins_[p]);
            sum[p] += v;
            if (v < minV[p]) minV[p] = v;
            if (v > maxV[p]) maxV[p] = v;
        }
        delay(20);
    }

    for (uint8_t p = 0; p < NUM_PIECES; p++) {
        baseline_[p] = sum[p] / CALIBRATION_SAMPLES;
        noise_[p]    = static_cast<float>(maxV[p] - minV[p]);

        // Delta propio de cada pieza, acotado entre un piso y un techo.
        float d = noise_[p] * NOISE_MULT;
        const float minD = baseline_[p] * MIN_DELTA_PERCENT;
        const float maxD = baseline_[p] * MAX_DELTA_PERCENT;
        if (d < minD) d = minD;
        if (d > maxD) d = maxD;
        delta_[p] = d;

        updateLevels(p);
        touched_[p] = false;
        lastChangeTime_[p] = 0;
    }

    // Log de depuración: descomentar para verificar la calibración.
    // for (uint8_t p = 0; p < NUM_PIECES; p++) {
    //     Serial.printf("pieza %u: base=%.0f ruido=%.0f delta=%.0f\n",
    //                   p, baseline_[p], noise_[p], delta_[p]);
    // }
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
        } else if (!touched_[p] && value < releaseLevel_[p]) {
            // Reposo claro: seguir la deriva (temperatura, humedad) lentamente.
            baseline_[p] += BASELINE_ALPHA * (value - baseline_[p]);
            updateLevels(p);
        }
    }

    return numChanges;
}