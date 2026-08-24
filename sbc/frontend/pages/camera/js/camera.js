import {
  input,
  InputAction
} from "../../../shared/js/inputController.js";

(() => {
  "use strict";

  // =========================================================
  // CONTEXTO
  // =========================================================

  const CONTEXT = "CAMERA";


  // =========================================================
  // ELEMENTOS
  // =========================================================

  const cameraFeed =
    document.getElementById("cameraFeed");


  // =========================================================
  // ESTADO
  // =========================================================

  let mediaStream = null;


  // =========================================================
  // INICIAR CÁMARA
  // =========================================================

  async function startCamera() {

    try {

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        console.error(
          "[CAMERA] getUserMedia no está disponible."
        );

        return;
      }


      console.log(
        "[CAMERA] Solicitando acceso a la cámara..."
      );


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


      console.log(
        "[CAMERA] Cámara iniciada."
      );

    }

    catch (error) {

      console.error(
        "[CAMERA] No se pudo acceder a la cámara:",
        error
      );

    }

  }


  // =========================================================
  // DETENER CÁMARA
  // =========================================================

  function stopCamera() {

    if (!mediaStream) {
      return;
    }


    mediaStream
      .getTracks()
      .forEach((track) => {

        track.stop();

      });


    mediaStream = null;


    cameraFeed.srcObject = null;


    console.log(
      "[CAMERA] Cámara detenida."
    );

  }


  // =========================================================
  // ESCAPE / BACK
  // =========================================================

  function handleBack() {

    console.log(
      "[CAMERA] BACK"
    );


    // Detener cámara
    stopCamera();


    // Salir del contexto actual
    input.popContext();


    // Volver al Home
    window.location.href =
      "../home/home.html";

  }


  // =========================================================
  // INPUT CONTROLLER
  // =========================================================

  input.pushContext(CONTEXT);


  input.on(
    InputAction.BACK,
    handleBack,
    CONTEXT
  );


  // =========================================================
  // INICIO
  // =========================================================

  startCamera();


  // =========================================================
  // LIMPIEZA
  // =========================================================

  window.addEventListener(
    "beforeunload",
    stopCamera
  );

})();