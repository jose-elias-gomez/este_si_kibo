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
          overflow: hidden;
          min-height: calc(64px + 35px + 40px);
        }
        .slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 64px;
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
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          border: none;
        }
        /* Valor flotante centrado sobre la esfera */
        .thumb-value {
          position: absolute;
          top: 67px;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%);
          pointer-events: none;
          color: #2D86DC;
          font-family: inherit;
          font-size: 1.4rem;
          font-weight: bold;
          letter-spacing: normal; /* Se elimina el spacing para no descentrar */
          line-height: 1;
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

    this.updateSlider();
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

  updateSlider() {
    this._value = Number(this.slider.value);

    if (this.thumbValue && this.slider) {
      const min = Number(this.slider.min) || 0;
      const max = Number(this.slider.max) || 100;
      const val = Number(this.slider.value);
      const percent = (val - min) / (max - min || 1);
      const valStr = String(val);

      this.thumbValue.textContent = valStr;

      // Escalar la fuente si el número tiene 3 o más dígitos para que no sobresalga
      if (valStr.length >= 3) {
        this.thumbValue.style.fontSize = "1.1rem";
      } else {
        this.thumbValue.style.fontSize = "1.4rem";
      }

      // Fórmula corregida: considera los 16px de padding + 24px de radio del thumb (total offset: 40px)
      this.thumbValue.style.left = `calc(40px + (100% - 80px) * ${percent})`;
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