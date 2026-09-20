import { input, InputAction } from "../../../shared/js/inputController.js";
import { setupBackHandler } from "../../../shared/components/backHandler.js";
import { mountTicTacToe } from "./tictactoe.js";
import { mountQuiz } from "./quiz.js";
import { mountMemory } from "./memory.js";

const GAMES = [
    {
        id: "tictactoe",
        label: "Tres en Raya",
        icon: "⭕",
        mount: mountTicTacToe,
    },
    { id: "quiz", label: "Quiz", icon: "❓", mount: mountQuiz },
    { id: "memory", label: "Memoria", icon: "🃏", mount: mountMemory },
];

/**
 * Monta el Game Hub (menú + juegos) dentro de `container`.
 * `exitToHome` es el callback que te devuelve al home de la app que
 * contiene este módulo (lo que antes estaba vacío en el onBack del menú).
 * Devuelve un cleanup(), igual que los mount() de cada juego, para que
 * la app padre pueda desmontar el hub cuando navegue a otro lado.
 */
export function mountGameHub(container, exitToHome) {
    // Cleanup function for whatever screen is currently mounted (menu or a game).
    let currentCleanup = null;

    function clearCurrent() {
        if (currentCleanup) {
            currentCleanup();
            currentCleanup = null;
        }
        container.innerHTML = "";
    }

    function showMenu() {
        clearCurrent();

        const screen = document.createElement("div");
        screen.className = "screen";
        screen.innerHTML = `
    <div class="menu-header">
      <h1 class="uppercase-text">Game Hub</h1>
      <h2>Elegí un juego para jugar</h2>
    </div>
    <div class="game-grid"></div>
    <div class="menu-hint">Flechas / WASD para moverte · Enter para jugar</div>
  `;
        container.appendChild(screen);

        const grid = screen.querySelector(".game-grid");
        const cards = GAMES.map((game, i) => {
            const card = document.createElement("div");
            card.className = "game-card";
            card.tabIndex = 0;
            card.innerHTML = `
      <span class="icon">${game.icon}</span>
      <span class="label">${game.label}</span>
    `;
            card.addEventListener("click", () => {
                selected = i;
                render();
                launchGame(i);
            });
            card.addEventListener("mouseenter", () => {
                selected = i;
                render();
            });
            grid.appendChild(card);
            return card;
        });

        let selected = 0;

        function render() {
            cards.forEach((card, i) => card.classList.toggle("selected", i === selected));
        }

        function launchGame(i) {
            currentCleanup = GAMES[i].mount(container, showMenu);
        }

        const removeBackHandler = setupBackHandler({
            context: "MENU",
            onBack: exitToHome, // <-- acá se sale del game-hub hacia el home de la app padre
        });

        input.on(
            InputAction.RIGHT,
            () => {
                selected = Math.min(selected + 1, cards.length - 1);
                render();
            },
            "MENU"
        );
        input.on(
            InputAction.LEFT,
            () => {
                selected = Math.max(selected - 1, 0);
                render();
            },
            "MENU"
        );
        input.on(
            InputAction.DOWN,
            () => {
                selected = Math.min(selected + 1, cards.length - 1);
                render();
            },
            "MENU"
        );
        input.on(
            InputAction.UP,
            () => {
                selected = Math.max(selected - 1, 0);
                render();
            },
            "MENU"
        );
        input.on(InputAction.CONFIRM, () => launchGame(selected), "MENU");

        render();

        currentCleanup = removeBackHandler;
    }

    showMenu();

    // Cleanup general: si la app padre desmonta el hub estando en un juego
    // o en el menú, currentCleanup ya apunta al cleanup correcto en cada caso.
    return () => clearCurrent();
}
