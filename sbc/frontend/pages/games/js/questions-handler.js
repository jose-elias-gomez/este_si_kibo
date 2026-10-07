import { input, InputAction } from "../../../shared/js/inputController.js";
import { displayAnimation, EXPRESSIONS_TYPE } from "../../../shared/js/expressions/expressions.js";
import { speak } from "../../../shared/js/api/tts.js";
import { DEBUG_MODE } from "../../../shared/js/api/common.js";
import { buildAnimation } from "../../../shared/js/movement/animationBuilder.js";
import { movementController } from "../../../shared/js/movement/movementController.js";

const CONTEXT = "quiz";
const QUESTION_SECONDS = 15;
const FEEDBACK_MS = 2000; // cuánto se ve la respuesta correcta antes de cerrar

// Cada opción se responde tocando una pieza del robot (de arriba a abajo en pantalla)
const PARTS = {
    A: { action: InputAction.TOUCH_LEFT_ARM, src: "../../shared/assets/body/left-arm.svg", label: "Brazo izquierdo" },
    B: { action: InputAction.TOUCH_HEAD, src: "../../shared/assets/body/head.svg", label: "Cabeza" },
    C: { action: InputAction.TOUCH_RIGHT_ARM, src: "../../shared/assets/body/right-arm.svg", label: "Brazo derecho" },
};

const DIFFICULTY_LABELS = { facil: "Fácil", media: "Medio", dificil: "Difícil" };

const dialog = document.getElementById("question-dialog");
const timerEl = document.getElementById("question-timer");
const timeText = document.getElementById("question-time");
const difficultyEl = document.getElementById("question-difficulty");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("question-options");

const LETTERS = Object.keys(PARTS);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createOption(letter, answerText) {
    const part = PARTS[letter];

    const li = document.createElement("li");
    li.dataset.option = letter;

    const img = document.createElement("img");
    img.src = part.src;

    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = part.label;

    const answer = document.createElement("strong");
    answer.className = "option-answer";
    answer.textContent = answerText;

    const body = document.createElement("div");
    body.className = "option-body";
    body.append(label, answer);

    li.append(img, body);
    return li;
}

function render(question, difficulty) {
    questionText.textContent = question.question;
    difficultyEl.textContent = DIFFICULTY_LABELS[difficulty] ?? difficulty;
    optionsList.replaceChildren(...Object.entries(question.options).map(([letter, text]) => createOption(letter, text)));
    setTimer(QUESTION_SECONDS);
}

function setTimer(secondsLeft) {
    timeText.textContent = Math.max(0, Math.ceil(secondsLeft));
    timerEl.style.setProperty("--progress", Math.max(0, secondsLeft / QUESTION_SECONDS));
    timerEl.classList.toggle("is-low", secondsLeft <= 5);
}

function select(index) {
    [...optionsList.children].forEach((li, i) => li.classList.toggle("is-selected", i === index));
}

function reveal(chosen, correct) {
    for (const li of optionsList.children) {
        li.classList.remove("is-selected");
        const letter = li.dataset.option;
        if (letter === correct) li.classList.add("is-correct");
        else if (letter === chosen) li.classList.add("is-wrong");
        else li.classList.add("is-dim");
    }
}

/**
 * Muestra la pregunta y espera a que se responda (tocando una pieza) o se acabe el tiempo.
 * Resuelve con { correct, chosen, timedOut }.
 */
export function handleQuestionInput(question, difficulty) {
    return new Promise((resolve) => {
        let answered = false;
        let timerId;

        async function finish(chosen) {
            // El sensor táctil emite al tocar y al soltar: sin esto se respondería dos veces
            if (answered) return;
            answered = true;
            clearInterval(timerId);

            const timedOut = chosen === null;
            const correct = chosen === question.correct_answer;
            reveal(chosen, question.correct_answer);

            var expression;
            if (timedOut) {
                speak("Se acabó el tiempo, era " + question.options[question.correct_answer]);
                expression = EXPRESSIONS_TYPE.CONFUSION;
                buildAnimation(movementController, "confusion").execute();
            } else if (correct) {
                speak("Que lastima, es correcto");
                expression = EXPRESSIONS_TYPE.SAD;
                buildAnimation(movementController, "sad").execute();
            } else {
                speak("Pues no, era " + question.options[question.correct_answer]);
                expression = EXPRESSIONS_TYPE.NO;
                buildAnimation(movementController, "no").execute();
            }

            displayAnimation(expression);
            await wait(expression.repeat * expression.duration + FEEDBACK_MS);
            dialog.close();
            input.popContext();

            movementController.setAngleForPart("Head", 0);
            movementController.setAngleForPart("LeftArm", 0);
            movementController.setAngleForPart("RightArm", 0);

            resolve({ correct, chosen, timedOut });
        }

        render(question, difficulty);

        movementController.setAngleForPart("Head", 0);
        movementController.setAngleForPart("LeftArm", 90);
        movementController.setAngleForPart("RightArm", 90);

        input.pushContext(CONTEXT);
        for (const [letter, part] of Object.entries(PARTS)) {
            input.on(part.action, async () => await finish(letter), CONTEXT);
        }

        if (DEBUG_MODE) {
            let selected = 0;
            const move = (delta) => {
                if (answered) return;
                selected = Math.min(LETTERS.length - 1, Math.max(0, selected + delta));
                select(selected);
            };

            select(selected);
            input.on(InputAction.UP, () => move(-1), CONTEXT);
            input.on(InputAction.DOWN, () => move(1), CONTEXT);
            input.on(InputAction.CONFIRM, () => finish(LETTERS[selected]), CONTEXT);
        }

        dialog.showModal();
        speak(question.question);

        const startedAt = performance.now();
        timerId = setInterval(() => {
            const left = QUESTION_SECONDS - (performance.now() - startedAt) / 1000;
            if (left <= 0) finish(null);
            else setTimer(left);
        }, 100);
    });
}
