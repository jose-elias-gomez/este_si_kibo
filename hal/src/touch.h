#pragma once

#include <Arduino.h>

// Identifica cuál de las 3 piezas táctiles cambió de estado.
// Mismos valores que PartId (LeftArm=0, RightArm=1, Head=2) para evitar confusiones.
enum class TouchPiece : uint8_t {
    LeftArm = 0,
    RightArm = 1,
    Head = 2,
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
    //
    // NOTA: la lógica asume ESP32-S3, donde touchRead() SUBE al tocar.
    // En un ESP32 clásico el valor BAJA al tocar y habría que invertirla.
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

    // Velocidad de adaptación de la baseline (solo sin tocar). ~6 s de constante de tiempo.
    static constexpr float BASELINE_ALPHA = 0.002f;

    static constexpr unsigned long DEBOUNCE_MS = 60;

    uint8_t pins_[NUM_PIECES];
    float baseline_[NUM_PIECES] = {0, 0, 0};
    float threshold_[NUM_PIECES] = {0, 0, 0};
    float releaseLevel_[NUM_PIECES] = {0, 0, 0};
    bool touched_[NUM_PIECES] = {false, false, false};
    unsigned long lastChangeTime_[NUM_PIECES] = {0, 0, 0};

    int readFiltered(uint8_t pin) const;
    void updateLevels(uint8_t piece);
};