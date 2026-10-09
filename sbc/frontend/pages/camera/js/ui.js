import { getApiUrl } from "../../../shared/js/api/common.js";
import { input, InputAction } from "../../../shared/js/inputController.js";
import { getPhotoCount, getPhoto, deletePhoto } from "./photo-storage.js";

const GALLERY_CONTEXT = "gallery";
const EMAIL_CONTEXT = "email-dialog";

const DEFAULT_SUBJECT = "Mira la foto que tomé";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const shutterButton = document.getElementById("shutterButton");
const flash = document.getElementById("flash");
const toast = document.getElementById("toast");

const gallery = document.getElementById("gallery");
const galleryImage = document.getElementById("galleryImage");
const galleryDate = document.getElementById("galleryDate");
const galleryCounter = document.getElementById("galleryCounter");
const galleryStatus = document.getElementById("galleryStatus");

const emailDialog = document.getElementById("emailDialog");
const emailTitle = document.getElementById("emailTitle");
const emailSubject = document.getElementById("emailSubject");
const emailRecipient = document.getElementById("emailRecipient");
const emailSend = document.getElementById("emailSend");
const emailStatus = document.getElementById("emailStatus");

// Navigable items of the email dialog, top to bottom.
const emailItems = [emailTitle, emailSubject, emailRecipient, emailSend];
const emailFields = [emailTitle, emailSubject, emailRecipient];

let onTakePhoto = null;
let onExit = null;
let currentIndex = 0;
let emailFocusIndex = 0;
let sending = false;
let toastTimer = null;

function formatDate(iso) {
    const date = new Date(iso);

    const day = date.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
    const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    return `${day}, ${time}`;
}

function writeStatus(element, text, type = "") {
    element.textContent = text;
    element.className = "gallery-status" + (type ? ` ${type}` : "");
}

function setStatus(text, type) {
    writeStatus(galleryStatus, text, type);
}

function setEmailStatus(text, type) {
    writeStatus(emailStatus, text, type);
}

function renderPhoto() {
    const photo = getPhoto(currentIndex);

    galleryImage.src = photo.dataUrl;
    galleryDate.textContent = formatDate(photo.createdAt);
    galleryCounter.textContent = `${currentIndex + 1} / ${getPhotoCount()}`;
    setStatus("");
}

function navigate(delta) {
    const count = getPhotoCount();

    if (count === 0 || sending) {
        return;
    }

    currentIndex = (currentIndex + delta + count) % count;
    renderPhoto();
}

function deleteCurrent() {
    if (getPhotoCount() === 0 || sending) {
        return;
    }

    deletePhoto(getPhoto(currentIndex).id);

    const count = getPhotoCount();

    if (count === 0) {
        closeGallery();
        showToast("Foto borrada");
        return;
    }

    currentIndex = Math.min(currentIndex, count - 1);
    renderPhoto();
    setStatus("Foto borrada", "ok");
}

