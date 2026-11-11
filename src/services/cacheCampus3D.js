import * as THREE from 'three';

export const CACHE_NAME = 'unimap-3d-cache-v2';
export const GLTF_URL = '/Modelo3D/Unimap.gltf';
export const BIN_URL = '/Modelo3D/Unimap.bin';

/**
 * Verifica si el navegador soporta Cache API
 */
export function soportaCacheApi() {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Consulta si los archivos principales del modelo 3D ya están en la Cache API local
 */
export async function estaModeloEnCache() {
  if (!soportaCacheApi()) return false;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    const hasGltf = await cache.match(GLTF_URL);
    const hasBin = await cache.match(BIN_URL);
    return Boolean(hasGltf && hasBin);
  } catch (err) {
    console.warn('Aviso comprobando Cache API:', err.message);
    return false;
  }
}

/**
 * Descarga un recurso mostrando el progreso en tiempo real usando ReadableStream
 */
async function fetchConProgreso(url, onProgreso, pesoAproximadoBytes = 25000000) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al descargar ${url}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : pesoAproximadoBytes;
  
  if (!response.body || typeof ReadableStream === 'undefined') {
    const blob = await response.blob();
    if (onProgreso) onProgreso(100);
    return new Response(blob, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  const reader = response.body.getReader();
  let loaded = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (onProgreso && total > 0) {
      const pct = Math.min(99, Math.round((loaded / total) * 100));
      onProgreso(pct);
    }
  }

  // Combinar chunks en un Uint8Array continuo
  const fullBytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    fullBytes.set(chunk, offset);
    offset += chunk.length;
  }

  if (onProgreso) onProgreso(100);

  return new Response(fullBytes.buffer, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * Prepara e inyecta el modelo 3D en THREE.Cache utilizando Cache API del navegador.
 * Si ya está en caché, la carga es prácticamente instantánea (< 250ms).
 * Si no está, lo descarga, lo almacena en la Cache API local y lo inyecta en memoria.
 * 
 * @param {Function} onProgreso - Callback que recibe (porcentaje, mensaje)
 * @returns {Promise<{ desdeCache: boolean, exito: boolean }>}
 */
export async function prepararCacheThreeJS(onProgreso = () => {}) {
  // Siempre habilitamos el caché en memoria nativo de Three.js
  THREE.Cache.enabled = true;

  if (!soportaCacheApi()) {
    return { desdeCache: false, exito: false };
  }

  try {
    const cache = await window.caches.open(CACHE_NAME);
    let cachedGltf = await cache.match(GLTF_URL);
    let cachedBin = await cache.match(BIN_URL);

    // 1. CASO HIT: Los archivos ya están guardados en el disco del usuario
    if (cachedGltf && cachedBin) {
      if (onProgreso) onProgreso(30, 'Recuperando modelo desde caché local...');
      const gltfText = await cachedGltf.text();
      
      if (onProgreso) onProgreso(70, 'Cargando datos binarios...');
      const binBuffer = await cachedBin.arrayBuffer();

      // Inyectar en THREE.Cache bajo la clave que busca FileLoader
      THREE.Cache.add('file:' + GLTF_URL, gltfText);
      THREE.Cache.add('file:' + BIN_URL, binBuffer);

      if (onProgreso) onProgreso(100, 'Modelo 3D listo en memoria');
      return { desdeCache: true, exito: true };
    }

    // 2. CASO MISS: Primera visita, se descargan y se guardan para siempre en Cache API
    if (onProgreso) onProgreso(5, 'Descargando definición del mapa 3D...');
    const gltfResponse = await fetch(GLTF_URL);
    if (!gltfResponse.ok) throw new Error('No se pudo descargar Unimap.gltf');
    const gltfText = await gltfResponse.text();

    if (onProgreso) onProgreso(15, 'Descargando geometría y texturas del campus (27 MB)...');
    const binResponse = await fetchConProgreso(
      BIN_URL,
      (pct) => {
        // Mapear de 15% a 95%
        const mappedPct = Math.round(15 + (pct * 0.8));
        if (onProgreso) onProgreso(mappedPct, `Descargando campus 3D (${pct}%)...`);
      },
      26899940
    );

    const binBuffer = await binResponse.arrayBuffer();

    // Guardar en la Cache API local del navegador (persistencia en disco)
    try {
      await cache.put(GLTF_URL, new Response(gltfText, {
        headers: { 'Content-Type': 'model/gltf+json' }
      }));
      await cache.put(BIN_URL, new Response(binBuffer.slice(0), {
        headers: { 'Content-Type': 'application/octet-stream' }
      }));
      console.log('⚡ Modelo UniMap guardado con éxito en Cache API del dispositivo.');
    } catch (cacheErr) {
      console.warn('Aviso guardando en Cache API:', cacheErr.message);
    }

    // Inyectar en THREE.Cache
    THREE.Cache.add('file:' + GLTF_URL, gltfText);
    THREE.Cache.add('file:' + BIN_URL, binBuffer);

    if (onProgreso) onProgreso(100, 'Descarga y caché completados');
    return { desdeCache: false, exito: true };

  } catch (error) {
    console.warn('Fallo en acelerador Cache API, recurriendo a carga estándar de Three.js:', error);
    return { desdeCache: false, exito: false };
  }
}

/**
 * Limpia la caché local del modelo 3D (útil si se publica un nuevo modelo)
 */
export async function limpiarCache3D() {
  if (!soportaCacheApi()) return false;
  try {
    return await window.caches.delete(CACHE_NAME);
  } catch (err) {
    return false;
  }
}
