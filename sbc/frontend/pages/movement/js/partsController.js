import {
    PARTS_CONFIG,
    DEFAULT_PART_CONFIG,
    WHEEL_MOTOR_CONFIG,
    WHEEL_MOTOR_SPEED_DEG_PER_SEC,
    MotorDirection,
} from "../../../shared/js/movement/partsConfig.js";
import { findPivotInNode } from "./modelLoader.js";
import { movementController } from "../../../shared/js/movement/movementController.js";

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

        // El ángulo "actual" de cada pieza ya no se guarda acá: es
        // movementController (shared/js/movement/movementController.js)
        // quien lleva ese estado, tanto en debug (valores locales) como
        // contra el robot real (sincronizado vía GET_PARTS/MOVE_PART).
        // Esta clase solo se encarga de reflejar ese ángulo en el pivote
        // 3D — no de guardarlo por su cuenta.

        // Caché de pivotes ya resueltos: findPivotInNode() hace dos
        // traverse() completos del árbol del modelo, así que resolverlo
        // en cada click/frame es caro sin necesidad — el pivote de una
        // pieza no cambia una vez cargado el modelo.
        /** @type {Record<string, THREE.Object3D>} */
        this._pivotCache = {};

        this.selectedPartName = null;
        this.activePivotMesh = null;

        // Tweens de gsap en loop infinito para los motores DC de rueda
        // (ver runMotor/stopMotor), indexados por partName. A diferencia
        // de un tween de AnimationBuilder (que termina solo), estos hay
        // que matarlos explícitamente con stopMotor() o nunca paran.
        /** @type {Record<string, gsap.core.Tween>} */
        this._motorTweens = {};

        this._captureInitialRotations();
    }

    /**
     * Resuelve el pivote de una pieza, usando la caché si ya se buscó antes.
     * @param {string} partName
     * @returns {THREE.Object3D|null}
     */
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
     * Aplica un ángulo (en grados) a una pieza puntual, sin depender de
     * ni afectar la selección activa (this.selectedPartName). Pensado
     * para animar varias piezas en paralelo sin que se pisen entre sí.
     * @param {string} partName
     * @param {number} angleDegrees
     */
    setAngleForPart(partName, angleDegrees) {
        // Si esta pieza es una rueda con el motor DC corriendo (ver
        // runMotor), hay que frenarlo antes: si no, el tween infinito del
        // motor y este set puntual pelean por escribir el mismo
        // pivotMesh.rotation en el mismo frame.
        this.stopMotor(partName);

        const pivotMesh = this._getPivot(partName);
        if (!pivotMesh) return;

        const config = this.getConfig(partName);
        const baseRotation =
            this.initialRotations[partName] || new THREE.Euler(0, 0, 0);
        const radiansOffset = THREE.MathUtils.degToRad(angleDegrees);

        pivotMesh.rotation.copy(baseRotation);
        pivotMesh.rotation[config.axis] =
            baseRotation[config.axis] + radiansOffset;

        // movementController es ahora la única fuente de verdad del
        // ángulo de cada pieza (ver nota en el constructor).
        movementController.setAngleForPart(partName, angleDegrees);

        // Si la pieza afectada es la actualmente seleccionada, mantener
        // activePivotMesh sincronizado para que setAngle() siga funcionando bien.
        if (this.selectedPartName === partName) {
            this.activePivotMesh = pivotMesh;
        }

        this.requestRender();
    }

    getPivotAngle(partName) {
        return movementController.getAngleForPart(partName);
    }

    /**
     * Ángulo actual guardado de una pieza puntual (sin necesidad de seleccionarla).
     * @param {string} partName
     * @returns {number}
     */
    getAngleForPart(partName) {
        return movementController.getAngleForPart(partName);
    }

    /**
     * Marca una pieza como activa para poder rotarla con setAngle().
     * @param {string} partName
     * @returns {{config: object, currentAngle: number}} info útil para actualizar cualquier UI
     */
    selectPart(partName) {
        this.selectedPartName = partName;
        this.activePivotMesh = this._getPivot(partName);

        return {
            config: this.getConfig(partName),
            currentAngle: movementController.getAngleForPart(partName),
        };
    }

    /**
     * Aplica un ángulo (en grados) a la pieza actualmente seleccionada,
     * rotando únicamente sobre el eje configurado para esa pieza y
     * partiendo siempre de su rotación inicial del GLTF.
     * @param {number} angleDegrees
     */
    setAngle(angleDegrees) {
        if (!this.activePivotMesh || !this.selectedPartName) return;

        this.stopMotor(this.selectedPartName); // ver nota en setAngleForPart

        const config = this.getConfig(this.selectedPartName);
        const baseRotation =
            this.initialRotations[this.selectedPartName] ||
            new THREE.Euler(0, 0, 0);
        const radiansOffset = THREE.MathUtils.degToRad(angleDegrees);

        this.activePivotMesh.rotation.copy(baseRotation);
        this.activePivotMesh.rotation[config.axis] =
            baseRotation[config.axis] + radiansOffset;

        movementController.setAngleForPart(this.selectedPartName, angleDegrees);

        this.requestRender();
    }

    /**
     * Arranca el motor DC de una rueda: a diferencia de un servo, no va
     * "hacia un ángulo" — gira sin parar en un sentido hasta que se llama
     * a stopMotor(). Se simula con un proxy que gsap empuja +/-360° por
     * vuelta con repeat infinito; cada vuelta es una tween nueva relativa
     * a la anterior, por lo que el giro es perfectamente continuo (sin
     * salto al "reiniciar" la vuelta). Si ya está corriendo, no hace nada
     * (para invertir el sentido en caliente hay que stopMotor() primero).
     * @param {string} partName - 'LeftWheel' | 'RightWheel'
     * @param {string} [direction] - MotorDirection.FORWARD (default) o .BACKWARD
     * @param {number} [speedDegPerSec] - velocidad angular del motor
     */
    runMotor(
        partName,
        direction = MotorDirection.FORWARD,
        speedDegPerSec = WHEEL_MOTOR_SPEED_DEG_PER_SEC
    ) {
        if (this._motorTweens[partName]) return;

        const pivotMesh = this._getPivot(partName);
        if (!pivotMesh) return;

        const config = this.getConfig(partName);
        const baseRotation =
            this.initialRotations[partName] || new THREE.Euler(0, 0, 0);
        const motorConfig = WHEEL_MOTOR_CONFIG[partName];
        const forwardSign = motorConfig ? motorConfig.direction : 1;
        const directionSign = direction === MotorDirection.BACKWARD ? -1 : 1;

        // Signo final aplicado al pivote: combina "qué es adelante para
        // esta rueda" (forwardSign, fijo en config) con "qué sentido se
        // pidió ahora" (directionSign, forward/backward).
        const signedDirection = forwardSign * directionSign;

        // Arranca desde el ángulo actual reportado por movementController
        // (si venía de una posición manual, por ejemplo). Para ruedas
        // movementController.getAngleForPart() siempre devuelve 0 (no
        // tiene sentido un "ángulo real" en un motor DC — ver ese
        // archivo), así que en la práctica esto siempre arranca en 0.
        const proxy = { angle: movementController.getAngleForPart(partName) };

        const tween = gsap.to(proxy, {
            angle: `+=${360 * signedDirection}`,
            duration: 360 / speedDegPerSec,
            ease: "none",
            repeat: -1,
            onUpdate: () => {
                pivotMesh.rotation.copy(baseRotation);
                pivotMesh.rotation[config.axis] =
                    baseRotation[config.axis] +
                    THREE.MathUtils.degToRad(proxy.angle);

                // No se persiste proxy.angle en movementController: para
                // ruedas ese ángulo no tiene un correlato real (es un
                // motor DC, no un servo), así que el giro visual queda
                // como estado puramente local de este tween.
                this.requestRender();
            },
        });

        this._motorTweens[partName] = tween;
    }

    /**
     * Frena el motor DC de una rueda, dejándola en el ángulo en el que
     * haya quedado (un motor real no "asienta" a una posición, a
     * diferencia del SETTLE_TIME_MS de los servos SG90). No hace nada si
     * esa pieza no tiene el motor corriendo.
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
     * @returns {boolean} true si el motor DC de esa pieza está corriendo
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
            this.stopMotor(partName); // no tiene sentido resetear una rueda que sigue girando

            // Para ruedas, movementController.setAngleForPart() sólo
            // loguea un warning y no hace nada (ver ese archivo) — no
            // hace falta filtrarlas acá aparte.
            movementController.setAngleForPart(partName, 0);

            const pivotMesh = this._getPivot(partName);
            if (pivotMesh && this.initialRotations[partName]) {
                pivotMesh.rotation.copy(this.initialRotations[partName]);
            }
        });

        this.requestRender();
    }
}
