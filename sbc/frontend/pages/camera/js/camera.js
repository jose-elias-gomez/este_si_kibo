import { addPhoto, getPhotoCount } from "./photo-storage.js";
import { initUI, showToast, flashScreen } from "./ui.js";

// localStorage is limited (~5 MB): photos are downscaled so several fit.
const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.7;

const cameraFeed = document.getElementById("cameraFeed");

let mediaStream = null;

export async function startCamera() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("[CAMERA] getUserMedia is not available.");

            return;
        }

        console.log("[CAMERA] Requesting camera access...");

        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
            },

            audio: false,
        });

        cameraFeed.srcObject = mediaStream;

        cameraFeed.muted = true;
        cameraFeed.autoplay = true;
        cameraFeed.playsInline = true;

        await cameraFeed.play();

        console.log("[CAMERA] Camera started.");
    } catch (error) {
        console.error("[CAMERA] Could not access the camera:", error);
    }
}

export function stopCamera() {
    if (!mediaStream) {
        return;
    }

    mediaStream.getTracks().forEach((track) => {
        track.stop();
    });

    mediaStream = null;

    cameraFeed.srcObject = null;

    console.log("[CAMERA] Camera stopped.");
}

/** @returns {boolean} true if the video feed is running and has frames. */
export function isCameraReady() {
    return mediaStream !== null && cameraFeed.videoWidth > 0;
}

/**
 * Grabs the current frame as a downscaled JPEG.
 * The feed is rotated 180° by CSS, so the frame is rotated the same way
 * to match what the user sees on screen.
 * @returns {string | null} JPEG data URL, or null if the camera is not ready.
 */
export function captureFrame() {
    if (!isCameraReady()) {
        return null;
    }

    const scale = Math.min(1, MAX_WIDTH / cameraFeed.videoWidth);
    const width = Math.round(cameraFeed.videoWidth * scale);
    const height = Math.round(cameraFeed.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.translate(width, height);
    ctx.rotate(Math.PI);
    ctx.drawImage(cameraFeed, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function takePhoto() {
    const dataUrl = captureFrame();

    if (!dataUrl) {
        showToast("La cámara no está lista");
        return;
    }

    if (!addPhoto(dataUrl)) {
        showToast("No se pudo guardar la foto");
        return;
    }

    flashScreen();
    showToast(`Foto guardada (${getPhotoCount()})`);
}

initUI({ onTakePhoto: takePhoto, onExit: stopCamera });

startCamera();

window.addEventListener("beforeunload", stopCamera);
