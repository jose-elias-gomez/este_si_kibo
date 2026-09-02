// animationBuilder.js
// Builder simple y encadenable para animar piezas del modelo simulando
// el tiempo real que tarda un servo SG90 en llegar al ángulo pedido.
//
// Uso (encadenado a mano):
//   const anim = new AnimationBuilder(partsController)
//       .leftArm(180)
//       .head(-45)
//       .wait(300)
//       .rightWheel(90);
//
//   await anim.execute(); // resuelve cuando termina toda la secuencia
//
// Uso (data-driven, ver animationsConfig.js):
//   const anim = buildAnimation(partsController, 'confusion');
//   await anim.execute();

import { ANIMATIONS } from "./animations.js";
import { WHEEL_MOTOR_CONFIG, WHEEL_MOTOR_SPEED_DEG_PER_SEC, MotorDirection } from "./partsConfig.js";

// --- Timing del servo SG90 ---
// Datasheet: ~0.1s por cada 60° a 4.8V (más lento a menor voltaje).
// Se toma ese valor como referencia estándar.
const SG90_SECONDS_PER_60_DEGREES = 0.13;
const SG90_MS_PER_DEGREE = (SG90_SECONDS_PER_60_DEGREES * 1000) / 60;

// Pequeño margen de asentamiento mecánico al llegar al ángulo objetivo
// (vibración/rebote del engranaje), típico en servos económicos como el SG90.
const SETTLE_TIME_MS = 40;

/**
 * Calcula cuánto tarda un SG90 en recorrer una distancia angular dada.
 * @param {number} degreesDelta - grados a recorrer (valor absoluto)
 * @returns {number} duración en milisegundos
 */
export function servoDurationMs(degreesDelta) {
    const distance = Math.abs(degreesDelta);
    if (distance === 0) return 0;
    return distance * SG90_MS_PER_DEGREE + SETTLE_TIME_MS;
}

/**
 * Calcula cuánto tiempo hay que correr el motor DC de una rueda para que,
 * en la previsualización 3D, "recorra" una distancia angular dada. Esto
 * es puramente un truco visual: el motor real (Arduino) no tiene noción
 * de ángulo, solo gira a velocidad constante hasta que se le manda parar
 * (LEFT/RIGHT/STOP). Se reusa la misma velocidad angular que ya usa el
 * giro libre (runMotor en partsController) para que ambos casos, si se
 * mezclaran, sean coherentes entre sí.
 * @param {number} degreesDelta - grados "equivalentes" a recorrer (valor absoluto)
 * @returns {number} duración en milisegundos
 */
export function wheelDurationMs(degreesDelta) {
    const distance = Math.abs(degreesDelta);
    if (distance === 0) return 0;
    return (distance / WHEEL_MOTOR_SPEED_DEG_PER_SEC) * 1000;
}

/**
 * @param {string} partName
 * @returns {boolean} true si la pieza es un motor DC de rueda (solo
 *   soporta LEFT/RIGHT/STOP) en vez de un servo con ángulo objetivo
 *   (Head/LeftArm/RightArm, que sí aceptan cualquier grado dentro de su rango).
 */
function isWheelPart(partName) {
    return Object.prototype.hasOwnProperty.call(WHEEL_MOTOR_CONFIG, partName);
}

// Nombres de piezas válidos, para mapear los métodos de conveniencia del
// builder (.head(), .leftArm()...) 1:1 con PARTS_CONFIG sin repetir
// strings sueltos por el código. move() (el método genérico, usado por
// el intérprete data-driven) no pasa por acá: recibe el nombre de pieza
// directamente, tal como viene escrito en ANIMATIONS.
const PART_NAMES = {
    head: 'Head',
    leftArm: 'LeftArm',
    rightArm: 'RightArm',
    leftWheel: 'LeftWheel',
    rightWheel: 'RightWheel'
};

