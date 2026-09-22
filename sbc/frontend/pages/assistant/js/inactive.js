import { InputAction, input } from "../../../shared/js/inputController.js";
import { EXPRESSIONS_TYPE, displayAnimation } from "../../../shared/js/expressions/expressions.js"
import { startRecording } from "./recording.js";

const historyContainer = document.querySelector(".history");
const recordBtn = document.querySelector(".record-btn");
const inactiveBackground = document.getElementById("inactive-background");
const expressionImg = inactiveBackground.querySelector(".expression-img");
const inactiveTitle = inactiveBackground.querySelector(".inactive-text strong");
const inactiveSubtitle = inactiveBackground.querySelector(".inactive-text p");

const MAX_HISTORY_MESSAGES = 25;
const SCROLL_STEP_PX = 96; // aprox. la altura de una card

const EXPRESSIONS = {
    happy: { title: "¿Qué esperas?", subtitle: "Presiona el botón para hablar" },
    dance: { title: "¡Vamos, animate!", subtitle: "Decime algo y lo festejamos juntos" },
    surprise: { title: "¿No se te ocurre nada?", subtitle: "Preguntame lo que quieras" },
    confusion: { title: "Estoy esperando...", subtitle: "¿En qué te puedo ayudar?" },
    no: { title: "Tanto silencio", subtitle: "Presioná el botón cuando quieras hablar" },
    angry: { title: "¡Decí algo ya!", subtitle: "Hace rato que no hablamos" },
    sad: { title: "Me aburro solo acá", subtitle: "Contame algo, dale" },
    run: { title: "¿A dónde vas?", subtitle: "Quedate, hablemos un rato" },
};

const EXPRESSION_KEYS = Object.keys(EXPRESSIONS);
const EXPRESSION_INTERVAL_MS = 3000;
let expressionIndex = 0;
let expressionIntervalId = null;

function setExpression(name) {
    const { title, subtitle } = EXPRESSIONS[name];

    expressionImg.src = `../../shared/assets/expressions/${name}.svg`;
    inactiveTitle.textContent = title;
    inactiveSubtitle.textContent = subtitle;

    inactiveBackground.classList.remove("expression-change");
    void inactiveBackground.offsetWidth;
    inactiveBackground.classList.add("expression-change");
}

function startExpressionCycle() {
    if (expressionIntervalId) return;

    setExpression(EXPRESSION_KEYS[expressionIndex]);
    expressionIntervalId = setInterval(() => {
        expressionIndex = (expressionIndex + 1) % EXPRESSION_KEYS.length;
        setExpression(EXPRESSION_KEYS[expressionIndex]);
    }, EXPRESSION_INTERVAL_MS);
}

function stopExpressionCycle() {
    clearInterval(expressionIntervalId);
    expressionIntervalId = null;
}

function updateInactiveBackground() {
    const isEmpty = historyContainer.children.length === 0;

    if (isEmpty && !inactiveBackground.classList.contains("visible")) {
        inactiveBackground.classList.add("visible");
    } else if (!isEmpty) {
        inactiveBackground.classList.remove("visible");
    }

    if (isEmpty) startExpressionCycle();
    else stopExpressionCycle();
}

function formatTime(timeInMillis) {
    return new Date(timeInMillis).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function createCard(message, timeInMillis) {
    const card = document.createElement("div");
    card.classList.add("card");

    const timeElement = document.createElement("span");
    timeElement.classList.add("card-time");
    timeElement.textContent = formatTime(timeInMillis);
    card.appendChild(timeElement);

    const bodyElement = document.createElement("p");
    bodyElement.classList.add("card-body");
    bodyElement.textContent = message;
    card.appendChild(bodyElement);

    return card;
}

function trimHistory() {
    while (historyContainer.children.length > MAX_HISTORY_MESSAGES) {
        historyContainer.firstElementChild.remove();
    }
}

export function addReply(message, timeInMillis) {
    historyContainer.appendChild(createCard(message, timeInMillis));
    trimHistory();
    updateInactiveBackground();

    historyContainer.scrollTo({ top: historyContainer.scrollHeight, behavior: "smooth" });
}

export function addReplyFromNow(message) {
    addReply(message, Date.now());
}

export function addTranscribeFromNow(message) {
    const card = createCard(message, Date.now());
    card.classList.add("user");
    historyContainer.appendChild(card);
    trimHistory();
    updateInactiveBackground();

    historyContainer.scrollTo({ top: historyContainer.scrollHeight, behavior: "smooth" });
}

recordBtn.addEventListener("click", () => recordBtn.classList.add("clicked"));
recordBtn.addEventListener("animationend", () => recordBtn.classList.remove("clicked"));

input.on(InputAction.UP, () => historyContainer.scrollBy({ top: -SCROLL_STEP_PX, behavior: "smooth" }));
input.on(InputAction.DOWN, () => historyContainer.scrollBy({ top: SCROLL_STEP_PX, behavior: "smooth" }));

input.on(InputAction.CONFIRM, startRecording);
input.on(InputAction.BACK, () => (window.location.href = "../home/home.html"));
input.on(InputAction.LEFT, () => {
    displayAnimation(EXPRESSIONS_TYPE.CONFUSION);
});
updateInactiveBackground();
