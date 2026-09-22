import { findNode } from "./modelLoader.js";
import { EXPRESSIONS_TYPE, getExpressionSvgUrl } from "../../../shared/js/expressions/expressions.js";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const BG_COLOR = "#050505";

// El mesh "Screen" del modelo tiene el UV espejado en horizontal (cosa
// del modelo 3D, no del SVG en sí) — se corrige acá, al dibujar, en vez
// de tocar el modelo. Si en algún momento se arregla desde el modelo,
// poner esto en false.
const MIRROR_X = true;

function clearCanvas(ctx) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

export class FaceScreenController {
    /**
     * @param {THREE.Object3D} modelRoot - raíz del modelo ya cargado en escena
     * @param {() => void} [requestRender] - callback para pedir un nuevo frame (p.ej. sceneEngine.requestRender)
     */
    constructor(modelRoot, requestRender = () => {}) {
        this.requestRender = requestRender;
        this.screenMesh = findNode(modelRoot, "Screen");
        this.texture = null;
        this.canvas = null;
        this.ctx = null;

        this._activeUrl = null;
        this._stopTimeoutId = null;
        this._tick = this._tick.bind(this);

        if (!this.screenMesh || !this.screenMesh.isMesh) {
            console.warn('No se encontró una malla "Screen" (Head > Pivot > Screen): las expresiones faciales no se van a mostrar.');
            return;
        }

        this.canvas = document.createElement("canvas");
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext("2d");

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.encoding = THREE.sRGBEncoding;

        // El material de este mesh ya es una instancia propia (ver
        // loadGltfModel en modelLoader.js, que crea un MeshBasicMaterial
        // nuevo por cada mesh del GLTF), así que pisar .map acá no
        // afecta a ninguna otra pieza del modelo.
        this.screenMesh.material.map = this.texture;
        this.screenMesh.material.color.set(0xffffff);
        this.screenMesh.material.needsUpdate = true;

        // <img> real en el DOM para cargar el SVG animado: tiene que
        // seguir "vivo" en el documento para que su animación interna
        // (SMIL de svgator) siga corriendo — si no, drawImage() capturaría
        // siempre el mismo cuadro estático. A propósito NO se esconde con
        // un tamaño mínimo (1x1) ni muy lejos del viewport: varios
        // navegadores le bajan la prioridad de render (o directamente lo
        // pausan) a elementos así de chicos/lejanos, como si fueran
        // invisibles. Con tamaño real + opacity:0 sigue totalmente
        // "pintado" (solo que transparente), así que la animación no se
        // frena.
        this._image = document.createElement("img");
        this._image.setAttribute("aria-hidden", "true");
        this._image.style.position = "fixed";
        this._image.style.top = "0";
        this._image.style.left = "0";
        this._image.style.width = CANVAS_WIDTH + "px";
        this._image.style.height = CANVAS_HEIGHT + "px";
        this._image.style.opacity = "0";
        this._image.style.pointerEvents = "none";
        document.body.appendChild(this._image);

        this._drawBlank();
    }

    /**
     * Muestra el SVG animado asociado a una animación (ver
     * ANIMATION_EXPRESSIONS), si tiene una asignada. Pensado para
     * llamarse justo antes de ejecutar esa animación.
     * @param {string} animationName
     */
    playForAnimation(animationName) {
        const type = EXPRESSIONS_TYPE[animationName.toUpperCase()];
        if (!type) return; // sin expresión asociada: no tocar la pantalla
        this.play(type);
    }

    /**
     * Carga el SVG animado de `type` y lo vuelca cuadro a cuadro sobre
     * el canvas durante type.duration * type.repeat ms — el mismo
     * cálculo que usa displayAnimation() en expressions.js — y se
     * detiene sola al cumplirse ese tiempo.
     * @param {{id: string, duration: number, repeat: number}} type - una entrada de EXPRESSIONS_TYPE
     */
    play(type) {
        if (!this.texture) return;

        this._stopLoop();

        const url = getExpressionSvgUrl(type);
        this._activeUrl = url;

        // Cache-bust: si src ya apuntaba a esta misma URL (p.ej. se pide
        // la misma expresión dos veces seguidas), el navegador puede no
        // volver a disparar onload — y sin eso el ticker nunca arranca
        // de nuevo. Con un query param distinto en cada llamada, siempre
        // hay una recarga real y onload siempre dispara.
        const loadUrl = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();

        this._image.onload = () => {
            // Puede haber cambiado la expresión pedida mientras esta
            // cargaba (p.ej. dos animaciones encadenadas rápido) — si ya
            // no es la activa, no arrancamos el loop de dibujo con un
            // frame que ya no corresponde.
            if (this._activeUrl !== url) return;
            gsap.ticker.remove(this._tick);
            gsap.ticker.add(this._tick);
        };
        this._image.onerror = () => {
            console.warn(`No se pudo cargar la expresión "${type.id}" (${url})`);
        };
        this._image.src = loadUrl;

        this._stopTimeoutId = setTimeout(() => this.stop(), type.duration * type.repeat);
    }

    /**
     * Detiene la expresión activa (si había alguna corriendo) y apaga
     * la pantalla. Seguro de llamar aunque no haya ninguna activa.
     */
    stop() {
        this._stopLoop();
        this._activeUrl = null;
        this._drawBlank();
    }

    _stopLoop() {
        gsap.ticker.remove(this._tick);
        if (this._stopTimeoutId) {
            clearTimeout(this._stopTimeoutId);
            this._stopTimeoutId = null;
        }
    }

    _tick() {
        if (!this._activeUrl || !this.texture) return;

        clearCanvas(this.ctx);
        this._drawContain(this._image);

        this.texture.needsUpdate = true;
        this.requestRender();
    }

    /**
     * Dibuja `image` centrado y escalado tipo "contain" dentro del
     * canvas de 800x480, por si el SVG no viene exactamente en esa
     * proporción (se ve completo, sin recortarse ni deformarse), y
     * espejado en horizontal si MIRROR_X está activo (ver comentario
     * arriba — corrige el UV del mesh "Screen").
     */
    _drawContain(image) {
        const iw = image.naturalWidth || CANVAS_WIDTH;
        const ih = image.naturalHeight || CANVAS_HEIGHT;
        const scale = Math.min(CANVAS_WIDTH / iw, CANVAS_HEIGHT / ih);
        const w = iw * scale;
        const h = ih * scale;
        const x = (CANVAS_WIDTH - w) / 2;
        const y = (CANVAS_HEIGHT - h) / 2;

        this.ctx.save();
        if (MIRROR_X) {
            this.ctx.translate(CANVAS_WIDTH, 0);
            this.ctx.scale(-1, 1);
        }
        this.ctx.drawImage(image, x, y, w, h);
        this.ctx.restore();
    }

    _drawBlank() {
        if (!this.texture) return;
        clearCanvas(this.ctx);
        this.texture.needsUpdate = true;
        this.requestRender();
    }
}