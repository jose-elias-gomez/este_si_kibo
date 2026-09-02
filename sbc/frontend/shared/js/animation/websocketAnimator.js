// websocketAnimator.js
// Implementación de "controller" de piezas que, en vez de mover el
// modelo 3D localmente (como PartsController), habla directamente el
// protocolo real del robot por WebSocket (ver movement_connector.py).
//
// Expone la misma interfaz mínima que usa AnimationBuilder
// (getAngleForPart / setAngleForPart / runMotor / stopMotor), para poder
// pasarse como reemplazo de PartsController sin tocar el builder.
//
// OJO con la diferencia de protocolo entre piezas:
//   - Head/LeftArm/RightArm son servos: el packet MOVE_PART espera un
//     ángulo (int) en los campos head/left_arm/right_arm.
//   - LeftWheel/RightWheel son motores DC: el packet MOVE_PART NO acepta
//     ángulo para estos campos — solo el comando LEFT/RIGHT/STOP en los
//     campos left_wheel/right_wheel (ver _as_motor_command en
//     movement_connector.py). Mandarles un ángulo hace que
//     PacketDecodeError reviente del lado del server.
//
// Todo esto solo corre si DEBUG_MODE está desactivado: en debug no hay
// servidor real del otro lado, así que no tiene sentido abrir el socket
// ni mandar comandos (ver sendPacket en client.js, que ya no-opea en
// DEBUG_MODE, pero acá directamente evitamos construir mal los packets).

import { PACKET_ID, sendPacket } from "../api/client.js";
import { DEBUG_MODE } from "../api/common.js";
import { WHEEL_MOTOR_CONFIG, MotorDirection } from "./partsConfig.js";

// partName (tal como lo usa el modelo 3D / PARTS_CONFIG) -> nombre de
// campo del packet MOVE_PART / respuesta de GET_PARTS.
const PART_FIELD = {
    Head: "head",
    LeftArm: "left_arm",
    RightArm: "right_arm",
    LeftWheel: "left_wheel",
    RightWheel: "right_wheel"
};

// Comando de motor DC que espera movement_connector.py para las ruedas.
// STOP no tiene "sentido" (adelante/atrás), por eso no está en
// MotorDirection: es un tercer estado propio de las ruedas.
const WheelCommand = Object.freeze({
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    STOP: "STOP"
});

function isWheelPart(partName) {
    return Object.prototype.hasOwnProperty.call(WHEEL_MOTOR_CONFIG, partName);
}

/**
 * Traduce un MotorDirection (FORWARD/BACKWARD, "qué sentido se pidió")
 * al comando real LEFT/RIGHT que espera el server, combinándolo con qué
 * es "adelante" para esa rueda en particular (WHEEL_MOTOR_CONFIG),
 * exactamente con la misma lógica que ya usa PartsController.runMotor
 * para el giro simulado — así ambos caminos (simulación local vs
 * servidor real) resultan en el mismo sentido físico de giro.
 * @param {string} partName - 'LeftWheel' | 'RightWheel'
 * @param {string} direction - MotorDirection.FORWARD | .BACKWARD
 * @returns {string} WheelCommand.LEFT | .RIGHT
 */
function toWheelCommand(partName, direction) {
    const motorConfig = WHEEL_MOTOR_CONFIG[partName];
    const forwardSign = motorConfig ? motorConfig.direction : 1;
    const directionSign = direction === MotorDirection.BACKWARD ? -1 : 1;
    const signedDirection = forwardSign * directionSign;

    return signedDirection >= 0 ? WheelCommand.LEFT : WheelCommand.RIGHT;
}

class WebsocketAnimator {
    constructor() {
        /** @type {Map<string, number>} último ángulo conocido, por partName (solo piezas tipo servo) */
        this.partAngles = new Map();

        /** @type {Set<string>} ruedas actualmente corriendo (para isMotorRunning) */
        this._runningMotors = new Set();

        if (!DEBUG_MODE) {
            this._fetchInitialAngles();
        }
    }

    async _fetchInitialAngles() {
        try {
            const parts = await sendPacket({ id: PACKET_ID.GET_PARTS }, true);
            // decode_get_parts() devuelve un dict plano, p.ej.
            // { left_arm: 0, right_arm: 0, head: 0 } — no una lista.
            Object.entries(parts || {}).forEach(([field, value]) => {
                const partName = Object.keys(PART_FIELD).find((name) => PART_FIELD[name] === field);
                if (partName) {
                    this.partAngles.set(partName, value);
                }
            });
        } catch (err) {
            console.error("No se pudo obtener el estado inicial de las partes:", err);
        }
    }

    /**
     * Ángulo actual conocido de una pieza tipo servo. Para ruedas no
     * tiene sentido (no hay "ángulo real"): siempre devuelve 0.
     * @param {string} partName
     * @returns {number}
     */
    getAngleForPart(partName) {
        if (isWheelPart(partName)) return 0;
        return this.partAngles.get(partName) ?? 0;
    }

    /**
     * Mueve un servo a un ángulo objetivo real, vía el packet MOVE_PART.
     * No usar con ruedas (ver runMotor/stopMotor para eso) — movement_connector
     * rechaza un ángulo en los campos left_wheel/right_wheel.
     * @param {string} partName - 'Head' | 'LeftArm' | 'RightArm'
     * @param {number} angleDegrees
     */
    setAngleForPart(partName, angleDegrees) {
        if (isWheelPart(partName)) {
            console.warn(`setAngleForPart no aplica a ${partName}: es un motor DC, usar runMotor/stopMotor`);
            return;
        }

        const field = PART_FIELD[partName];
        if (!field) {
            console.warn(`Pieza desconocida: ${partName}`);
            return;
        }

        this.partAngles.set(partName, angleDegrees);

        if (DEBUG_MODE) return;

        sendPacket({
            id: PACKET_ID.MOVE_PART,
            [field]: Math.round(angleDegrees)
        });
    }

    /**
     * Arranca el motor DC de una rueda mandando el comando real
     * (LEFT/RIGHT) por el packet MOVE_PART. A diferencia de un servo, esto
     * nunca lleva ángulo — el motor gira sin parar hasta stopMotor().
     * @param {string} partName - 'LeftWheel' | 'RightWheel'
     * @param {string} [direction] - MotorDirection.FORWARD (default) o .BACKWARD
     */
    runMotor(partName, direction = MotorDirection.FORWARD) {
        const field = PART_FIELD[partName];
        if (!field || !isWheelPart(partName)) {
            console.warn(`runMotor no aplica a ${partName}`);
            return;
        }

        this._runningMotors.add(partName);

        if (DEBUG_MODE) return;

        sendPacket({
            id: PACKET_ID.MOVE_PART,
            [field]: toWheelCommand(partName, direction)
        });
    }

    /**
     * Frena el motor DC de una rueda mandando STOP por el packet MOVE_PART.
     * @param {string} partName - 'LeftWheel' | 'RightWheel'
     */
    stopMotor(partName) {
        const field = PART_FIELD[partName];
        if (!field || !isWheelPart(partName)) return;

        if (!this._runningMotors.has(partName)) return;
        this._runningMotors.delete(partName);

        if (DEBUG_MODE) return;

        sendPacket({
            id: PACKET_ID.MOVE_PART,
            [field]: WheelCommand.STOP
        });
    }

    /**
     * @param {string} partName
     * @returns {boolean} true si esa rueda tiene el motor corriendo
     */
    isMotorRunning(partName) {
        return this._runningMotors.has(partName);
    }
}

const instance = new WebsocketAnimator();
export default instance;