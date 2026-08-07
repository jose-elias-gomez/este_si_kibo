export const InputAction = Object.freeze({
  UP: "UP",
  DOWN: "DOWN",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  CONFIRM: "CONFIRM",
  BACK: "BACK",
});

// Mapeo privado de Teclas -> Acciones de Tu App
const KEY_BINDINGS = Object.freeze({
  ArrowUp: InputAction.UP,
  KeyW: InputAction.UP,

  ArrowDown: InputAction.DOWN,
  KeyS: InputAction.DOWN,

  ArrowLeft: InputAction.LEFT,
  KeyA: InputAction.LEFT,

  ArrowRight: InputAction.RIGHT,
  KeyD: InputAction.RIGHT,

  Enter: InputAction.CONFIRM,
  Space: InputAction.CONFIRM,

  Escape: InputAction.BACK,
});

class InputManager {
  constructor() {
    this.eventhandlers = new Map();
    this.contextStack = ["GLOBAL"]; // el tope de la pila es el contexto activo
    this._initKeyboard();
  }

  /**
   * Contexto actualmente activo (el tope de la pila).
   */
  get activeContext() {
    return this.contextStack[this.contextStack.length - 1];
  }

  /**
   * Entra a un nuevo contexto (ej: abrir un popup o el panel de settings).
   * A partir de este punto, solo se emiten acciones a listeners de este contexto.
   */
  pushContext(context) {
    this.contextStack.push(context);
  }

  /**
   * Sale del contexto activo y vuelve al anterior.
   */
  popContext() {
    if (this.contextStack.length > 1) {
      let context = this.contextStack.pop();
      this.eventhandlers.delete(context);
    }
  }

  /**
   * Suscribe un callback a una acción del sistema, dentro de un contexto.
   * @param {string} action - Una constante de `InputAction`
   * @param {Function} callback
   * @param {string} [context="GLOBAL"] - Contexto al que pertenece este listener
   */
  on(action, callback, context = "GLOBAL") {
    let eventhandler = this.eventhandlers.get(context);
    if (eventhandler == null) {
      eventhandler = new Map();
      this.eventhandlers.set(context, eventhandler);
    }

    let listeners = eventhandler.get(action);
    if (listeners == null) {
      listeners = new Array();
      eventhandler.set(action, listeners);
    }
    listeners.push(callback);
  }

  /**
   * Emite la acción solo a los suscriptores del contexto activo.
   */
  _emit(action) {
    const eventhandler = this.eventhandlers.get(this.activeContext);
    if (eventhandler) {
      let listeners = eventhandler.get(action);
      if (listeners) {
        let executed = 0;
        for (const listener of listeners) {
          listener();
          executed++;
        }
      }
    }
  }

  _initKeyboard() {
    window.addEventListener("keydown", (e) => {
      const action = KEY_BINDINGS[e.code];
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }
      if (action) {
        this._emit(action);
      }
    });
  }
}

export const input = new InputManager();