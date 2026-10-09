import { PARTS_CONFIG, DEFAULT_PART_CONFIG, WHEEL_MOTOR_CONFIG, WHEEL_MOTOR_SPEED_DEG_PER_SEC, MotorDirection } from "../../../shared/js/movement/partsConfig.js";
import { findPivotInNode } from "./modelLoader.js";
import { movementController } from "../../../shared/js/movement/movementController.js";

/**
 * Remapeo de piezas SOLO para el envío al robot / estado de movementController.
 * Cuando se mueve la pieza de la izquierda en el modelo 3D, los datos se
 * mandan como si fuera la pieza de la derecha. El modelo 3D sigue moviendo
 * la pieza original (el brazo se ve moviéndose igual).
 *
 * Para desactivarlo, vaciá el objeto: {}
 */
const SEND_AS = {
    RightArm: "Head",
};

/** @param {string} partName @returns {string} pieza que se usa para hablar con movementController */
function hwPart(partName) {
    return SEND_AS[partName] || partName;
}

export class WrappedMovementPartController {
    /**
     * @param {THREE.Object3D} modelRoot - raíz del modelo ya cargado en escena
     * @param {() => void} [requestRender] - callback para pedir un nuevo frame (p.ej. sceneEngine.requestRender)
     */
    constructor(modelRoot, requestRender = () => {}) {
        this.modelRoot = modelRoot;
        this.requestRender = requestRender;

        /** @type {Record<string, THREE.Euler>} rotación inicial de cada pivote, tal como viene del GLTF */
        this.initialRotations = {};

        // El ángulo "actual" de cada pieza lo lleva movementController.
        // Esta clase solo refleja ese ángulo en el pivote 3D.

        /** @type {Record<string, THREE.Object3D>} */
        this._pivotCache = {};

        this.selectedPartName = null;
        this.activePivotMesh = null;

        /** @type {Record<string, gsap.core.Tween>} */
        this._motorTweens = {};

        this._captureInitialRotations();
    }

    _getPivot(partName) {
        if (!this._pivotCache[partName]) {
            const pivotMesh = findPivotInNode(this.modelRoot, partName);
            if (pivotMesh) {
                this._pivotCache[partName] = pivotMesh;
            }
        }
        return this._pivotCache[partName] || null;
    }

    _captureInitialRotations() {
        Object.keys(PARTS_CONFIG).forEach((partName) => {
            const pivotMesh = this._getPivot(partName);
            if (pivotMesh) {
                this.initialRotations[partName] = pivotMesh.rotation.clone();
            }
        });
    }

    /**
     * Devuelve la configuración (eje, min, max) de una pieza.
     * @param {string} partName
     */
    getConfig(partName) {
        return PARTS_CONFIG[partName] || DEFAULT_PART_CONFIG;
    }

    /**
     * Envía el ángulo a movementController usando la pieza remapeada
     * (si la hay), limitado al rango de esa pieza de destino para no
     * pasarse de los límites del servo real.
     * @param {string} partName - pieza original (la del modelo 3D)
     * @param {number} angleDegrees
     */
    _sendAngle(partName, angleDegrees) {
        const target = hwPart(partName);
        let angle = angleDegrees;

        if (target !== partName) {
            const { min, max } = this.getConfig(target);
            if (typeof min === "number") angle = Math.max(min, angle);
            if (typeof max === "number") angle = Math.min(max, angle);
        }

        movementController.setAngleForPart(target, angle);
    }

    /**
     * Aplica un ángulo (en grados) a una pieza puntual, sin depender de
     * ni afectar la selección activa.
     * @param {string} partName
     * @param {number} angleDegrees
     */
    setAngleForPart(partName, angleDegrees) {
        this.stopMotor(partName);

        const pivotMesh = this._getPivot(partName);
        if (!pivotMesh) return;

        const config = this.getConfig(partName);
        const baseRotation = this.initialRotations[partName] || new THREE.Euler(0, 0, 0);
        const radiansOffset = THREE.MathUtils.degToRad(angleDegrees);

        pivotMesh.rotation.copy(baseRotation);
        pivotMesh.rotation[config.axis] = baseRotation[config.axis] + radiansOffset;

        this._sendAngle(partName, angleDegrees);

        if (this.selectedPartName === partName) {
            this.activePivotMesh = pivotMesh;
        }

        this.requestRender();
    }

