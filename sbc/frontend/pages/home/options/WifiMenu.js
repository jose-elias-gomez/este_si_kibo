/**
 * <wifi-menu> Web Component
 * Encapsula la interfaz de usuario del menú Wi-Fi, listas de redes,
 * animaciones de expansión de opciones y control mediante teclado/controlador.
 */

import { input, InputAction } from "../../../shared/js/inputController.js";
import { BasePopup } from "../../../shared/components/BasePopup.js";

// Contenido que se proyecta en el slot="header" del BasePopup
const headerTemplate = document.createElement("template");
headerTemplate.innerHTML = `
  <h1>Wi-Fi</h1>
  <switch-toggle id="autoConnectToggle" checked></switch-toggle>
`;

// Contenido que se proyecta en el slot por defecto (popup-body) del BasePopup
const bodyTemplate = document.createElement("template");
bodyTemplate.innerHTML = `
  <style>
    /* Estos estilos viven en el light DOM de <wifi-menu>, por lo que
       aplican al contenido proyectado dentro de los slots del BasePopup. */

    wifi-menu [slot="header"] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    /* Lista de redes */
    wifi-menu .wifi-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    /* Card de cada red */
    wifi-menu .wifi-card {
      border-radius: var(--radius-xl, 16px);
      background-color: transparent;
      padding: 32px;
      transition:
        background-color var(--duration-medium, 0.3s) ease,
        transform var(--duration-fast, 0.15s) ease;
    }

    wifi-menu .wifi-card header {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    wifi-menu .wifi-card.hovered {
      background-color: rgba(255, 255, 255, 0.03);
    }

    wifi-menu .wifi-card.selected {
      background-color: var(--color-highlight, rgba(255, 255, 255, 0.08));
    }

    wifi-menu .wifi-card.selected .wifi-icon-wrapper {
      transition: transform var(--duration-medium, 0.15s) ease;
    }

    wifi-menu .wifi-card.selected .ssid {
      transition: color var(--duration-medium, 0.15s) ease;
    }

    /* Panel de opciones: sistema de expansión animado con grid-template-rows */
    wifi-menu .wifi-options {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      margin-top: 0;
      transition:
        grid-template-rows var(--duration-medium, 0.15s) ease,
        opacity var(--duration-medium, 0.15s) ease,
        margin-top var(--duration-medium, 0.15s) ease;
    }

    wifi-menu .wifi-options.expanded {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: 16px;
    }

    wifi-menu .wifi-options-inner {
      overflow: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    wifi-menu .active {
      margin-bottom: 32px;
    }

    wifi-menu .wifi-password {
      width: 100%;
    }

    wifi-menu .wifi-icon-wrapper {
      position: relative;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }

    wifi-menu .wifi-icon-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.25;
    }

    wifi-menu .wifi-icon-bars {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    wifi-menu .wifi-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }

    wifi-menu .wifi-info .ssid {
      font-size: var(--font-size-xl, 1rem);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--color-text, #ffffff);
    }

    wifi-menu .wifi-info .status {
      font-size: var(--font-size-lg, 0.75rem);
      color: var(--color-enabled, #4caf50);
      opacity: 0.7;
      margin-top: 2px;
      font-weight: 400;
    }

    wifi-menu h2 {
      font-size: var(--font-size-lg, 1.1rem);
      font-weight: 600;
      margin: 16px 0 8px 0;
    }

    wifi-menu .connect-btn {
      align-self: flex-end;
      margin-top: 16px;
    }

    wifi-menu #disable-wifi-content,
    wifi-menu #content {
      transition: opacity var(--duration-medium, 0.3s) ease;
    }

    wifi-menu #disable-wifi-content[hidden],
    wifi-menu #content[hidden] {
      display: none !important;
    }

    wifi-menu #disable-wifi-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 16px;
      width: 100%;
      height: 100%;
    }

    wifi-menu #disable-wifi-content img {
      width: 256px;
      height: 256px;
    }
    wifi-menu #disable-wifi-content h2 {
      font-size: 3rem;
    }
  </style>

  <div id="disable-wifi-content" hidden>
    <img src="../../shared/assets/wifi/off.svg" alt="Wi-Fi desactivado">
    <h2>Wi-Fi desactivado</h2>
  </div>

  <section id="content">
    <h2>Red actual</h2>
    <article class="wifi-card active">
      <header>
        <div class="wifi-icon-wrapper" data-signal="full">
          <img class="wifi-icon-bg" src="../../shared/assets/wifi/full.svg" alt="Señal base">
          <img class="wifi-icon-bars" src="../../shared/assets/wifi/full.svg" alt="Barras de señal">
        </div>

        <div class="wifi-info">
          <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
          <span class="status">Conectada, segura</span>
        </div>

        <generic-btn class="disconnect-btn">Desconectar</generic-btn>
      </header>
    </article>

    <h2>Redes disponibles</h2>
    <ul class="wifi-list">
          <li class="wifi-card">
        <header>
          <div class="wifi-icon-wrapper" data-signal="full">
            <img class="wifi-icon-bg" src="../../shared/assets/wifi/full.svg" alt="Señal base">
            <img class="wifi-icon-bars" src="../../shared/assets/wifi/full.svg" alt="Barras de señal">
          </div>

          <div class="wifi-info">
            <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
            <span class="status">Requiere contraseña</span>
          </div>
        </header>

        <div class="wifi-options" hidden>
          <div class="wifi-options-inner">
            <text-container class="wifi-password" label="Contraseña" max-length="128"></text-container>
            <generic-btn class="connect-btn">Conectar</generic-btn>
          </div>
        </div>
      </li>      <li class="wifi-card">
        <header>
          <div class="wifi-icon-wrapper" data-signal="full">
            <img class="wifi-icon-bg" src="../../shared/assets/wifi/full.svg" alt="Señal base">
            <img class="wifi-icon-bars" src="../../shared/assets/wifi/full.svg" alt="Barras de señal">
          </div>

          <div class="wifi-info">
            <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
            <span class="status">Requiere contraseña</span>
          </div>
        </header>

        <div class="wifi-options" hidden>
          <div class="wifi-options-inner">
            <text-container class="wifi-password" label="Contraseña" max-length="128"></text-container>
            <generic-btn class="connect-btn">Conectar</generic-btn>
          </div>
        </div>
      </li>      <li class="wifi-card">
        <header>
          <div class="wifi-icon-wrapper" data-signal="full">
            <img class="wifi-icon-bg" src="../../shared/assets/wifi/full.svg" alt="Señal base">
            <img class="wifi-icon-bars" src="../../shared/assets/wifi/full.svg" alt="Barras de señal">
          </div>

          <div class="wifi-info">
            <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
            <span class="status">Requiere contraseña</span>
          </div>
        </header>

        <div class="wifi-options" hidden>
          <div class="wifi-options-inner">
            <text-container class="wifi-password" label="Contraseña" max-length="128"></text-container>
            <generic-btn class="connect-btn">Conectar</generic-btn>
          </div>
        </div>
      </li>      <li class="wifi-card">
        <header>
          <div class="wifi-icon-wrapper" data-signal="full">
            <img class="wifi-icon-bg" src="../../shared/assets/wifi/full.svg" alt="Señal base">
            <img class="wifi-icon-bars" src="../../shared/assets/wifi/full.svg" alt="Barras de señal">
          </div>

          <div class="wifi-info">
            <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
            <span class="status">Requiere contraseña</span>
          </div>
        </header>

        <div class="wifi-options" hidden>
          <div class="wifi-options-inner">
            <text-container class="wifi-password" label="Contraseña" max-length="128"></text-container>
            <generic-btn class="connect-btn">Conectar</generic-btn>
          </div>
        </div>
      </li>      <li class="wifi-card">
        <header>
          <div class="wifi-icon-wrapper" data-signal="full">
            <img class="wifi-icon-bg" src="../../shared/assets/wifi/full.svg" alt="Señal base">
            <img class="wifi-icon-bars" src="../../shared/assets/wifi/full.svg" alt="Barras de señal">
          </div>

          <div class="wifi-info">
            <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
            <span class="status">Requiere contraseña</span>
          </div>
        </header>

        <div class="wifi-options" hidden>
          <div class="wifi-options-inner">
            <text-container class="wifi-password" label="Contraseña" max-length="128"></text-container>
            <generic-btn class="connect-btn">Conectar</generic-btn>
          </div>
        </div>
      </li>
      <li class="wifi-card">
        <header>
          <div class="wifi-icon-wrapper" data-signal="full">
            <img class="wifi-icon-bg" src="../../shared/assets/wifi/full.svg" alt="Señal base">
            <img class="wifi-icon-bars" src="../../shared/assets/wifi/full.svg" alt="Barras de señal">
          </div>

          <div class="wifi-info">
            <span class="ssid">GLC_alpha_ac2-5G_E381F</span>
            <span class="status">Requiere contraseña</span>
          </div>
        </header>

        <div class="wifi-options" hidden>
          <div class="wifi-options-inner">
            <text-container class="wifi-password" label="Contraseña" max-length="128"></text-container>
            <generic-btn class="connect-btn">Conectar</generic-btn>
          </div>
        </div>
      </li>
    </ul>
  </section>
`;

