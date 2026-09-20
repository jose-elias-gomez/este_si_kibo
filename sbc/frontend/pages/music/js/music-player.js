import { SONGS } from "./songs-repo.js";
import { speak } from "../../../shared/js/api/tts.js";

// -------------------------------------------------------
// Parsear el LRC a algo usable: [{time: segundos, text: "..."}]
// -------------------------------------------------------
function parseLyrics(lrc) {
    const lines = [];
    lrc.split("\n").forEach((line) => {
        // formato: [mm:ss.xx]texto
        const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
        if (match) {
            const minutos = parseInt(match[1], 10);
            const segundos = parseFloat(match[2]);
            const time = minutos * 60 + segundos;
            const text = match[3].trim();
            if (text) lines.push({ time, text });
        }
    });
    return lines;
}

// -------------------------------------------------------
// Elementos del DOM
// -------------------------------------------------------
const carouselView = document.getElementById("carousel-view");
const playerView = document.getElementById("player-view");
const track = document.getElementById("carouselTrack");

const player = document.getElementById("player");
const lyricsStage = document.getElementById("lyricsStage");
const playerCover = document.getElementById("playerCover");
const playerTitle = document.getElementById("playerTitle");
const playerAuthor = document.getElementById("playerAuthor");

const curTimeEl = document.getElementById("curTime");
const durTimeEl = document.getElementById("durTime");
const timeTrack = document.getElementById("timeTrack");
const timeFill = document.getElementById("timeFill");

// -------------------------------------------------------
// Estado
// -------------------------------------------------------
let selectedIndex = 0;
let currentView = "carousel"; // 'carousel' | 'player'
let lineasActuales = [];
let ultimaLineaIndex = -1;
let lineEls = [];
let activeLineEl = null;

function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60)
        .toString()
        .padStart(2, "0");
    return `${m}:${s}`;
}

// -------------------------------------------------------
// Construcción del carrusel (una vez, al cargar)
// -------------------------------------------------------
const itemEls = SONGS.map((song, i) => {
    const el = document.createElement("div");
    el.className = "carousel-item";
    el.innerHTML = `
    <div class="carousel-cover" style="${song.cover ? `background-image:url('${song.cover}')` : ""}">
      ${song.cover ? "" : '<span class="no-cover">♪</span>'}
    </div>
    <div class="carousel-meta">
      <div class="carousel-title">${song.title}</div>
      <div class="carousel-author">${song.author}</div>
    </div>
  `;
    el.addEventListener("click", () => {
        if (i === selectedIndex) {
            playSong(i);
        } else {
            selectedIndex = i;
            renderCarousel();
        }
    });
    track.appendChild(el);
    return el;
});

// -------------------------------------------------------
// Renderizar posición de cada tarjeta según la distancia
// al índice seleccionado (efecto "coverflow")
// -------------------------------------------------------
function renderCarousel() {
    itemEls.forEach((el, i) => {
        const offset = i - selectedIndex;
        const abs = Math.abs(offset);

        el.style.transform = `translate(-50%, -50%) translateX(${offset * 320}px) scale(${Math.max(1 - abs * 0.18, 0.55)})`;
        el.style.opacity = abs > 3 ? 0 : Math.max(1 - abs * 0.3, 0.15);
        el.style.zIndex = String(100 - abs);
        el.style.pointerEvents = abs > 3 ? "none" : "auto";
        el.classList.toggle("is-active", offset === 0);
    });
}

function moveSelection(delta) {
    const next = selectedIndex + delta;
    if (next < 0 || next >= SONGS.length) return;
    selectedIndex = next;
    renderCarousel();
}

// -------------------------------------------------------
// Cambiar entre vista de carrusel y vista de reproductor
// -------------------------------------------------------
function showView(view) {
    currentView = view;
    carouselView.classList.toggle("is-active", view === "carousel");
    playerView.classList.toggle("is-active", view === "player");
}

// -------------------------------------------------------
// Reproducir + sincronizar letra
// -------------------------------------------------------
function playSong(index) {
    const song = SONGS[index];
    selectedIndex = index;

    lineasActuales = parseLyrics(song.lyrics);
    ultimaLineaIndex = -1;
    activeLineEl = null;

    // construir las líneas de letra en pantalla
    lyricsStage.innerHTML = "";
    if (lineasActuales.length) {
        lineEls = lineasActuales.map((linea, i) => {
            const div = document.createElement("div");
            div.className = "lyric-line";
            div.dataset.index = i;
            div.textContent = linea.text;
            lyricsStage.appendChild(div);
            return div;
        });
    } else {
        lineEls = [];
        lyricsStage.innerHTML = `<div class="lyric-line is-active">(sin letra sincronizada)</div>`;
    }

    curTimeEl.textContent = "0:00";
    durTimeEl.textContent = "0:00";
    timeFill.style.width = "0%";

    playerTitle.textContent = song.title;
    playerAuthor.textContent = song.author;
    if (song.cover) {
        playerCover.src = song.cover;
        playerCover.style.display = "block";
    } else {
        playerCover.style.display = "none";
    }

    player.src = song.audio;
    player.currentTime = 0;
    player.volume = 0.3;
    player.play();

    showView("player");
    console.log(`▶ Reproduciendo: ${song.title} — ${song.author}`);
}

function stopAndGoBack() {
    if (currentView === "carousel") {
        window.location.href = "../home/home.html";
    } else {
        player.pause();
        showView("carousel");
        renderCarousel();
    }
}

// -------------------------------------------------------
// Controles de mouse (bonus, además del teclado)
// -------------------------------------------------------

// -------------------------------------------------------
// Teclado: flechas + Enter en el carrusel, ESC en el player
// -------------------------------------------------------
window.addEventListener("keydown", (e) => {
    if (currentView === "carousel") {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            moveSelection(-1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            moveSelection(1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            playSong(selectedIndex);
        } else if (e.key === "Escape") {
            e.preventDefault();
            stopAndGoBack();
        }
    } else if (currentView === "player") {
        if (e.key === "Escape") {
            e.preventDefault();
            stopAndGoBack();
        }
    }
});

// -------------------------------------------------------
// Duración total, apenas se conoce
// -------------------------------------------------------
player.addEventListener("loadedmetadata", () => {
    durTimeEl.textContent = formatTime(player.duration);
});

// -------------------------------------------------------
// Sincronización de letra + barra de tiempo en vivo
// -------------------------------------------------------
player.addEventListener("timeupdate", () => {
    const t = player.currentTime;

    // -- barra de tiempo --
    curTimeEl.textContent = formatTime(t);
    if (player.duration) {
        timeFill.style.width = `${(t / player.duration) * 100}%`;
    }

    // -- línea activa de la letra --
    if (!lineasActuales.length) return;

    let idx = -1;
    for (let i = 0; i < lineasActuales.length; i++) {
        if (lineasActuales[i].time <= t) idx = i;
        else break;
    }

    if (idx !== -1 && idx !== ultimaLineaIndex) {
        ultimaLineaIndex = idx;
        const linea = lineasActuales[idx];
        const target = lineEls[idx];
        if (activeLineEl) activeLineEl.classList.remove("is-active");
        if (target) {
            target.classList.add("is-active");
            target.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        activeLineEl = target;
        speak(linea.text);
    }
});

// -------------------------------------------------------
// Click en la barra de tiempo para saltar a ese punto
// -------------------------------------------------------
timeTrack.addEventListener("click", (e) => {
    if (!player.duration) return;
    const rect = timeTrack.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    player.currentTime = ratio * player.duration;
});

// -------------------------------------------------------
// Estado inicial
// -------------------------------------------------------
renderCarousel();
