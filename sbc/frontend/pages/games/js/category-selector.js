import { CATEGORIES, getRandomCategory, getRandomQuestion } from "./data.js";
import { input, InputAction } from "../../../shared/js/inputController.js";
import { speak } from "../../../shared/js/api/tts.js";
import { selectDifficulty } from "./difficulty-selector.js";
import { handleQuestionInput } from "./questions-handler.js";

const VISIBLE = 3; // visible cards at once (odd is better: there's a center one)
const STRIP_LENGTH = 40; // total cards each spin goes through
const WINNER_INDEX = 6; // position of the winner inside the strip
const MIN_SCALE = 0.7; // minimum size of the cards at the edges
const MAX_DIM = 0.8; // maximum opacity of the black layer (0 to 1)
const SPIN_MS = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 800 : 5000;

const HALF = Math.floor(VISIBLE / 2);
const START_POS = STRIP_LENGTH - 1 - HALF; // center card at the start

const viewport = document.getElementById("category-viewport");
const categoryList = document.getElementById("category-list");

let spinning = false;
let metrics = { itemH: 150, step: 166 };

// What is currently visible on screen (so the next spin starts without jumps)
let visibleNames = Array.from({ length: VISIBLE }, (_, i) => CATEGORIES[i % CATEGORIES.length]);

function createCard(categoryName) {
    const category = document.createElement("li");
    const img = document.createElement("img");
    img.src = "assets/categories/" + categoryName + ".png";

    category.setAttribute("data-category", categoryName);
    category.appendChild(img);
    return category;
}

function measure() {
    const first = categoryList.firstElementChild;
    const gap = parseFloat(getComputedStyle(categoryList).rowGap) || 0;
    const itemH = first.offsetHeight;
    metrics = { itemH, step: itemH + gap };
    viewport.style.height = `${VISIBLE * metrics.step - gap}px`;
}

function renderStrip(names) {
    categoryList.replaceChildren(...names.map(createCard));
    measure();
}

// pos = index (can have decimals) of the card that is in the center of the viewport.
// Move the list and style each card according to its distance from the center.
function setPosition(pos) {
    const { itemH, step } = metrics;
    const y = viewport.clientHeight / 2 - (pos * step + itemH / 2);
    categoryList.style.transform = `translateY(${y}px)`;

    Array.from(categoryList.children).forEach((li, i) => {
        const distance = Math.abs(i - pos); // 0 = center, 1 = neighbor, 2 = edge...
        li.style.setProperty("--scale", Math.max(MIN_SCALE, 1 - distance * 0.2));
        li.style.setProperty("--dim", Math.min(MAX_DIM, distance * 0.4));
    });
}

function buildStrip(winner) {
    const winnerPosition = CATEGORIES.indexOf(winner);
    const orderedCycle = [...CATEGORIES.slice(winnerPosition), ...CATEGORIES.slice(0, winnerPosition)];

    const strip = Array.from({ length: STRIP_LENGTH }, (_, i) => orderedCycle[i % orderedCycle.length]);

    // Keep the order of CATEGORIES and leave the winner at the prize position.
    strip[WINNER_INDEX] = winner;
    return strip;
}

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

function spin(winner) {
    return new Promise((resolve) => {
        const strip = buildStrip(winner);
        renderStrip(strip);
        setPosition(START_POS);

        const startTime = performance.now();

        function frame(now) {
            const t = Math.min((now - startTime) / SPIN_MS, 1);
            // The position goes down from START_POS to WINNER_INDEX => the cards move downward
            setPosition(START_POS + (WINNER_INDEX - START_POS) * easeOutQuart(t));

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                visibleNames = strip.slice(WINNER_INDEX - HALF, WINNER_INDEX + HALF + 1);
                resolve(winner);
            }
        }
        requestAnimationFrame(frame);
    });
}

renderStrip(visibleNames);
setPosition(HALF);

input.on(InputAction.BACK, () => (window.location.href = "../home/home.html"));
input.on(InputAction.CONFIRM, async () => {
    if (spinning) return;
    spinning = true; // se mantiene hasta terminar toda la ronda para que no se pueda girar de nuevo

    try {
        speak("A ver que toca");
        const category = getRandomCategory();
        await spin(category);
        speak("Pues ha tocado " + category);

        const difficulty = await selectDifficulty();
        const question = getRandomQuestion(category, difficulty);
        if (!question) {
            console.warn(`No hay preguntas para ${category} / ${difficulty}`);
            return;
        }

        await handleQuestionInput(question, difficulty);
    } finally {
        spinning = false;
    }
});
