import { InputAction, input } from "../js/inputController.js";

const CONTEXT = "keyboard_context";

const firstPage = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const secondPage = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["+", "x", "÷", "=", "/", "_", "<", ">", "[", "]"],
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["-", "'", "\"", ":", ";", ",", "¿", "?", ",", "."],
];

// Páginas disponibles, indexadas por número de página (0 = letras, 1 = números/símbolos).
const pages = [firstPage, secondPage];

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      position: fixed;
      bottom: 0;
      left: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 60vh;
      width: 100%;
      z-index: 10000;
      background-color: #d7d7d7;
      border-top-left-radius: 3rem;
      border-top-right-radius: 3rem;
      padding: 24px 30px;
      padding-top: 16px;
      gap: var(--space-xs);
      box-sizing: border-box;
      font-family: var(--font-body);
      font-size: 1.5rem;
      font-weight: 400;

      --capslock-color: rgba(0, 0, 0, 0.2);

      /* Estado base: siempre arranca corrido fuera de pantalla.
         Esto es lo que se ve mientras el host no tiene "hidden" pero
         tampoco tiene la clase "open" (por ejemplo, justo al abrir,
         durante un frame, antes de animar hacia arriba). */
      transform: translateY(100%);

      /* Transición para la animación de abrir y cerrar */
      transition: transform 0.4s cubic-bezier(0.1, 0.9, 0.2, 1);
    }

    /* Estado realmente oculto: ni se pinta, ni ocupa layout, ni anima.
       Esto es lo que evita el "flash" al cargar la página: mientras
       este atributo esté presente, el <style> de arriba (incluido el
       transform base) ni siquiera se aplica visualmente, porque el
       elemento no se renderiza. */
    :host([hidden]) {
      display: none;
    }

    /* Estado Visible */
    :host(.open) {
      transform: translateY(0);
    }

    /* El contenedor no debería generar caja propia: las filas deben
       comportarse como hijos flex directos del host (mismo layout que
       antes, cuando las filas eran hijas directas de .keyboard). */
    #container {
      display: contents;
    }

    .row {
      display: flex;
      justify-content: center;
      align-items: stretch;
      gap: var(--space-xs);
      width: 80%;
      height: 100%;
      margin: 0 auto;
    }

    .bottom-row {
      width: 100%;
      border-top: 2px solid rgba(0, 0, 0, 0.05);
      padding-top: 16px;
      padding-left: 8px;
      padding-right: 8px;
    }

    .key {
      flex: 1;
      display: flex;
      align-items: flex-start;
      background-color: #fafafa;
      color: #707070;
      padding-top: 12px;
      padding-left: 12px;
      border-radius: 24px;
      text-align: left;
      user-select: none;
      box-shadow: 0px 4px 0px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
      position: relative;
      font-size: 2rem;
      cursor: pointer;

      transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
    }

    .key.selected {
      background-color: rgba(0, 0, 0, 0.08);
      color: #444444;
      transform: translateY(-4px);
      z-index: 10;
    }

    /* Animación de presión: se dispara al agregar la clase "pressed"
       (ver flashKey en el JS) y se saca sola por timeout. A propósito
       NO usa @keyframes/animation: reutiliza la misma "transition" que
       ya tiene .key (transform, background-color, box-shadow), así el
       "pop" y su regreso quedan a cargo del mismo mecanismo que ya
       anima ".selected", en vez de competir con él (mezclar animation
       + transition sobre la misma propiedad es lo que producía el
       flicker al cambiar de tecla/página). */
    .key.pressed {
      transform: scale(0.8);
      background-color: rgba(0, 0, 0, 0.3);
      box-shadow: 0px 2px 0px rgba(0, 0, 0, 0.4);
    }

    /* Si la tecla presionada también está "seleccionada" (navegación
       por mando), combinamos su desplazamiento hacia arriba con el
       escalado, en vez de que uno pise al otro. */
    .key.selected.pressed {
      transform: translateY(-4px) scale(0.8);
    }

    .space {
      flex: 4 !important;
    }

    .capslock,
    .enter {
      flex: 2 !important;
    }

    .delete {
      flex: 1.5 !important;
    }

    /* Tecla de alternar página (letras <-> números/símbolos) */
    .page-toggle {
      flex: 1.4 !important;
      font-weight: bold;
    }

    .capslock::after {
      content: "";
      position: absolute;
      top: 12px;
      right: 12px;
      width: 10px;
      height: 10px;
      background-color: var(--capslock-color);
      border-radius: 50%;
    }
  </style>
  <div id="container"></div>
