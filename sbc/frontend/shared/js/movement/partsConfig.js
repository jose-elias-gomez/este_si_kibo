export const PARTS_CONFIG = {
    Head: { axis: "y", min: -90, max: 90 },
    LeftArm: { axis: "x", min: -90, max: 90 },
    RightArm: { axis: "x", min: -90, max: 90 },
    LeftWheel: { axis: "x", min: -180, max: 180 },
    RightWheel: { axis: "x", min: -180, max: 180 },
};

export const NODE_LABELS = {
    Head: "Cabeza",
    LeftArm: "Brazo izquierdo",
    RightArm: "Brazo derecho",
    LeftWheel: "Rueda izquierda",
    RightWheel: "Rueda derecha",
};

export const DEFAULT_PART_CONFIG = { axis: "y", min: -45, max: 45 };

// --- Motores de rueda (DC, no servo) ---
// A diferencia de Head/LeftArm/RightArm (servos SG90, se mueven a un
// ángulo objetivo puntual), las ruedas son motores DC simulados: solo
// tienen 2 estados (corriendo / parado) y mientras corren giran sin
// límite en un sentido. 'direction' define cuál es el signo de "hacia
// adelante" para cada rueda en su propio eje local (son opuestos entre
// sí para que, cada una girando "adelante", el robot avance de forma
// coherente en vez de que una empuje para un lado y la otra para el
// opuesto). El sentido real de giro en cada arranque (adelante/atrás)
// se elige aparte, con MotorDirection — esto solo fija qué significa
// "adelante" para esa rueda en particular.
export const WHEEL_MOTOR_CONFIG = {
    LeftWheel: { direction: -1 },
    RightWheel: { direction: 1 },
};

// Velocidad angular constante del motor DC simulado, en grados/segundo.
export const WHEEL_MOTOR_SPEED_DEG_PER_SEC = 240;

// Sentido de giro solicitado al arrancar un motor (runMotor). No es el
// signo final aplicado al pivote — eso sale de combinar esto con el
// 'direction' (adelante) de WHEEL_MOTOR_CONFIG para esa rueda.
export const MotorDirection = Object.freeze({
    FORWARD: "forward",
    BACKWARD: "backward",
});
