import { InputAction, input } from "../js/inputController.js";

export class RangeSlider extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const min = this.getAttribute("min") || "0";
    const max = this.getAttribute("max") || "100";
    const value = this.getAttribute("value") || min;
    const step = this.getAttribute("step") || "1";
    const context = this.getAttribute("context") || "GLOBAL";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          box-sizing: border-box;
        }
        .slidecontainer {
          width: 100%;
          position: relative;
          padding-top: 35px;
          box-sizing: border-box;
        }
        .slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 48px;
          border-radius: 2rem;
          background: #2D86DC;
          padding: 0 16px;
          outline: none;
          margin: 0;
          box-sizing: border-box;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          border: none;
        }
        /* Valor flotante centrado sobre el círculo */
        .thumb-value {
          position: absolute;
          top: 59px; /* Centrado verticalmente respecto a la barra (35px padding-top + 24px mitad de la barra) */
          transform: translate(-50%, -50%);
          pointer-events: none;
          color: #2D86DC; /* Color contrastante con el círculo blanco */
          font-family: inherit;
          font-size: 0.75rem;
          font-weight: bold;
          z-index: 2;
          user-select: none;
        }
        /* Etiquetas de Min, Label central y Max */
        .range-labels {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          text-rendering: optimizeLegibility;
          letter-spacing: 0.1rem;
          color: #ffffff;
          padding: 0 16px;
        }
        .center-label {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          pointer-events: none;
        }
      </style>
      <div class="slidecontainer">
        <input type="range" min="${min}" max="${max}" value="${value}" step="${step}" class="slider" id="myRange">
        <span id="thumbValue" class="thumb-value">${value}</span>
        <div class="range-labels">
          <span id="minLabel">${min}</span>
          <span class="center-label"><slot></slot></span>
          <span id="maxLabel">${max}</span>
        </div>
      </div>
    `;

    // Referencias del Shadow DOM
    this.slider = this.shadowRoot.getElementById("myRange");
    this.thumbValue = this.shadowRoot.getElementById("thumbValue");
    this.context = context;

    // Listeners nativos del <input type="range">
    this.slider.addEventListener("input", () => this.updateSlider());

    // Recalcular si cambia el tamaño de la ventana
    this._onResize = () => this.updateSlider();
    window.addEventListener("resize", this._onResize);

    // Inicializar
    this.updateSlider();

    // Entrar al contexto de input propio de este slider
    input.pushContext(this.context);

    // Suscripciones al InputManager (todas dentro del mismo contexto)
    this._unsubscribers = [
      input.on(InputAction.LEFT, () => this.step(-1), this.context),
      input.on(InputAction.RIGHT, () => this.step(1), this.context),
      input.on(InputAction.CONFIRM, () => this.confirm(), this.context),
      input.on(InputAction.BACK, () => this.back(), this.context),
    ];
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
    if (this._unsubscribers) {
      this._unsubscribers.forEach((unsubscribe) => unsubscribe());
      this._unsubscribers = null;
    }
    input.popContext();
  }

  step(direction) {
    const stepAttr = Number(this.slider.step) || 1;
    const min = Number(this.slider.min) || 0;
    const max = Number(this.slider.max) || 100;
    let newValue = Number(this.slider.value) + direction * stepAttr;
    newValue = Math.min(max, Math.max(min, newValue));
    this.slider.value = newValue;
    this.updateSlider();
    this.slider.dispatchEvent(new Event("input"));
  }

  confirm() {
    input.popContext();
    this.dispatchEvent(
      new CustomEvent("confirm", { detail: { value: this.value } }),
    );
  }

  back() {
    input.popContext();
    this.dispatchEvent(
      new CustomEvent("back", { detail: { value: this.value } }),
    );
  }

  updateSlider() {
    this._value = Number(this.slider.value);

    if (this.thumbValue && this.slider) {
      const min = Number(this.slider.min) || 0;
      const max = Number(this.slider.max) || 100;
      const val = Number(this.slider.value);
      const percent = (val - min) / (max - min || 1);

      this.thumbValue.textContent = val;
      // Posiciona el número sobre el centro del thumb según el porcentaje del valor
      this.thumbValue.style.left = `calc(32px + (100% - 64px) * ${percent})`;
    }
  }

  get value() {
    return this.slider ? this.slider.value : this.getAttribute("value");
  }

  set value(val) {
    if (this.slider) {
      this.slider.value = val;
      this.updateSlider();
    }
  }
}

// Registrar el Web Component
customElements.define("range-slider", RangeSlider);