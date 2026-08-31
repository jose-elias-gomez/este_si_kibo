import { input, InputAction } from "../../../shared/js/inputController.js";
import { CATEGORIES, allItems } from "./lsa-content.js";
import { handIconSVG } from "./lsa-hand-icon.js";

const GAP = 24;

const TILES = [
  ...CATEGORIES.map((c) => ({ type: "category", category: c, bg: accentBg(c.accent), glow: accentGlow(c.accent) })),
  { type: "quiz", label: "Practicar", icon: "⭐", meta: "Repaso mixto", bg: accentBg("sun"), glow: accentGlow("sun") },
];

function accentBg(accent) {
  return accent === "sun" ? "#3a2f10" : "#132d3f";
}
function accentGlow(accent) {
  return accent === "sun" ? "rgba(244,197,66,0.45)" : "rgba(110,193,228,0.45)";
}

// ============================================================
// Estado
// ============================================================
let screen = "categories"; // "categories" | "lesson" | "quiz"
let index = 0;
let currentCategory = null;
let revealed = false;
let quiz = null; // { questions, index, focus, answered, score }

// ============================================================
// Referencias de DOM fijas (definidas en lsa.html)
// ============================================================
const screenTitle = document.getElementById("screenTitle");
const screenBody = document.getElementById("screenBody");
const hintBar = document.getElementById("hintBar");
const controllerDot = document.getElementById("controllerDot");
const controllerLabel = document.getElementById("controllerLabel");

// Referencias del carrusel: se resuelven de nuevo cada vez que se
// repinta screenBody, porque ese markup se reemplaza por completo.
let scrollContainer = null;
let itemsTrack = null;
let dotsEl = null;

// ============================================================
// Utilidades de carrusel (mismo look & feel que el home: tarjeta
// enfocada grande + glow, vecinas chicas, dots de paginación)
// ============================================================
function currentCarouselItems() {
  return screen === "categories" ? TILES : currentCategory.items;
}

function largeSize() {
  const h = scrollContainer ? scrollContainer.clientHeight : window.innerHeight * 0.5;
  return Math.min(300, window.innerWidth * 0.28, h * (4 / 5));
}
function smallSize() {
  const h = scrollContainer ? scrollContainer.clientHeight : window.innerHeight * 0.5;
  return Math.min(190, window.innerWidth * 0.28, h * (4 / 5) * 0.7);
}

function renderCarouselScreen() {
  screenBody.innerHTML = `
    <div class="scroll-container" id="scrollContainer">
      <div class="items-track" id="itemsTrack"></div>
    </div>
    <div class="dots" id="dots"></div>
  `;
  scrollContainer = document.getElementById("scrollContainer");
  itemsTrack = document.getElementById("itemsTrack");
  dotsEl = document.getElementById("dots");
  renderCarouselItems();
}

function renderCarouselItems() {
  itemsTrack.innerHTML = "";
  const items = currentCarouselItems();

  items.forEach((item, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "item";

    const btn = document.createElement("button");
    btn.className = "item-btn";
    btn.setAttribute("aria-label", tileLabel(item));

    const card = document.createElement("div");
    card.className = "card";
    const isFocused = i === index;
    card.style.width = `${isFocused ? largeSize() : smallSize()}px`;
    card.style.background = tileBg(item);
    card.style.opacity = isFocused ? "1" : "0.68";
    card.style.boxShadow = isFocused
      ? `0 20px 45px -12px ${tileGlow(item)}, 0 6px 16px rgba(0,0,0,0.18)`
      : "0 6px 16px rgba(0,0,0,0.14)";
    if (isFocused) wrapper.classList.add("is-focused");

    card.innerHTML = tileInner(item, isFocused);

    btn.appendChild(card);

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = tileLabel(item);

    wrapper.appendChild(btn);
    wrapper.appendChild(title);
    itemsTrack.appendChild(wrapper);
  });

  layoutTrackPadding();
  scrollToFocused(true);
  renderDots();
}

