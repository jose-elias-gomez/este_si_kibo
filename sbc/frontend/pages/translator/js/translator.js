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


  /* =========================================================
     ESTADO
     ========================================================= */

  let mediaStream = null;

  let panelOpen = false;


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


      /*
       * Verificación de compatibilidad.
       */

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        throw new Error(
          "getUserMedia no está disponible"
        );

      }


      /*
       * Solicitar cámara.
       */

      mediaStream =
        await navigator.mediaDevices.getUserMedia({

          video: {
            facingMode: "user"
          },

          audio: false

        });


      /*
       * Conectar stream al video.
       */

      cameraFeed.srcObject =
        mediaStream;


      cameraFeed.muted = true;

      cameraFeed.autoplay = true;

      cameraFeed.playsInline = true;


      /*
       * Iniciar reproducción.
       */

      await cameraFeed.play();


      /*
       * Mostrar cámara.
       */

      cameraFrame.classList.add(
        "is-active"
      );


      /*
       * Mostrar estado activo.
       */

      signalDot.classList.add(
        "is-tracking"
      );


      signalLabel.textContent =
        "Cámara activa";


      console.log(
        "[TRANSLATOR] Cámara iniciada correctamente."
      );

    }

    catch (error) {

      console.error(
        "[TRANSLATOR] Error de cámara:",
        error
      );


      signalDot.classList.remove(
        "is-tracking"
      );


      /*
       * Mensajes específicos.
       */

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
     DETENER CÁMARA
     ========================================================= */

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

      } else {

        openPanel();

      }

    }
  );


  /* =========================================================
     MOSTRAR SEÑA
     =========================================================

     Esta función queda preparada para conectar
     el modelo real de reconocimiento.

     Ejemplo:

       window.showSign("A");

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


    /*
     * Reiniciar animación.
     */

    currentGlyph.classList.remove(
      "is-fresh"
    );


    void currentGlyph.offsetWidth;


    currentGlyph.classList.add(
      "is-fresh"
    );

  }


  /*
   * Hacer disponible para el modelo
   * de reconocimiento.
   */

  window.showSign =
    showSign;


  /* =========================================================
     INICIO AUTOMÁTICO
     ========================================================= */

  startCamera();


  /* =========================================================
     INPUT CONTROLLER
     ========================================================= */

  input.pushContext(
    CONTEXT
  );


  /*
   * UP
   *
   * Abrir/cerrar panel.
   */

  input.on(

    InputAction.UP,

    () => {

      if (panelOpen) {

        closePanel();

      } else {

        openPanel();

      }

    },

    CONTEXT

  );


  /*
   * DOWN
   *
   * Cerrar panel.
   */

  input.on(

    InputAction.DOWN,

    () => {

      closePanel();

    },

    CONTEXT

  );


  /*
   * BACK
   *
   * Salir.
   */

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