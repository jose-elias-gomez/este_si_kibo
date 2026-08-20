import asyncio
import json
import websockets


class ServerConnection:
  def __init__(self, host: str = "localhost", port: int = 8080):
    self.host = host
    self.port = port
    self.connected_clients = set()
    self.server = None

  async def _handler(self, websocket):
    # Registra el cliente al conectarse
    self.connected_clients.add(websocket)
    print(f"[Server] Cliente conectado desde: {websocket.remote_address}")

    try:
      # Mantiene viva la conexión escuchando mensajes salientes/entrantes
      async for message in websocket:
        # Opcional: procesar mensajes recibidos si lo necesitas en el futuro
        pass
    except websockets.exceptions.ConnectionClosed:
      pass
    finally:
      # Remueve automáticamente al cliente si se desconecta
      self.connected_clients.remove(websocket)
      print("[Server] Cliente desconectado.")

  async def start(self):
    """Inicia el servidor WebSocket de forma asíncrona."""
    self.server = await websockets.serve(self._handler, self.host, self.port)
    print(f"[Server] Servidor WebSocket corriendo en ws://{self.host}:{self.port}")

  async def send_packet(self, data, client=None):
    """
    Envía un paquete.
    - Si 'data' es un dict o list, se convierte a JSON automáticamente.
    - Si se especifica 'client', se le envía solo a ese cliente.
    - Si 'client' es None, se envía en broadcast a TODOS los clientes conectados.
    """
    if not self.connected_clients:
      return

    # Serializa a JSON si le pasas un diccionario/lista
    message = json.dumps(data) if isinstance(data, (dict, list)) else data

    if client:
      # Envío a un cliente específico
      if client in self.connected_clients:
        await client.send(message)
    else:
      # Broadcast a todos los clientes activos simultáneamente
      await websockets.broadcast(self.connected_clients, message)


# ==========================================
# Ejemplo de uso / Integración con tu Slider
# ==========================================
async def main():
  server = ServerConnection(host="localhost", port=8080)
  await server.start()

  # Bucle de prueba enviando paquetes continuos a los clientes
  val = 0.0
  while True:
    await asyncio.sleep(0.5)  # Simula eventos periódicos
    val = round((val + 0.1) % 1.0, 2)

    # Enviar paquete de slider a todos los clientes conectados
    packet = {"id": "volume_slider", "val": val}
    await server.send_packet(packet)

if __name__ == "__main__":
  # Ejecuta el event loop de asyncio
  asyncio.run(main())