function tileLabel(item) {
  if (screen === "categories") return item.type === "category" ? item.category.label : item.label;
  return revealed ? item.word : "?";
}
function tileBg(item) {
  if (screen === "categories") return item.bg;
  return "#2C2C2C";
}
function tileGlow(item) {
  if (screen === "categories") return item.glow;
  return "rgba(110,193,228,0.4)";
}
function tileInner(item, isFocused) {
  if (screen === "categories") {
    const icon = item.type === "category" ? item.category.icon : item.icon;
    return `<span class="icon-inner">${icon}</span>`;
  }
  // pantalla "lesson": siempre se ve la seña; la palabra se revela con CONFIRM
  return `<div class="lesson-card-inner">${handIconSVG(item.hand)}</div>`;
}

function layoutTrackPadding() {
  const pad = Math.max(0, (scrollContainer.clientWidth - smallSize()) / 2);
  itemsTrack.style.paddingLeft = `${pad}px`;
  itemsTrack.style.paddingRight = `${pad}px`;
}

function scrollToFocused(instant = false) {
  const large = largeSize();
  const small = smallSize();
  const pad = parseFloat(itemsTrack.style.paddingLeft) || 0;

  let offsetBefore = 0;
  for (let i = 0; i < index; i++) offsetBefore += small + GAP;

  const focusedCenter = pad + offsetBefore + large / 2;
  const target = focusedCenter - scrollContainer.clientWidth / 2;

  scrollContainer.scrollTo({ left: Math.max(0, target), behavior: instant ? "auto" : "smooth" });
}

function renderDots() {
  dotsEl.innerHTML = "";
  currentCarouselItems().forEach((_, d) => {
    const dot = document.createElement("span");
    dot.className = "dot";
    if (index === d) dot.classList.add("active");
    dotsEl.appendChild(dot);
  });
}

function navigate(delta) {
  const items = currentCarouselItems();
  const next = Math.max(0, Math.min(index + delta, items.length - 1));
  if (next === index) return;
  index = next;
  if (screen === "lesson") revealed = false;
  renderCarouselItems();
}

// ============================================================
// Barra de estado del control (arriba a la derecha)
// ============================================================
function watchController() {
  const socket = input.controllerSocket;
  if (!socket) return;
  const setConnected = (on) => {
    controllerDot.classList.toggle("is-connected", on);
    controllerLabel.textContent = on ? "Control conectado" : "Sin control · usá el teclado";
  };
  socket.addEventListener("open", () => setConnected(true));
  socket.addEventListener("close", () => setConnected(false));
  socket.addEventListener("error", () => setConnected(false));
}

function renderHints(items) {
  hintBar.innerHTML = items
    .map((h) => `<span class="hint-item"><span class="hint-key">${h.key}</span>${h.label}</span>`)
    .join("");
}

// ============================================================
// Pantalla: categorías (raíz de la app)
// ============================================================
function goToCategories() {
  screen = "categories";
  currentCategory = null;
  index = 0;
  screenTitle.textContent = "Lengua de Señas Argentina";
  input.off("LESSON");
  input.off("QUIZ");
  renderCarouselScreen();
  renderHints([
    { key: "↔", label: "Moverse" },
    { key: "⏎", label: "Elegir" },
    { key: "Esc", label: "Salir" },
  ]);
}

function selectTile() {
  const tile = TILES[index];
  if (tile.type === "category") {
    openLesson(tile.category);
  } else {
    openQuiz();
  }
}

// ============================================================
// Pantalla: lección (carrusel de señas de una categoría)
// ============================================================
function openLesson(category) {
  currentCategory = category;
  screen = "lesson";
  index = 0;
  revealed = false;
  screenTitle.textContent = category.label;
  input.pushContext("LESSON");
  renderCarouselScreen();
  renderLessonNote();
  bindLessonInput();
}

function renderLessonNote() {
  let noteEl = document.getElementById("lessonNote");
  if (!noteEl) {
    noteEl = document.createElement("div");
    noteEl.id = "lessonNote";
    noteEl.className = "flashcard-note";
    screenBody.appendChild(noteEl);
  }
  const item = currentCategory.items[index];
  noteEl.textContent = revealed ? item.note : "Confirmá para ver la palabra y la explicación.";
  renderHints([
    { key: "↔", label: "Cambiar seña" },
    { key: "⏎", label: revealed ? "Ocultar" : "Revelar" },
    { key: "Esc", label: "Volver" },
  ]);
}

