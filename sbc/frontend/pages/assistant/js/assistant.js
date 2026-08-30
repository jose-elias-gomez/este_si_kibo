import {
    setupBackHandler
} from "../../../shared/components/backHandler.js";

import {
    DEBUG_MODE,
    getApiUrl
} from "../../../shared/js/api/common.js";

(() => {
    "use strict";

    const CONTEXT = "ASSISTANT";

    const assistant = document.getElementById("assistant");
    const micButton = document.getElementById("micButton");
    const voiceLabel = document.getElementById("voiceLabel");
    const conversation = document.getElementById("conversation");
    const welcome = document.getElementById("welcome");
    const statusText = document.getElementById("statusText");

    let mediaRecorder = null;
    let mediaStream = null;
    let audioChunks = [];

    let isRecording = false;
    let isProcessing = false;


    // =========================================================
    // VALIDAR ELEMENTOS
    // =========================================================

    if (
        !assistant ||
        !micButton ||
        !voiceLabel ||
        !conversation ||
        !statusText
    ) {
        console.error(
            "[ASSISTANT] Faltan elementos HTML necesarios."
        );
        return;
    }


    // =========================================================
    // SOPORTE DEL MICRÓFONO
    // =========================================================

    if (!navigator.mediaDevices?.getUserMedia) {

        statusText.textContent = "No disponible";

        voiceLabel.textContent =
            "El navegador no permite usar el micrófono.";

        micButton.disabled = true;

        return;
    }


    // =========================================================
    // BOTÓN DEL MICRÓFONO
    // =========================================================

    micButton.addEventListener("click", async () => {

        if (isProcessing) {
            return;
        }

        if (isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }

    });


    // =========================================================
    // INICIAR GRABACIÓN
    // =========================================================

    async function startRecording() {

        try {

            mediaStream =
                await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });


            audioChunks = [];


            // -------------------------------------------------
            // Elegir formato compatible
            // -------------------------------------------------

            let mimeType = "";

            if (
                MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/webm;codecs=opus";

            } else if (
                MediaRecorder.isTypeSupported(
                    "audio/webm"
                )
            ) {

                mimeType =
                    "audio/webm";

            } else if (
                MediaRecorder.isTypeSupported(
                    "audio/ogg;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/ogg;codecs=opus";
            }


            mediaRecorder = mimeType
                ? new MediaRecorder(
                    mediaStream,
                    { mimeType }
                )
                : new MediaRecorder(mediaStream);


            // -------------------------------------------------
            // Datos de audio
            // -------------------------------------------------

            mediaRecorder.ondataavailable =
                (event) => {

                    if (
                        event.data &&
                        event.data.size > 0
                    ) {

                        audioChunks.push(
                            event.data
                        );
                    }
                };


            // -------------------------------------------------
            // Grabación terminada
            // -------------------------------------------------

            mediaRecorder.onstop =
                async () => {

                    // Liberar micrófono
                    if (mediaStream) {

                        mediaStream
                            .getTracks()
                            .forEach(track => {
                                track.stop();
                            });

                        mediaStream = null;
                    }


                    const actualMimeType =
                        mediaRecorder.mimeType ||
                        "audio/webm";


                    const audioBlob =
                        new Blob(
                            audioChunks,
                            {
                                type: actualMimeType
                            }
                        );


                    console.log(
                        "[ASSISTANT] Audio grabado:",
                        audioBlob.size,
                        "bytes"
                    );


                    if (audioBlob.size === 0) {

                        setIdle();
                        return;
                    }


                    await sendAudio(audioBlob);
                };


            // -------------------------------------------------
            // Comenzar
            // -------------------------------------------------

            mediaRecorder.start();

            isRecording = true;

            assistant.classList.add(
                "is-listening"
            );

            statusText.textContent =
                "Escuchando";

            voiceLabel.textContent =
                "Hablá... tocá nuevamente para terminar";


            console.log(
                "[ASSISTANT] Grabación iniciada"
            );

        } catch (error) {

            console.error(
                "[ASSISTANT] Error accediendo al micrófono:",
                error
            );

            if (mediaStream) {

                mediaStream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

                mediaStream = null;
            }

            isRecording = false;

            setIdle();
        }
    }


    // =========================================================
    // DETENER GRABACIÓN
    // =========================================================

    function stopRecording() {

        if (
            !mediaRecorder ||
            mediaRecorder.state === "inactive"
        ) {
            return;
        }


        isRecording = false;

        assistant.classList.remove(
            "is-listening"
        );

        statusText.textContent =
            "Procesando";

        voiceLabel.textContent =
            "Procesando tu mensaje...";


        mediaRecorder.stop();


        console.log(
            "[ASSISTANT] Grabación detenida"
        );
    }


    // =========================================================
    // ENVIAR AUDIO AL BACKEND
    // =========================================================

    async function sendAudio(audioBlob) {

        isProcessing = true;


        try {

            const formData =
                new FormData();


            formData.append(
                "audio",
                audioBlob,
                "voice.webm"
            );


            const apiUrl =
                getApiUrl("assistant/talk");


            console.log(
                "[ASSISTANT] Enviando audio a:",
                apiUrl
            );


            const response =
                await fetch(
                    apiUrl,
                    {
                        method: "POST",
                        body: formData
                    }
                );


            console.log(
                "[ASSISTANT] HTTP:",
                response.status
            );


            // -------------------------------------------------
            // Error HTTP
            // -------------------------------------------------

            if (!response.ok) {

                let errorMessage =
                    "Error procesando el audio.";

                try {

                    const errorData =
                        await response.json();

                    if (
                        typeof errorData.detail ===
                        "string"
                    ) {

                        errorMessage =
                            errorData.detail;

                    } else if (
                        errorData.detail?.message
                    ) {

                        errorMessage =
                            errorData.detail.message;
                    }

                } catch (_) {
                    // El backend no devolvió JSON
                }


                throw new Error(
                    errorMessage
                );
            }


            // -------------------------------------------------
            // Respuesta
            // -------------------------------------------------

            const data =
                await response.json();


            console.log(
                "[ASSISTANT] Respuesta backend:",
                data
            );


            // -------------------------------------------------
            // Transcripción
            // -------------------------------------------------

            if (data.transcription) {

                addMessage(
                    data.transcription,
                    "user"
                );
            }


            // -------------------------------------------------
            // Respuesta del asistente
            // -------------------------------------------------

            if (data.reply) {

                addMessage(
                    data.reply,
                    "assistant"
                );
            }


            // -------------------------------------------------
            // Si no recibimos nada
            // -------------------------------------------------

            if (
                !data.transcription &&
                !data.reply
            ) {

                console.warn(
                    "[ASSISTANT] El backend respondió pero no devolvió transcription/reply."
                );
            }


            setIdle();

        } catch (error) {

            console.error(
                "[ASSISTANT] Error:",
                error
            );


            addMessage(
                error.message ||
                "No pude procesar tu mensaje.",
                "assistant"
            );


            setIdle();

        } finally {

            isProcessing = false;
        }
    }


    // =========================================================
    // AGREGAR MENSAJE
    // =========================================================

    function addMessage(text, type) {

        if (!text) {
            return;
        }


        if (welcome) {
            welcome.style.display =
                "none";
        }


        const message =
            document.createElement("div");

        message.className =
            `message message--${type}`;


        const bubble =
            document.createElement("div");

        bubble.className =
            "message__bubble";


        bubble.textContent =
            text;


        message.appendChild(
            bubble
        );


        conversation.appendChild(
            message
        );


        conversation.scrollTop =
            conversation.scrollHeight;
    }


    // =========================================================
    // ESTADO IDLE
    // =========================================================

    function setIdle() {

        isRecording = false;

        assistant.classList.remove(
            "is-listening"
        );

        statusText.textContent =
            "Listo";

        voiceLabel.textContent =
            "Tocá para hablar";
    }


    // =========================================================
    // LIMPIAR AL SALIR
    // =========================================================

    window.addEventListener(
        "beforeunload",
        () => {

            if (mediaStream) {

                mediaStream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });
            }
        }
    );


    // =========================================================
    // BOTÓN ATRÁS
    // =========================================================

    setupBackHandler({

        context: CONTEXT,

        onBack: () => {

            if (isProcessing) {
                return;
            }


            if (isRecording) {

                stopRecording();
                return;
            }


            if (mediaStream) {

                mediaStream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

                mediaStream = null;
            }


            window.location.href =
                "../home/home.html";
        }

    });


    console.log(
        "[ASSISTANT] Assistant JS cargado correctamente."
    );

})();