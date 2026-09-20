import { input, InputAction } from "../../../shared/js/inputController.js";

(() => {
    "use strict";

    /* =========================================================
     CONTEXTO Y CONFIGURACIÓN
     ========================================================= */

    const CONTEXT = "TRANSLATOR";
    const WS_URL = "ws://localhost:25566/api/translator/ws";

    const FRAME_INTERVAL = 80;
    const JPEG_QUALITY = 0.65;
    const FRAME_WIDTH = 640;
    const FRAME_HEIGHT = 480;

    /* =========================================================
     ELEMENTOS DEL DOM
     ========================================================= */

    const cameraFrame = document.getElementById("cameraFrame");
    const cameraFeed = document.getElementById("cameraFeed");
    const signalDot = document.getElementById("signalDot");
    const signalLabel = document.getElementById("signalLabel");
    const captionDock = document.getElementById("captionDock");
    const peekHandle = document.getElementById("peekHandle");
    const currentGlyph = document.getElementById("currentGlyph");
    const translatorWord = document.getElementById("translatorWord");

    /* =========================================================
     ESTADO LOCAL
     ========================================================= */

    let mediaStream = null;
    let panelOpen = false;
    let socket = null;
    let socketReady = false;
    let canvas = null;
    let canvasContext = null;
    let sendTimer = null;
    let currentWord = "";

    let frameProcessing = false;
    let sendingFrames = false;
    let isNavigating = false;

    /* =========================================================
     CÁMARA
     ========================================================= */

    async function startCamera() {
        try {
            console.log("[TRANSLATOR] Solicitando cámara...");
            if (signalLabel) signalLabel.textContent = "Solicitando acceso…";

            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {
                throw new Error("getUserMedia no está disponible");
            }

            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false,
            });

            if (cameraFeed) {
                cameraFeed.srcObject = mediaStream;
                cameraFeed.muted = true;
                cameraFeed.autoplay = true;
                cameraFeed.playsInline = true;
                await cameraFeed.play();
            }

            if (cameraFrame) cameraFrame.classList.add("is-active");
            if (signalDot) signalDot.classList.add("is-tracking");
            if (signalLabel) signalLabel.textContent = "Cámara activa";

            console.log("[TRANSLATOR] Cámara iniciada correctamente.");
            startCanvas();
        } catch (error) {
            console.error("[TRANSLATOR] Error de cámara:", error);
            if (signalDot) signalDot.classList.remove("is-tracking");
            if (signalLabel) {
                switch (error.name) {
                    case "NotAllowedError":
                        signalLabel.textContent = "Permiso de cámara rechazado";
                        break;
                    case "NotFoundError":
                        signalLabel.textContent = "No se encontró una cámara";
                        break;
                    case "NotReadableError":
                        signalLabel.textContent = "La cámara está siendo usada";
                        break;
                    default:
                        signalLabel.textContent =
                            "No se pudo acceder a la cámara";
                }
            }
        }
    }

    /* =========================================================
     CANVAS
     ========================================================= */

    function startCanvas() {
        canvas = document.createElement("canvas");
        canvas.width = FRAME_WIDTH;
        canvas.height = FRAME_HEIGHT;

        canvasContext = canvas.getContext("2d", { alpha: false });

        if (!canvasContext) {
            console.error(
                "[TRANSLATOR] No se pudo crear el contexto del canvas."
            );
            return;
        }

        startSendingFrames();
    }

    /* =========================================================
     DETENER CÁMARA Y WEBSOCKET
     ========================================================= */

    function stopCamera() {
        sendingFrames = false;
        frameProcessing = false;

        if (sendTimer) {
            clearTimeout(sendTimer);
            sendTimer = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = null;
        }

        if (socket) {
            try {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;

                if (
                    socket.readyState === WebSocket.OPEN ||
                    socket.readyState === WebSocket.CONNECTING
                ) {
                    socket.close(1000, "Salida del módulo");
                }
            } catch (error) {
                console.error("[TRANSLATOR] Error cerrando WebSocket:", error);
            }
            socket = null;
        }

        socketReady = false;

        if (cameraFeed) cameraFeed.srcObject = null;
        if (cameraFrame) cameraFrame.classList.remove("is-active");
        if (signalDot) signalDot.classList.remove("is-tracking");
    }

    /* =========================================================
     PANEL Y VISTA
     ========================================================= */

    function openPanel() {
        panelOpen = true;
        if (captionDock) captionDock.classList.add("is-open");
        if (peekHandle) peekHandle.classList.add("is-hidden");
    }

    function closePanel() {
        panelOpen = false;
        if (captionDock) captionDock.classList.remove("is-open");
        if (peekHandle) peekHandle.classList.remove("is-hidden");
    }

    if (peekHandle) {
        peekHandle.addEventListener("click", () => {
            if (panelOpen) closePanel();
            else openPanel();
        });
    }

    /* =========================================================
     INTERFAZ Y LETRAS
     ========================================================= */

    function showSign(sign) {
        if (!sign || !currentGlyph) return;
        currentGlyph.textContent = sign;
        currentGlyph.classList.remove("is-fresh");
        void currentGlyph.offsetWidth;
        currentGlyph.classList.add("is-fresh");
    }

    function updateWord(word) {
        currentWord = word || "";
        if (translatorWord) {
            translatorWord.textContent = currentWord;
        }
    }

    /* =========================================================
     WEBSOCKET
     ========================================================= */

    function connectSocket() {
        if (
            socket &&
            (socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        console.log("[TRANSLATOR] Conectando WebSocket...");
        socket = new WebSocket(WS_URL);
        socket.binaryType = "arraybuffer";

        socket.onopen = () => {
            console.log("[TRANSLATOR] WebSocket conectado.");
            socketReady = true;
            if (signalLabel) signalLabel.textContent = "Traductor conectado";
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleBackendMessage(data);
            } catch (error) {
                console.error("[TRANSLATOR] Error JSON:", error);
            }
        };

        socket.onerror = (error) => {
            console.error("[TRANSLATOR] WebSocket error:", error);
            socketReady = false;
        };

        socket.onclose = () => {
            console.log("[TRANSLATOR] WebSocket cerrado.");
            socketReady = false;
        };
    }

    function handleBackendMessage(data) {
        if (data.type === "error") return;
        if (data.type === "word") {
            updateWord(data.word);
            return;
        }
        if (data.type !== "prediction") return;

        if (data.prediction) showSign(data.prediction);
        if (data.confirmed && data.confirmed_letter)
            showSign(data.confirmed_letter);
        if (typeof data.word === "string") updateWord(data.word);
    }

    /* =========================================================
     ENVIAR FRAMES
     ========================================================= */

    function startSendingFrames() {
        if (sendingFrames) return;
        sendingFrames = true;
        frameProcessing = false;
        sendFrame();
    }

    function scheduleNextFrame() {
        if (!sendingFrames) return;
        if (sendTimer) clearTimeout(sendTimer);

        sendTimer = setTimeout(() => {
            sendTimer = null;
            sendFrame();
        }, FRAME_INTERVAL);
    }

    function sendFrame() {
        if (!sendingFrames) return;

        if (
            !mediaStream ||
            !socketReady ||
            !socket ||
            socket.readyState !== WebSocket.OPEN ||
            !canvas ||
            !canvasContext
        ) {
            scheduleNextFrame();
            return;
        }

        if (frameProcessing) {
            scheduleNextFrame();
            return;
        }

        frameProcessing = true;

        try {
            canvasContext.drawImage(
                cameraFeed,
                0,
                0,
                FRAME_WIDTH,
                FRAME_HEIGHT
            );

            canvas.toBlob(
                (blob) => {
                    if (!sendingFrames) {
                        frameProcessing = false;
                        return;
                    }

                    if (
                        blob &&
                        socket &&
                        socket.readyState === WebSocket.OPEN
                    ) {
                        try {
                            socket.send(blob);
                        } catch (error) {
                            console.error(
                                "[TRANSLATOR] Error enviando frame:",
                                error
                            );
                        }
                    }

                    frameProcessing = false;
                    scheduleNextFrame();
                },
                "image/jpeg",
                JPEG_QUALITY
            );
        } catch (error) {
            console.error("[TRANSLATOR] Error procesando frame:", error);
            frameProcessing = false;
            scheduleNextFrame();
        }
    }

    /* =========================================================
     INICIALIZACIÓN
     ========================================================= */

    startCamera();
    connectSocket();

    /* =========================================================
     INPUT CONTROLLER Y SALIDA LIMPIA
     ========================================================= */

    function destroyTranslatorView() {
        isNavigating = true;
        stopCamera();

        try {
            input.off(CONTEXT);
            input.popContext();
        } catch (e) {
            console.warn("[TRANSLATOR] Error al destruir contexto:", e);
        }
    }

    input.pushContext(CONTEXT);

    input.on(
        InputAction.UP,
        () => {
            if (isNavigating) return;
            if (panelOpen) closePanel();
            else openPanel();
        },
        CONTEXT
    );

    input.on(
        InputAction.DOWN,
        () => {
            if (isNavigating) return;
            closePanel();
        },
        CONTEXT
    );

    input.on(
        InputAction.BACK,
        () => {
            if (isNavigating) return;
            destroyTranslatorView();
            window.location.replace("../home/home.html");
        },
        CONTEXT
    );

    input.on(
        InputAction.RELOAD,
        () => {
            if (isNavigating) return;
            destroyTranslatorView();
            window.location.reload();
        },
        CONTEXT
    );

    window.addEventListener("beforeunload", () => {
        destroyTranslatorView();
    });
})();
