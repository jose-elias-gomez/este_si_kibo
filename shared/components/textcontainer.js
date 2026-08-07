const DEFAULT_MAX_LENGTH = 512;

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
      height: 100%;
      width: 100%;
      background: transparent;
      border-radius: var(--radius-xl);
      border: 2px solid var(--color-border);
      outline: none;

      padding: 0.75rem 1rem 2.25rem 1rem;

      box-sizing: border-box;
      cursor: pointer;
      font-family: var(--font-body);
      color: var(--color-text);
      font-size: var(--font-size-lg);
      font-weight: 400;

      transition:
        background-color var(--duration-fast, 0.3s) ease;    
        border-color var(--duration-fast, 0.3s) ease;    

      overflow: hidden;
      caret-color: transparent;
    }

    :host(.hovered) {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: transparent;
    }

    :host(.selected) {
      background-color: rgba(255, 255, 255, 0.05);
      border-color: transparent;
    }
      
    .label-text {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--color-h1);
      pointer-events: none;
      user-select: none;
      font-family: var(--font-body);
      margin-bottom: 0.5rem; /* Espacio fijo y constante entre el label y el texto */
      line-height: 1.2;
    }

    .input-area {
      flex: 1;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      line-height: 1.3;
    }

    /* Cursor visual */
    .text-cursor {
      display: inline-block;
      width: 4px;
      border-radius: 2px;
      height: 1.2em;
      vertical-align: middle;
      margin-left: 2px;
      background-color: var(--color-h1);
      animation: text-cursor-blink 1s step-start infinite;
    }

    @keyframes text-cursor-blink {
      50% {
        opacity: 0;
      }
    }

    .char-counter {
      position: absolute;
      right: 1.25rem;
      bottom: 0.5rem;
      pointer-events: none;
      font-size: 0.9rem;
      color: var(--color-text);
      box-sizing: border-box;
      font-family: var(--font-body);
    }
  </style>
  <div class="label-text"></div>
  <div class="input-area"><span class="text-content"></span><span class="text-cursor"></span></div>
  <div class="char-counter"></div>
`;

/**
 * <text-container>
 */
export class TextContainer extends HTMLElement {
  static get observedAttributes() {
    return ["max-length", "label"];
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.textSpan = this.shadowRoot.querySelector(".text-content");
    this.cursorSpan = this.shadowRoot.querySelector(".text-cursor");
    this.counterEl = this.shadowRoot.querySelector(".char-counter");
    this.labelEl = this.shadowRoot.querySelector(".label-text");

    this.hideCursor();

    this._maxLength = DEFAULT_MAX_LENGTH;
  }

  get isHovered() {
    return this.classList.contains("hovered");
  }

  get text() {
    return this.textSpan.textContent;
  }

  set text(value) {
    this.textSpan.textContent = value.slice(0, this._maxLength);
    this.updateCounter();
  }

  hover() {
    this.classList.add("hovered");
  }

  select() {
    document.getElementById("virtual-keyboard")?.open(this);
    this.classList.add("selected");
    this.classList.remove("hovered");
    this.showCursor();
  }

  unselect() {
    this.classList.remove("selected");
    this.classList.remove("hovered");
    this.hideCursor();
  }

  onCloseKeyboard() {
    this.unselect();
    this.hover();
  }

  unhover() {
    this.classList.remove("hovered");
  }

  connectedCallback() {
    this.updateCounter();
    this.updateLabel();
  }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === "max-length") {
      const parsed = parseInt(newValue, 10);
      this._maxLength = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_LENGTH;
      if (this.textSpan.textContent.length > this._maxLength) {
        this.textSpan.textContent = this.textSpan.textContent.slice(0, this._maxLength);
      }
      this.updateCounter();
    }

    if (name === "label") {
      this.updateLabel();
    }
  }

  get maxLength() {
    return this._maxLength;
  }

  set maxLength(value) {
    this.setAttribute("max-length", value);
  }

  get label() {
    return this.getAttribute("label") || "";
  }

  set label(value) {
    if (value) {
      this.setAttribute("label", value);
    } else {
      this.removeAttribute("label");
    }
  }

  getText() {
    return this.textSpan.textContent;
  }

  showCursor() {
    this.cursorSpan.style.visibility = "visible";
  }

  hideCursor() {
    this.cursorSpan.style.visibility = "hidden";
  }

  insertText(str) {
    if (!str) return;
    const available = this._maxLength - this.textSpan.textContent.length;
    if (available <= 0) return;
    this.textSpan.textContent += str.slice(0, available);
    this.updateCounter();
  }

  deleteChar() {
    if (this.textSpan.textContent.length === 0) return;
    this.textSpan.textContent = this.textSpan.textContent.slice(0, -1);
    this.updateCounter();
  }

  clear() {
    this.textSpan.textContent = "";
    this.updateCounter();
  }

  updateLabel() {
    this.labelEl.textContent = this.getAttribute("label") || "";
    // Oculta el elemento del label si está vacío para evitar ocupar espacio
    this.labelEl.style.display = this.labelEl.textContent ? "block" : "none";
  }

  updateCounter() {
    const length = this.textSpan.textContent.length;
    this.counterEl.textContent = `${length}/${this._maxLength}`;

    this.dispatchEvent(
      new CustomEvent("text-changed", {
        bubbles: true,
        composed: true,
        detail: { length, maxLength: this._maxLength, text: this.textSpan.textContent },
      })
    );
  }
}

customElements.define("text-container", TextContainer);