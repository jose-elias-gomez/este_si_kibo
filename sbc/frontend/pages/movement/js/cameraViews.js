export const CameraView = Object.freeze({
    FRONT: 'front',
    LEFT: 'left',
    RIGHT: 'right'
});

export class CameraViewController {
    /**
     * @param {THREE.PerspectiveCamera} camera
     * @param {THREE.OrbitControls} controls
     * @param {THREE.Vector3} center - punto alrededor del cual orbitan las vistas
     * @param {number} distance - distancia de la cámara al centro
     * @param {() => void} [requestRender] - callback para pedir un nuevo frame (p.ej. sceneEngine.requestRender)
     */
    constructor(camera, controls, center, distance, requestRender = () => {}) {
        this.camera = camera;
        this.controls = controls;
        this.center = center;
        this.distance = distance;
        this.requestRender = requestRender;

        // Vector reutilizado para no allocar uno nuevo en cada click de
        // botón / cada paso de una animación (AnimationBuilder llama a
        // goTo() en cada pieza si followWithCamera está activo).
        this._targetPos = new THREE.Vector3();
        this._lookAtTarget = new THREE.Vector3();

        // Proxy persistente para animar el punto de mira. Tiene que ser
        // SIEMPRE el mismo objeto (no uno nuevo por llamada): gsap
        // identifica qué tween cancelar/overridear por la identidad del
        // objeto + propiedad que anima. Si acá se pasara un clon nuevo en
        // cada goTo(), un click rápido antes de que termine la transición
        // anterior dejaría el tween viejo corriendo "a lo fantasma" sobre
        // un objeto que ya nadie lee, y el nuevo arrancaría desde un punto
        // de partida desactualizado — eso es el salto/tirón que se ve al
        // encadenar vistas rápido.
        this._lookAtProxy = center.clone();

        // Ajuste fino para las vistas LEFT/RIGHT (ruedas): bajan la cámara
        // un poco respecto al centro y acercan (menos distancia = más
        // zoom), para encuadrar mejor una pieza que está más abajo en el
        // modelo que la cabeza/brazos. Se expresan como fracciones de
        // `distance` para que escalen solas si el modelo cambia de tamaño
        // (ver fitCameraToModel en movement.js), en vez de un valor fijo
        // en metros que quedaría mal si el modelo es más grande o chico.
        this.wheelHeightDropRatio = 0.25; // cuánto baja la cámara (0 = nada, 1 = tanto como la distancia)
        this.wheelZoomRatio = 0.6;        // multiplicador de distance: <1 acerca la cámara
    }

    setDistance(distance) {
        this.distance = distance;
    }

    /**
     * Sincroniza el proxy interno de lookAt con un punto dado. Hay que
     * llamarlo cada vez que la cámara se reposiciona "a mano" (fuera de
     * goTo/gsap) — típicamente en el ajuste inicial tras cargar el
     * modelo (fitCameraToModel). Si no se llama, el primer goTo() de la
     * sesión anima el lookAt desde un valor desactualizado (el que tenía
     * el proxy al construirse el controller) en vez de desde donde la
     * cámara está mirando realmente, y se ve como un salto.
     * @param {THREE.Vector3} point
     */
    syncLookAt(point) {
        this._lookAtProxy.copy(point);
    }

    /**
     * Anima la cámara hacia una vista predefinida.
     * @param {string} view - uno de los valores de CameraView
     * @param {string} [partName] - nombre de la pieza que originó el cambio de vista
     *   (p.ej. 'LeftWheel'). Es opcional y solo se usa para decidir si aplica
     *   el encuadre especial de las ruedas (bajar + zoom) — 'left'/'right' por
     *   sí solos no alcanzan para distinguir una rueda de un brazo, ya que
     *   ambas piezas comparten el mismo `view`.
     */
    goTo(view, partName = null) {
        const { x, y, z } = this.center;
        const targetPos = this._targetPos;
        const isWheel = partName === 'LeftWheel' || partName === 'RightWheel';

        switch (view) {
            case CameraView.FRONT:
                targetPos.set(x, y, z + this.distance);
                break;
            case CameraView.LEFT: {
                const wheelDistance = this.distance * this.wheelZoomRatio;
                targetPos.set(
                    isWheel ? x - wheelDistance : x - this.distance,
                    isWheel ? y - this.distance * this.wheelHeightDropRatio : y,
                    z
                );
                break;
            }
            case CameraView.RIGHT: {
                const wheelDistance = this.distance * this.wheelZoomRatio;
                targetPos.set(
                    isWheel ? x + wheelDistance : x + this.distance,
                    isWheel ? y - this.distance * this.wheelHeightDropRatio : y,
                    z
                );
                break;
            }
            default:
                console.warn(`Vista de cámara desconocida: ${view}`);
                return;
        }

        // El punto al que mira la cámara: el centro del modelo para todo,
        // salvo las ruedas, que bajan la mirada junto con la posición
        // (si no, la cámara se acerca y baja pero sigue mirando al pecho
        // del robot en vez de a la rueda). El brazo sigue mirando siempre
        // al centro, como estaba antes de este ajuste.
        const lookAtGoal = this._lookAtTarget;
        lookAtGoal.copy(this.center);
        if (isWheel) {
            lookAtGoal.y -= this.distance * this.wheelHeightDropRatio;
        }

        // El lookAt también se anima, no solo la posición: si se lo
        // asigna de una sola vez al valor final (como se hacía antes),
        // la cámara "salta" a mirar hacia abajo en el primer frame de la
        // transición y recién después se traslada, lo que se ve como un
        // corte brusco en vez de un movimiento suave.
        //
        // this._lookAtProxy YA contiene el punto de mira actual (donde
        // haya quedado la transición anterior, terminada o no — a
        // diferencia de usar this.camera.userData._lastLookAt, que solo
        // se actualizaba al completar, este valor siempre está al día
        // porque es el mismo objeto que gsap viene animando). Así que
        // simplemente le decimos a gsap que lo lleve al nuevo objetivo:
        // si había un tween anterior en vuelo sobre este mismo objeto,
        // gsap lo overridea automáticamente y continúa desde donde
        // estaba, sin importar en qué punto lo interrumpiste.
        const lookAtProxy = this._lookAtProxy;

        // El target de los controls se sincroniza una única vez con el
        // valor final, en vez de en cada onUpdate (antes se hacía 70+
        // veces por segundo durante 1.2s, sin ninguna necesidad).
        this.controls.target.copy(lookAtGoal);

        gsap.to(lookAtProxy, {
            x: lookAtGoal.x,
            y: lookAtGoal.y,
            z: lookAtGoal.z,
            duration: 1,
            ease: "power2.inOut"
            // No hace falta lookAt() acá: el tween de abajo (posición de
            // cámara) ya lo llama en su propio onUpdate, y ambos tweens
            // corren en paralelo con la misma duración/easing, así que
            // alcanza con hacerlo una sola vez por frame.
        });

        gsap.to(this.camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 1,
            ease: "power2.inOut",
            onUpdate: () => {
                this.camera.lookAt(lookAtProxy);
                this.requestRender();
            },
            onComplete: () => {
                // Acá sí conviene resincronizar el estado interno de
                // OrbitControls una sola vez, ya con la posición final.
                this.controls.update();
                this.requestRender();
            }
        });
    }
}