function scrollEmailFocusIntoView() {
    const isFirst = emailFocusIndex === 0;
    const isLast = emailFocusIndex === emailItems.length - 1;

    if (isFirst) {
        emailDialog.scrollTo({ top: 0, behavior: "smooth" });
    } else if (isLast) {
        emailDialog.scrollTo({ top: emailDialog.scrollHeight, behavior: "smooth" });
    } else {
        emailItems[emailFocusIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
}

function setEmailFocus(index) {
    emailFocusIndex = Math.min(Math.max(index, 0), emailItems.length - 1);

    emailItems.forEach((item, i) => {
        const focused = i === emailFocusIndex;

        if (item === emailSend) {
            item.classList.toggle("hovered", focused);
        } else if (focused) {
            item.hover();
        } else {
            item.unhover();
        }
    });

    scrollEmailFocusIntoView();
}

function moveEmailFocus(delta) {
    if (sending) {
        return;
    }

    setEmailFocus(emailFocusIndex + delta);
}

function confirmEmailItem() {
    if (sending) {
        return;
    }

    const item = emailItems[emailFocusIndex];

    if (item === emailSend) {
        sendCurrentByEmail();
    } else {
        // Opens the virtual keyboard; when it closes, input comes back to EMAIL_CONTEXT.
        item.select();
    }
}

function openEmailDialog() {
    if (getPhotoCount() === 0 || sending) {
        return;
    }

    const photo = getPhoto(currentIndex);

    emailTitle.text = formatDate(photo.createdAt);
    emailSubject.text = DEFAULT_SUBJECT;
    emailRecipient.clear();

    setEmailStatus("");

    input.pushContext(EMAIL_CONTEXT);
    input.on(InputAction.UP, () => moveEmailFocus(-1), EMAIL_CONTEXT);
    input.on(InputAction.DOWN, () => moveEmailFocus(1), EMAIL_CONTEXT);
    input.on(InputAction.CONFIRM, confirmEmailItem, EMAIL_CONTEXT);
    input.on(InputAction.BACK, closeEmailDialog, EMAIL_CONTEXT);

    emailDialog.showModal();

    // showModal() focuses the first focusable element (the Send button) and
    // scrolls down to it. Reset to the top, then focus the first field
    // (this must run AFTER showModal: a closed dialog cannot scroll).
    emailDialog.scrollTop = 0;
    setEmailFocus(0);
}

function closeEmailDialog() {
    if (sending || !emailDialog.open) {
        return;
    }

    input.popContext();
    emailDialog.close();
}

async function sendCurrentByEmail() {
    if (getPhotoCount() === 0 || sending) {
        return;
    }

    const photo = getPhoto(currentIndex);

    // Title and subject fall back to their defaults if left empty.
    const title = emailTitle.getText().trim() || formatDate(photo.createdAt);
    const subject = emailSubject.getText().trim() || DEFAULT_SUBJECT;
    const recipient = emailRecipient.getText().trim();

    if (!recipient) {
        setEmailStatus("El destinatario es obligatorio", "error");
        setEmailFocus(2);
        return;
    }

    if (!EMAIL_REGEX.test(recipient)) {
        setEmailStatus("El destinatario no es un email válido", "error");
        setEmailFocus(2);
        return;
    }

    sending = true;
    setEmailStatus("Enviando...");

    let sent = false;

    try {
        const blob = await (await fetch(photo.dataUrl)).blob();

        const form = new FormData();
        form.append("title", title);
        form.append("subject", subject);
        form.append("to", recipient);
        form.append("image", blob, "foto.jpg");

        const response = await fetch(getApiUrl("email"), {
            method: "POST",
            body: form,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        sent = true;
    } catch (error) {
        console.error("[UI] Error sending the email:", error);
    } finally {
        sending = false;
    }

    if (sent) {
        closeEmailDialog();
        setStatus(`Enviada a ${recipient}`, "ok");
    } else {
        setEmailStatus("No se pudo enviar el email", "error");
    }
}

export function initUI(handlers) {
    onTakePhoto = handlers.onTakePhoto;
    onExit = handlers.onExit;

    shutterButton.addEventListener("click", () => onTakePhoto?.());

    input.on(InputAction.UP, () => openGallery());
    input.on(InputAction.CONFIRM, () => onTakePhoto?.());
    input.on(InputAction.BACK, () => {
        onExit?.();
        window.location.href = "../home/home.html";
    });

    // Esc closes <dialog> natively: closing is handled through BACK instead.
    gallery.addEventListener("cancel", (event) => event.preventDefault());
    emailDialog.addEventListener("cancel", (event) => event.preventDefault());

    // While a field is being edited (virtual keyboard open), show only that
    // field so the keyboard does not cover it.
    const observer = new MutationObserver(() => {
        const editing = emailFields.some((field) => field.classList.contains("selected"));
        const wasEditing = emailDialog.classList.contains("editing");

        emailDialog.classList.toggle("editing", editing);

        // The other items reappear and the layout changes: restore the scroll.
        if (wasEditing && !editing) {
            requestAnimationFrame(scrollEmailFocusIntoView);
        }
    });

    emailFields.forEach((field) => {
        observer.observe(field, { attributes: true, attributeFilter: ["class"] });
    });
}

export function showToast(text) {
    toast.textContent = text;
    toast.classList.add("visible");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
}

export function flashScreen() {
    flash.classList.remove("active");
    void flash.offsetWidth; // restarts the animation
    flash.classList.add("active");
}

export function openGallery() {
    const count = getPhotoCount();

    if (count === 0) {
        showToast("No hay fotos todavía");
        return;
    }

    currentIndex = count - 1;
    renderPhoto();

    if (!gallery.open) {
        input.pushContext(GALLERY_CONTEXT);
        input.on(InputAction.UP, openEmailDialog, GALLERY_CONTEXT);
        input.on(InputAction.DOWN, deleteCurrent, GALLERY_CONTEXT);
        input.on(InputAction.LEFT, () => navigate(-1), GALLERY_CONTEXT);
        input.on(InputAction.RIGHT, () => navigate(1), GALLERY_CONTEXT);
        input.on(InputAction.BACK, closeGallery, GALLERY_CONTEXT);
        gallery.showModal();
    }
}

export function closeGallery() {
    if (gallery.open) {
        input.popContext();
        gallery.close();
    }
}