export class AnimationBuilder {
    constructor(partsController, cameraViewController = null) {
        this.partsController = partsController;
        this.cameraViewController = cameraViewController;

        // Cada entrada es un paso a ejecutar en secuencia, y puede ser de
        // 2 tipos (nunca una mezcla ambigua de los dos, a diferencia de un
        // primer borrador donde una clave numérica podía ser "delay" o
        // "nombre de pieza" según el caso):
        //   { type: 'move', steps: [{partName, angle}, ...], repeat, yoyo }
        //   { type: 'wait', duration }  // en ms
        // Un 'move' con un solo step se ejecuta como siempre; uno con
        // varios (armado por .parallel()) se ejecuta simultáneamente.
        /** @type {Array<{type: 'move', steps: Array<{partName: string, angle: number}>, repeat: number, yoyo: boolean} | {type: 'wait', duration: number}>} */
        this._groups = [];

        // Buffer temporal usado por .parallel() para armar su grupo
        // con el mismo estilo fluido (leftArm(x).rightArm(y)).
        /** @type {{steps: Array<{partName: string, angle: number}>} | null} */
        this._parallelBuffer = null;
    }

    /**
     * Mueve una pieza puntual a un ángulo objetivo. Es el método genérico
     * detrás de los atajos (.head(), .leftArm()...) y el que usa el
     * intérprete data-driven (buildAnimation), que solo conoce nombres de
     * pieza como string (tal como están en PARTS_CONFIG / ANIMATIONS) y no
     * tiene por qué mapearlos a un método de conveniencia particular.
     * @param {string} partName - p.ej. 'Head', 'LeftArm'
     * @param {number} angleDegrees
     * @param {{repeat?: number, yoyo?: boolean}} [options] - se ignoran si este move() cae dentro de un .parallel(): ahí el repeat/yoyo se define una sola vez a nivel de grupo, en el segundo argumento de .parallel()
     * @returns {AnimationBuilder}
     */
    move(partName, angleDegrees, options = {}) {
        const step = { partName, angle: angleDegrees };

        if (this._parallelBuffer) {
            // Estamos dentro de un .parallel(builder => ...): el paso se
            // agrega al grupo paralelo en construcción, no como paso
            // secuencial suelto. repeat/yoyo de este 'options' individual
            // se descartan a propósito (ver nota arriba).
            this._parallelBuffer.steps.push(step);
        } else {
            this._groups.push({
                type: 'move',
                steps: [step],
                repeat: options.repeat || 0,
                yoyo: options.yoyo || false
            });
        }

        return this;
    }

    head(angleDegrees, options) {
        return this.move(PART_NAMES.head, angleDegrees, options);
    }

    leftArm(angleDegrees, options) {
        return this.move(PART_NAMES.leftArm, angleDegrees, options);
    }

    rightArm(angleDegrees, options) {
        return this.move(PART_NAMES.rightArm, angleDegrees, options);
    }

    /**
     * Corre la rueda izquierda. A diferencia de head()/leftArm()/rightArm(),
     * esto NO mueve la rueda a un ángulo objetivo real (el motor DC no
     * tiene esa noción) — angleDegrees es un delta "equivalente" que solo
     * se usa para calcular cuánto tiempo y en qué sentido correr el motor
     * (ver wheelDurationMs / _runWheelStep). Al robot real solo le llega
     * LEFT/RIGHT/STOP.
     * @param {number} angleDegrees - delta equivalente (no ángulo objetivo)
     */
    leftWheel(angleDegrees, options) {
        return this.move(PART_NAMES.leftWheel, angleDegrees, options);
    }

    /** Ver nota en leftWheel(). */
    rightWheel(angleDegrees, options) {
        return this.move(PART_NAMES.rightWheel, angleDegrees, options);
    }

    /**
     * Inserta una espera pura (sin mover nada) en la secuencia, antes de
     * pasar al siguiente paso encolado.
     * @param {number} durationMs
     * @returns {AnimationBuilder}
     */
    wait(durationMs) {
        this._groups.push({ type: 'wait', duration: durationMs });
        return this;
    }

