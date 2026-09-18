import { API_BASE_URL, DEBUG_MODE } from "./common.js";

export const PACKET_ID = {
  SYSTEM_OPTION: 1,
  JOYSTICK: 2,
  GET_PARTS: 3,
  MOVE_PART: 4
};

let socket = null;
const pendingRequests = new Map();
const listeners = new Map();

function connect() {
  socket = new WebSocket(`ws://${API_BASE_URL}/api/ws`);

  socket.onopen = function () {
    console.log("Websocket conectado");
  };

  socket.onmessage = function (event) {
  console.log("[WS CLIENT] MENSAJE RECIBIDO:", event.data);

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

  console.log("[WS CLIENT] JSON:", data);

  if (data.error) {
    console.error("[WS CLIENT] Error del servidor:", data.error);
    return;
  }

  // Request pendiente
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
    console.log(
      "[WS CLIENT] No hay listeners para packet:",
      data.id
    );
  }
};

  socket.onclose = function () {
    pendingRequests.forEach(({ reject }) => reject(new Error("Websocket closed")));
    pendingRequests.clear();
    socket = null;
  };

  socket.onerror = function (error) {
    console.error("WebSocket error:", error);
  };
}

if (!DEBUG_MODE) {
  connect();
}

export function onConnect(timeout = 5000) {
  return new Promise((resolve, reject) => {
    // Si ya está abierto, resolvemos al instante
    if (socket && socket.readyState === WebSocket.OPEN) {
      return resolve();
    }

    if (DEBUG_MODE) {
      return resolve();
    }

    const timer = setTimeout(() => {
      reject(new Error("Timeout esperando la conexión del WebSocket"));
    }, timeout);

    // Revisamos periódicamente la conexión
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

/**
 * Suscribe un handler a todos los paquetes de un tipo dado (por ejemplo
 * PACKET_ID.JOYSTICK, para escuchar los broadcasts que manda el server
 * sin que vengan atados a un request tuyo).
 * Devuelve una función para desuscribirse.
 */
export function onPacket(packetId, handler) {
  if (!listeners.has(packetId)) {
    listeners.set(packetId, new Set());
  }
  listeners.get(packetId).add(handler);

  return () => listeners.get(packetId)?.delete(handler);
}

/**
 * Envía el paquete y retorna una Promise con los datos recibidos del servidor.
 * OJO: si mandás dos requests del mismo packet.id en paralelo, la segunda
 * va a pisar a la primera en pendingRequests (ver nota arriba).
 */
export function sendPacket(packet, receiveResponse = false, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (DEBUG_MODE) {
      console.log("DEBUG_MODE: sendPacket", packet);
      return resolve();
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return reject(new Error(`Websocket not open. Current state: ${socket?.readyState}`));
    }

    const id = packet.id;
    if (id === undefined || id === null) {
      return reject(new Error("Packet must have a valid id"));
    }

    if (receiveResponse) {
      const timer = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`Timeout for the packet: ${JSON.stringify(packet)}`));
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
