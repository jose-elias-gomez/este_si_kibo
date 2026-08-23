(() => {

  "use strict";
  

  const cameraFeed =
    document.getElementById("cameraFeed");


  let mediaStream = null;


  /* =========================================================
     INICIAR CÁMARA
     ========================================================= */

  async function startCamera() {

    try {

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        console.error(
          "[TRANSLATOR] getUserMedia no está disponible."
        );

        return;

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


      await cameraFeed.play();


      console.log(
        "[TRANSLATOR] Cámara iniciada."
      );

    }

    catch (error) {

      console.error(
        "[TRANSLATOR] No se pudo acceder a la cámara:",
        error
      );

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

  }


  /* =========================================================
     INICIO AUTOMÁTICO
     ========================================================= */

  startCamera();


  /* =========================================================
     LIMPIEZA
     ========================================================= */

  window.addEventListener(
    "beforeunload",
    stopCamera
  );


})();