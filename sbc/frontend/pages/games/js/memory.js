import { input, InputAction } from "../../../shared/js/inputController.js";
import { setupBackHandler } from "../../../shared/components/backHandler.js";

const ICONS = ["🍎", "🍌", "🍇", "🍒", "🍉", "🍋", "🍓", "🍍"];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function mountMemory(container, exitToMenu) {
    const screen = document.createElement("div");
    screen.className = "screen";
    screen.innerHTML = `
    <div class="game-topbar">
      <button class="back-btn" id="mem-back">← Volver</button>
      <h1 class="uppercase-text">Memoria</h1>
      <span class="topbar-spacer"></span>
    </div>
    <div class="memory-grid"></div>
    <div class="game-status"></div>
  `;
    container.appendChild(screen);

    const gridEl = screen.querySelector(".memory-grid");
    const statusEl = screen.querySelector(".game-status");
    const backBtn = screen.querySelector("#mem-back");

    let cards = shuffle([...ICONS, ...ICONS]).map((icon) => ({
        icon,
        flipped: false,
        matched: false,
    }));
    let cursor = 0;
    let flippedIndices = [];
    let lock = false;
    let moves = 0;
    let timeoutId = null;

    const cardEls = cards.map((_, i) => {
        const div = document.createElement("div");
        div.className = "memory-card";
        div.addEventListener("click", () => {
            cursor = i;
            flip(i);
        });
        div.addEventListener("mouseenter", () => {
            cursor = i;
            render();
        });
        gridEl.appendChild(div);
        return div;
    });

    function render() {
        cards.forEach((card, i) => {
            const el = cardEls[i];
            const showFace = card.flipped || card.matched;
            el.textContent = showFace ? card.icon : "";
            el.classList.toggle("flipped", showFace);
            el.classList.toggle("matched", card.matched);
            el.classList.toggle("selected", i === cursor);
        });
        statusEl.textContent = `Movimientos: ${moves}`;
    }

    function flip(i) {
        if (lock || cards[i].flipped || cards[i].matched) return;
        cards[i].flipped = true;
        flippedIndices.push(i);
        render();

        if (flippedIndices.length === 2) {
            moves++;
            lock = true;
            const [a, b] = flippedIndices;
            if (cards[a].icon === cards[b].icon) {
                cards[a].matched = true;
                cards[b].matched = true;
                flippedIndices = [];
                lock = false;
                render();
                if (cards.every((c) => c.matched)) {
                    statusEl.textContent = `¡Completaste el juego en ${moves} movimientos!`;
                }
            } else {
                timeoutId = setTimeout(() => {
                    cards[a].flipped = false;
                    cards[b].flipped = false;
                    flippedIndices = [];
                    lock = false;
                    render();
                }, 700);
            }
        }
    }

    function moveCursor(dx, dy) {
        let x = cursor % 4;
        let y = Math.floor(cursor / 4);
        x = (x + dx + 4) % 4;
        y = (y + dy + 4) % 4;
        cursor = y * 4 + x;
        render();
    }

    render();

    backBtn.addEventListener("click", () => exitToMenu());

    const removeBackHandler = setupBackHandler({
        context: "MEMORY",
        onBack: exitToMenu,
    });
    input.on(InputAction.LEFT, () => moveCursor(-1, 0), "MEMORY");
    input.on(InputAction.RIGHT, () => moveCursor(1, 0), "MEMORY");
    input.on(InputAction.UP, () => moveCursor(0, -1), "MEMORY");
    input.on(InputAction.DOWN, () => moveCursor(0, 1), "MEMORY");
    input.on(InputAction.CONFIRM, () => flip(cursor), "MEMORY");

    return function cleanup() {
        if (timeoutId) clearTimeout(timeoutId);
        removeBackHandler();
        screen.remove();
    };
}
