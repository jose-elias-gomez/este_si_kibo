import { input, InputAction } from "../../../shared/js/inputController.js";
// ⚠️ Ajustá esta ruta si tu backHandler.js no vive en la misma carpeta que inputController.js
import { setupBackHandler } from "../../../shared/components/backHandler.js";

/**
 * ============================================================
 * DATOS
 * ============================================================
 * Cada seña es un VIDEO corto (mp4, sin sonido necesario, loop).
 * El "poster" es opcional: una imagen que se ve mientras el video
 * carga. Si no la tenés, el navegador muestra el primer cuadro
 * apenas puede — funciona igual, solo tarda un instante más.
 */
const ABECEDARIO = "abcdefghijklmnopqrstuvwxyz"
  .split("")
  .map((letra) => ({
    id: letra,
    label: letra.toUpperCase(),
    video: `videos/lsa/abecedario/${letra}.mp4`,
    poster: `../../../shared/assets/lsa/alphabet/${letra}.png`,
    category: "abecedario",
  }))
  .concat([
    {
      id: "n-tilde",
      label: "Ñ",
      video: "videos/lsa/abecedario/n-tilde.mp4",
      poster: "../../../shared/assets/lsa/alphabet/n-tilde.png",
      category: "abecedario",
    },
  ]);

const PALABRAS = [
  { id: "hola", label: "Hola" },
  { id: "gracias", label: "Gracias" },
  { id: "por-favor", label: "Por favor" },
  { id: "si", label: "Sí" },
  { id: "no", label: "No" },
  { id: "buenos-dias", label: "Buenos días" },
  { id: "como-estas", label: "Cómo estás" },
  { id: "bien", label: "Bien" },
  { id: "mal", label: "Mal" },
  { id: "nombre", label: "Nombre" },
  { id: "familia", label: "Familia" },
  { id: "agua", label: "Agua" },
  { id: "comer", label: "Comer" },
  { id: "ayuda", label: "Ayuda" },
  { id: "amigo", label: "Amigo" },
].map((p) => ({
  ...p,
  video: `videos/lsa/palabras/${p.id}.mp4`,
  poster: `images/lsa/palabras/${p.id}.jpg`,
  category: "palabras",
}));

const DATA = {
  abecedario: ABECEDARIO,
  palabras: PALABRAS,
};

const CATEGORY_LABELS = {
  abecedario: "Abecedario",
  palabras: "Palabras",
};

const CATEGORIES = ["abecedario", "palabras"];

/**
 * ============================================================
 * ESTADO
 * ============================================================
 */
const state = {
  category: "abecedario",
  focusZone: "grid", // "tabs" | "grid"
  tabIndex: 0,
  cardIndex: 0,
};

/**
 * ============================================================
 * REFERENCIAS DOM
 * ============================================================
 */
const tabsEl = document.getElementById("lsa-tabs");
const tabsIndicatorEl = document.getElementById("lsa-tabs-indicator");
const heroTitleEl = document.getElementById("lsa-hero-title");
const heroMetaEl = document.getElementById("lsa-hero-meta");
const gridEl = document.getElementById("lsa-grid");
const detailEl = document.getElementById("lsa-detail");
const detailVideoEl = document.getElementById("lsa-detail-video");
const detailLabelEl = document.getElementById("lsa-detail-label");
const detailIndexEl = document.getElementById("lsa-detail-index");

let detailCleanup = null;

/**
 * ============================================================
 * TABS
 * ============================================================
 */
function renderTabs() {
  const buttons = Array.from(tabsEl.querySelectorAll(".lsa-tab"));

  buttons.forEach((btn, index) => {
    const cat = btn.dataset.category;
    btn.classList.toggle("is-active", cat === state.category);
    btn.classList.toggle(
      "is-focused",
      state.focusZone === "tabs" && index === state.tabIndex
    );

    btn.onclick = () => {
      state.tabIndex = index;
      selectCategory(cat);
    };
  });

  moveIndicatorToActiveTab();
}

