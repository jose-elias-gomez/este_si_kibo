import { getRandomDifficulty } from "./data.js";
import { speak } from "../../../shared/js/api/tts.js";

const TRANSITION_MS = 300; // debe coincidir con la transición de #difficulty-container en el CSS

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

async function changeTo(difficulty) {
    difficultyContainer.classList.add("is-changing");
    await wait(TRANSITION_MS);

    showDifficulty(difficulty);

    difficultyContainer.classList.remove("is-changing");
    await wait(TRANSITION_MS);
}

export async function selectDifficulty() {
    const target = getRandomDifficulty();

    difficultyContainer.classList.remove("is-changing");
    showDifficulty("facil");

    difficultySelector.showModal();

    await wait(500);
    speak("¿Dificultad fácil?");

    if (target === "media" || target === "dificil") {
        await wait(2000);
        speak("Mentira, es mediana");
        await changeTo("media");
    }

    if (target === "dificil") {
        await wait(1500);
        speak("JA JA, dificil y bancatela");
        await changeTo("dificil");
    }

    await wait(2000);
    difficultySelector.close();

    return target;
}
