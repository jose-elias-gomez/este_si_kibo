import { input, InputAction } from "../../../shared/js/inputController.js";
// ⚠️ Ajustá esta ruta si tu backHandler.js no vive en la misma carpeta que inputController.js
import { setupBackHandler } from "../../../shared/components/backHandler.js";

/**
 * ============================================================
 * DATOS
 * ============================================================
 * Cada seña es una IMAGEN (png). Las tarjetas del grid y la
 * vista de detalle usan la misma imagen.
 */
const ABECEDARIO = "abcdefghijklmnopqrstuvwxyz"
    .split("")
    .map((letra) => ({
        id: letra,
        label: letra.toUpperCase(),
        image: `assets/${letra}.png`,
    }))
    .concat([
        {
            id: "n-tilde",
            label: "Ñ",
            image: "assets/n-tilde.png",
        },
    ]);

/**
 * ============================================================
 * ESTADO
 * ============================================================
 */
const state = {
    cardIndex: 0,
};

/**
 * ============================================================
 * REFERENCIAS DOM
 * ============================================================
 */
const heroTitleEl = document.getElementById("lsa-hero-title");
const heroMetaEl = document.getElementById("lsa-hero-meta");
const gridEl = document.getElementById("lsa-grid");
const detailEl = document.getElementById("lsa-detail");
const detailImageEl = document.getElementById("lsa-detail-image");
const detailIndexEl = document.getElementById("lsa-detail-index");

let detailCleanup = null;

/**
 * ============================================================
 * HERO
 * ============================================================
 */
function renderHero() {
    heroTitleEl.textContent = "Abecedario";
    heroMetaEl.textContent = ABECEDARIO.length === 1 ? "1 seña" : `${ABECEDARIO.length} señas`;
}

/**
 * ============================================================
 * GRID
 * ============================================================
 */
function renderGrid() {
    gridEl.innerHTML = "";

    ABECEDARIO.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "lsa-card";
        card.style.setProperty("--i", index);

        const media = document.createElement("div");
        media.className = "lsa-card-media";

        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = item.label;
        img.src = item.image;

        media.appendChild(img);
        card.appendChild(media);

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
        card.classList.toggle("is-focused", i === index);
    });
    cards[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function render() {
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
    if (ABECEDARIO.length === 0) return;

    const rows = getGridRows();
    const currentRow = rows.findIndex((r) => r.indices.includes(state.cardIndex));
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
        if (currentRow > 0) {
            const targetRow = rows[currentRow - 1];
            nextIndex = targetRow.indices[Math.min(currentCol, targetRow.indices.length - 1)];
        }
    } else if (action === InputAction.DOWN) {
        if (currentRow < rows.length - 1) {
            const targetRow = rows[currentRow + 1];
            nextIndex = targetRow.indices[Math.min(currentCol, targetRow.indices.length - 1)];
        }
    }

    setFocusedCard(nextIndex);
}

/**
 * ============================================================
 * DETALLE (overlay a pantalla completa)
 * ============================================================
 */
function openDetail() {
    const item = ABECEDARIO[state.cardIndex];
    if (!item) return;

    detailImageEl.src = item.image;
    detailImageEl.alt = item.label;
    detailIndexEl.textContent = `Seña ${state.cardIndex + 1} de ${ABECEDARIO.length}`;
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
                setFocusedCard(Math.min(ABECEDARIO.length - 1, state.cardIndex + 1));
                openDetail();
            },
            "LSA_DETAIL"
        );
    }
}

function closeDetail() {
    detailEl.classList.remove("is-open");
    detailImageEl.removeAttribute("src");

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

    input.on(InputAction.UP, () => moveGrid(InputAction.UP), "LSA");
    input.on(InputAction.DOWN, () => moveGrid(InputAction.DOWN), "LSA");
    input.on(InputAction.LEFT, () => moveGrid(InputAction.LEFT), "LSA");
    input.on(InputAction.RIGHT, () => moveGrid(InputAction.RIGHT), "LSA");

    input.on(InputAction.CONFIRM, () => openDetail(), "LSA");
}

// Auto-init si esta página se carga directa (no como módulo importado por un router).
initLsaPage();
