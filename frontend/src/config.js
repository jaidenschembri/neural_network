// In production (same origin), use relative path. In dev, use localhost.
const DEFAULT_WS_URL = import.meta.env.PROD
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  : 'ws://localhost:8001/ws';

function normalizeWsUrl(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`;
  }
  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`;
  }
  return trimmed;
}

const envWsUrl = normalizeWsUrl(import.meta.env.VITE_WS_URL);

export const WS_URL = envWsUrl || DEFAULT_WS_URL;
export const IS_PROD = import.meta.env.PROD;
