import { input, InputAction } from "../../../shared/js/inputController.js";
import { setupBackHandler } from "../../../shared/components/backHandler.js";

const WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

export function mountTicTacToe(container, exitToMenu) {
    const screen = document.createElement("div");
    screen.className = "screen";
    screen.innerHTML = `
    <div class="game-topbar">
      <button class="back-btn" id="ttt-back">← Volver</button>
      <h1 class="uppercase-text">Tres en Raya</h1>
      <span class="topbar-spacer"></span>
    </div>
    <div class="ttt-board"></div>
    <div class="game-status"></div>
  `;
    container.appendChild(screen);

    const boardEl = screen.querySelector(".ttt-board");
    const statusEl = screen.querySelector(".game-status");
    const backBtn = screen.querySelector("#ttt-back");

    let board = Array(9).fill(null);
    let currentPlayer = "X";
    let gameOver = false;
    let cursor = 0;

    const cells = [];
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "ttt-cell";
        cell.addEventListener("click", () => {
            cursor = i;
            place(i);
        });
        cell.addEventListener("mouseenter", () => {
            cursor = i;
            render();
        });
        boardEl.appendChild(cell);
        cells.push(cell);
    }

    function checkResult() {
        for (const [a, b, c] of WIN_LINES) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a] };
            }
        }
        if (board.every(Boolean)) return { winner: "draw" };
        return null;
    }

    function render() {
        cells.forEach((cell, i) => {
            cell.textContent = board[i] || "";
            cell.classList.toggle("selected", i === cursor && !gameOver);
            cell.classList.toggle("taken", !!board[i]);
        });
    }

    function place(i) {
        if (gameOver || board[i]) return;
        board[i] = currentPlayer;
        const result = checkResult();
        if (result) {
            gameOver = true;
            statusEl.textContent =
                result.winner === "draw"
                    ? "¡Empate!"
                    : `¡Ganó ${result.winner}!`;
        } else {
            currentPlayer = currentPlayer === "X" ? "O" : "X";
            statusEl.textContent = `Turno de ${currentPlayer}`;
        }
        render();
    }

    function moveCursor(dx, dy) {
        if (gameOver) return;
        let x = cursor % 3;
        let y = Math.floor(cursor / 3);
        x = (x + dx + 3) % 3;
        y = (y + dy + 3) % 3;
        cursor = y * 3 + x;
        render();
    }

    function restart() {
        board = Array(9).fill(null);
        currentPlayer = "X";
        gameOver = false;
        cursor = 0;
        statusEl.textContent = `Turno de ${currentPlayer}`;
        render();
    }

    statusEl.textContent = `Turno de ${currentPlayer}`;
    render();

    backBtn.addEventListener("click", () => exitToMenu());

    const removeBackHandler = setupBackHandler({
        context: "TICTACTOE",
        onBack: exitToMenu,
    });
    input.on(InputAction.LEFT, () => moveCursor(-1, 0), "TICTACTOE");
    input.on(InputAction.RIGHT, () => moveCursor(1, 0), "TICTACTOE");
    input.on(InputAction.UP, () => moveCursor(0, -1), "TICTACTOE");
    input.on(InputAction.DOWN, () => moveCursor(0, 1), "TICTACTOE");
    input.on(
        InputAction.CONFIRM,
        () => (gameOver ? restart() : place(cursor)),
        "TICTACTOE"
    );

    return function cleanup() {
        removeBackHandler();
        screen.remove();
    };
}
