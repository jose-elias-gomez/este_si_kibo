export const InputAction = Object.freeze({
  UP: "UP",
  DOWN: "DOWN",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  CONFIRM: "CONFIRM",
  BACK: "BACK",
});

/**
 * Mapeo privado de Teclas -> Acciones de Tu App
 */
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

    // El tope de la pila es el contexto activo
    this.contextStack = ["GLOBAL"];

    this._initKeyboard();
    this._initController();
  }

  /**
   * Contexto actualmente activo.
   */
  get activeContext() {
    return this.contextStack[
      this.contextStack.length - 1
    ];
  }

  /**
   * Entra a un nuevo contexto.
   *
   * Ejemplo:
   * GLOBAL -> MENU -> SETTINGS
   */
  pushContext(context) {

    this.contextStack.push(context);
  }

  /**
   * Sale del contexto activo.
   */
  popContext() {

    if (this.contextStack.length > 1) {

      const context =
        this.contextStack.pop();

      this.eventhandlers.delete(context);
    }
  }

  /**
   * Elimina todos los listeners de un contexto
   * sin modificar la pila.
   */
  off(context) {

    this.eventhandlers.delete(context);
  }

  /**
   * Suscribe un callback a una acción.
   *
   * @param {string} action
   * @param {Function} callback
   * @param {string} context
   */
  on(
    action,
    callback,
    context = "GLOBAL"
  ) {

    let eventhandler =
      this.eventhandlers.get(context);

    if (eventhandler == null) {

      eventhandler = new Map();

      this.eventhandlers.set(
        context,
        eventhandler
      );
    }

    let listeners =
      eventhandler.get(action);

    if (listeners == null) {

      listeners = [];

      eventhandler.set(
        action,
        listeners
      );
    }

    listeners.push(callback);
  }

  /**
   * Emite una acción únicamente al contexto activo.
   */
  _emit(action) {

    const eventhandler =
      this.eventhandlers.get(
        this.activeContext
      );

    if (!eventhandler) {
      return;
    }

    const listeners =
      eventhandler.get(action);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {

      try {
        listener();
      } catch (error) {

        console.error(
          "[INPUT] Error en listener:",
          error
        );

      }
    }
  }

  /**
   * ============================================================
   * TECLADO
   * ============================================================
   */
  _initKeyboard() {

    window.addEventListener(
      "keydown",
      (e) => {

        const action =
          KEY_BINDINGS[e.code];

        if (!action) {
          return;
        }

        // Evita comportamiento default del navegador.
        e.preventDefault();

        this._emit(action);
      }
    );
  }

  /**
   * ============================================================
   * CONTROL BLUETOOTH
   * ============================================================
   *
   * Python lee el HID del control y envía por WebSocket:
   *
   * {
   *   "type": "input",
   *   "action": "RIGHT"
   * }
   *
   * Acá simplemente convertimos ese mensaje
   * en un InputAction.
   */
  _initController() {

    const protocol =
      window.location.protocol === "https:"
        ? "wss:"
        : "ws:";

    const host =
      window.location.hostname || "localhost";

    const port =
      window.location.port || "25566";

    const socketUrl =
      `${protocol}//${host}:${port}/api/ws/ws`;

    console.log(
      "[INPUT] Conectando controller:",
      socketUrl
    );

    let socket;

    try {

      socket = new WebSocket(
        socketUrl
      );

    } catch (error) {

      console.error(
        "[INPUT] No se pudo crear WebSocket:",
        error
      );

      return;
    }

    socket.addEventListener(
      "open",
      () => {

        console.log(
          "[INPUT] Controller conectado"
        );

      }
    );

    socket.addEventListener(
      "message",
      (event) => {

        try {

          const data =
            JSON.parse(event.data);

          // Ignorar mensajes que no sean
          // eventos de input.
          if (
            !data ||
            data.type !== "input"
          ) {
            return;
          }

          const action =
            data.action;

          // Verificar que sea una acción válida.
          if (
            action !== InputAction.UP &&
            action !== InputAction.DOWN &&
            action !== InputAction.LEFT &&
            action !== InputAction.RIGHT &&
            action !== InputAction.CONFIRM &&
            action !== InputAction.BACK
          ) {
            console.warn(
              "[INPUT] Acción desconocida:",
              action
            );

            return;
          }

          console.log(
            "[INPUT] Controller:",
            action
          );

          // Mandamos el evento al mismo sistema
          // que utiliza el teclado.
          this._emit(action);

        } catch (error) {

          console.error(
            "[INPUT] Error procesando mensaje:",
            error
          );

        }
      }
    );

    socket.addEventListener(
      "close",
      () => {

        console.log(
          "[INPUT] Controller desconectado"
        );

      }
    );

    socket.addEventListener(
      "error",
      (error) => {

        console.error(
          "[INPUT] WebSocket error:",
          error
        );

      }
    );

    this.controllerSocket = socket;
  }
}

export const input =
  new InputManager();