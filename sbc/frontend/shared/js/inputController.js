import { onPacket, PACKET_ID } from "./api/client.js";

export const InputAction = Object.freeze({
    UP: "UP",
    DOWN: "DOWN",
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    CONFIRM: "CONFIRM",
    BACK: "BACK",
    RELOAD: "RELOAD",
});

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

    F5: InputAction.RELOAD,
    KeyR: InputAction.RELOAD,
});

class InputManager {
    constructor() {
        this.eventhandlers = new Map();
        this.contextStack = ["GLOBAL"];
        this._initKeyboard();
    }

    get activeContext() {
        return this.contextStack[this.contextStack.length - 1];
    }

    pushContext(context) {
        this.contextStack.push(context);
    }

    popContext() {
        if (this.contextStack.length > 1) {
            let context = this.contextStack.pop();
            this.eventhandlers.delete(context);
        }
    }

    off(context) {
        this.eventhandlers.delete(context);
    }

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

    _emit(action) {
        const eventhandler = this.eventhandlers.get(this.activeContext);
        if (eventhandler) {
            let listeners = eventhandler.get(action);
            if (listeners) {
                for (const listener of listeners) {
                    listener();
                }
            }
        }
    }

    _initKeyboard() {
        window.addEventListener("keydown", (e) => {
            const action = KEY_BINDINGS[e.code];
            if (action) {
                e.preventDefault();
                this._emit(action);
            }
        });
    }
}

export const input = new InputManager();
