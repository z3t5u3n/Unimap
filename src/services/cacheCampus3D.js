import * as THREE from 'three';

export const CACHE_NAME = 'unimap-3d-cache-v2';
export const GLTF_URL = '/Modelo3D/Unimap.gltf';
export const BIN_PART1_URL = '/Modelo3D/Unimap_part1.bin';
export const BIN_PART2_URL = '/Modelo3D/Unimap_part2.bin';

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
    const hasBin1 = await cache.match(BIN_PART1_URL);
    const hasBin2 = await cache.match(BIN_PART2_URL);
    return Boolean(hasGltf && hasBin1 && hasBin2);
  } catch (err) {
    console.warn('Aviso comprobando Cache API:', err.message);
    return false;
  }
}

/**
 * Descarga un recurso mostrando el progreso en tiempo real usando ReadableStream
 */
async function fetchConProgreso(url, onProgreso, pesoAproximadoBytes = 14000000) {
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
    let cachedBin1 = await cache.match(BIN_PART1_URL);
    let cachedBin2 = await cache.match(BIN_PART2_URL);

    // 1. CASO HIT: Los archivos ya están guardados en el disco del usuario
    if (cachedGltf && cachedBin1 && cachedBin2) {
      if (onProgreso) onProgreso(30, 'Recuperando modelo desde caché local...');
      const gltfText = await cachedGltf.text();
      
      if (onProgreso) onProgreso(60, 'Cargando datos binarios (parte 1)...');
      const bin1Buffer = await cachedBin1.arrayBuffer();

      if (onProgreso) onProgreso(85, 'Cargando datos binarios (parte 2)...');
      const bin2Buffer = await cachedBin2.arrayBuffer();

      // Inyectar en THREE.Cache bajo las claves que busca FileLoader
      THREE.Cache.add('file:' + GLTF_URL, gltfText);
      THREE.Cache.add('file:' + BIN_PART1_URL, bin1Buffer);
      THREE.Cache.add('file:' + BIN_PART2_URL, bin2Buffer);

      if (onProgreso) onProgreso(100, 'Modelo 3D listo en memoria');
      return { desdeCache: true, exito: true };
    }

    // 2. CASO MISS: Primera visita, se descargan y se guardan para siempre en Cache API
    if (onProgreso) onProgreso(5, 'Descargando definición del mapa 3D...');
    const gltfResponse = await fetch(GLTF_URL);
    if (!gltfResponse.ok) throw new Error('No se pudo descargar Unimap.gltf');
    const gltfText = await gltfResponse.text();

    if (onProgreso) onProgreso(15, 'Descargando geometría del campus (parte 1/2)...');
    const bin1Response = await fetchConProgreso(
      BIN_PART1_URL,
      (pct) => {
        const mappedPct = Math.round(15 + (pct * 0.4));
        if (onProgreso) onProgreso(mappedPct, `Descargando geometría 1/2 (${pct}%)...`);
      },
      13896172
    );
    const bin1Buffer = await bin1Response.arrayBuffer();

    if (onProgreso) onProgreso(55, 'Descargando geometría del campus (parte 2/2)...');
    const bin2Response = await fetchConProgreso(
      BIN_PART2_URL,
      (pct) => {
        const mappedPct = Math.round(55 + (pct * 0.4));
        if (onProgreso) onProgreso(mappedPct, `Descargando geometría 2/2 (${pct}%)...`);
      },
      13003768
    );
    const bin2Buffer = await bin2Response.arrayBuffer();

    // Guardar en la Cache API local del navegador (persistencia en disco)
    try {
      await cache.put(GLTF_URL, new Response(gltfText, {
        headers: { 'Content-Type': 'model/gltf+json' }
      }));
      await cache.put(BIN_PART1_URL, new Response(bin1Buffer.slice(0), {
        headers: { 'Content-Type': 'application/octet-stream' }
      }));
      await cache.put(BIN_PART2_URL, new Response(bin2Buffer.slice(0), {
        headers: { 'Content-Type': 'application/octet-stream' }
      }));
      console.log('⚡ Modelo UniMap (partes 1 y 2) guardado con éxito en Cache API del dispositivo.');
    } catch (cacheErr) {
      console.warn('Aviso guardando en Cache API:', cacheErr.message);
    }

    // Inyectar en THREE.Cache
    THREE.Cache.add('file:' + GLTF_URL, gltfText);
    THREE.Cache.add('file:' + BIN_PART1_URL, bin1Buffer);
    THREE.Cache.add('file:' + BIN_PART2_URL, bin2Buffer);

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