    /**
     * Agrupa varios movimientos para que ocurran simultáneamente, dentro
     * de la misma cadena secuencial:
     *
     *   animate()
     *       .head(90)                                     // 1. corre solo
     *       .parallel(a => a.leftArm(180).rightArm(180))   // 2. ambos brazos a la vez
     *       .leftWheel(90);                                // 3. corre solo, después de que terminen los brazos
     *
     * @param {(group: AnimationBuilder) => void} groupFn - recibe un builder temporal donde encadenar los movimientos del grupo
     * @param {{repeat?: number, yoyo?: boolean}} [options] - repeat/yoyo para el grupo completo (todas las piezas del grupo van y vuelven juntas)
     * @returns {AnimationBuilder}
     */
    parallel(groupFn, options = {}) {
        const buffer = { steps: [] };
        this._parallelBuffer = buffer;

        groupFn(this);

        this._parallelBuffer = null;

        if (buffer.steps.length > 0) {
            this._groups.push({
                type: 'move',
                steps: buffer.steps,
                repeat: options.repeat || 0,
                yoyo: options.yoyo || false
            });
        }

        return this;
    }

    /**
     * Anima un único paso. Bifurca según el tipo de pieza:
     *   - Servo (Head/LeftArm/RightArm): se mueve a un ángulo objetivo
     *     puntual, con la duración de un SG90 real. Comportamiento sin
     *     cambios respecto de antes.
     *   - Rueda (LeftWheel/RightWheel): no tiene ángulo objetivo real —
     *     es un motor DC que solo entiende LEFT/RIGHT/STOP. El "ángulo"
     *     que le llega acá (tal como está escrito en animations.js) se
     *     usa únicamente para decidir, en la previsualización 3D, cuánto
     *     tiempo y en qué sentido girar (ver _runWheelStep), pero nunca
     *     se manda como ángulo real al robot.
     * No depende ni altera la selección global, por lo que es seguro
     * correrlo junto a otros pasos en paralelo.
     * @param {{partName: string, angle: number}} step
     * @param {number} repeat - repeticiones extra tras la primera pasada (semántica de gsap: 2 = 3 pasadas en total)
     * @param {boolean} yoyo - si es true, cada repetición alterna de sentido (ida y vuelta) en vez de saltar de golpe al inicio
     * @returns {Promise<void>}
     */
    _runStep(step, repeat = 0, yoyo = false) {
        if (this.cameraViewController) {
            this.cameraViewController.goToPart(step.partName);
        }

        if (isWheelPart(step.partName)) {
            return this._runWheelStep(step, repeat, yoyo);
        }
        return this._runServoStep(step, repeat, yoyo);
    }

    /**
     * Mueve un servo (Head/LeftArm/RightArm) desde su ángulo actual hasta
     * el objetivo, durante el tiempo que tardaría un SG90 real.
     * @param {{partName: string, angle: number}} step
     * @param {number} repeat
     * @param {boolean} yoyo
     * @returns {Promise<void>}
     */
    _runServoStep(step, repeat, yoyo) {
        const { partName, angle: targetAngle } = step;

        const startAngle = this.partsController.getAngleForPart(partName);
        const duration = servoDurationMs(targetAngle - startAngle) / 1000; // gsap usa segundos

        return new Promise((resolve) => {
            if (duration === 0) {
                this.partsController.setAngleForPart(partName, targetAngle);
                resolve();
                return;
            }

            const proxy = { angle: startAngle };
            gsap.to(proxy, {
                angle: targetAngle,
                duration,
                ease: "linear",
                repeat,
                yoyo,
                onUpdate: () => {
                    this.partsController.setAngleForPart(partName, proxy.angle);
                },
                onComplete: () => {
                    // Con yoyo:true, gsap ya deja el proxy en targetAngle
                    // solo si la cantidad de repeats es par (si es impar,
                    // la última pasada fue "de vuelta" y quedó en
                    // startAngle) — se fuerza el valor final acá para que
                    // no dependa de esa paridad.
                    this.partsController.setAngleForPart(partName, targetAngle);
                    resolve();
                }
            });
        });
    }

