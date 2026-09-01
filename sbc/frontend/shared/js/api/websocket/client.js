import { API_BASE_URL, DEBUG_MODE } from "../common";

let socket = null;
const pendingRequests = new Map();

if (!DEBUG_MODE) {
  socket = new WebSocket(`wss://${API_BASE_URL}/ws`);

  socket.onopen = function() {
		pendingRequests.clear();
		socket = null;
  };

  socket.onmessage = function(event) {
    console.log('Message from server:', event.data);
    
    try {
      const data = JSON.parse(event.data);
      
      if (data && data.id && pendingRequests.has(data.id)) {
        const { resolve } = pendingRequests.get(data.id);
        pendingRequests.delete(data.id);
        resolve(data.payload ?? data);
      }
    } catch (err) {
			console.error(err)
    }
  };

  socket.onclose = function(event) {
    pendingRequests.forEach(({ reject }) => reject(new Error('Websocket closed')));
    pendingRequests.clear();
  };

  socket.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

/**
 * Solo envía el paquete (Sin esperar ninguna respuesta)
 */
export function sendPacket(id, payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id, payload }));
  } else {
    console.error('WebSocket is not open. Current state: ' + socket?.readyState);
  }
}

/**
 * Envía el paquete y retorna una Promise con los datos recibidos del servidor
 */
export function sendPacketAsync(id, payload, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return reject(new Error(`Websocket not open. Current state: ${socket?.readyState}`));
    }

    const timer = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Timeout for the packet: ${id} - ${payload}`));
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
      }
    });

    socket.send(JSON.stringify({ id, payload }));
  });
}