export class WifiMenu extends BasePopup {

  constructor() {
    super();
    this.selectedIndex = -1;
  }

  get context() {
    return "wifi-menu";
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

    this._disableWifiContent = this.querySelector("#disable-wifi-content");
    this._enableWifiContent = this.querySelector("#content");
    this._wifiToggleSwitch = this.querySelector("#autoConnectToggle");

    this._setupToggleListener();
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
  }

  getWifiCards() {
    return Array.from(this.querySelectorAll(".wifi-card"));
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
    return this.context + "-" + ssid;
  }

  /**
   * Hace scroll para que se vea, en lo posible, la card completa
   * (header + panel de opciones expandido), en vez de sólo el
   * elemento con foco. Si la card es más alta que el área visible
   * y el elemento con foco (input de contraseña / botón conectar)
   * igual queda cortado, hace un segundo ajuste para asegurar que
   * al menos ese quede a la vista.
   */
  scrollCardIntoView(card, focusEl) {
    if (!card) return;

    card.scrollIntoView({ block: "nearest", behavior: "smooth" });

    if (!focusEl || focusEl === card) return;

    requestAnimationFrame(() => {
      const rect = focusEl.getBoundingClientRect();
      const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!fullyVisible) {
        focusEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  setOptionsExpanded(optionsEl, expand) {
    if (expand) {
      optionsEl.hidden = false;
      requestAnimationFrame(() => {
        optionsEl.classList.add("expanded");
      });

      // Una vez termina la animación de expansión (grid-template-rows
      // 0fr -> 1fr), la card ya tiene su alto final, así que recién ahí
      // hacemos el scroll definitivo para intentar mostrarla completa.
      const card = optionsEl.closest(".wifi-card");
      const onExpandEnd = (e) => {
        if (e.propertyName !== "grid-template-rows") return;
        optionsEl.removeEventListener("transitionend", onExpandEnd);
        this.scrollCardIntoView(card);
      };
      optionsEl.addEventListener("transitionend", onExpandEnd);
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

  _setupInputForActiveWifi(card, context) {
    const disconnectBtn = card.querySelector(".disconnect-btn");

    input.on(InputAction.CONFIRM, () => {
      if (disconnectBtn.isHovered) {
        disconnectBtn.click();
      }
    }, context);

    input.on(InputAction.LEFT, () => disconnectBtn.unhover(), context);
    input.on(InputAction.RIGHT, () => disconnectBtn.hover(), context);
  }

  _setupInputForAvailableWifi(card, context) {
    const connectBtn = card.querySelector(".connect-btn");
    const passwordContainer = card.querySelector(".wifi-password");

    function connectToWifi() {
      const ssidEl = card.querySelector(".ssid");
      const ssid = ssidEl ? ssidEl.textContent.trim() : "";
      const password = passwordContainer ? passwordContainer.text : "";
      const eventDetail = { ssid, password };

      console.log("Conectar a red:", eventDetail);
      if (passwordContainer) {
        passwordContainer.text = "";
      }
    };

    input.on(InputAction.CONFIRM, () => {
      if (passwordContainer !== null && passwordContainer.isHovered) {
        passwordContainer.select();
        return;
      }

      if (connectBtn !== null && connectBtn.isHovered) {
        connectToWifi();
      }
    }, context);

    input.on(InputAction.DOWN, () => {
      if (passwordContainer === null) {
        connectBtn?.hover();
        this.scrollCardIntoView(card, connectBtn);
        return;
      }

      if (passwordContainer.isHovered) {
        passwordContainer.unhover();
        connectBtn?.hover();
        this.scrollCardIntoView(card, connectBtn);
      } else if (!connectBtn.isHovered) {
        passwordContainer.hover();
        this.scrollCardIntoView(card, passwordContainer);
      }

    }, context);

    input.on(InputAction.UP, () => {
      if (connectBtn.isHovered) {
        connectBtn.unhover();
        passwordContainer?.hover();
        this.scrollCardIntoView(card, passwordContainer);
      }
    }, context);
  }

  setupInputController() {
    if (!input || !InputAction) return;
    const globalContext = this.context;

    input.on(InputAction.LEFT, () => {
      if (this._wifiToggleSwitch) {
        this._wifiToggleSwitch.checked = false;
      }
      this.updateWifiContent(false);
    }, globalContext);

    input.on(InputAction.RIGHT, () => {
      if (this._wifiToggleSwitch) {
        this._wifiToggleSwitch.checked = true;
      }
      this.updateWifiContent(true);
    }, globalContext);

    input.on(InputAction.DOWN, () => {
      if (this._enableWifiContent.hidden) return;
      this.selectCard(this.selectedIndex + 1);
    }, globalContext);

    input.on(InputAction.UP, () => {
      if (this._enableWifiContent.hidden) return;
      this.selectCard(this.selectedIndex - 1);
    }, globalContext);

    input.on(InputAction.CONFIRM, () => {
      const cards = this.getWifiCards();
      if (cards.length === 0 || this.selectedIndex < 0) return;

      const currentCard = cards[this.selectedIndex];
      const ssidEl = currentCard.querySelector(".ssid");
      const ssid = ssidEl ? ssidEl.textContent.trim() : "";
      const isActiveCard = this.selectedIndex === 0;
      const options = currentCard.querySelector(".wifi-options");

      currentCard.classList.remove("hovered");
      currentCard.classList.add("selected");

      const contextID = this.contextFromSSID(ssid);
      input.pushContext(contextID);

      // Único handler de BACK para este contexto: hace todo el cleanup
      // de la tarjeta (deshover botones, colapsar opciones, etc.) y recién
      // al final saca el contexto de la pila. Al popearlo, el contexto
      // activo vuelve a ser `globalContext`, donde BACK vuelve a caer en
      // el fallback de BasePopup y una segunda pulsación cierra el popup.
      const exitCardContext = () => {
        currentCard.classList.remove("selected");
        currentCard.classList.add("hovered");

        if (isActiveCard) {
          currentCard.querySelector(".disconnect-btn")?.unhover();
        } else {
          currentCard.querySelector(".wifi-password")?.unselect();
          currentCard.querySelector(".connect-btn")?.unhover();
          this.setOptionsExpanded(options, false);
        }

        currentCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
        input.popContext();
      };

      input.on(InputAction.BACK, exitCardContext, contextID);

      if (isActiveCard) {
        this._setupInputForActiveWifi(currentCard, contextID);
        return;
      }

      this.setOptionsExpanded(options, true);
      currentCard.scrollIntoView({ block: "nearest", behavior: "smooth" });

      this._setupInputForAvailableWifi(currentCard, contextID);
    }, globalContext);
  }

  _removeInputController() {
    if (!input) return;
    input.off(this.context);
  }
}

customElements.define("wifi-menu", WifiMenu);