    /**
     * Corre el motor DC de una rueda como comando discreto (LEFT/RIGHT),
     * durante el tiempo equivalente a la distancia angular pedida, y lo
     * frena (STOP) al terminar. Nunca se le pide a la rueda "llegar" a un
     * ángulo — solo arrancar en un sentido y pararse después de un rato,
     * que es lo único que el motor real sabe hacer.
     *
     * El repeat/yoyo de gsap no tiene sentido para un motor DC (no hay
     * "ida y vuelta" continua con ease, es arrancar/parar), así que acá
     * se interpretan como: correr el mismo tramo (repeat + 1) veces, y si
     * yoyo es true, alternar el sentido en cada repetición.
     * @param {{partName: string, angle: number}} step
     * @param {number} repeat
     * @param {boolean} yoyo
     * @returns {Promise<void>}
     */
    async _runWheelStep(step, repeat, yoyo) {
        const { partName, angle: angleDelta } = step;
        const passes = repeat + 1;

        for (let i = 0; i < passes; i++) {
            // Sentido de esta pasada: si yoyo, alterna en cada repetición
            // (igual que gsap con yoyo:true); si no, siempre el mismo.
            const passSign = yoyo && i % 2 === 1 ? -1 : 1;
            const requestedSign = Math.sign(angleDelta) * passSign || 1;

            // Ojo: acá solo se decide FORWARD/BACKWARD "pedido" (el signo
            // visual). NO se combina con WHEEL_MOTOR_CONFIG.direction acá
            // — eso ya lo hace partsController.runMotor() internamente
            // (forwardSign * directionSign). Hacerlo también acá
            // duplicaría el signo y giraría la rueda al revés de lo pedido.
            const direction = requestedSign >= 0
                ? MotorDirection.FORWARD
                : MotorDirection.BACKWARD;

            const durationMs = wheelDurationMs(angleDelta);

            this.partsController.runMotor(partName, direction);

            if (durationMs > 0) {
                await this._runWait(durationMs);
            }

            this.partsController.stopMotor(partName);
        }
    }

    /**
     * Espera pura, sin mover ninguna pieza.
     * @param {number} durationMs
     * @returns {Promise<void>}
     */
    _runWait(durationMs) {
        return new Promise((resolve) => {
            gsap.delayedCall(durationMs / 1000, resolve);
        });
    }

    /**
     * Ejecuta un grupo de tipo 'move': todos sus pasos corren en paralelo
     * (y con el mismo repeat/yoyo, si se especificó), y resuelve cuando
     * todos terminaron (el más lento del grupo marca la duración).
     * @param {{steps: Array<{partName: string, angle: number}>, repeat: number, yoyo: boolean}} group
     * @returns {Promise<void>}
     */
    _runMoveGroup(group) {
        return Promise.all(
            group.steps.map((step) => this._runStep(step, group.repeat, group.yoyo))
        ).then(() => {});
    }

    /**
     * Ejecuta todos los pasos encolados en secuencia (uno después del
     * otro); dentro de cada paso de tipo 'move', todas sus piezas corren
     * en paralelo.
     * @returns {Promise<void>} se resuelve cuando termina el último paso
     */
    async execute() {
        for (const group of this._groups) {
            if (group.type === 'wait') {
                await this._runWait(group.duration);
            } else {
                await this._runMoveGroup(group);
            }
        }
    }
}

/**
 * Arma un AnimationBuilder ya cargado a partir de una animación declarada
 * en ANIMATIONS (ver animationsConfig.js), lista para .execute().
 * Es la traducción directa dato -> builder: recorre los pasos y llama a
 * .move()/.parallel()/.wait() según corresponda, sin motor nuevo.
 * @returns {AnimationBuilder}
 */
export function buildAnimation(partsController, animationName, cameraViewController = null) {
    const steps = ANIMATIONS[animationName];
    if (!steps) {
        throw new Error(`Animación desconocida: "${animationName}"`);
    }

    const builder = new AnimationBuilder(partsController, cameraViewController);

    steps.forEach((step) => {
        if ('wait' in step) {
            builder.wait(step.wait);
            return;
        }

        const partNames = Object.keys(step.move);
        const options = { repeat: step.repeat, yoyo: step.yoyo };

        if (partNames.length === 1) {
            const partName = partNames[0];
            builder.move(partName, step.move[partName], options);
        } else {
            builder.parallel((group) => {
                partNames.forEach((partName) => {
                    group.move(partName, step.move[partName]);
                });
            }, options);
        }
    });

    return builder;
}