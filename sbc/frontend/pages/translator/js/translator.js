import {
  input,
  InputAction
} from "../../../shared/js/inputController.js";

(() => {

  "use strict";


  /* =========================================================
     CONTEXTO
     ========================================================= */

  const CONTEXT = "TRANSLATOR";

  const WS_URL =
    "ws://localhost:25566/api/translator/ws";

  const FRAME_INTERVAL = 80;
  const JPEG_QUALITY = 0.65;


  /* =========================================================
     ELEMENTOS
     ========================================================= */

  const cameraFrame =
    document.getElementById("cameraFrame");

  const cameraFeed =
    document.getElementById("cameraFeed");

  const signalDot =
    document.getElementById("signalDot");

  const signalLabel =
    document.getElementById("signalLabel");

  const captionDock =
    document.getElementById("captionDock");

  const peekHandle =
    document.getElementById("peekHandle");

  const currentGlyph =
    document.getElementById("currentGlyph");

  const translatorWord =
    document.getElementById("translatorWord");


  /* =========================================================
     ESTADO
     ========================================================= */

  let mediaStream = null;
  let panelOpen = false;

  let socket = null;
  let socketReady = false;

  let canvas = null;
  let sendTimer = null;

  let currentWord = "";


  /* =========================================================
     CÁMARA
     ========================================================= */

  async function startCamera() {

    try {

      console.log(
        "[TRANSLATOR] Solicitando cámara..."
      );

      signalLabel.textContent =
        "Solicitando acceso…";


      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        throw new Error(
          "getUserMedia no está disponible"
        );

      }


      mediaStream =
        await navigator.mediaDevices.getUserMedia({

          video: {
            facingMode: "user"
          },

          audio: false

        });


      cameraFeed.srcObject =
        mediaStream;

      cameraFeed.muted = true;
      cameraFeed.autoplay = true;
      cameraFeed.playsInline = true;


      await cameraFeed.play();


      cameraFrame.classList.add(
        "is-active"
      );


      signalDot.classList.add(
        "is-tracking"
      );


      signalLabel.textContent =
        "Cámara activa";


      console.log(
        "[TRANSLATOR] Cámara iniciada correctamente."
      );


      startCanvas();

    }

    catch (error) {

      console.error(
        "[TRANSLATOR] Error de cámara:",
        error
      );


      signalDot.classList.remove(
        "is-tracking"
      );


      switch (error.name) {

        case "NotAllowedError":

          signalLabel.textContent =
            "Permiso de cámara rechazado";

          break;


        case "NotFoundError":

          signalLabel.textContent =
            "No se encontró una cámara";

          break;


        case "NotReadableError":

          signalLabel.textContent =
            "La cámara está siendo usada";

          break;


        case "SecurityError":

          signalLabel.textContent =
            "Acceso a cámara bloqueado";

          break;


        default:

          signalLabel.textContent =
            "No se pudo acceder a la cámara";

      }

    }

  }


  /* =========================================================
     CANVAS
     ========================================================= */

  function startCanvas() {

    canvas =
      document.createElement("canvas");

    canvas.width =
      cameraFeed.videoWidth || 640;

    canvas.height =
      cameraFeed.videoHeight || 480;

    startSendingFrames();

  }


  /* =========================================================
     DETENER CÁMARA
     ========================================================= */

  function stopCamera() {

    if (sendTimer) {

      clearInterval(
        sendTimer
      );

      sendTimer = null;

    }


    if (socket) {

      try {

        socket.close();

      }

      catch (error) {

        console.error(error);

      }

      socket = null;

    }


    socketReady = false;


    if (mediaStream) {

      mediaStream
        .getTracks()
        .forEach((track) => {

          track.stop();

        });

      mediaStream = null;

    }


    cameraFeed.srcObject =
      null;


    cameraFrame.classList.remove(
      "is-active"
    );


    signalDot.classList.remove(
      "is-tracking"
    );


    signalLabel.textContent =
      "Cámara detenida";

  }


  /* =========================================================
     PANEL
     ========================================================= */

  function openPanel() {

    panelOpen = true;


    captionDock.classList.add(
      "is-open"
    );


    peekHandle.classList.add(
      "is-hidden"
    );

  }


  function closePanel() {

    panelOpen = false;


    captionDock.classList.remove(
      "is-open"
    );


    peekHandle.classList.remove(
      "is-hidden"
    );

  }


  /* =========================================================
     FLECHA
     ========================================================= */

  peekHandle.addEventListener(
    "click",
    () => {

      if (panelOpen) {

        closePanel();

      }

      else {

        openPanel();

      }

    }
  );


  /* =========================================================
     MOSTRAR SEÑA
     ========================================================= */

  function showSign(sign) {

    if (
      sign === null ||
      sign === undefined ||
      sign === ""
    ) {

      return;

    }


    currentGlyph.textContent =
      sign;


    currentGlyph.classList.remove(
      "is-fresh"
    );


    void currentGlyph.offsetWidth;


    currentGlyph.classList.add(
      "is-fresh"
    );

  }


  window.showSign =
    showSign;


  /* =========================================================
     ACTUALIZAR PALABRA
     ========================================================= */

  function updateWord(word) {
  currentWord = word || "";

  console.log(
    "[TRANSLATOR] Mostrando palabra:",
    currentWord
  );

  if (!translatorWord) {
    console.error(
      "[TRANSLATOR] No existe #translatorWord"
    );
    return;
  }

  translatorWord.textContent = currentWord;
}


  /* =========================================================
     WEBSOCKET
     ========================================================= */

  function connectSocket() {

    if (
      socket &&
      socket.readyState === WebSocket.OPEN
    ) {

      return;

    }


    console.log(
      "[TRANSLATOR] Conectando WebSocket..."
    );


    socket =
      new WebSocket(WS_URL);


    socket.binaryType =
      "arraybuffer";


    socket.onopen = () => {

      console.log(
        "[TRANSLATOR] WebSocket conectado."
      );

      socketReady = true;

    };


    socket.onmessage = (event) => {

      try {

        const data =
          JSON.parse(event.data);

        handleBackendMessage(
          data
        );

      }

      catch (error) {

        console.error(
          "[TRANSLATOR] Error JSON:",
          error
        );

      }

    };


    socket.onerror = (error) => {

      console.error(
        "[TRANSLATOR] WebSocket error:",
        error
      );

      socketReady = false;

    };


    socket.onclose = () => {

      console.log(
        "[TRANSLATOR] WebSocket cerrado."
      );

      socketReady = false;

    };

  }


  /* =========================================================
     MENSAJES DEL BACKEND
     ========================================================= */

  function handleBackendMessage(data) {
  console.log("[TRANSLATOR] Backend:", data);

  if (data.type === "error") {
    console.error(
      "[TRANSLATOR] Backend error:",
      data.message
    );
    return;
  }

  if (data.type === "word") {
    console.log(
      "[TRANSLATOR] WORD:",
      data.word
    );

    updateWord(data.word);
    return;
  }

  if (data.type !== "prediction") {
    return;
  }

  if (data.prediction) {
    showSign(data.prediction);
  }

  if (
    data.confirmed &&
    data.confirmed_letter
  ) {
    console.log(
      "[TRANSLATOR] LETRA CONFIRMADA:",
      data.confirmed_letter
    );

    showSign(data.confirmed_letter);
  }

  if (
    typeof data.word === "string"
  ) {
    console.log(
      "[TRANSLATOR] PALABRA:",
      data.word
    );

    updateWord(data.word);
  }
}


  /* =========================================================
     COMANDOS
     ========================================================= */

  function sendCommand(command) {

    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {

      return;

    }


    socket.send(
      JSON.stringify({
        command: command
      })
    );

  }


  function addSpace() {

    sendCommand(
      "SPACE"
    );

  }


  function deleteLast() {

    sendCommand(
      "DELETE"
    );

  }


  function clearWord() {

    sendCommand(
      "CLEAR"
    );

  }


  /* =========================================================
     ENVIAR FRAMES
     ========================================================= */

  function startSendingFrames() {

    if (sendTimer) {

      clearInterval(
        sendTimer
      );

    }


    sendTimer =
      setInterval(
        sendFrame,
        FRAME_INTERVAL
      );

  }


  function sendFrame() {

    if (
      !mediaStream ||
      !socketReady ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !canvas
    ) {

      return;

    }


    const context =
      canvas.getContext("2d");


    context.drawImage(
      cameraFeed,
      0,
      0,
      canvas.width,
      canvas.height
    );


    canvas.toBlob(

      (blob) => {

        if (!blob) {

          return;

        }


        if (
          socket &&
          socket.readyState ===
            WebSocket.OPEN
        ) {

          socket.send(
            blob
          );

        }

      },

      "image/jpeg",

      JPEG_QUALITY

    );

  }


  /* =========================================================
     INICIO
     ========================================================= */

  startCamera();

  connectSocket();


  /* =========================================================
     INPUT CONTROLLER
     ========================================================= */

  input.pushContext(
    CONTEXT
  );


  input.on(

    InputAction.UP,

    () => {

      if (panelOpen) {

        closePanel();

      }

      else {

        openPanel();

      }

    },

    CONTEXT

  );


  input.on(

    InputAction.DOWN,

    () => {

      closePanel();

    },

    CONTEXT

  );


  input.on(

    InputAction.BACK,

    () => {

      stopCamera();

      input.popContext();

      window.location.href =
        "../home/home.html";

    },

    CONTEXT

  );


})();
