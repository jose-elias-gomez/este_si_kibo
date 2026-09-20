import { BasePopup } from "../../../shared/components/BasePopup.js";
import { input, InputAction } from "../../../shared/js/inputController.js";
import { sendPacket, PACKET_ID } from "../../../shared/js/api/client.js";
const headerTemplate = document.createElement("template");
headerTemplate.innerHTML = `<h1>Volumen</h1>`;

const bodyTemplate = document.createElement("template");
bodyTemplate.innerHTML = `
    <style>
        volume-menu {
            --popup-height: 60vh;
            display: block;
            height: 100%;
        }

        volume-menu .volume-content {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            padding: 8px 0;
            box-sizing: border-box;
        }
    </style>

    <div class="volume-content">
        <range-slider min="0" max="100" value="50">Intensidad</range-slider>
    </div>
`;

export class VolumeMenu extends BasePopup {
    constructor() {
        super();
    }

    get context() {
        return "volume-menu";
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

    _step(direction) {
        const volumeSlider = this.querySelector("range-slider");
        if (volumeSlider.step(direction)) {
            sendPacket({
                id: PACKET_ID.SYSTEM_OPTION,
                context: "set_volume",
                value: volumeSlider.value,
            });
        }
    }

    setupInputController() {
        sendPacket({ id: PACKET_ID.SYSTEM_OPTION, context: "get_volume" }, true).then((response) => (this.querySelector("range-slider").value = parseInt(response)));

        input.on(InputAction.LEFT, () => this._step(-1), this.context);
        input.on(InputAction.RIGHT, () => this._step(1), this.context);
    }
}

customElements.define("volume-menu", VolumeMenu);
