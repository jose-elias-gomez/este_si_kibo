export const API_BASE_URL = 'localhost:25566'; // minecraft reference lol 25565
export const getApiUrl = (path) => `http://${API_BASE_URL}/api/${path}`;

export const DEBUG_MODE = await (async () => {
  try {
    await fetch(getApiUrl("ping"));
    return false;
  } catch (error) {
    console.log(error);
    // Si no responde o falla la red, activa debug_mode (true).
    return true;
  }
})();