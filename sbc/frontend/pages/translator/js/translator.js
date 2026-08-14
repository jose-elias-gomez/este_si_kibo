import { input, InputAction } from "../../../shared/js/inputController.js";

(() => {
  "use strict";

  const CONTEXT = "TRANSLATOR";

  const cameraFrame = document.getElementById("cameraFrame");
  const cameraFeed = document.getElementById("cameraFeed");
  const canvas = document.getElementById("trackingCanvas");
  const ctx = canvas.getContext("2d");
  const signalDot = document.getElementById("signalDot");
  const signalLabel = document.getElementById("signalLabel");

  const currentGlyphEl = document.getElementById("currentGlyph");
  const sentenceTextEl = document.getElementById("sentenceText");
  const caretEl = document.getElementById("caret");

  const captionDock = document.getElementById("captionDock");
  const peekHandle = document.getElementById("peekHandle");

  const btnToggleCamera = document.getElementById("btnToggleCamera");
  const cameraToggleLabel = document.getElementById("cameraToggleLabel");

  const btnSpace = document.getElementById("btnSpace");
  const btnBackspace = document.getElementById("btnBackspace");
  const btnSpeak = document.getElementById("btnSpeak");
  const btnClear = document.getElementById("btnClear");

  const controlItems = Array.from(document.querySelectorAll(".ctrl-btn"));

  let sentence = "";
  let mediaStream = null;
  let trackingRaf = null;
  let trackingPoints = [];
  let panelOpen = false;
  let focusIndex = 0;

  /* ---------- Texto reconocido ---------- */
  function renderSentence() {
    sentenceTextEl.textContent = sentence;
    sentenceTextEl.appendChild(caretEl);
  }
  renderSentence();

  /* Punto de integración: llamar a pushLetter("X") con cada letra
     que devuelva el modelo de reconocimiento en reemplazo del demo. */
  function pushLetter(letter) {
    currentGlyphEl.textContent = letter;
    currentGlyphEl.classList.remove("is-fresh");
    void currentGlyphEl.offsetWidth;
    currentGlyphEl.classList.add("is-fresh");

    sentence += letter;
    renderSentence();
    flashSignal();
  }

  function addSpace() {
    if (sentence === "" || sentence.endsWith(" ")) return;
    sentence += " ";
    renderSentence();
  }

  function backspace() {
    sentence = sentence.slice(0, -1);
    renderSentence();
  }

  function clearAll() {
    sentence = "";
    currentGlyphEl.textContent = "—";
    renderSentence();
  }

  function speak() {
    if (!sentence.trim() || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(sentence.trim());
    utterance.lang = "es-AR";
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  function flashSignal() {
    signalDot.classList.add("is-tracking");
    signalLabel.textContent = "Manos detectadas";
    clearTimeout(flashSignal._t);
    flashSignal._t = setTimeout(() => {
      if (!mediaStream) {
        signalDot.classList.remove("is-tracking");
        signalLabel.textContent = "Sin manos detectadas";
      }
    }, 1400);
  }

  btnSpace.addEventListener("click", addSpace);
  btnBackspace.addEventListener("click", backspace);
  btnClear.addEventListener("click", clearAll);
  btnSpeak.addEventListener("click", speak);

  /* ---------- Cámara ---------- */
  btnToggleCamera.addEventListener("click", toggleCamera);

  async function toggleCamera() {
    if (mediaStream) stopCamera();
    else await startCamera();
  }

  async function startCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      cameraFeed.srcObject = mediaStream;
      cameraFrame.classList.add("is-active");
      btnToggleCamera.classList.add("is-on");
      cameraToggleLabel.textContent = "Detener cámara";
      signalDot.classList.add("is-tracking");
      signalLabel.textContent = "Buscando manos…";
      resizeCanvas();
      startTrackingOverlay();
      startDemoLoop();
      window.addEventListener("resize", resizeCanvas);
    } catch (err) {
      signalLabel.textContent = "No se pudo acceder a la cámara";
      console.error("No se pudo iniciar la cámara:", err);
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    cameraFeed.srcObject = null;
    cameraFrame.classList.remove("is-active");
    btnToggleCamera.classList.remove("is-on");
    cameraToggleLabel.textContent = "Iniciar cámara";
    signalDot.classList.remove("is-tracking");
    signalLabel.textContent = "Sin manos detectadas";
    stopTrackingOverlay();
    stopDemoLoop();
    window.removeEventListener("resize", resizeCanvas);
  }

  /* ---------- Demo de reconocimiento ----------
     Sin modelo conectado todavía: mientras la cámara está activa,
     se van agregando letras de a una para simular el reconocimiento
     en vivo. Reemplazar por la salida real del modelo (pushLetter). */
  const DEMO_QUEUE = "HOLA COMO ESTAS".split("");
  let demoIndex = 0;
  let demoTimer = null;

  function startDemoLoop() {
    demoTimer = setInterval(() => {
      const char = DEMO_QUEUE[demoIndex % DEMO_QUEUE.length];
      demoIndex++;
      if (char === " ") addSpace();
      else pushLetter(char);
    }, 1300);
  }

  function stopDemoLoop() {
    clearInterval(demoTimer);
    demoTimer = null;
  }

  /* ---------- Overlay decorativo de seguimiento (mock) ----------
     Simple animación de puntos que sugiere el área de detección.
     Reemplazar por los landmarks reales del modelo de manos. */
  function resizeCanvas() {
    const rect = cameraFrame.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const spread = Math.min(canvas.width, canvas.height) * 0.16;
    trackingPoints = Array.from({ length: 6 }, (_, i) => ({
      baseX: cx + Math.cos((i / 6) * Math.PI * 2) * spread,
      baseY: cy + Math.sin((i / 6) * Math.PI * 2) * spread,
      phase: i * 0.9,
    }));
  }

  function startTrackingOverlay() {
    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = t / 900;

      ctx.strokeStyle = "rgba(255, 106, 77, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      trackingPoints.forEach((p, i) => {
        const x = p.baseX + Math.sin(time + p.phase) * 6;
        const y = p.baseY + Math.cos(time + p.phase) * 6;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = "#ff6a4d";
      trackingPoints.forEach((p, i) => {
        const x = p.baseX + Math.sin(time + p.phase) * 6;
        const y = p.baseY + Math.cos(time + p.phase) * 6;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      trackingRaf = requestAnimationFrame(draw);
    };
    trackingRaf = requestAnimationFrame(draw);
  }

  function stopTrackingOverlay() {
    if (trackingRaf) cancelAnimationFrame(trackingRaf);
    trackingRaf = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* ---------- Panel deslizable (foco entre controles) ---------- */
  function setFocus(index) {
    focusIndex = (index + controlItems.length) % controlItems.length;
    controlItems.forEach((el, i) => el.classList.toggle("is-focused", i === focusIndex));
  }

  function openPanel() {
    panelOpen = true;
    captionDock.classList.add("is-open");
    peekHandle.classList.add("is-hidden");
    setFocus(0);
  }

  function closePanel() {
    panelOpen = false;
    captionDock.classList.remove("is-open");
    peekHandle.classList.remove("is-hidden");
    controlItems.forEach((el) => el.classList.remove("is-focused"));
  }

  function activateFocused() {
    controlItems[focusIndex]?.click();
  }

  peekHandle.addEventListener("click", openPanel);
  controlItems.forEach((item, i) => {
    item.addEventListener("click", () => setFocus(i));
  });

  /* ---------- Input controller (mando / teclado) ---------- */
  input.pushContext(CONTEXT);

  input.on(InputAction.UP, () => (panelOpen ? closePanel() : openPanel()), CONTEXT);
  input.on(InputAction.DOWN, () => closePanel(), CONTEXT);
  input.on(InputAction.LEFT, () => panelOpen && setFocus(focusIndex - 1), CONTEXT);
  input.on(InputAction.RIGHT, () => panelOpen && setFocus(focusIndex + 1), CONTEXT);
  input.on(InputAction.CONFIRM, () => panelOpen && activateFocused(), CONTEXT);
  input.on(
    InputAction.BACK,
    () => {
      if (panelOpen) {
        closePanel();
      } else {
        input.popContext();
        window.location.href = "../home/translator.html";
      }
    },
    CONTEXT
  );
})();