function moveIndicatorToActiveTab() {
  const activeBtn = tabsEl.querySelector(".lsa-tab.is-active");
  if (!activeBtn) return;

  tabsIndicatorEl.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  tabsIndicatorEl.style.width = `${activeBtn.offsetWidth}px`;
}

/**
 * ============================================================
 * HERO
 * ============================================================
 */
function renderHero() {
  const items = DATA[state.category];
  heroTitleEl.textContent = CATEGORY_LABELS[state.category];
  heroMetaEl.textContent =
    items.length === 1 ? "1 seña" : `${items.length} señas`;
}

/**
 * ============================================================
 * GRID
 * ============================================================
 * Se reconstruye SOLO cuando cambia la categoría. Moverse con el
 * mando (setFocusedCard) no recrea los <video>, solo cambia clases
 * y hace play/pause — si no, cada flecha reiniciaría la carga del
 * video entero.
 * ============================================================
 */
function renderGrid() {
  gridEl.innerHTML = "";

  DATA[state.category].forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "lsa-card";
    card.style.setProperty("--i", index);

    const media = document.createElement("div");
    media.className = "lsa-card-media";

    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.poster = item.poster;
    video.src = item.video;

    const caption = document.createElement("div");
    caption.className = "lsa-card-caption";
    caption.textContent = item.label;

    media.appendChild(video);
    card.appendChild(media);
    card.appendChild(caption);

    card.addEventListener("click", () => {
      setFocusedCard(index);
      openDetail();
    });

    gridEl.appendChild(card);
  });

  setFocusedCard(state.cardIndex);
}

function setFocusedCard(index) {
  const cards = Array.from(gridEl.children);
  state.cardIndex = index;

  cards.forEach((card, i) => {
    const video = card.querySelector("video");
    const isFocused = i === index;

    card.classList.toggle("is-focused", isFocused);

    if (isFocused) {
      video.play().catch(() => {});
    } else if (!video.paused) {
      video.pause();
      video.currentTime = 0;
    }
  });
}

function render() {
  renderTabs();
  renderHero();
  renderGrid();
}

/**
 * ============================================================
 * NAVEGACIÓN POR FILAS (para UP/DOWN con mando)
 * Agrupa las cards por su posición Y real en pantalla, así
 * funciona sin importar cuántas columnas entren por resolución.
 * ============================================================
 */
function getGridRows() {
  const cards = Array.from(gridEl.children);
  const rows = [];

  cards.forEach((card, index) => {
    const top = card.offsetTop;
    let row = rows.find((r) => Math.abs(r.top - top) < 4);

    if (!row) {
      row = { top, indices: [] };
      rows.push(row);
    }

    row.indices.push(index);
  });

  return rows;
}

function moveGrid(action) {
  const items = DATA[state.category];
  if (items.length === 0) return;

  const rows = getGridRows();
  const currentRow = rows.findIndex((r) =>
    r.indices.includes(state.cardIndex)
  );
  const currentCol = rows[currentRow]?.indices.indexOf(state.cardIndex) ?? 0;

  let nextIndex = state.cardIndex;

  if (action === InputAction.LEFT) {
    if (currentCol > 0) {
      nextIndex = rows[currentRow].indices[currentCol - 1];
    }
  } else if (action === InputAction.RIGHT) {
    if (currentCol < rows[currentRow].indices.length - 1) {
      nextIndex = rows[currentRow].indices[currentCol + 1];
    }
  } else if (action === InputAction.UP) {
    if (currentRow === 0) {
      state.focusZone = "tabs";
      renderTabs();
      return;
    }
    const targetRow = rows[currentRow - 1];
    nextIndex =
      targetRow.indices[Math.min(currentCol, targetRow.indices.length - 1)];
  } else if (action === InputAction.DOWN) {
    if (currentRow < rows.length - 1) {
      const targetRow = rows[currentRow + 1];
      nextIndex =
        targetRow.indices[Math.min(currentCol, targetRow.indices.length - 1)];
    }
  }

  setFocusedCard(nextIndex);
}

