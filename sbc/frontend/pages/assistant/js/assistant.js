import { input, InputAction } from "../../../shared/js/inputController.js";

import { PACKET_ID, onPacket } from "../../../shared/js/api/client.js";

import { getApiUrl } from "../../../shared/js/api/common.js";

(() => {
    "use strict";

    /* =========================================================
     CONTEXTO
     ========================================================= */

    const CONTEXT = "ASSISTANT";

    // Debe coincidir con MAX_RECORD_SECONDS del backend (AssistantRecorder).
    const MAX_RECORD_SECONDS = 10;

    /*
     * El backend responde "processing" apenas encola el pipeline
     * (STT -> LLM -> TTS); todavia no hay un endpoint/aviso de cuando
     * termina. Este timeout es solo una red de seguridad para que el
     * micro no quede bloqueado para siempre si algo falla.
     * TODO: reemplazar por polling a un endpoint de estado o por un
     * evento (websocket/SSE) que avise cuando el TTS termino de hablar.
     */
    const PROCESSING_SAFETY_TIMEOUT_MS = 20000;

    /* =========================================================
     ELEMENTOS
     ========================================================= */

    const assistant = document.getElementById("assistant");

    const micButton = document.getElementById("micButton");

    const voiceLabel = document.getElementById("voiceLabel");

    const voiceHint = document.getElementById("voiceHint");

    const conversation = document.getElementById("conversation");

    const welcome = document.getElementById("welcome");

    const statusText = document.getElementById("statusText");

    const recordTimerBar = document.getElementById("recordTimerBar");

    /* =========================================================
     ESTADO
     ========================================================= */

    // "idle" | "starting" | "recording" | "processing"
    let state = "idle";

    let autoStopTimeoutId = null;
    let processingSafetyTimeoutId = null;

    onPacket(PACKET_ID.ASSISTANT_RESPONSE, (data) => {
        console.log("[ASSISTANT] Respuesta del asistente:", data);
        setState("idle");
        addMessage(data.text, "assistant");
    });

    /* =========================================================
     VALIDAR ELEMENTOS
     ========================================================= */

    if (
        !assistant ||
        !micButton ||
        !voiceLabel ||
        !conversation ||
        !statusText ||
        !recordTimerBar
    ) {
        console.error("[ASSISTANT] Faltan elementos HTML necesarios.");

        return;
    }

    /* =========================================================
     TOGGLE GRABACIÓN
     ========================================================= */

    function toggleRecording() {
        if (state === "processing") {
            console.log("[ASSISTANT] Todavía procesando...");

            return;
        }

        if (state === "starting") {
            console.log("[ASSISTANT] Esperando confirmación de inicio...");

            return;
        }

        if (state === "recording") {
            stopRecording();

            return;
        }

        startRecording();
    }

    /* =========================================================
     CLICK DEL BOTÓN
     ========================================================= */

    micButton.addEventListener("click", () => {
        toggleRecording();
    });

    /* =========================================================
     INPUT CONTROLLER
     ========================================================= */

    input.pushContext(CONTEXT);

    /* =========================================================
     CONFIRMAR
     ========================================================= */

    input.on(
        InputAction.CONFIRM,

        () => {
            toggleRecording();
        },

        CONTEXT
    );

    /* =========================================================
     ATRÁS
     ========================================================= */

    input.on(
        InputAction.BACK,

        () => {
            if (state === "recording") {
                stopRecording();
            }

            input.popContext();

            window.location.href = "../home/home.html";
        },

        CONTEXT
    );

    /* =========================================================
     INICIAR GRABACIÓN
     ========================================================= */

    async function startRecording() {
        if (state !== "idle") {
            return;
        }

        setState("starting");

        try {
            console.log("[ASSISTANT] Iniciando grabación...");

            const response = await fetch(
                getApiUrl("assistant/start-recording"),
                {
                    method: "POST",
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            console.log("[ASSISTANT] start-recording:", data);

            if (data.status && data.status !== "recording") {
                // p. ej. "already_recording": alguien más ya inició una grabación.
                throw new Error(data.status);
            }

            setState("recording");
        } catch (error) {
            console.error("[ASSISTANT] Error al iniciar grabación:", error);

            addMessage("No pude iniciar la grabación.", "assistant");

            setState("idle");
        }
    }

    /* =========================================================
     DETENER GRABACIÓN
     ========================================================= */

    async function stopRecording() {
        if (state !== "recording") {
            return;
        }

        // Bloqueamos de inmediato para evitar dobles clicks.
        setState("processing");

        try {
            console.log("[ASSISTANT] Deteniendo grabación...");

            const response = await fetch(
                getApiUrl("assistant/stop-recording"),
                {
                    method: "POST",
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            console.log("[ASSISTANT] stop-recording:", data);

            // El pipeline STT -> LLM -> TTS corre en un thread aparte del
            // backend; por ahora solo confirmamos que quedó encolado.
            // El propio TTS es el que reproduce la respuesta.
        } catch (error) {
            console.error("[ASSISTANT] Error al detener grabación:", error);

            addMessage(
                "No pude enviar tu mensaje para procesarlo.",
                "assistant"
            );

            setState("idle");

            return;
        }

        // Red de seguridad: si nunca sabemos que terminó, volvemos a "idle".
        processingSafetyTimeoutId = setTimeout(() => {
            if (state === "processing") {
                setState("idle");
            }
        }, PROCESSING_SAFETY_TIMEOUT_MS);
    }

    /* =========================================================
     MENSAJES
     ========================================================= */

    function addMessage(text, type) {
        if (!text) {
            return;
        }

        if (welcome) {
            welcome.style.display = "none";
        }

        const message = document.createElement("div");

        message.className = `message message--${type}`;

        const bubble = document.createElement("div");

        bubble.className = "message__bubble";

        bubble.textContent = text;

        message.appendChild(bubble);

        conversation.appendChild(message);

        conversation.scrollTop = conversation.scrollHeight;
    }

    /* =========================================================
     MÁQUINA DE ESTADOS VISUAL
     ========================================================= */

    function setState(next) {
        state = next;

        clearAutoStopTimer();

        if (next !== "processing") {
            clearProcessingSafetyTimer();
        }

        assistant.classList.remove("is-listening", "is-processing");

        micButton.disabled = false;

        switch (next) {
            case "starting": {
                statusText.textContent = "Conectando";

                voiceLabel.textContent = "Activando micrófono...";

                micButton.disabled = true;

                break;
            }

            case "recording": {
                assistant.classList.add("is-listening");

                statusText.textContent = "Escuchando";

                voiceLabel.textContent =
                    "Hablá... tocá nuevamente para terminar";

                startAutoStopTimer();

                break;
            }

            case "processing": {
                assistant.classList.add("is-processing");

                statusText.textContent = "Procesando";

                voiceLabel.textContent = "Procesando tu mensaje...";

                micButton.disabled = true;

                resetTimerBar();

                break;
            }

            default: {
                statusText.textContent = "Listo";

                voiceLabel.textContent = "Tocá para hablar";

                if (voiceHint) {
                    voiceHint.textContent = "Voz · máx. 10s";
                }

                resetTimerBar();

                break;
            }
        }
    }

    /* =========================================================
     LÍMITE DE 10s (auto-stop + barra visual)
     ========================================================= */

    function startAutoStopTimer() {
        resetTimerBar();

        // Fuerza reflow para que la transición de scaleX(1) -> scaleX(0) corra.
        void recordTimerBar.offsetWidth;

        recordTimerBar.classList.add("is-counting");

        let secondsLeft = MAX_RECORD_SECONDS;

        if (voiceHint) {
            voiceHint.textContent = `Se corta en ${secondsLeft}s`;
        }

        const tick = setInterval(() => {
            secondsLeft -= 1;

            if (voiceHint && secondsLeft > 0) {
                voiceHint.textContent = `Se corta en ${secondsLeft}s`;
            }

            if (secondsLeft <= 0) {
                clearInterval(tick);
            }
        }, 1000);

        autoStopTimeoutId = setTimeout(() => {
            clearInterval(tick);

            console.log(
                "[ASSISTANT] Límite de 10s alcanzado, deteniendo automáticamente"
            );

            stopRecording();
        }, MAX_RECORD_SECONDS * 1000);

        // Guardamos el interval para poder limpiarlo si se corta antes.
        autoStopTimeoutId = {
            timeout: autoStopTimeoutId,
            interval: tick,
        };
    }

    function clearAutoStopTimer() {
        if (!autoStopTimeoutId) {
            return;
        }

        if (typeof autoStopTimeoutId === "object") {
            clearTimeout(autoStopTimeoutId.timeout);
            clearInterval(autoStopTimeoutId.interval);
        } else {
            clearTimeout(autoStopTimeoutId);
        }

        autoStopTimeoutId = null;
    }

    function clearProcessingSafetyTimer() {
        if (processingSafetyTimeoutId) {
            clearTimeout(processingSafetyTimeoutId);

            processingSafetyTimeoutId = null;
        }
    }

    function resetTimerBar() {
        recordTimerBar.classList.remove("is-counting");

        // Vuelve a llenar la barra instantáneamente para la próxima grabación.
        recordTimerBar.style.transition = "none";
        recordTimerBar.style.transform = "scaleX(1)";

        // Restauramos la transición en el próximo frame.
        requestAnimationFrame(() => {
            recordTimerBar.style.transition = "";
        });
    }

    /* =========================================================
     ESTADO INICIAL
     ========================================================= */

    setState("idle");

    /* =========================================================
     DEBUG
     ========================================================= */

    console.log("[ASSISTANT] Assistant JS cargado correctamente.");
})();
