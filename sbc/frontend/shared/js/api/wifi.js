import { DEBUG_MODE, getApiUrl } from './common.js';

// Anticorruption layer for Wi-Fi API calls
export class WifiNetwork {
  constructor(ssid, signal, security, inUse) {
    this.ssid = ssid;
    this.signal = signal;
    this.security = security;
    this.inUse = inUse;
  }
}

export class WifiApiError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'WifiApiError';
    this.detail = detail;
  }
}

export function listWifiNetworks() {
  if (DEBUG_MODE) {
    return Promise.resolve([
      new WifiNetwork('Network 1', 10, 'OPEN', false),
      new WifiNetwork('Network 2', 30, 'WPA2-Personal', false),
      new WifiNetwork('Network 3', 50, 'WPA2-Personal', false),
      new WifiNetwork('Network 4', 90, 'WPA3-Personal', true),
    ]);
  }

  return fetch(getApiUrl('networks'))
    .then(handleResponse)
    .then((networks) =>
      networks.map((n) => new WifiNetwork(n.ssid, n.signal, n.security, n.in_use))
    )
    .catch((error) => {
      console.error('Error fetching Wi-Fi networks:', error);
      throw error;
    });
}

export function getCurrentNetwork() {
  if (DEBUG_MODE) {
    return Promise.resolve({ ssid: 'Network 4', connected: true });
  }

  return fetch(getApiUrl('networks/current'))
    .then(handleResponse)
    .catch((error) => {
      console.error('Error fetching current Wi-Fi network:', error);
      throw error;
    });
}

export function connectToNetwork(ssid, password = null) {
  if (DEBUG_MODE) {
    return Promise.resolve({ ssid, status: 'connected', previous: null });
  }

  return fetch(getApiUrl('networks/connect'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssid, password }),
  })
    .then(handleResponse)
    .catch((error) => {
      console.error(`Error connecting to Wi-Fi network "${ssid}":`, error);
      throw error;
    });
}

export function disconnectFromNetwork() {
  if (DEBUG_MODE) {
    return Promise.resolve({ status: 'disconnected', previous: 'Network 4' });
  }

  return fetch(getApiUrl('networks/disconnect'), {
    method: 'POST',
  })
    .then(handleResponse)
    .catch((error) => {
      console.error('Error disconnecting Wi-Fi:', error);
      throw error;
    });
}
