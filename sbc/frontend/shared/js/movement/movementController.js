import { PACKET_ID, sendPacket, onConnect } from "../api/client.js";
import { DEBUG_MODE } from "../api/common.js";
import { WHEEL_MOTOR_CONFIG, MotorDirection, PARTS_CONFIG } from "./partsConfig.js";

// partName (tal como lo usa el modelo 3D / PARTS_CONFIG) -> nombre de
// campo del packet MOVE_PART / respuesta de GET_PARTS.
const PART_FIELD = {
    Head: "head",
    LeftArm: "left_arm",
    RightArm: "right_arm",
    LeftWheel: "left_wheel",
    RightWheel: "right_wheel",
};

const WheelCommand = Object.freeze({
    FORWARD: "FORWARD",
    BACKWARD: "BACKWARD",
    STOP: "STOP",
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
 * @returns {string} WheelCommand.FORWARD | .BACKWARD
 */
function toWheelCommand(partName, direction) {
    const motorConfig = WHEEL_MOTOR_CONFIG[partName];
    const forwardSign = motorConfig ? motorConfig.direction : 1;
    const directionSign = direction === MotorDirection.BACKWARD ? -1 : 1;
    const signedDirection = forwardSign * directionSign;

    return signedDirection >= 0 ? WheelCommand.FORWARD : WheelCommand.BACKWARD;
}

class MovementController {
    constructor() {
        /** @type {Map<string, number>} último ángulo conocido, por partName (solo piezas tipo servo) */
        this.partAngles = new Map();

        /** @type {Set<string>} ruedas actualmente corriendo (para isMotorRunning) */
        this._runningMotors = new Set();

        onConnect()
            .then(() => this._fetchInitialAngles())
            .catch((err) => console.error("No se pudo obtener el estado inicial de las partes", err));
    }

    async _fetchInitialAngles() {
        try {
            const parts = await sendPacket({ id: PACKET_ID.GET_PARTS }, true);
            Object.entries(parts || {}).forEach(([field, value]) => {
                const partName = Object.keys(PART_FIELD).find((name) => PART_FIELD[name] === field);
                if (partName) {
                    let degrees = value; // Valor que viene del HAL [0, 180]
                    const config = PARTS_CONFIG[partName];

                    // Mapeo dinámico inverso: transforma [0, 180] del HAL al rango [min, max]
                    if (config && typeof config.min === "number" && typeof config.max === "number") {
                        const min = config.min;
                        const max = config.max;

                        // Mapea proporcionalmente el valor del HAL [0, 180] al rango [min, max]
                        degrees = min + (value / 180) * (max - min);

                        // Clamp de seguridad para asegurar que no quede fuera de los límites de la config
                        const lower = Math.min(min, max);
                        const upper = Math.max(min, max);
                        degrees = Math.max(lower, Math.min(upper, degrees));
                    }

                    this.partAngles.set(partName, Math.round(degrees));
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
     * Como el HAL del robot funciona con algulo 0->180 tenemos que mapear esto
     *
     * rechaza un ángulo en los campos left_wheel/right_wheel.
     * @param {string} partName - 'Head' | 'LeftArm' | 'RightArm'
     * @param {number} angleDegrees
     * @param {boolean} processLast - si es true, se manda el packet MOVE_PART_LAST en vez de MOVE_PART
     */
    setAngleForPart(partName, angleDegrees, processLast = false) {
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

        const config = PARTS_CONFIG[partName];
        if (!config) {
            console.warn(`Error en la configuracion (no existe la parte): ${partName}`);
            return;
        }

        // Mapeo dinámico: transforma [min, max] de la config al rango del HAL [0, 180]
        let halAngle = angleDegrees;
        if (config && typeof config.min === "number" && typeof config.max === "number") {
            const min = config.min;
            const max = config.max;

            const range = max - min;
            if (range !== 0) {
                // Mapea proporcionalmente el ángulo ingresado a 0 -> 180
                halAngle = ((angleDegrees - min) / range) * 180;
            }
        }

        // Clamp de seguridad para garantizar que el HAL nunca reciba valores fuera de 0 -> 180
        halAngle = Math.max(0, Math.min(180, halAngle));
        sendPacket({
            id: processLast ? PACKET_ID.MOVE_PART_LAST : PACKET_ID.MOVE_PART,
            partName: field.toUpperCase(),
            angle: Math.round(halAngle),
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
        if (!isWheelPart(partName)) return;

        this._runningMotors.add(partName);

        if (DEBUG_MODE) return;

        sendPacket({
            id: PACKET_ID.MOVE_PART,
            partName: partName,
            command: toWheelCommand(partName, direction),
        });
    }

    /**
     * Frena el motor DC de una rueda mandando STOP por el packet MOVE_PART.
     * @param {string} partName - 'LeftWheel' | 'RightWheel'
     */
    stopMotor(partName) {
        if (!isWheelPart(partName)) return;

        if (!this._runningMotors.has(partName)) return;
        this._runningMotors.delete(partName);

        if (DEBUG_MODE) return;

        sendPacket({
            id: PACKET_ID.MOVE_PART,
            partName: partName,
            command: WheelCommand.STOP,
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

export const movementController = new MovementController();
