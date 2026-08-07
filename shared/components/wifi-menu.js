/**
 * <wifi-menu> Web Component
 * Encapsula la interfaz de usuario del menú Wi-Fi, listas de redes,
 * animaciones de expansión de opciones y control mediante teclado/controlador.
 */

import { input, InputAction } from "../js/inputController.js";

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      font-family: var(--font-ui, system-ui, -apple-system, sans-serif);
      color: var(--color-text, #ffffff);
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .popup {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .wifi-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
    }

    .wifi-header h1 {
      margin: 0;
      font-size: var(--font-size-2xl, 1.5rem);
      font-weight: 600;
    }

    main {
      flex: 1;
      height: calc(100% - 72px);
      overflow-y: auto;
    }

    /* Lista de redes */
    .wifi-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    /* Card de cada red */
    .wifi-card {
      border-radius: var(--radius-xl, 16px);
      background-color: transparent;
      padding: 32px;
      transition:
        background-color var(--duration-medium, 0.3s) ease,
        transform var(--duration-fast, 0.15s) ease;
    }

    .wifi-card header {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    .wifi-card.hovered {
      background-color: rgba(255, 255, 255, 0.03);
    }

    .wifi-card.selected {
      background-color: var(--color-highlight, rgba(255, 255, 255, 0.08));
    }

    /* El ícono y el texto respiran un poco cuando la card se selecciona */
    .wifi-card.selected .wifi-icon-wrapper {
      transition: transform var(--duration-medium, 0.15s) ease;
    }

    .wifi-card.selected .ssid {
      transition: color var(--duration-medium, 0.15s) ease;
    }

    /* Panel de opciones: sistema de expansión animado con grid-template-rows */
    .wifi-options {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      margin-top: 0;
      transition:
        grid-template-rows var(--duration-medium, 0.15s) ease,
        opacity var(--duration-medium, 0.15s) ease,
        margin-top var(--duration-medium, 0.15s) ease;
    }

    .wifi-options.expanded {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: 16px;
    }

    .wifi-options-inner {
      overflow: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .active {
      margin-bottom: 32px;
    }

    .wifi-password {
      width: 100%;
    }

    /* LÓGICA DE SUPERPOSICIÓN DE LOGOS / ÍCONOS */
    .wifi-icon-wrapper {
      position: relative;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }

    /* El SVG 'full' va de fondo como base deshabilitada/opaca */
    .wifi-icon-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.25;
    }

    /* El SVG de la señal actual sobrepasa arriba */
    .wifi-icon-bars {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    /* Información de red */
    .wifi-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }

    .wifi-info .ssid {
      font-size: var(--font-size-xl, 1rem);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--color-text, #ffffff);
    }

    .wifi-info .status {
      font-size: var(--font-size-lg, 0.75rem);
      color: var(--color-enabled, #4caf50);
      opacity: 0.7;
      margin-top: 2px;
      font-weight: 400;
    }

    h2 {
      font-size: var(--font-size-lg, 1.1rem);
      font-weight: 600;
      margin: 16px 0 8px 0;
    }

    .wifi-btn {
      background-color: transparent;
      color: var(--color-text, #ffffff);
      border: 1px solid var(--color-border, rgba(255, 255, 255, 0.2));
      border-radius: var(--radius-xl, 16px);
      padding: 8px 24px;
      font-size: var(--font-size-lg, 0.9rem);
      font-family: var(--font-ui, inherit);
      cursor: pointer;
      transition: background-color var(--duration-fast, 0.15s);
    }

    .wifi-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .connect-btn {
      align-self: flex-end;
      margin-top: 16px;
    }

    #disable-wifi-content,
    #content {
      transition: opacity var(--duration-medium, 0.3s) ease;
    }

    #disable-wifi-content[hidden],
    #content[hidden] {
      display: none !important;
    }

    #disable-wifi-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 16px;
      width: 100%;
      height: 100%;
    }

    #disable-wifi-content img {
      width: 256px;
      height: 256px;
    }
  </style>

  <div class="popup">
    <header class="wifi-header">
      <h1>Wi-Fi</h1>
      <switch-toggle id="autoConnectToggle" checked></switch-toggle> 
    </header>

    <main>
      <div id="disable-wifi-content" hidden>
        <img src="../shared/assets/wifi/off.svg" alt="Wi-Fi desactivado">
        <h2>Wi-Fi desactivado</h2>
      </div>

      <section id="content">
        <h2>Red actual</h2>
        <article class="wifi-card active">
          <header>
            <div class="wifi-icon-wrapper" data-signal="full">
              <img class="wifi-icon-bg" src="../shared/assets/wifi/full.svg" alt="Señal base">
              <img class="wifi-icon-bars" src="../shared/assets/wifi/full.svg" alt="Barras de señal">
            </div>

            <div class="wifi-info">
              <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
              <span class="status">Conectada, segura</span>
            </div>

            <button class="wifi-btn disconnect-btn">Desconectar</button>
          </header>
        </article>

        <h2>Redes disponibles</h2>
        <ul class="wifi-list">
          <li class="wifi-card">
            <header>
              <div class="wifi-icon-wrapper" data-signal="full">
                <img class="wifi-icon-bg" src="../shared/assets/wifi/full.svg" alt="Señal base">
                <img class="wifi-icon-bars" src="../shared/assets/wifi/full.svg" alt="Barras de señal">
              </div>

              <div class="wifi-info">
                <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
                <span class="status">Requiere contraseña</span>
              </div>
            </header>

            <div class="wifi-options" hidden>
              <div class="wifi-options-inner">
                <text-container class="wifi-password" label="Contraseña" max-length="128"></text-container>
                <button class="wifi-btn connect-btn">Conectar</button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
