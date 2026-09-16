#pragma once

#include <Arduino.h>

// Identifica cuál de las 3 piezas táctiles cambió de estado.
enum class TouchPiece : uint8_t {
    Piece1 = 0,
    Piece2 = 1,
    Piece3 = 2,
};

// Tipo de evento de una pieza táctil.
enum class TouchEvent : uint8_t {
    Touched  = 0,
    Released = 1,
};

struct TouchChange {
    TouchPiece type;
    TouchEvent event;
};

class TouchSensors {
public:
    // Calibra la baseline de cada pieza. Debe llamarse una vez en setup(),
    // sin tocar ningún sensor mientras se ejecuta.
    void begin();

    // Lee las 3 piezas y detecta cambios de estado (con filtrado de ruido,
    // umbral relativo por pieza, histéresis y debounce).
    // Llena 'changes' (capacidad mínima 3) con los cambios detectados en
    // esta llamada y devuelve cuántos hubo (0 a 3).
    uint8_t update(TouchChange* changes);

private:
    static constexpr uint8_t NUM_PIECES = 3;

    // Muestras por lectura (para filtrar ruido con la mediana).
    static constexpr uint8_t SAMPLES_PER_READ = 8;

    // Muestras tomadas durante la calibración inicial.
    static constexpr uint16_t CALIBRATION_SAMPLES = 50;

    // % sobre la baseline para considerar "tocado" / para considerar "liberado".
    static constexpr float THRESHOLD_PERCENT = 0.15f;
    static constexpr float RELEASE_PERCENT = 0.08f;

    static constexpr unsigned long DEBOUNCE_MS = 60;

    uint8_t pins_[NUM_PIECES];
    float baseline_[NUM_PIECES] = {0, 0, 0};
    float threshold_[NUM_PIECES] = {0, 0, 0};
    float releaseLevel_[NUM_PIECES] = {0, 0, 0};
    bool touched_[NUM_PIECES] = {false, false, false};
    unsigned long lastChangeTime_[NUM_PIECES] = {0, 0, 0};

    int readFiltered(uint8_t pin) const;
};