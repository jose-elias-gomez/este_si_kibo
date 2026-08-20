import { DEBUG_MODE, getApiUrl } from './common.js';

export class TtsApiError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'TtsApiError';
    this.detail = detail;
  }
}

async function handleResponse(response) {
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      // response body wasn't JSON
    }
    const detail = payload?.detail;
    const message = detail?.message || `TTS request failed with status ${response.status}`;
    throw new TtsApiError(message, detail?.detail);
  }
  return response.json();
}

export function speak(text) {
  if (DEBUG_MODE) {
    console.log(`TTS: "${text}"`);
    return Promise.resolve();
  }

  return fetch(getApiUrl('speak'), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: text,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`TTS request failed with status ${response.status}`);
    }
    return response.json();
  });
}

export function getSpeakStatus() {
  if (DEBUG_MODE) {
    return Promise.resolve({ pending_messages: 0 });
  }

  return fetch(getApiUrl('speak/status'))
    .then(handleResponse)
    .catch((error) => {
      console.error('Error fetching TTS status:', error);
      throw error;
    });
}
