// Configuración centralizada de la API de Laravel
const DEFAULT_HOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `http://${window.location.hostname}:8000`
    : 'https://unimap-api.alwaysdata.net';

export const API_HOST_URL = import.meta.env.VITE_API_URL || DEFAULT_HOST;
export const API_BASE_URL = `${API_HOST_URL}/api`;
