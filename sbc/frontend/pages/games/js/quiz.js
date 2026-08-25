import { input, InputAction } from "../../../shared/js/inputController.js";
import { setupBackHandler } from "../../../shared/components/backHandler.js";

const QUESTIONS = [
  { q: "¿Cuál es la capital de Francia?", options: ["Madrid", "París", "Roma", "Berlín"], correct: 1 },
  { q: "¿Cuánto es 7 x 8?", options: ["54", "56", "62", "48"], correct: 1 },
  { q: "¿Qué planeta es conocido como el planeta rojo?", options: ["Venus", "Júpiter", "Marte", "Saturno"], correct: 2 },
  { q: "¿Quién pintó la Mona Lisa?", options: ["Van Gogh", "Picasso", "Da Vinci", "Miguel Ángel"], correct: 2 },
  { q: "¿Cuál es el océano más grande del mundo?", options: ["Atlántico", "Índico", "Ártico", "Pacífico"], correct: 3 },
  { q: "¿En qué año llegó el ser humano a la Luna?", options: ["1965", "1969", "1972", "1959"], correct: 1 },
  { q: "¿Cuál es el elemento químico más abundante en el universo?", options: ["Oxígeno", "Helio", "Hidrógeno", "Carbono"], correct: 2 },
  { q: "¿Qué país tiene la mayor cantidad de habitantes en el mundo?", options: ["India", "China", "Estados Unidos", "Brasil"], correct: 0 },
  { q: "¿Cuál es el animal terrestre más rápido del mundo?", options: ["León", "Guepardo", "Antílope", "Hiena"], correct: 1 },
  { q: "¿En qué continente se encuentra Egipto?", options: ["Asia", "Europa", "África", "Oceanía"], correct: 2 },
  { q: "¿Cuál es el libro más vendido de la historia después de la Biblia?", options: ["El Señor de los Anillos", "Don Quijote de la Mancha", "Harry Potter", "El Principito"], correct: 1 },
  { q: "¿Cuántos huesos tiene el cuerpo humano adulto?", options: ["206", "210", "198", "300"], correct: 0 },
  { q: "¿Cuál es el río más largo del mundo?", options: ["Nilo", "Misisipi", "Amazonas", "Yangtsé"], correct: 2 },
  { q: "¿Qué instrumento musical tiene 88 teclas?", options: ["Organo", "Acordeón", "Piano", "Arpa"], correct: 2 },
  { q: "¿Cuál es el metal cuyo símbolo químico es Au?", options: ["Plata", "Oro", "Cobre", "Aluminio"], correct: 1 },
  { q: "¿Cual es la función de kibo?", options: ["Asistente", "Robot de pelea", "Auto"], correct: 0 },
];

export function mountQuiz(container, exitToMenu) {
  const screen = document.createElement("div");
  screen.className = "screen";
  screen.innerHTML = `
    <div class="game-topbar">
      <button class="back-btn" id="quiz-back">← Volver</button>
      <h1 class="uppercase-text">Quiz</h1>
      <span class="topbar-spacer"></span>
    </div>
    <div class="quiz-progress"></div>
    <div class="quiz-question"></div>
    <div class="quiz-options"></div>
  `;
  container.appendChild(screen);

  const progressEl = screen.querySelector(".quiz-progress");
  const questionEl = screen.querySelector(".quiz-question");
  const optionsEl = screen.querySelector(".quiz-options");
  const backBtn = screen.querySelector("#quiz-back");

  let currentQ = 0;
  let cursor = 0;
  let score = 0;
  let answered = false;
  let finished = false;
  let timeoutId = null;

  function renderQuestion() {
    answered = false;
    cursor = 0;
    const q = QUESTIONS[currentQ];
    progressEl.textContent = `Pregunta ${currentQ + 1} / ${QUESTIONS.length} — Puntaje: ${score}`;
    questionEl.textContent = q.q;
    optionsEl.innerHTML = "";
    q.options.forEach((opt, i) => {
      const div = document.createElement("div");
      div.className = "quiz-option";
      div.textContent = opt;
      div.addEventListener("click", () => {
        cursor = i;
        selectAnswer(i);
      });
      div.addEventListener("mouseenter", () => {
        if (!answered) {
          cursor = i;
          renderSelection();
        }
      });
      optionsEl.appendChild(div);
    });
    renderSelection();
  }

  function renderSelection() {
    const opts = optionsEl.querySelectorAll(".quiz-option");
    opts.forEach((opt, i) => opt.classList.toggle("selected", i === cursor && !answered));
  }

  function selectAnswer(i) {
    if (answered) return;
    answered = true;
    const q = QUESTIONS[currentQ];
    const opts = optionsEl.querySelectorAll(".quiz-option");
    opts[i].classList.add(i === q.correct ? "correct" : "incorrect");
    if (i !== q.correct) opts[q.correct].classList.add("correct");
    if (i === q.correct) score++;
    progressEl.textContent = `Pregunta ${currentQ + 1} / ${QUESTIONS.length} — Puntaje: ${score}`;

    timeoutId = setTimeout(() => {
      currentQ++;
      if (currentQ >= QUESTIONS.length) {
        showResult();
      } else {
        renderQuestion();
      }
    }, 1100);
  }

  function showResult() {
    finished = true;
    progressEl.textContent = "";
    questionEl.textContent = `¡Terminaste! Puntaje final: ${score} / ${QUESTIONS.length}`;
    optionsEl.innerHTML = "";
    const retryBtn = document.createElement("button");
    retryBtn.className = "primary-btn";
    retryBtn.textContent = "Jugar de nuevo";
    retryBtn.addEventListener("click", restart);
    optionsEl.appendChild(retryBtn);
  }

  function restart() {
    finished = false;
    currentQ = 0;
    score = 0;
    renderQuestion();
  }

  renderQuestion();

  backBtn.addEventListener("click", () => exitToMenu());

  const removeBackHandler = setupBackHandler({ context: "QUIZ", onBack: exitToMenu });
  input.on(InputAction.UP, () => {
    if (!answered && !finished) {
      cursor = Math.max(cursor - 1, 0);
      renderSelection();
    }
  }, "QUIZ");
  input.on(InputAction.DOWN, () => {
    if (!answered && !finished) {
      cursor = Math.min(cursor + 1, QUESTIONS[currentQ].options.length - 1);
      renderSelection();
    }
  }, "QUIZ");
  input.on(InputAction.CONFIRM, () => {
    if (finished) {
      restart();
    } else if (!answered) {
      selectAnswer(cursor);
    }
  }, "QUIZ");

  return function cleanup() {
    if (timeoutId) clearTimeout(timeoutId);
    removeBackHandler();
    screen.remove();
  };
}
