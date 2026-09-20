export class SceneEngine {
    /**
     * @param {HTMLElement} container - contenedor donde se monta el canvas
     * @param {THREE.Vector3} lookAtTarget - punto inicial al que mira la cámara
     */
    constructor(container, lookAtTarget = new THREE.Vector3(0, 0.8, 0)) {
        this.container = container;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.5, 3.5);

        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false,
            powerPreference: "low-power",
        });
        this.renderer.shadowMap.enabled = false;
        this.renderer.setClearColor(0x000000, 0);

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        this.controls.enableRotate = false;
        this.controls.enableZoom = false;
        this.controls.enablePan = false;
        this.controls.target.copy(lookAtTarget);

        this._onWindowResize = this._onWindowResize.bind(this);
        window.addEventListener("resize", this._onWindowResize);

        this._animate = this._animate.bind(this);
        this._rafId = null;

        // Render bajo demanda: con rotate/zoom/pan desactivados y sin
        // damping, no había ningún motivo real para llamar a
        // controls.update() + renderer.render() en TODOS los frames, para
        // siempre, incluso con el modelo completamente quieto. Eso era el
        // 57% del tiempo de main thread en el profile (ver "_animate" /
        // sceneEngine.js:46). Ahora solo se pinta un frame nuevo cuando
        // alguien lo pide explícitamente vía requestRender() (una
        // animación de gsap, un cambio de ángulo, un resize).
        this._needsRender = true;
    }

    /**
     * Marca que hace falta pintar un nuevo frame. Cualquier cosa que
     * modifique la escena (mover cámara, rotar una pieza, resize) debe
     * llamar a esto para que se vea reflejada en el próximo frame.
     */
    requestRender() {
        this._needsRender = true;
    }

    start() {
        this._animate();
    }

    _animate() {
        this._rafId = requestAnimationFrame(this._animate);

        if (!this._needsRender) return;
        this._needsRender = false;

        this.renderer.render(this.scene, this.camera);
    }

    _onWindowResize() {
        const { container, camera, renderer } = this;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        this.requestRender();
    }

    dispose() {
        window.removeEventListener("resize", this._onWindowResize);
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }
}
