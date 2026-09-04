import { SceneEngine } from "./sceneEngine.js";
import { CameraViewController, CameraView } from "./cameraViews.js";
import { loadGltfModel } from "./modelLoader.js";
import { WrappedMovementPartController } from "./partsController.js";
import { AnimationBuilder, buildAnimation } from "../../../shared/js/movement/animationBuilder.js";
const MODEL_URL = 'assets/kibo_model.glb';
const modelCenter = new THREE.Vector3(0, 0.8, 0);
let cameraDistance = 3.5;

let sceneEngine = null;
let cameraViewController = null;
let partsController = null;

/**
 * Punto de entrada. Crea el motor 3D, carga el modelo y deja listo
 * el controlador de piezas. Devuelve las piezas necesarias para que
 * cualquier capa de UI externa pueda conectarse (seleccionar pieza,
 * mover un ángulo, resetear, etc.).
 */
async function init3D() {
    const container = document.getElementById('canvas-container');

    sceneEngine = new SceneEngine(container, modelCenter);

    // Le pasamos requestRender a todo lo que puede modificar la escena
    // (cámara y piezas), para que el loop de render (que ahora es
    // "bajo demanda") sepa cuándo tiene que pintar un frame nuevo.
    cameraViewController = new CameraViewController(
        sceneEngine.camera,
        sceneEngine.controls,
        modelCenter,
        cameraDistance,
        () => sceneEngine.requestRender()
    );

    sceneEngine.start();

    const modelRoot = await loadGltfModel(MODEL_URL).catch(err => {
        console.error("FALLÓ LA CARGA DEL MODELO:", err);
        throw err;
    });
    console.log("SI TU MARIDO NO TE QUIERE BAB Y");
    sceneEngine.scene.add(modelRoot);
    sceneEngine.requestRender(); // el modelo recién agregado tiene que pintarse

    partsController = new WrappedMovementPartController(modelRoot, () => sceneEngine.requestRender());

    fitCameraToModel(modelRoot);

    return { sceneEngine, cameraViewController, partsController };
}

/**
 * Ajusta centro y distancia de cámara al tamaño real del modelo cargado,
 * y posiciona la cámara en la vista frontal.
 * @param {THREE.Object3D} modelRoot
 */
function fitCameraToModel(modelRoot) {
    const box = new THREE.Box3().setFromObject(modelRoot);
    box.getCenter(modelCenter);
    const size = box.getSize(new THREE.Vector3());

    cameraDistance = size.y * 1.5;
    cameraViewController.setDistance(cameraDistance);
    sceneEngine.controls.target.copy(modelCenter);

    sceneEngine.camera.position.set(
        modelCenter.x,
        modelCenter.y,
        modelCenter.z + cameraDistance
    );
    sceneEngine.camera.lookAt(modelCenter);
    sceneEngine.controls.update();
    cameraViewController.syncLookAt(modelCenter); // evita el salto en el primer goTo() de la sesión
    sceneEngine.requestRender(); // reposicionamos la cámara fuera de un tween de gsap
}

/**
 * Selecciona una pieza y mueve la cámara a la vista indicada.
 * Pensado como el punto de conexión para cualquier UI externa
 * (botones, gestos, voz, etc.).
 * @param {string} partName - p.ej. 'Head', 'LeftArm'
 * @param {string} view - uno de CameraView (front | left | right)
 */
export function selectPart(partName, view) {
    if (!partsController) return null;

    const selection = partsController.selectPart(partName);
    cameraViewController.goTo(view, partName);

    return selection; // { config, currentAngle } — útil para actualizar cualquier UI
}

/**
 * Aplica un ángulo (en grados) a la pieza actualmente seleccionada.
 * @param {number} angleDegrees
 */
export function setPartAngle(angleDegrees) {
    partsController?.setAngle(angleDegrees);
}

export function getPivotAngle(partName) {
    return partsController?.getPivotAngle(partName);
}

/**
 * Arranca el motor DC de una rueda (giro continuo, sin ángulo objetivo).
 * @param {string} partName - 'LeftWheel' | 'RightWheel'
 * @param {string} [direction] - MotorDirection.FORWARD (default) o .BACKWARD
 */
export function runMotor(partName, direction) {
    partsController?.runMotor(partName, direction);
}

/**
 * Frena el motor DC de una rueda.
 * @param {string} partName - 'LeftWheel' | 'RightWheel'
 */
export function stopMotor(partName) {
    partsController?.stopMotor(partName);
}

/** Restaura todas las piezas a su posición inicial. */
export function resetParts() {
    partsController?.resetAll();
}

/**
 * Crea un nuevo builder de animación encadenable, listo para usar:
 *
 *   const anim = animate().leftArm(180).head(-45);
 *   await anim.execute();
 *
 * @param {boolean} [followWithCamera=false] - si true, cada paso también mueve la cámara a una vista acorde a la pieza
 * @returns {AnimationBuilder}
 */
export function animate(followWithCamera = false) {
    return new AnimationBuilder(
        partsController,
        followWithCamera ? cameraViewController : null
    );
}

/**
 * Arma y ejecuta de una una animación declarada en ANIMATIONS
 * (animationsConfig.js) por nombre.
 *
 *   await playAnimation('confusion');
 *
 * @param {string} animationName - clave dentro de ANIMATIONS
 * @param {boolean} [followWithCamera=false] - si true, cada paso también mueve la cámara a una vista acorde a la pieza
 * @returns {Promise<void>} resuelve cuando termina toda la secuencia
 */
export function playAnimation(animationName, followWithCamera = false) {
    const builder = buildAnimation(
        partsController,
        animationName,
        followWithCamera ? cameraViewController : null
    );
    return builder.execute();
}

export { CameraView };

window.onload = () => {
    console.log("?");
    init3D();
};