    getPivotAngle(partName) {
        return movementController.getAngleForPart(hwPart(partName));
    }

    /**
     * Ángulo actual guardado de una pieza puntual (sin necesidad de seleccionarla).
     * @param {string} partName
     * @returns {number}
     */
    getAngleForPart(partName) {
        return movementController.getAngleForPart(hwPart(partName));
    }

    /**
     * Marca una pieza como activa para poder rotarla con setAngle().
     * @param {string} partName
     * @returns {{config: object, currentAngle: number}}
     */
    selectPart(partName) {
        this.selectedPartName = partName;
        this.activePivotMesh = this._getPivot(partName);

        return {
            config: this.getConfig(partName),
            currentAngle: movementController.getAngleForPart(hwPart(partName)),
        };
    }

    /**
     * Aplica un ángulo (en grados) a la pieza actualmente seleccionada.
     * @param {number} angleDegrees
     */
    setAngle(angleDegrees) {
        if (!this.activePivotMesh || !this.selectedPartName) return;

        this.stopMotor(this.selectedPartName);

        const config = this.getConfig(this.selectedPartName);
        const baseRotation = this.initialRotations[this.selectedPartName] || new THREE.Euler(0, 0, 0);
        const radiansOffset = THREE.MathUtils.degToRad(angleDegrees);

        this.activePivotMesh.rotation.copy(baseRotation);
        this.activePivotMesh.rotation[config.axis] = baseRotation[config.axis] + radiansOffset;

        this._sendAngle(this.selectedPartName, angleDegrees);

        this.requestRender();
    }

    /**
     * Arranca el motor DC de una rueda (giro continuo hasta stopMotor()).
     * @param {string} partName - 'LeftWheel' | 'RightWheel'
     * @param {string} [direction] - MotorDirection.FORWARD (default) o .BACKWARD
     * @param {number} [speedDegPerSec]
     */
    runMotor(partName, direction = MotorDirection.FORWARD, speedDegPerSec = WHEEL_MOTOR_SPEED_DEG_PER_SEC) {
        if (this._motorTweens[partName]) return;

        const pivotMesh = this._getPivot(partName);
        if (!pivotMesh) return;

        const config = this.getConfig(partName);
        const baseRotation = this.initialRotations[partName] || new THREE.Euler(0, 0, 0);
        const motorConfig = WHEEL_MOTOR_CONFIG[partName];
        const forwardSign = motorConfig ? motorConfig.direction : 1;
        const directionSign = direction === MotorDirection.BACKWARD ? -1 : 1;
        const signedDirection = forwardSign * directionSign;

        const proxy = { angle: movementController.getAngleForPart(partName) };

        const tween = gsap.to(proxy, {
            angle: `+=${360 * signedDirection}`,
            duration: 360 / speedDegPerSec,
            ease: "none",
            repeat: -1,
            onUpdate: () => {
                pivotMesh.rotation.copy(baseRotation);
                pivotMesh.rotation[config.axis] = baseRotation[config.axis] + THREE.MathUtils.degToRad(proxy.angle);
                this.requestRender();
            },
        });

        this._motorTweens[partName] = tween;
    }

    /**
     * Frena el motor DC de una rueda.
     * @param {string} partName
     */
    stopMotor(partName) {
        const tween = this._motorTweens[partName];
        if (!tween) return;

        tween.kill();
        delete this._motorTweens[partName];
    }

    /**
     * @param {string} partName
     * @returns {boolean}
     */
    isMotorRunning(partName) {
        return !!this._motorTweens[partName];
    }

    /**
     * Restaura todas las piezas a su rotación original del modelo y
     * pone todos los ángulos guardados en 0.
     */
    resetAll() {
        Object.keys(PARTS_CONFIG).forEach((partName) => {
            this.stopMotor(partName);

            // Para ruedas, movementController.setAngleForPart() solo loguea
            // un warning. Para piezas remapeadas (brazos) se manda 0 al
            // destino, que de todas formas se resetea con su propia entrada.
            movementController.setAngleForPart(hwPart(partName), 0);

            const pivotMesh = this._getPivot(partName);
            if (pivotMesh && this.initialRotations[partName]) {
                pivotMesh.rotation.copy(this.initialRotations[partName]);
            }
        });

        this.requestRender();
    }
}