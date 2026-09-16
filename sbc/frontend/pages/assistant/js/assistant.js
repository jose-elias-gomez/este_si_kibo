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
  let isStarting = false;


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
     TOGGLE GRABACIÓN
     ========================================================= */

  function toggleRecording() {

    /*
     * Si está procesando la respuesta del asistente,
     * no hacemos nada.
     */

    if (isProcessing) {

      console.log(
        "[ASSISTANT] Todavía procesando..."
      );

      return;

    }


    /*
     * Si todavía está solicitando el micrófono,
     * ignoramos otro Enter/click.
     */

    if (isStarting) {

      console.log(
        "[ASSISTANT] Esperando micrófono..."
      );

      return;

    }


    /*
     * Si está grabando, el mismo botón/Enter
     * detiene la grabación.
     */

    if (isRecording) {

      stopRecording();

      return;

    }


    /*
     * Si no está grabando, comienza.
     */

    startRecording();

  }


  /* =========================================================
     CLICK DEL BOTÓN
     ========================================================= */

  micButton.addEventListener(
    "click",
    () => {

      toggleRecording();

    }
  );


  /* =========================================================
     INPUT CONTROLLER
     ========================================================= */

  input.pushContext(
    CONTEXT
  );


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


  /* =========================================================
     INICIAR GRABACIÓN
     ========================================================= */

  async function startRecording() {

    if (
      isProcessing ||
      isStarting ||
      isRecording
    ) {

      return;

    }


    isStarting = true;


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


      /* =====================================================
         MIME TYPE
         ===================================================== */

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


      /* =====================================================
         MEDIA RECORDER
         ===================================================== */

      mediaRecorder = mimeType
        ? new MediaRecorder(
            mediaStream,
            {
              mimeType
            }
          )
        : new MediaRecorder(
            mediaStream
          );


      /* =====================================================
         DATOS DEL AUDIO
         ===================================================== */

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


      /* =====================================================
         STOP
         ===================================================== */

      mediaRecorder.onstop =
        async () => {

          console.log(
            "[ASSISTANT] MediaRecorder terminó."
          );


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


          /*
           * Ya no necesitamos mantener el recorder.
           */

          mediaRecorder = null;


          if (audioBlob.size === 0) {

            isProcessing = false;

            setIdle();

            return;

          }


          await sendAudio(
            audioBlob
          );

        };


      /* =====================================================
         START
         ===================================================== */

      mediaRecorder.start();


      isRecording = true;
      isStarting = false;


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
      isStarting = false;


      setIdle();

    }

  }


  /* =========================================================
     DETENER GRABACIÓN
     ========================================================= */

  function stopRecording() {

    if (!mediaRecorder) {

      return;

    }


    if (
      mediaRecorder.state === "inactive"
    ) {

      return;

    }


    /*
     * BLOQUEAMOS INMEDIATAMENTE.
     *
     * Antes isProcessing se activaba recién cuando
     * sendAudio() comenzaba. Ahora queda bloqueado
     * desde el mismo Enter que detiene la grabación.
     */

    isRecording = false;
    isProcessing = true;


    assistant.classList.remove(
      "is-listening"
    );


    statusText.textContent =
      "Procesando";


    voiceLabel.textContent =
      "Procesando tu mensaje...";


    console.log(
      "[ASSISTANT] Grabación detenida"
    );


    /*
     * Detenemos el MediaRecorder.
     *
     * Esto dispara onstop(), que después enviará
     * el audio al backend.
     */

    mediaRecorder.stop();

  }


  /* =========================================================
     DETENER TRACKS
     ========================================================= */

  function stopMediaTracks() {

    if (!mediaStream) {

      return;

    }


    mediaStream
      .getTracks()
      .forEach(
        (track) => {

          track.stop();

        }
      );


    mediaStream = null;

  }


  /* =========================================================
     ENVIAR AUDIO
     ========================================================= */

  async function sendAudio(
    audioBlob
  ) {

    /*
     * isProcessing ya se activa en stopRecording().
     */

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
        getApiUrl(
          "assistant/talk"
        );


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
        "[ASSISTANT] Respuesta HTTP:",
        response.status
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


      /* =====================================================
         TRANSCRIPCIÓN
         ===================================================== */

      if (
        data.transcription
      ) {

        addMessage(
          data.transcription,
          "user"
        );

      }


      /* =====================================================
         RESPUESTA
         ===================================================== */

      if (
        data.reply
      ) {

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
     MENSAJES
     ========================================================= */

  function addMessage(
    text,
    type
  ) {

    if (!text) {

      return;

    }


    if (welcome) {

      welcome.style.display =
        "none";

    }


    const message =
      document.createElement(
        "div"
      );


    message.className =
      `message message--${type}`;


    const bubble =
      document.createElement(
        "div"
      );


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
    isProcessing = false;
    isStarting = false;


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
     DEBUG
     ========================================================= */

  console.log(
    "[ASSISTANT] Assistant JS cargado correctamente."
  );


})();