`;

/**
 * <virtual-keyboard>
 *
 * Web component autocontenido del teclado virtual. No sabe nada sobre
 * "dónde" se escribe el texto: emite CustomEvents (char-input,
 * space-input, delete-input) que cualquier consumidor puede escuchar.
 *
 * API pública: open() / close().
 */
export class VirtualKeyboard extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.container = this.shadowRoot.getElementById("container");

    // Posición actual del cursor de navegación: { row, col }
    this.selectedRow = 0;
    this.selectedCol = 0;
    this.page = 0;
    this.isCapsLockOn = false;

    // Matriz de referencias a los elementos DOM de teclas, fila por fila,
    // incluyendo la fila inferior (capslock/alternar página, espacio,
    // confirmar, borrar) para que la navegación arriba/abajo/izquierda/derecha
    // cubra todo el teclado.
    this.keyMatrix = [];

    // Estado inicial: completamente oculto y fuera del árbol de render.
    // No usamos clases (.closed / .open) para el estado de visibilidad
    // real, sino el atributo "hidden", que evita el flash al cargar la
    // página (display: none no anima ni se pinta).
    this.hidden = true;

    // Bindings usados como listeners de input
    this._onLeft = () => this.moveSelection(0, -1);
    this._onRight = () => this.moveSelection(0, 1);
    this._onUp = () => this.moveSelection(-1, 0);
    this._onDown = () => this.moveSelection(1, 0);
    this._onConfirm = () => this.activateSelection();
    this._onBack = () => this.close();

    // Handler de transición usado por close() para saber cuándo terminó
    // la animación de bajada y recién ahí aplicar "hidden".
    this._onTransitionEnd = null;
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  clearSelection() {
    this.keyMatrix.flat().forEach((el) => el && el.classList.remove("selected"));
  }

  applySelection() {
    this.clearSelection();
    const row = this.keyMatrix[this.selectedRow];
    if (!row) return;
    const el = row[this.selectedCol];
    if (el) el.classList.add("selected");
  }

  // Dispara el efecto de "presionado" (scale + color) sobre una tecla.
  // Se apoya en la clase CSS "pressed", que reutiliza la misma
  // "transition" que ya tiene .key/.key.selected (en vez de una
  // @keyframes animation aparte, que competía con esas transitions y
  // provocaba flicker). Un timeout se encarga de sacar la clase; si
  // llega un nuevo press mientras el anterior seguía activo, reiniciamos
  // el timeout sin tocar la clase (ya está puesta), evitando cualquier
  // salto visual.
  flashKey(el) {
    if (!el) return;

    if (el._pressTimeout) {
      clearTimeout(el._pressTimeout);
    } else {
      el.classList.add("pressed");
    }

    el._pressTimeout = setTimeout(() => {
      el.classList.remove("pressed");
      el._pressTimeout = null;
    }, 100);
  }

  // Dado un índice de columna en la fila actual, calcula la columna
  // "proporcional" equivalente en la fila destino (las filas tienen
  // distinta cantidad de teclas y distinto ancho, así que se mapea
  // por posición relativa en vez de índice absoluto).
  proportionalCol(fromRowIndex, toRowIndex, fromCol) {
    const fromRow = this.keyMatrix[fromRowIndex];
    const toRow = this.keyMatrix[toRowIndex];
    if (!fromRow || !toRow || fromRow.length === 0) return 0;

    const ratio = fromCol / Math.max(fromRow.length - 1, 1);
    const targetCol = Math.round(ratio * Math.max(toRow.length - 1, 0));
    return this.clamp(targetCol, 0, toRow.length - 1);
  }

  moveSelection(deltaRow, deltaCol) {
    if (this.keyMatrix.length === 0) return;

    if (deltaCol !== 0) {
      const row = this.keyMatrix[this.selectedRow];
      if (!row) return;
      this.selectedCol = this.clamp(this.selectedCol + deltaCol, 0, row.length - 1);
    }

    if (deltaRow !== 0) {
      const newRow = this.clamp(this.selectedRow + deltaRow, 0, this.keyMatrix.length - 1);
      if (newRow !== this.selectedRow) {
        this.selectedCol = this.proportionalCol(this.selectedRow, newRow, this.selectedCol);
        this.selectedRow = newRow;
      }
    }

    this.applySelection();
  }

  activateSelection() {
    const row = this.keyMatrix[this.selectedRow];
    if (!row) return;
    const el = row[this.selectedCol];
    if (el) el.click();
  }

  // Delega en la API pública de <text-container>: el teclado no conoce
  // ni toca su DOM interno (ni el límite de caracteres, ni el cursor
  // visual, ni el contador), solo le pide que inserte o borre texto.
  insertText(str) {
    if (this.textContainer == null) return;
    this.textContainer.insertText(str);
  }

  deleteChar() {
    if (this.textContainer == null) return;
    this.textContainer.deleteChar();
  }

  open(textContainer) {
    this.textContainer = textContainer;

    // Si ya está abierto (visible y con la clase "open"), no hacemos nada.
    if (!this.hidden && this.classList.contains("open")) {
      return;
    }

    // Si había una animación de cierre en curso, la cancelamos: no
    // queremos que un transitionend viejo vuelva a ocultar el teclado
    // después de que lo acabamos de abrir.
    if (this._onTransitionEnd) {
      this.removeEventListener("transitionend", this._onTransitionEnd);
      this._onTransitionEnd = null;
    }

    if (this.textContainer?.showCursor) {
      this.textContainer.showCursor();
    }

    this.renderPage(0);

    // Sacamos "hidden" para que el elemento vuelva a estar en el árbol
    // de render. En este momento sigue corrido hacia abajo por el
    // transform base (translateY(100%)) definido en :host.
    this.hidden = false;

    // Forzamos reflow para que el navegador "registre" esa posición
    // inicial ANTES de agregar la clase que dispara la animación.
    // Sin este paso, agregar "open" en el mismo frame podría no animarse
    // (el navegador podría fusionar ambos cambios de estilo).
    this.getBoundingClientRect();

    requestAnimationFrame(() => {
      this.classList.add("open");
    });

    input.pushContext(CONTEXT);

    input.on(InputAction.LEFT, this._onLeft, CONTEXT);
    input.on(InputAction.RIGHT, this._onRight, CONTEXT);
    input.on(InputAction.UP, this._onUp, CONTEXT);
    input.on(InputAction.DOWN, this._onDown, CONTEXT);
    input.on(InputAction.CONFIRM, this._onConfirm, CONTEXT);
    input.on(InputAction.BACK, this._onBack, CONTEXT);
  }

  close() {
    const wasOpen = !this.hidden && this.classList.contains("open");

    this.classList.remove("open");
    this.clearSelection();
    this.keyMatrix = [];
    this.selectedRow = 0;
    this.selectedCol = 0;

    if (this.textContainer?.onCloseKeyboard) {
      this.textContainer.onCloseKeyboard();
    }

    input.popContext();

    if (!wasOpen) {
      // Ya estaba oculto (o nunca llegó a animarse la apertura): no hay
      // nada que animar, lo ocultamos directamente.
      this.hidden = true;
      return;
    }

    // Esperamos a que termine la animación de bajada (transform) antes
    // de aplicar "hidden". Si lo hiciéramos de inmediato, "display: none"
    // cortaría la transición a mitad de camino y se vería un salto.
    this._onTransitionEnd = (event) => {
      if (event.target !== this || event.propertyName !== "transform") return;
      this.removeEventListener("transitionend", this._onTransitionEnd);
      this._onTransitionEnd = null;
      this.hidden = true;
    };
    this.addEventListener("transitionend", this._onTransitionEnd);
  }

  // Renderiza la página indicada (0 = letras, 1 = números/símbolos).
  // Si ya había una selección previa (venimos de cambiar de página),
  // intenta mantener una posición equivalente en vez de resetear siempre
  // a la primera tecla.
  renderPage(targetPage) {
    const hadPreviousSelection = this.keyMatrix.length > 0;

    this.container.innerHTML = "";
    this.page = targetPage;
    this.keyMatrix = [];

    const layout = pages[this.page];

    for (let i = 0; i < layout.length; i++) {
      const row = document.createElement("div");
      row.classList.add("row");
      const rowKeys = [];

      for (let j = 0; j < layout[i].length; j++) {
        const key = document.createElement("div");
        key.classList.add("key");

        // En la página de letras respetamos el estado de Mayúsculas activo.
        const rawChar = layout[i][j];
        const isLetter = this.page === 0 && /[a-zA-ZñÑ]/.test(rawChar);
        key.textContent = isLetter && this.isCapsLockOn ? rawChar.toUpperCase() : rawChar;

        key.addEventListener("click", () => {
          this.flashKey(key);
          this.insertText(key.textContent);
        });

        row.appendChild(key);
        rowKeys.push(key);
      }

      this.container.appendChild(row);
      this.keyMatrix.push(rowKeys);
    }

    const bottomRow = document.createElement("div");
    bottomRow.classList.add("row", "bottom-row");
    const bottomRowKeys = [];

    if (this.page === 0) {
      if (!hadPreviousSelection) {
        this.selectedCol = 0;
        this.selectedRow = 0;
      } else {
        this.selectedCol = 1; // Que aparezca de vuelta en 1!#
        this.selectedRow = 3;
      }

      const capslockKey = document.createElement("div");
      capslockKey.classList.add("key", "capslock");
      capslockKey.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="25px" height="25px" style="width:25px;height:25px;fill:#707070;shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 200 200"><path d="M61.8 148.97l76.4 0c6,0 10.91,4.9 10.91,10.9l0 27.24c0,5.99 -4.91,10.89 -10.91,10.89l-76.4 0c-6,0 -10.91,-4.9 -10.91,-10.89l0 -27.24c0,-6 4.91,-10.9 10.91,-10.9zm105.7 -60.38l-18.39 0 0 37.36c0,5.99 -4.91,10.89 -10.91,10.89l-76.4 0c-6,0 -10.91,-4.9 -10.91,-10.89l0 -37.36 -18.39 0c-2.65,0 -4.91,-1.47 -5.97,-3.89 -1.07,-2.42 -0.63,-5.08 1.16,-7.02l67.5 -73.57c1.28,-1.39 2.91,-2.11 4.81,-2.11 1.9,0 3.53,0.72 4.81,2.11l67.5 73.57c1.79,1.94 2.23,4.6 1.16,7.02 -1.06,2.42 -3.32,3.89 -5.97,3.89z"></path></svg>`;
      capslockKey.style.setProperty("--capslock-color", this.isCapsLockOn ? "#5decaa" : "rgba(0, 0, 0, 0.2)");
      bottomRow.appendChild(capslockKey);
      bottomRowKeys.push(capslockKey);
      capslockKey.addEventListener("click", () => {
        this.flashKey(capslockKey);
        this.isCapsLockOn = !this.isCapsLockOn;
        capslockKey.style.setProperty("--capslock-color", this.isCapsLockOn ? "#5decaa" : "rgba(0, 0, 0, 0.2)");

        const keys = this.container.querySelectorAll(".key");
        keys.forEach((key) => {
          if (key.textContent.length === 1 && /[a-zA-ZñÑ]/.test(key.textContent)) {
            key.textContent = this.isCapsLockOn ? key.textContent.toUpperCase() : key.textContent.toLowerCase();
          }
        });
      });

      // Tecla Símbolos -> pasa a la segunda página
      const symbolsKey = document.createElement("div");
      symbolsKey.classList.add("key", "page-toggle");
      symbolsKey.textContent = "!#1";
      bottomRow.appendChild(symbolsKey);
      bottomRowKeys.push(symbolsKey);
      symbolsKey.addEventListener("click", () => {
        this.flashKey(symbolsKey);
        this.renderPage(1);
      });
    } else {
      this.selectedCol = 0; // Que aparezca en ABC
      this.selectedRow = 4;

      const lettersKey = document.createElement("div");
      lettersKey.classList.add("key", "page-toggle");
      lettersKey.textContent = "ABC";
      bottomRow.appendChild(lettersKey);
      bottomRowKeys.push(lettersKey);
      lettersKey.addEventListener("click", () => {
        this.flashKey(lettersKey);
        this.renderPage(0);
      });
    }

    const spaceKey = document.createElement("div");
    spaceKey.classList.add("key", "space");
    spaceKey.textContent = "Espacio";
    bottomRow.appendChild(spaceKey);
    bottomRowKeys.push(spaceKey);
    spaceKey.addEventListener("click", () => {
      this.flashKey(spaceKey);
      this.insertText(" ");
    });

    const enterKey = document.createElement("div");
    enterKey.classList.add("key", "enter");
    enterKey.textContent = "Confirmar";
    bottomRow.appendChild(enterKey);
    bottomRowKeys.push(enterKey);
    enterKey.addEventListener("click", () => {
      this.flashKey(enterKey);
      this.close();
    });

    const deleteKey = document.createElement("div");
    deleteKey.classList.add("key", "delete");
    deleteKey.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="25px" height="25px" viewBox="0 0 612 612" style="width:25px;height:25px;fill:#707070;"><path d="M561,76.5H178.5c-17.85,0-30.6,7.65-40.8,22.95L0,306l137.7,206.55c10.2,12.75,22.95,22.95,40.8,22.95H561c28.05,0,51-22.95,51-51v-357C612,99.45,589.05,76.5,561,76.5z M484.5,397.8l-35.7,35.7L357,341.7l-91.8,91.8l-35.7-35.7l91.8-91.8l-91.8-91.8l35.7-35.7l91.8,91.8l91.8-91.8l35.7,35.7L392.7,306L484.5,397.8z"></path></svg>`;
    bottomRow.appendChild(deleteKey);
    bottomRowKeys.push(deleteKey);
    deleteKey.addEventListener("click", () => {
      this.flashKey(deleteKey);
      this.deleteChar();
    });

    this.container.appendChild(bottomRow);
    this.keyMatrix.push(bottomRowKeys);

    this.applySelection();
  }
}

customElements.define("virtual-keyboard", VirtualKeyboard);