function moveTabs(action) {
  if (action === InputAction.LEFT) {
    state.tabIndex = Math.max(0, state.tabIndex - 1);
  } else if (action === InputAction.RIGHT) {
    state.tabIndex = Math.min(CATEGORIES.length - 1, state.tabIndex + 1);
  } else if (action === InputAction.DOWN) {
    state.focusZone = "grid";
    setFocusedCard(0);
  }

  renderTabs();
}

function selectCategory(cat) {
  if (state.category === cat) return;
  state.category = cat;
  state.cardIndex = 0;
  render();
}

/**
 * ============================================================
 * DETALLE (overlay)
 * ============================================================
 */
function openDetail() {
  const items = DATA[state.category];
  const item = items[state.cardIndex];
  if (!item) return;

  detailVideoEl.poster = item.poster;
  detailVideoEl.src = item.video;
  detailVideoEl.play().catch(() => {});
  detailLabelEl.textContent = item.label;
  detailIndexEl.textContent = `Seña ${state.cardIndex + 1} de ${items.length}`;
  detailEl.classList.add("is-open");

  if (!detailCleanup) {
    detailCleanup = setupBackHandler({
      context: "LSA_DETAIL",
      onBack: closeDetail,
    });

    input.on(
      InputAction.LEFT,
      () => {
        setFocusedCard(Math.max(0, state.cardIndex - 1));
        openDetail();
      },
      "LSA_DETAIL"
    );

    input.on(
      InputAction.RIGHT,
      () => {
        setFocusedCard(
          Math.min(DATA[state.category].length - 1, state.cardIndex + 1)
        );
        openDetail();
      },
      "LSA_DETAIL"
    );

    input.on(
      InputAction.CONFIRM,
      () => {
        if (detailVideoEl.paused) {
          detailVideoEl.play().catch(() => {});
        } else {
          detailVideoEl.pause();
        }
      },
      "LSA_DETAIL"
    );
  }
}

function closeDetail() {
  detailEl.classList.remove("is-open");
  detailVideoEl.pause();
  detailVideoEl.removeAttribute("src");
  detailVideoEl.load();

  if (detailCleanup) {
    detailCleanup();
    detailCleanup = null;
  }
}

/**
 * ============================================================
 * INIT
 * ============================================================
 * @param {Object} options
 * @param {Function} options.onExit - qué hacer al salir de LSA (ej: volver al menú)
 */
export function initLsaPage({ onExit } = {}) {
  render();

  const pageCleanup = setupBackHandler({
    context: "LSA",
    onBack: () => {
      pageCleanup();
      if (typeof onExit === "function") {
        onExit();
      } else {
        window.location.href = "index.html";
      }
    },
  });

  input.on(
    InputAction.UP,
    () => {
      if (state.focusZone === "tabs") return;
      moveGrid(InputAction.UP);
    },
    "LSA"
  );

  input.on(
    InputAction.DOWN,
    () => {
      if (state.focusZone === "tabs") {
        moveTabs(InputAction.DOWN);
      } else {
        moveGrid(InputAction.DOWN);
      }
    },
    "LSA"
  );

  input.on(
    InputAction.LEFT,
    () => {
      if (state.focusZone === "tabs") {
        moveTabs(InputAction.LEFT);
      } else {
        moveGrid(InputAction.LEFT);
      }
    },
    "LSA"
  );

  input.on(
    InputAction.RIGHT,
    () => {
      if (state.focusZone === "tabs") {
        moveTabs(InputAction.RIGHT);
      } else {
        moveGrid(InputAction.RIGHT);
      }
    },
    "LSA"
  );

  input.on(
    InputAction.CONFIRM,
    () => {
      if (state.focusZone === "tabs") {
        selectCategory(CATEGORIES[state.tabIndex]);
        state.focusZone = "grid";
        render();
      } else {
        openDetail();
      }
    },
    "LSA"
  );

  // El indicador de tabs depende de layout ya calculado; lo reubicamos
  // si la ventana cambia de tamaño (responsive).
  window.addEventListener("resize", moveIndicatorToActiveTab);
}

// Auto-init si esta página se carga directa (no como módulo importado por un router).
initLsaPage();