function bindLessonInput() {
  input.off("LESSON");
  input.on(InputAction.RIGHT, () => { navigate(1); renderLessonNote(); }, "LESSON");
  input.on(InputAction.LEFT, () => { navigate(-1); renderLessonNote(); }, "LESSON");
  input.on(InputAction.CONFIRM, () => {
    revealed = !revealed;
    renderCarouselItems();
    renderLessonNote();
  }, "LESSON");
  input.on(InputAction.BACK, () => {
    input.popContext();
    goToCategories();
  }, "LESSON");
}

// ============================================================
// Pantalla: quiz (lista vertical de opciones — no carrusel)
// ============================================================
function openQuiz() {
  const pool = shuffle(allItems()).slice(0, 6);
  const questions = pool.map((correct) => ({
    correct,
    options: shuffle([correct, ...shuffle(allItems().filter((it) => it.word !== correct.word)).slice(0, 2)]),
  }));
  quiz = { questions, index: 0, focus: 0, answered: false, score: 0 };
  screen = "quiz";
  screenTitle.textContent = "Practicar";
  input.pushContext("QUIZ");
  renderQuiz();
  bindQuizInput();
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderQuiz() {
  const q = quiz.questions[quiz.index];
  screenBody.innerHTML = `
    <div class="quiz-view">
      <div class="quiz-prompt">Pregunta ${quiz.index + 1} de ${quiz.questions.length} · Puntos: <span class="quiz-score">${quiz.score}</span></div>
      <div class="card quiz-card">${handIconSVG(q.correct.hand)}</div>
      <div class="quiz-options">
        ${q.options.map((opt, i) => quizOptionMarkup(opt, i)).join("")}
      </div>
    </div>
  `;
  renderHints(quiz.answered
    ? [{ key: "⏎", label: "Siguiente" }, { key: "Esc", label: "Salir" }]
    : [{ key: "↕", label: "Moverse" }, { key: "⏎", label: "Responder" }, { key: "Esc", label: "Salir" }]
  );
}

function quizOptionMarkup(opt, i) {
  const q = quiz.questions[quiz.index];
  let cls = "quiz-option";
  if (i === quiz.focus) cls += " is-focused";
  if (quiz.answered) {
    if (opt.word === q.correct.word) cls += " is-correct";
    else if (i === quiz.focus) cls += " is-incorrect";
  }
  return `<div class="${cls}">${opt.word}</div>`;
}

function bindQuizInput() {
  input.off("QUIZ");
  input.on(InputAction.UP, () => moveQuizFocus(-1), "QUIZ");
  input.on(InputAction.DOWN, () => moveQuizFocus(1), "QUIZ");
  input.on(InputAction.CONFIRM, () => confirmQuiz(), "QUIZ");
  input.on(InputAction.BACK, () => {
    input.popContext();
    goToCategories();
  }, "QUIZ");
}

function moveQuizFocus(delta) {
  if (quiz.answered) return;
  const count = quiz.questions[quiz.index].options.length;
  quiz.focus = (quiz.focus + delta + count) % count;
  renderQuiz();
}

function confirmQuiz() {
  const q = quiz.questions[quiz.index];
  if (!quiz.answered) {
    quiz.answered = true;
    if (q.options[quiz.focus].word === q.correct.word) quiz.score += 1;
    renderQuiz();
    return;
  }
  if (quiz.index + 1 < quiz.questions.length) {
    quiz.index += 1;
    quiz.focus = 0;
    quiz.answered = false;
    renderQuiz();
  } else {
    input.popContext();
    goToCategories();
  }
}

// ============================================================
// Input global de la pantalla "categorías" (GLOBAL, como en home.js)
// ============================================================
input.on(InputAction.RIGHT, () => { if (screen === "categories") navigate(1); });
input.on(InputAction.LEFT, () => { if (screen === "categories") navigate(-1); });
input.on(InputAction.CONFIRM, () => { if (screen === "categories") selectTile(); });
input.on(InputAction.BACK, () => {
  if (screen === "categories") window.location.href = "../home/home.html";
});

window.addEventListener("resize", () => {
  if (screen !== "quiz") renderCarouselItems();
});

// ============================================================
// Arranque
// ============================================================
document.body.classList.add("no-transitions");
watchController();
goToCategories();
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.body.classList.remove("no-transitions"));
});
