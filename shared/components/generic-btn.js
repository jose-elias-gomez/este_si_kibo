/**
 * <generic-btn> Web Component
 * Botón genérico reutilizable con estados de hover, unhover y click programmatico/mouse.
 */

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: inline-block;
      box-sizing: border-box;
    }

    button {
      width: 100%;
      height: 100%;
      background-color: transparent;
      color: var(--color-text, #ffffff);
      border: 1px solid var(--color-border, rgba(255, 255, 255, 0.2));
      border-radius: var(--radius-xl, 16px);
      padding: 8px 24px;
      font-size: var(--font-size-lg, 0.9rem);
      font-family: var(--font-ui, system-ui, -apple-system, sans-serif);
      cursor: pointer;
      outline: none;
      user-select: none;
      transition:
        background-color var(--duration-fast, 0.15s) ease,
        transform var(--duration-fast, 0.15s) ease,
        border-color var(--duration-fast, 0.15s) ease;
    }

    button.hovered {
      background-color: var(--color-hover, rgba(255, 255, 255, 0.1));
      border-color: transparent;
    }

    /* Estado Pressed/Click (Mouse o JS) */
    button.pressed,
    button:active {
      transform: scale(0.92);
    }

    :host([disabled]) button {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
  </style>

  <button id="btn">
    <slot></slot>
  </button>
`;

export class GenericBtn extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._button = this.shadowRoot.getElementById("btn");
    this._isHovered = false;
  }

  connectedCallback() {
    this._setupMouseEvents();
  }

  _setupMouseEvents() {
    this._button.addEventListener("mouseenter", () => this.hover());
    this._button.addEventListener("mouseleave", () => this.unhover());
    this._button.addEventListener("click", (e) => this._onNativeClick(e));
  }

  // --- MÉTODOS Y ESTADOS PÚBLICOS ---

  /**
   * Activa el estado hover (vía control de mando/teclado o mouse)
   */
  hover() {
    if (this.hasAttribute("disabled")) return;
    this._isHovered = true;
    this._button.classList.add("hovered");
    this.setAttribute("is-hovered", "");
  }

  /**
   * Remueve el estado hover
   */
  unhover() {
    this._isHovered = false;
    this._button.classList.remove("hovered");
    this.removeAttribute("is-hovered");
  }

  /**
   * Ejecuta la animación de 'click' (pressed) y dispara la acción/evento
   */
  click() {
    if (this.hasAttribute("disabled")) return;

    this._button.classList.add("pressed");

    setTimeout(() => {
      this._button.classList.remove("pressed");
      this._dispatchClickEvent();
    }, 150);
  }

  /**
   * Retorna si el botón está en estado hover
   */
  get isHovered() {
    return this._isHovered;
  }

  _onNativeClick(e) {
    e.stopPropagation();
    this.click();
  }

  _dispatchClickEvent() {
    this.dispatchEvent(
      new CustomEvent("btn-click", {
        bubbles: true,
        composed: true,
        detail: { target: this }
      })
    );
  }
}

customElements.define("generic-btn", GenericBtn);