`;

export class WifiMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.selectedIndex = -1;
  }

  connectedCallback() {
    this._disableWifiContent = this.shadowRoot.getElementById("disable-wifi-content");
    this._enableWifiContent = this.shadowRoot.getElementById("content");
    this._wifiToggleSwitch = this.shadowRoot.getElementById("autoConnectToggle");

    this._setupToggleListener();
    this._setupInputController();
  }

  disconnectedCallback() {
    this._removeInputController();
  }

  _setupToggleListener() {
    if (this._wifiToggleSwitch) {
      this._wifiToggleSwitch.addEventListener("change", (e) => {
        this.updateWifiContent(e.target.checked);
      });
    }
  }

  updateWifiContent(newState) {
    if (!newState) {
      this._enableWifiContent.hidden = true;
      this._disableWifiContent.hidden = false;
      this.clearSelection();
    } else {
      this._disableWifiContent.hidden = true;
      this._enableWifiContent.hidden = false;
    }

    // Emitir evento personalizado hacia el exterior
    this.dispatchEvent(
      new CustomEvent("wifi-toggle", {
        detail: { enabled: newState },
        bubbles: true,
        composed: true
      })
    );
  }

  getWifiCards() {
    return Array.from(this.shadowRoot.querySelectorAll(".wifi-card"));
  }

  selectCard(index) {
    const cards = this.getWifiCards();
    if (cards.length === 0) return;

    // Remover selección anterior
    cards.forEach((card) => card.classList.remove("hovered"));

    // Clamp del índice dentro del rango válido
    if (index < 0) index = 0;
    if (index > cards.length - 1) index = cards.length - 1;

    this.selectedIndex = index;
    const currentCard = cards[this.selectedIndex];
    currentCard.classList.add("hovered");

    currentCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  clearSelection() {
    const cards = this.getWifiCards();
    cards.forEach((card) => card.classList.remove("hovered"));
    this.selectedIndex = -1;
  }

  contextFromSSID(ssid) {
    return "wifi-" + ssid;
  }

  setOptionsExpanded(optionsEl, expand) {
    if (expand) {
      optionsEl.hidden = false;
      requestAnimationFrame(() => {
        optionsEl.classList.add("expanded");
      });
    } else {
      optionsEl.classList.remove("expanded");
      const onEnd = (e) => {
        if (e.propertyName !== "grid-template-rows") return;
        optionsEl.hidden = true;
        optionsEl.removeEventListener("transitionend", onEnd);
      };
      optionsEl.addEventListener("transitionend", onEnd);
    }
  }

  _setupInputController() {
    if (!input || !InputAction) return;

    input.on(InputAction.LEFT, () => {
      if (this._wifiToggleSwitch) {
        this._wifiToggleSwitch.checked = false;
      }
      this.updateWifiContent(false);
    });

    input.on(InputAction.RIGHT, () => {
      if (this._wifiToggleSwitch) {
        this._wifiToggleSwitch.checked = true;
      }
      this.updateWifiContent(true);
    });

    input.on(InputAction.DOWN, () => {
      if (this._enableWifiContent.hidden) return;
      this.selectCard(this.selectedIndex + 1);
    });

    input.on(InputAction.UP, () => {
      if (this._enableWifiContent.hidden) return;
      this.selectCard(this.selectedIndex - 1);
    });

    input.on(InputAction.CONFIRM, () => {
      const cards = this.getWifiCards();
      if (cards.length === 0 || this.selectedIndex < 0) return;

      const currentCard = cards[this.selectedIndex];
      const ssidEl = currentCard.querySelector(".ssid");
      const ssid = ssidEl ? ssidEl.textContent.trim() : "";

      currentCard.classList.remove("hovered");
      currentCard.classList.add("selected");

      const contextID = this.contextFromSSID(ssid);
      input.pushContext(contextID);

      const optionsEl = currentCard.querySelector(".wifi-options");
      const passwordContainer = currentCard.querySelector(".wifi-password");

      input.on(
        InputAction.BACK,
        () => {
          currentCard.classList.remove("selected");
          currentCard.classList.add("hovered");

          if (passwordContainer && typeof passwordContainer.unselect === "function") {
            passwordContainer.unselect();
          }

          if (optionsEl) {
            this.setOptionsExpanded(optionsEl, false);
          }
          currentCard.scrollIntoView({ block: "nearest", behavior: "smooth" });

          input.popContext();
        },
        contextID
      );

      input.on(
        InputAction.DOWN,
        () => {
          if (passwordContainer && typeof passwordContainer.hover === "function") {
            passwordContainer.hover();
          }
        },
        contextID
      );

      input.on(
        InputAction.CONFIRM,
        () => {
          if (passwordContainer && typeof passwordContainer.select === "function") {
            passwordContainer.select();
          }
        },
        contextID
      );

      if (optionsEl) {
        this.setOptionsExpanded(optionsEl, true);
      }
      currentCard.scrollIntoView({ block: "nearest", behavior: "smooth" });

      console.log("Conectando a red SSID:", ssid);
      this.dispatchEvent(
        new CustomEvent("wifi-connect", {
          detail: { ssid },
          bubbles: true,
          composed: true
        })
      );
    });
  }

  _removeInputController() {
    // Método para limpiar manejadores de eventos si la app requiere remoción explícita
  }
}

customElements.define("wifi-menu", WifiMenu);