import { InputAction, input } from "../js/inputController.js";

class SidePanel extends HTMLElement {
    static get observedAttributes() {
        return ["side", "panel-title", "context"];
    }

    get context() {
        return this.getAttribute("side") || "GLOBAL";
    }

    constructor() {
        super();
        this._isOpen = false;

        const shadow = this.attachShadow({ mode: "open" });
        shadow.innerHTML = `
      <style>
        :host {
          display: contents;
          font-family: var(--font-body);
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

        .overlay {
          position: fixed;
          inset: 0;
          background: var(--overlay-backdrop);
          opacity: 0;
          z-index: 999;
          pointer-events: none;
          transition:
            transform var(--duration-medium, 0.2s) var(--ease-panel, ease),
            opacity var(--duration-medium, 0.2s) var(--ease-panel, ease);
        }
        .overlay.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .panel {
          position: fixed;
          background: var(--color-bg);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          pointer-events: none;
          transition:
            transform var(--duration-medium, 0.2s) var(--ease-panel, ease),
            opacity var(--duration-medium, 0.2s) var(--ease-panel, ease);
        }

        .panel.is-open {
          pointer-events: auto;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 1.75rem 0.75rem;
          font-family: var(--font-ui, sans-serif);
          flex-shrink: 0;
        }
        .title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0;
          color: var(--color-h1);
          font-size: var(--font-size-xxl);
          letter-spacing: 0.1rem;
        }

        .body {
          padding-top: 0.75rem;
          overflow-y: auto;
          flex: 1;
        }

        .panel.left {
          top: 0; left: 0; height: 100vh;
          width: min(420px, 88vw);
          border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
          transform: translateX(-105%);
        }
        .panel.left.is-open { transform: translateX(0); }

        .panel.right {
          top: 0; right: 0; height: 100vh;
          width: min(420px, 88vw);
          border-radius: var(--radius-xl) 0 0 var(--radius-xl);
          transform: translateX(105%);
        }
        .panel.right.is-open { transform: translateX(0); }

        .panel.top {
          top: 0; left: 0; width: 100vw;
          height: min(420px, 88vh);
          border-radius: 0 0 var(--radius-xl) var(--radius-xl);
          transform: translateY(-105%);
        }
        .panel.top.is-open { transform: translateY(0); }

        .panel.bottom {
          bottom: 0; left: 0; width: 100vw;
          height: min(420px, 88vh);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          transform: translateY(105%);
        }
        .panel.bottom.is-open { transform: translateY(0); }

        @media (max-width: 640px) {
          :host { --radius-xl: 2rem; }
        }
      </style>

      <div class="overlay" part="overlay"></div>
      <div class="panel" part="panel">
        <div class="header">
          <h2 class="title" part="title"></h2>
        </div>
        <div class="body" part="body">
          <slot></slot>
        </div>
      </div>
    `;

        this._overlay = shadow.querySelector(".overlay");
        this._panel = shadow.querySelector(".panel");
        this._titleEl = shadow.querySelector(".title");
    }

    connectedCallback() {
        this._applySide();
        this._applyTitle();

        // aria + estado inicial: totalmente oculto e inerte para el teclado/lectores
        this._panel.setAttribute("role", "dialog");
        this._panel.setAttribute("aria-modal", "true");
        this._panel.inert = true;
    }

    disconnectedCallback() {
        document.removeEventListener("keydown", this._boundEsc);
    }

    attributeChangedCallback(name) {
        if (name === "side") this._applySide();
        if (name === "panel-title") this._applyTitle();
    }

    _applySide() {
        const side = ["left", "right", "top", "bottom"].includes(
            this.getAttribute("side")
        )
            ? this.getAttribute("side")
            : "right";
        this._panel.classList.remove("left", "right", "top", "bottom");
        this._panel.classList.add(side);
    }

    _applyTitle() {
        this._titleEl.textContent = this.getAttribute("panel-title") || "";
    }

    setTitle(newTitle) {
        this.setAttribute("panel-title", newTitle);
    }

    open() {
        if (this._isOpen) return;
        this._isOpen = true;

        this._panel.inert = false;
        this._overlay.classList.add("is-open");
        this._panel.classList.add("is-open");
        document.body.style.overflow = "hidden";

        if (this.context != null) {
            input.pushContext(this.context);
            input.on(InputAction.BACK, () => this.close(), this.context);
        }
    }

    close() {
        if (!this._isOpen) return;
        this._isOpen = false;

        this._overlay.classList.remove("is-open");
        this._panel.classList.remove("is-open");
        this._panel.inert = true;
        document.body.style.overflow = "";

        if (this.context != null) {
            input.popContext();
        }
    }

    toggle() {
        this._isOpen ? this.close() : this.open();
    }

    get isOpen() {
        return this._isOpen;
    }
}

customElements.define("side-panel", SidePanel);
