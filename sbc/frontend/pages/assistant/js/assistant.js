import {
  setupBackHandler
} from "../../../shared/components/backHandler.js";
import { DEBUG_MODE, getApiUrl } from './common.js';

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
  // SOPORTE
  // =========================================================

  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "No disponible";
    voiceLabel.textContent = "El navegador no permite usar el micrófono";
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

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      audioChunks = [];

      /*
       * Chrome normalmente soporta audio/webm.
       */

      let mimeType = "";

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      }

      mediaRecorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream);


      mediaRecorder.ondataavailable = (event) => {

        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }

      };


      mediaRecorder.onstop = async () => {

        /*
         * Liberamos el micrófono.
         */

        if (mediaStream) {

          mediaStream
            .getTracks()
            .forEach(track => track.stop());

          mediaStream = null;
        }


        const actualMimeType =
          mediaRecorder.mimeType || "audio/webm";


        const audioBlob = new Blob(
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


      mediaRecorder.start();

      isRecording = true;

      assistant.classList.add("is-listening");

      statusText.textContent = "Escuchando";

      voiceLabel.textContent =
        "Hablá... tocá nuevamente para terminar";


      console.log(
        "[ASSISTANT] Grabación iniciada"
      );

    }

    catch (error) {

      console.error(
        "[ASSISTANT] Error accediendo al micrófono:",
        error
      );

      isRecording = false;

      setIdle();

    }

  }


  // =========================================================
  // DETENER GRABACIÓN
  // =========================================================

  function stopRecording() {

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      return;
    }

    isRecording = false;

    assistant.classList.remove("is-listening");

    statusText.textContent = "Procesando";

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

      const formData = new FormData();

      /*
       * El backend espera:
       *
       * UploadFile = audio
       */

      formData.append(
        "audio",
        audioBlob,
        "voice.webm"
      );


      console.log(
        "[ASSISTANT] Enviando audio al backend..."
      );


      const response = await fetch(getApiUrl("assistant/talk"),
        {
          method: "POST",
          body: formData
        }
      );

      if (!response.ok) {

        let errorMessage =
          "Error procesando el audio.";

        try {

          const errorData =
            await response.json();

          if (errorData.detail) {
            errorMessage =
              errorData.detail;
          }

        } catch (_) {}


        throw new Error(
          errorMessage
        );

      }


      /*
       * El backend devuelve:
       *
       * audio/wav
       *
       * y los textos en headers.
       */

      const data = await response.json();

    console.log("[ASSISTANT] Transcripción:", data.transcription);
    console.log("[ASSISTANT] Respuesta:", data.reply);

    if (data.transcription) {
        addMessage(data.transcription, "user");
    }

    if (data.reply) {
        addMessage(data.reply, "assistant");
    }


    }

    catch (error) {

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

    }

    finally {

      isProcessing = false;

    }

  }


  // =========================================================
  // REPRODUCIR RESPUESTA
  // =========================================================

  async function playResponse(blob) {

    if (!blob || blob.size === 0) {
      setIdle();
      return;
    }


    statusText.textContent =
      "Hablando";

    voiceLabel.textContent =
      "El asistente está respondiendo...";


    const audioURL =
      URL.createObjectURL(blob);


    const audio =
      new Audio(audioURL);


    audio.onended = () => {

      URL.revokeObjectURL(audioURL);

      setIdle();

    };


    audio.onerror = () => {

      URL.revokeObjectURL(audioURL);

      console.error(
        "[ASSISTANT] No se pudo reproducir el audio"
      );

      setIdle();

    };


    try {

      await audio.play();

    }

    catch (error) {

      console.error(
        "[ASSISTANT] Error reproduciendo audio:",
        error
      );

      URL.revokeObjectURL(audioURL);

      setIdle();

    }

  }


  // =========================================================
  // MENSAJES
  // =========================================================

  function addMessage(text, type) {

    if (!text) {
      return;
    }


    if (welcome) {
      welcome.style.display = "none";
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
        .forEach(track => track.stop());

      mediaStream = null;
    }

    window.location.href =
      "../home/home.html";
  }
});

})();