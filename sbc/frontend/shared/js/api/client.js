import { API_BASE_URL, DEBUG_MODE } from "./common.js";

export const PACKET_ID = {
    PING: 0,
    SYSTEM_OPTION: 1,
    GET_PARTS: 2,
    MOVE_PART: 3,
    ASSISTANT_RESPONSE: 4,
};

let socket = null;
let reconnectTimer = null;
let heartbeatInterval = null;

const pendingRequests = new Map();
const listeners = new Map();

function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ id: PACKET_ID.PING }));
        }
    }, 5000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function scheduleReconnect() {
    if (reconnectTimer || DEBUG_MODE) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        console.log("[WS CLIENT] Intentando reconectar al WebSocket...");
        connect();
    }, 3000);
}

function connect() {
    if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }

    socket = new WebSocket(`ws://${API_BASE_URL}/api/ws`);

    socket.onopen = function () {
        console.log("[WS CLIENT] Websocket conectado");
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        startHeartbeat();
    };

    socket.onmessage = function (event) {
        let data;

        try {
            data = JSON.parse(event.data);
        } catch (err) {
            console.error(
                "[WS CLIENT] Mensaje no es JSON válido:",
                event.data,
                err
            );
            return;
        }

        // Ignorar respuestas del Ping para evitar logs innecesarios
        if (data.id === PACKET_ID.PING) {
            return;
        }

        console.log("[WS CLIENT] MENSAJE RECIBIDO:", data);

        if (data.error) {
            console.error("[WS CLIENT] Error del servidor:", data.error);
            return;
        }

        if (data.id !== undefined && pendingRequests.has(data.id)) {
            const { resolve } = pendingRequests.get(data.id);

            pendingRequests.delete(data.id);

            console.log(
                "[WS CLIENT] Resolviendo request:",
                data.id,
                data.payload ?? data
            );

            resolve(data.payload ?? data);
        }

        // Broadcast / listeners
        if (data.id !== undefined && listeners.has(data.id)) {
            console.log(
                "[WS CLIENT] Ejecutando listeners para packet:",
                data.id,
                "listeners:",
                listeners.get(data.id).size
            );

            listeners.get(data.id).forEach((cb) => {
                console.log(
                    "[WS CLIENT] Ejecutando callback con:",
                    data.payload ?? data
                );

                cb(data.payload ?? data);
            });
        } else {
            console.log("[WS CLIENT] No hay listeners para packet:", data.id);
        }
    };

    socket.onclose = function () {
        stopHeartbeat();
        pendingRequests.forEach(({ reject }) =>
            reject(new Error("Websocket closed"))
        );
        pendingRequests.clear();
        socket = null;

        console.warn(
            "[WS CLIENT] WebSocket desconectado. Programando reintento..."
        );
        scheduleReconnect();
    };

    socket.onerror = function (error) {
        console.error("[WS CLIENT] WebSocket error:", error);
    };
}

if (!DEBUG_MODE) {
    connect();
}

export function onConnect(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            return resolve();
        }

        if (DEBUG_MODE) {
            return resolve();
        }

        const timer = setTimeout(() => {
            reject(new Error("Timeout esperando la conexión del WebSocket"));
        }, timeout);

        const checkConnection = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                clearInterval(checkConnection);
                clearTimeout(timer);
                resolve();
            } else if (socket && socket.readyState === WebSocket.CLOSED) {
                clearInterval(checkConnection);
                clearTimeout(timer);
                reject(new Error("El WebSocket se cerró antes de conectarse"));
            }
        }, 50);
    });
}

export function onPacket(packetId, handler) {
    if (!listeners.has(packetId)) {
        listeners.set(packetId, new Set());
    }
    listeners.get(packetId).add(handler);

    return () => listeners.get(packetId)?.delete(handler);
}

export function sendPacket(packet, receiveResponse = false, timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (DEBUG_MODE) {
            console.log("DEBUG_MODE: sendPacket", packet);
            return resolve();
        }

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return reject(
                new Error(
                    `Websocket not open. Current state: ${socket?.readyState}`
                )
            );
        }

        const id = packet.id;
        if (id === undefined || id === null) {
            return reject(new Error("Packet must have a valid id"));
        }

        if (receiveResponse) {
            const timer = setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(
                        new Error(
                            `Timeout for the packet: ${JSON.stringify(packet)}`
                        )
                    );
                }
            }, timeout);

            pendingRequests.set(id, {
                resolve: (data) => {
                    clearTimeout(timer);
                    resolve(data);
                },
                reject: (err) => {
                    clearTimeout(timer);
                    reject(err);
                },
            });
        }

        socket.send(JSON.stringify(packet));
    });
}
