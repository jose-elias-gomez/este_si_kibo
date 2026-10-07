import { getRandomDifficulty } from "./data.js";
import { speak } from "../../../shared/js/api/tts.js";
import { input, InputAction } from "../../../shared/js/inputController.js";

const TRANSITION_MS = 300; // debe coincidir con la transición de #difficulty-container en el CSS
const INPUT_CONTEXT = "difficulty-selector";

const CONTENT = {
    facil: { src: "../../shared/assets/expressions/happy.svg", label: "Fácil" },
    media: { src: "../../shared/assets/expressions/confusion.svg", label: "Medio" },
    dificil: { src: "../../shared/assets/expressions/angry.svg", label: "Difícil" },
};

const difficultySelector = document.getElementById("difficulty-selector");
const difficultyContainer = document.getElementById("difficulty-container");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function showDifficulty(difficulty) {
    const { src, label } = CONTENT[difficulty];

    const img = document.createElement("img");
    img.src = src;

    const text = document.createElement("strong");
    text.textContent = label;

    difficultyContainer.replaceChildren(img, text);
}

async function changeTo(difficulty, waitOrSkip) {
    difficultyContainer.classList.add("is-changing");
    if (await waitOrSkip(TRANSITION_MS)) return false;

    showDifficulty(difficulty);

    difficultyContainer.classList.remove("is-changing");
    if (await waitOrSkip(TRANSITION_MS)) return false;
    return true;
}

export async function selectDifficulty() {
    const target = getRandomDifficulty();

    difficultyContainer.classList.remove("is-changing");
    showDifficulty("facil");

    difficultySelector.showModal();

    input.pushContext(INPUT_CONTEXT);

    let skipRequested = false;
    let resolveSkip;

    const skipPromise = new Promise((resolve) => {
        resolveSkip = resolve;
    });

    input.onEveryAction(() => {
        if (skipRequested) return;
        skipRequested = true;
        resolveSkip();
    }, INPUT_CONTEXT);

    const waitOrSkip = (ms) => {
        if (skipRequested) return Promise.resolve(true);
        return Promise.race([wait(ms).then(() => false), skipPromise.then(() => true)]);
    };

    const finishSkipped = () => {
        difficultyContainer.classList.remove("is-changing");
        showDifficulty(target);
        difficultySelector.close();
        return target;
    };

    try {
        if (await waitOrSkip(500)) return finishSkipped();
        speak("¿Dificultad fácil?");

        if (target === "media" || target === "dificil") {
            if (await waitOrSkip(2000)) return finishSkipped();
            speak("Mentira, es mediana");
            if (!(await changeTo("media", waitOrSkip))) return finishSkipped();
        }

        if (target === "dificil") {
            if (await waitOrSkip(1500)) return finishSkipped();
            speak("JA JA, dificil y bancatela");
            if (!(await changeTo("dificil", waitOrSkip))) return finishSkipped();
        }

        if (await waitOrSkip(2000)) return finishSkipped();
        difficultySelector.close();

        return target;
    } finally {
        input.popContext();
    }
}
