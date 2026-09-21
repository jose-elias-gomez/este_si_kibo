import { InputAction, input } from "../../../shared/js/inputController.js";
import { DEBUG_MODE, getApiUrl } from "../../../shared/js/api/common.js";
import { waitForProcess } from "./processing.js";

const recordingDialog = document.getElementById("recording-dialog");
const micVisualizer = document.querySelector(".mic-visualizer");
const waveCanvas = document.querySelector(".wave-canvas");
const waveCtx = waveCanvas.getContext("2d");
const timerText = document.getElementById("timer");

let audioContext = null;
let analyser = null;
let mediaStream = null;
let sourceNode = null;
let rafId = null;
let sampleIntervalId = null;
let smoothedLevel = 0;

const SAMPLE_INTERVAL_MS = 15;
const SAMPLE_COUNT = 60;

const WAVE_COLOR = "rgba(160, 160, 160, 0.4)";
const WAVE_WIDTH = 2;
const BASE_AMPLITUDE = 0;
const MAX_AMPLITUDE = 60;

const samples = new Array(SAMPLE_COUNT).fill(0);

function resizeWaveCanvas() {
    waveCanvas.width = recordingDialog.clientWidth;
    waveCanvas.height = recordingDialog.clientHeight;
}

function takeSample() {
    // Save actual intensity and discard oldest
    samples.push(smoothedLevel);
    samples.shift();
}

function drawWave() {
    const w = waveCanvas.width;
    const h = waveCanvas.height;
    const midY = h / 1.2;
    const stepX = w / (SAMPLE_COUNT - 1);

    waveCtx.clearRect(0, 0, w, h);
    waveCtx.beginPath();
    waveCtx.strokeStyle = WAVE_COLOR;
    waveCtx.lineWidth = WAVE_WIDTH;
    waveCtx.lineJoin = "round";

    samples.forEach((level, i) => {
        const x = i * stepX;
        // Alterna signo para que se vea como cresta/valle en vez de
        // una sola "montaña" hacia arriba
        const direction = i % 2 === 0 ? 1 : -1;
        const amplitude = BASE_AMPLITUDE + level * (MAX_AMPLITUDE - BASE_AMPLITUDE);
        const y = midY + amplitude * direction;

        if (i === 0) waveCtx.moveTo(x, y);
        else waveCtx.lineTo(x, y);
    });

    waveCtx.stroke();
}

async function startMicVisualizer() {
    try {
        resizeWaveCanvas();
        window.addEventListener("resize", resizeWaveCanvas);

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;

        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        sourceNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.fftSize);

        // Este loop corre cada frame SOLO para tener --intensity fluido
        // en el ícono (scale/fill), que sí se ve mejor sin "escalones"
        const tick = () => {
            analyser.getByteTimeDomainData(dataArray);

            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const normalized = (dataArray[i] - 128) / 128;
                sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);

            const target = Math.min(rms * 4, 1);
            smoothedLevel += (target - smoothedLevel) * 0.3;

            micVisualizer.style.setProperty("--intensity", smoothedLevel.toFixed(3));

            rafId = requestAnimationFrame(tick);
        };

        tick();

        // El muestreo para el canvas va aparte, a intervalo fijo
        sampleIntervalId = setInterval(() => {
            takeSample();
            drawWave();
        }, SAMPLE_INTERVAL_MS);
    } catch (err) {
        console.error("No se pudo acceder al micrófono:", err);
    }
}

function stopMicVisualizer() {
    if (rafId) cancelAnimationFrame(rafId);
    if (sampleIntervalId) clearInterval(sampleIntervalId);
    rafId = null;
    sampleIntervalId = null;

    window.removeEventListener("resize", resizeWaveCanvas);

    if (sourceNode) sourceNode.disconnect();
    if (audioContext) audioContext.close();
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());

    audioContext = null;
    analyser = null;
    sourceNode = null;
    mediaStream = null;
    smoothedLevel = 0;
    samples.fill(0);

    micVisualizer.style.setProperty("--intensity", 0);
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
}

let timer;
let timeRecording = 0;
const CONTEXT = "recording-audio";

export function startRecording() {
    recordingDialog.showModal();
    startMicVisualizer();

    input.pushContext(CONTEXT);

    timeRecording = -1;

    input.on(InputAction.CONFIRM, () => stopRecording(true), CONTEXT);
    input.on(InputAction.BACK, () => stopRecording(), CONTEXT);

    const timerFunction = () => {
        if (++timeRecording >= 10) {
            stopRecording(true);
            return;
        }
        timerText.innerHTML = timeRecording + " / 10s";
        timer = setTimeout(timerFunction, 1000);
    };

    timerFunction();

    if (!DEBUG_MODE) {
        fetch(getApiUrl("assistant/start-recording"), { signal: AbortSignal.timeout(500), method: "POST" });
    }
}

export function stopRecording(sendAudio = false) {
    recordingDialog.close();
    stopMicVisualizer();

    input.popContext();
    clearTimeout(timer);

    if (sendAudio) {
        waitForProcess();
    }

    if (!DEBUG_MODE) {
        fetch(getApiUrl(`assistant/stop-recording?process=${sendAudio}`), {
            signal: AbortSignal.timeout(500),
            method: "POST",
        });
    }
}

recordingDialog.addEventListener("close", stopMicVisualizer);
