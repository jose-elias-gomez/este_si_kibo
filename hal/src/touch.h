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
    // Calibra la baseline y el ruido de cada pieza. Debe llamarse una vez en
    // setup(), sin tocar ningún sensor mientras se ejecuta.
    void begin();

    // Lee las 3 piezas y detecta cambios de estado (con filtrado de ruido,
    // umbral adaptado a cada pieza, histéresis y debounce).
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

    // Umbral de toque (delta sobre la baseline) = ruido * NOISE_MULT,
    // limitado entre un piso y un techo expresados como % de la baseline.
    // El techo debe quedar por debajo de la variación del sensor más débil
    // (~8% en tu caso: 4000 sobre 50000).
    static constexpr float NOISE_MULT = 8.0f;
    static constexpr float MIN_DELTA_PERCENT = 0.015f;  // piso: 1.5%
    static constexpr float MAX_DELTA_PERCENT = 0.06f;   // techo: 6%

    // El nivel de liberación es este porcentaje del delta de toque (histéresis).
    static constexpr float RELEASE_RATIO = 0.5f;

    // Velocidad de adaptación de la baseline (solo sin tocar). ~6 s de constante de tiempo.
    static constexpr float BASELINE_ALPHA = 0.002f;

    static constexpr unsigned long DEBOUNCE_MS = 60;

    uint8_t pins_[NUM_PIECES];
    float baseline_[NUM_PIECES] = {0, 0, 0};
    float noise_[NUM_PIECES] = {0, 0, 0};
    float delta_[NUM_PIECES] = {0, 0, 0};
    float threshold_[NUM_PIECES] = {0, 0, 0};
    float releaseLevel_[NUM_PIECES] = {0, 0, 0};
    bool touched_[NUM_PIECES] = {false, false, false};
    unsigned long lastChangeTime_[NUM_PIECES] = {0, 0, 0};

    int readFiltered(uint8_t pin) const;
    void updateLevels(uint8_t piece);
};