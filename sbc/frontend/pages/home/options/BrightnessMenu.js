import { BasePopup } from "../../../shared/components/BasePopup.js";
import { input, InputAction } from "../../../shared/js/inputController.js";

const headerTemplate = document.createElement("template");
headerTemplate.innerHTML = `
  <h1>Brillo</h1>
`;

const bodyTemplate = document.createElement("template");
bodyTemplate.innerHTML = `
  <style>
    brightness-menu {
      --popup-height: 60vh;
      display: block;
      height: 100%;
    }

    brightness-menu .brightness-content {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 8px 0;
      box-sizing: border-box;
    }

  </style>

  <div class="brightness-content">
    <range-slider min="30" max="100" value="80">Luminosidad</range-slider>
  </div>
`;

export class BrightnessMenu extends BasePopup {

  constructor() {
    super();
  }

  get context() {
    return "brightness-menu";
  }

  connectedCallback() {
    // Monta el <dialog>/backdrop del BasePopup y crea this.dialog
    super.connectedCallback();

    // Sólo poblamos el light DOM una vez
    if (!this.querySelector("[slot='header']")) {
      const headerFragment = headerTemplate.content.cloneNode(true);
      const headerWrapper = document.createElement("div");
      headerWrapper.setAttribute("slot", "header");
      headerWrapper.append(...headerFragment.childNodes);
      this.appendChild(headerWrapper);

      const bodyFragment = bodyTemplate.content.cloneNode(true);
      this.append(...bodyFragment.childNodes);
    }
  }

  disconnectedCallback() {
    this._removeInputController();
  }

  _removeInputController() {
    if (!input) return;
    input.off(this.context);
  }

  setupInputController() {
    const brightnessSlider = this.querySelector("range-slider");

    input.on(InputAction.LEFT, () => brightnessSlider.step(-1), this.context);
    input.on(InputAction.RIGHT, () => brightnessSlider.step(1), this.context);
  }
}

customElements.define("brightness-menu", BrightnessMenu);