// Configuración centralizada de la API
// Soporta variable de entorno REACT_APP_API_URL para despliegues en producción (Render, Vercel, etc.)
// En desarrollo local recurre dinámicamente a http://${window.location.hostname}:8000
const DEFAULT_HOST =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? `http://${window.location.hostname}:8000`
    : `${window.location.protocol}//${window.location.hostname}`;

export const API_HOST_URL = process.env.REACT_APP_API_URL || DEFAULT_HOST;
export const API_BASE_URL = `${API_HOST_URL}/api`;
