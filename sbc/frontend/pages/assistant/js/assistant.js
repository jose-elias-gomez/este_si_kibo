/* =========================================================
   ASISTENTE AI — VOZ
   ========================================================= */

(() => {

  "use strict";


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
     SPEECH RECOGNITION
     ========================================================= */

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {

    voiceLabel.textContent =
      "Reconocimiento de voz no disponible";

    statusText.textContent =
      "No disponible";

    micButton.disabled = true;

    console.error(
      "[ASSISTANT] Speech Recognition no está disponible."
    );

    return;

  }


  const recognition =
    new SpeechRecognition();


  recognition.lang =
    "es-AR";

  recognition.continuous =
    false;

  recognition.interimResults =
    false;

  recognition.maxAlternatives =
    1;


  /* =========================================================
     ESTADO
     ========================================================= */

  let isListening = false;

  let isProcessing = false;


  /* =========================================================
     HABLAR
     ========================================================= */

  function speak(text) {

    if (
      !("speechSynthesis" in window)
    ) {

      return;

    }


    window.speechSynthesis.cancel();


    const utterance =
      new SpeechSynthesisUtterance(text);


    utterance.lang =
      "es-AR";

    utterance.rate =
      1;

    utterance.pitch =
      1;


    utterance.onstart = () => {

      statusText.textContent =
        "Hablando";

      voiceLabel.textContent =
        "El asistente está respondiendo";

    };


    utterance.onend = () => {

      statusText.textContent =
        "Listo";

      voiceLabel.textContent =
        "Tocá para hablar";

    };


    window.speechSynthesis.speak(
      utterance
    );

  }


  /* =========================================================
     MENSAJES
     ========================================================= */

  function addMessage(
    text,
    type
  ) {

    /*
     * Ocultar bienvenida.
     */

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
     PROCESAR VOZ
     ========================================================= */

  async function processSpeech(
    text
  ) {

    if (!text.trim()) {

      return;

    }


    isProcessing = true;


    statusText.textContent =
      "Procesando";

    voiceLabel.textContent =
      "Pensando...";


    addMessage(
      text,
      "user"
    );


    try {

      const response =
        await sendToAI(text);


      addMessage(
        response,
        "assistant"
      );


      speak(response);

    }

    catch (error) {

      console.error(
        "[ASSISTANT] Error:",
        error
      );


      const fallback =
        "No pude procesar tu mensaje.";


      addMessage(
        fallback,
        "assistant"
      );


      speak(fallback);

    }

    finally {

      isProcessing = false;

      statusText.textContent =
        "Listo";

      voiceLabel.textContent =
        "Tocá para hablar";

    }

  }


  /* =========================================================
     CONEXIÓN CON IA
     =========================================================

     POR AHORA:

     Simulación local.

     DESPUÉS:

     Esta función debe hacer:

       fetch("/api/chat", {
         method: "POST",
         headers: {
           "Content-Type": "application/json"
         },
         body: JSON.stringify({
           message: text
         })
       })

     Nunca pongas una API key privada
     directamente en este archivo.
     ========================================================= */

  async function sendToAI(text) {

    /*
     * Simulación temporal.
     *
     * Reemplazar por tu backend.
     */

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          700
        )
    );


    return (
      `Entendí que dijiste: ${text}`
    );

  }


  /* =========================================================
     INICIAR RECONOCIMIENTO
     ========================================================= */

  function startListening() {

    if (
      isListening ||
      isProcessing
    ) {

      return;

    }


    /*
     * Detener cualquier síntesis
     * anterior.
     */

    if (
      "speechSynthesis" in window
    ) {

      window.speechSynthesis.cancel();

    }


    try {

      recognition.start();

    }

    catch (error) {

      console.error(
        "[ASSISTANT] No se pudo iniciar reconocimiento:",
        error
      );

    }

  }


  /* =========================================================
     CLICK MICRÓFONO
     ========================================================= */

  micButton.addEventListener(
    "click",
    startListening
  );


  /* =========================================================
     RECONOCIMIENTO — INICIO
     ========================================================= */

  recognition.onstart = () => {

    isListening = true;


    assistant.classList.add(
      "is-listening"
    );


    statusText.textContent =
      "Escuchando";

    voiceLabel.textContent =
      "Hablá ahora";

  };


  /* =========================================================
     RECONOCIMIENTO — RESULTADO
     ========================================================= */

  recognition.onresult = (
    event
  ) => {

    const result =
      event.results[
        event.results.length - 1
      ];


    const text =
      result[0].transcript.trim();


    console.log(
      "[ASSISTANT] Usuario:",
      text
    );


    processSpeech(text);

  };


  /* =========================================================
     RECONOCIMIENTO — FIN
     ========================================================= */

  recognition.onend = () => {

    isListening = false;


    assistant.classList.remove(
      "is-listening"
    );


    if (!isProcessing) {

      statusText.textContent =
        "Listo";

      voiceLabel.textContent =
        "Tocá para hablar";

    }

  };


  /* =========================================================
     RECONOCIMIENTO — ERROR
     ========================================================= */

  recognition.onerror = (
    event
  ) => {

    console.error(
      "[ASSISTANT] Speech error:",
      event.error
    );


    isListening = false;


    assistant.classList.remove(
      "is-listening"
    );


    switch (event.error) {

      case "not-allowed":

        statusText.textContent =
          "Micrófono bloqueado";

        voiceLabel.textContent =
          "Permití el acceso al micrófono";

        break;


      case "no-speech":

        statusText.textContent =
          "Sin voz";

        voiceLabel.textContent =
          "No detecté voz. Tocá para intentar nuevamente";

        break;


      case "audio-capture":

        statusText.textContent =
          "Micrófono no disponible";

        voiceLabel.textContent =
          "Revisá el micrófono";

        break;


      default:

        statusText.textContent =
          "Error";

        voiceLabel.textContent =
          "Tocá para intentar nuevamente";

    }

  };


})();