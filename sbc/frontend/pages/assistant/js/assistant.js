import {
  input,
  InputAction
} from "../../../shared/js/inputController.js";

import {
  DEBUG_MODE,
  getApiUrl
} from "../../../shared/js/api/common.js";

(() => {

  "use strict";


  /* =========================================================
     CONTEXTO
     ========================================================= */

  const CONTEXT = "ASSISTANT";


  /* =========================================================
     ELEMENTOS
     ========================================================= */

  const assistant =
    document.getElementById("assistant");

  const micButton =
    document.getElementById("micButton");

  const voiceLabel =
    document.getElementById("voiceLabel");

  const conversation =
    document.getElementById("conversation");

  const welcome =
    document.getElementById("welcome");

  const statusText =
    document.getElementById("statusText");


  /* =========================================================
     ESTADO
     ========================================================= */

  let mediaRecorder = null;
  let mediaStream = null;
  let audioChunks = [];

  let isRecording = false;
  let isProcessing = false;


  /* =========================================================
     VALIDAR ELEMENTOS
     ========================================================= */

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


  /* =========================================================
     SOPORTE DEL MICRÓFONO
     ========================================================= */

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    statusText.textContent =
      "No disponible";

    voiceLabel.textContent =
      "El navegador no permite usar el micrófono.";

    micButton.disabled = true;

    return;

  }


  /* =========================================================
     ACCIONES PRINCIPALES
     ========================================================= */

  /* =========================================================
     ACCIONES PRINCIPALES
     ========================================================= */

  async function toggleRecording() {

    if (isProcessing) {
      return;
    }

    if (isRecording) {

      stopRecording();

    } else {

      await startRecording();

    }

  }


  // Evento directo con Mouse/Touch
  micButton.addEventListener(
    "click",
    (event) => {
      // Si el evento fue provocado por el teclado (Enter/Espacio), 
      // lo ignoramos aquí porque ya lo manejará el InputController.
      if (event.detail === 0) {
        return;
      }
      toggleRecording();
    }
  );


  /* =========================================================
     INPUT CONTROLLER
     ========================================================= */

  input.pushContext(
    CONTEXT
  );


  // Botón Confirmar (A / Enter / Joystick)
  input.on(

    InputAction.CONFIRM,

    () => {

      toggleRecording();

    },

    CONTEXT

  );


  // Botón Atrás (B / Escape / Back)
  input.on(

    InputAction.BACK,

    () => {

      if (isRecording) {

        stopRecording();

      }


      stopMediaTracks();


      input.popContext();


      window.location.href =
        "../home/home.html";

    },

    CONTEXT

  );

  micButton.addEventListener(
    "click",
    () => {
      toggleRecording();
    }
  );


  /* =========================================================
     INICIAR GRABACIÓN
     ========================================================= */

  async function startRecording() {

    try {

      console.log(
        "[ASSISTANT] Solicitando micrófono..."
      );

      mediaStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });


      audioChunks = [];


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
        : new MediaRecorder(
            mediaStream
          );


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


      mediaRecorder.onstop =
        async () => {

          stopMediaTracks();


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
        "[ASSISTANT] Error de micrófono:",
        error
      );

      stopMediaTracks();

      isRecording = false;

      setIdle();

    }

  }


  /* =========================================================
     DETENER GRABACIÓN
     ========================================================= */

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


  /* =========================================================
     DETENER TRACKS DE MEDIA
     ========================================================= */

  function stopMediaTracks() {

    if (mediaStream) {

      mediaStream
        .getTracks()
        .forEach((track) => {

          track.stop();

        });

      mediaStream = null;

    }

  }


  /* =========================================================
     ENVIAR AUDIO AL BACKEND
     ========================================================= */

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

        } catch (_) {}


        throw new Error(
          errorMessage
        );

      }


      const data =
        await response.json();


      console.log(
        "[ASSISTANT] Respuesta backend:",
        data
      );


      if (data.transcription) {

        addMessage(
          data.transcription,
          "user"
        );

      }


      if (data.reply) {

        addMessage(
          data.reply,
          "assistant"
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


  /* =========================================================
     MENSAJES EN PANTALLA
     ========================================================= */

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


  /* =========================================================
     ESTADO IDLE
     ========================================================= */

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


  /* =========================================================
     LIMPIAR AL SALIR
     ========================================================= */

  window.addEventListener(
    "beforeunload",
    () => {

      stopMediaTracks();

    }
  );


  /* =========================================================
     INPUT CONTROLLER
     ========================================================= */

  input.pushContext(
    CONTEXT
  );


  // Botón Confirmar (A / Enter / Click)
  input.on(

    InputAction.CONFIRM,

    () => {

      toggleRecording();

    },

    CONTEXT

  );


  // Botón Atrás (B / Escape / Back)
  input.on(

    InputAction.BACK,

    () => {

      if (isRecording) {

        stopRecording();

      }


      stopMediaTracks();


      input.popContext();


      window.location.href =
        "../home/home.html";

    },

    CONTEXT

  );


  console.log(
    "[ASSISTANT] Assistant JS cargado correctamente."
  );

})();