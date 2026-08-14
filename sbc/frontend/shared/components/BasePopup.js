import { input, InputAction } from "../js/inputController.js";

export class BasePopup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._inputContextActive = false;
  }

  /**
   * Contexto del input controller asociado a este popup. Las subclases que
   * necesiten navegación por teclado/control deben sobreescribir este
   * getter (ver WifiMenu -> get context()). Si devuelve null/undefined,
   * el popup no toca el input controller y close()/open() se comportan
   * como antes (solo animación del <dialog>).
   */
  get context() {
    return null;
  }

  connectedCallback() {
    this.render();
    this.dialog = this.shadowRoot.querySelector("dialog");
  }

  render() {
    const title = this.getAttribute("title") || "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        dialog {
          border: none;
          border-radius: var(--radius-xl, 2rem);
          padding: 24px;
          width: 90vw;
          max-width: 90vw; /* Recomendado para no verse gigante en pantallas anchas */
          height: var(--popup-height, 90vh);
          max-height: var(--popup-max-height, 90vh);

          /* CENTRADO CORREGIDO: Inset 0 + margin auto es la forma nativa y limpia */
          inset: 0;
          margin: auto;

          /* Animación solo basada en escala y opacidad */
          transform: scale(0.92);
          opacity: 0;

          background-color: var(--overlay-first, #2C2C2C);
          font-family: var(--font-ui, sans-serif);
          color: var(--color-text, #FFFFFF);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;

          transition:
            transform var(--duration-medium, 0.2s) var(--ease-panel, ease),
            opacity var(--duration-medium, 0.2s) var(--ease-panel, ease);
        }

        dialog.visible {
          transform: scale(1);
          opacity: 1;
        }

        dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.75);
          opacity: 0;
          transition: opacity var(--duration-medium, 0.2s) var(--ease-panel, ease);
        }

        dialog.visible::backdrop {
          opacity: 1;
        }

        .popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          flex-shrink: 0; /* Evita que el header se aplaste si hay mucho contenido */
        }

        .popup-header h1 {
          margin: 0;
          font-size: var(--font-size-2xl, 1.5rem);
          font-weight: 600;
        }

        /* CONTENIDO CORREGIDO: Permite scroll interno y no deforma el modal */
        .popup-body {
          flex: 1;
          min-height: 0; /* Permite reducir el tamaño en Flexbox */
          overflow-y: hidden;
          overflow-x: hidden;
        }
      </style>

      <dialog>
        <header class="popup-header">
          <slot name="header">
            <h1>${title}</h1>
          </slot>
        </header>
        <main class="popup-body">
          <slot></slot>
        </main>
      </dialog>
    `;
  }

  open() {
    this._cancelPendingClose();

    if (!this.dialog.open) {
      this.dialog.showModal();
    }

    if (this.context && !this._inputContextActive) {
      this._inputContextActive = true;
      input.pushContext(this.context);
      input.on(InputAction.BACK, () => this.close(), this.context);
      this.setupInputController?.();
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.dialog.classList.add("visible");
      });
    });
  }

  close() {
    if (this.context && this._inputContextActive) {
      this._inputContextActive = false;
      while (
        input.contextStack.length > 1 &&
        (input.activeContext === this.context ||
          input.activeContext.startsWith(`${this.context}-`))
      ) {
        input.popContext();
      }
    }

    this.dialog.classList.remove("visible");
    this._cancelPendingClose();

    this._onCloseEnd = (e) => {
      if (e.propertyName !== "transform" && e.propertyName !== "opacity") return;
      this.dialog.close();
      this._cancelPendingClose();
    };

    this.dialog.addEventListener("transitionend", this._onCloseEnd);
  }

  _cancelPendingClose() {
    if (this._onCloseEnd) {
      this.dialog.removeEventListener("transitionend", this._onCloseEnd);
      this._onCloseEnd = null;
    }
  }
}

customElements.define("base-popup", BasePopup);