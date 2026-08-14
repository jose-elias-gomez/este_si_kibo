import { BasePopup } from "../../../shared/components/BasePopup.js";
import { input, InputAction } from "../../../shared/js/inputController.js";

const bodyTemplate = document.createElement("template");
bodyTemplate.innerHTML = `
  <style>
    power-menu {
      --popup-height: 60vh;
      display: block;
      height: 100%;
    }

    power-menu .power-content {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 8px 0;
      flex-direction: column;
      box-sizing: border-box;
    }

    power-menu .power-selection {
      margin-top: 8px;
      gap: 8px;
      display: flex;
      align-items: row;
    }

  </style>

  <div class="power-content">
    <h1>¿Estás seguro de apagar?</h1>
    <div class="power-selection">
      <generic-btn id="power-accept">Si</generic-btn>
      <generic-btn id="power-cancel">No</generic-btn>
    </div>
  </div>
`;

export class PowerMenu extends BasePopup {

  constructor() {
    super();
  }

  get context() {
    return "power-menu";
  }

  connectedCallback() {
    // Monta el <dialog>/backdrop del BasePopup y crea this.dialog
    super.connectedCallback();

    // Sólo poblamos el light DOM una vez
    if (!this.querySelector("[slot='header']")) {
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
    const acceptBtn = this.querySelector("#power-accept");
    const cancelBtn = this.querySelector("#power-cancel");

    input.on(InputAction.LEFT, () => {
      acceptBtn.hover();
      cancelBtn.unhover();
    }, this.context);
    
    input.on(InputAction.RIGHT, () => {
      acceptBtn.unhover();
      cancelBtn.hover();
    }, this.context);

    input.on(InputAction.CONFIRM, () => {
      if (acceptBtn.isHovered) {
        acceptBtn.click();
        return;
      }

      if (cancelBtn.isHovered) {
        this.close();
        return;
      }
    }, this.context);
  }
}

customElements.define("power-menu", PowerMenu);