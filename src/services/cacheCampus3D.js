import * as THREE from 'three';

export const CACHE_NAME = 'unimap-3d-cache-v3';
export const GLTF_URL = '/Modelo3D/Unimap.gltf';
export const BIN_PART1_URL = '/Modelo3D/Unimap_part1.bin';
export const BIN_PART2_URL = '/Modelo3D/Unimap_part2.bin';
export const BIN_PART3_URL = '/Modelo3D/Unimap_part3.bin';
export const HDR_URL = '/Modelo3D/cielo_kloppenheim_2k.hdr';

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
    const hasBin3 = await cache.match(BIN_PART3_URL);
    return Boolean(hasGltf && hasBin1 && hasBin2 && hasBin3);
  } catch (err) {
    console.warn('Aviso comprobando Cache API:', err.message);
    return false;
  }
}

/**
 * Descarga un recurso mostrando el progreso en tiempo real usando ReadableStream
 */
async function fetchConProgreso(url, onProgreso, pesoAproximadoBytes = 20000000) {
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

function inyectarEnThreeCache(url, bufferOrText) {
  THREE.Cache.add(url, bufferOrText);
  THREE.Cache.add('file:' + url, bufferOrText);
  const baseName = url.split('/').pop();
  if (baseName && baseName !== url) {
    THREE.Cache.add(baseName, bufferOrText);
  }
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
  THREE.Cache.enabled = true;

  if (!soportaCacheApi()) {
    return { desdeCache: false, exito: false };
  }

  try {
    // Purgar versiones previas de la caché 3D para liberar espacio
    try {
      const keys = await window.caches.keys();
      for (const k of keys) {
        if (k.startsWith('unimap-3d-cache-') && k !== CACHE_NAME) {
          console.log('Purgando versión anterior de caché:', k);
          await window.caches.delete(k);
        }
      }
    } catch (_) {}

    const cache = await window.caches.open(CACHE_NAME);
    let cachedGltf = await cache.match(GLTF_URL);
    let cachedBin1 = await cache.match(BIN_PART1_URL);
    let cachedBin2 = await cache.match(BIN_PART2_URL);
    let cachedBin3 = await cache.match(BIN_PART3_URL);

    // 1. CASO HIT: Los archivos ya están guardados en el disco del usuario
    if (cachedGltf && cachedBin1 && cachedBin2 && cachedBin3) {
      if (onProgreso) onProgreso(20, 'Recuperando modelo desde caché local...');
      const gltfText = await cachedGltf.text();
      
      if (onProgreso) onProgreso(45, 'Cargando geometría binaria (1/3)...');
      const bin1Buffer = await cachedBin1.arrayBuffer();

      if (onProgreso) onProgreso(70, 'Cargando geometría binaria (2/3)...');
      const bin2Buffer = await cachedBin2.arrayBuffer();

      if (onProgreso) onProgreso(90, 'Cargando geometría binaria (3/3)...');
      const bin3Buffer = await cachedBin3.arrayBuffer();

      // Inyectar en THREE.Cache bajo todas las claves posibles
      inyectarEnThreeCache(GLTF_URL, gltfText);
      inyectarEnThreeCache(BIN_PART1_URL, bin1Buffer);
      inyectarEnThreeCache(BIN_PART2_URL, bin2Buffer);
      inyectarEnThreeCache(BIN_PART3_URL, bin3Buffer);

      if (onProgreso) onProgreso(100, 'Modelo 3D listo en memoria');
      return { desdeCache: true, exito: true };
    }

    // 2. CASO MISS: Primera visita o modelo actualizado
    if (onProgreso) onProgreso(5, 'Descargando estructura del campus 3D...');
    const gltfResponse = await fetch(GLTF_URL);
    if (!gltfResponse.ok) throw new Error('No se pudo descargar Unimap.gltf');
    const gltfText = await gltfResponse.text();

    if (onProgreso) onProgreso(12, 'Descargando geometría del campus (1/3)...');
    const bin1Response = await fetchConProgreso(
      BIN_PART1_URL,
      (pct) => {
        const mappedPct = Math.round(12 + (pct * 0.28));
        if (onProgreso) onProgreso(mappedPct, `Descargando geometría 1/3 (${pct}%)...`);
      },
      20302908
    );
    const bin1Buffer = await bin1Response.arrayBuffer();

    if (onProgreso) onProgreso(40, 'Descargando geometría del campus (2/3)...');
    const bin2Response = await fetchConProgreso(
      BIN_PART2_URL,
      (pct) => {
        const mappedPct = Math.round(40 + (pct * 0.28));
        if (onProgreso) onProgreso(mappedPct, `Descargando geometría 2/3 (${pct}%)...`);
      },
      20532340
    );
    const bin2Buffer = await bin2Response.arrayBuffer();

    if (onProgreso) onProgreso(68, 'Descargando geometría del campus (3/3)...');
    const bin3Response = await fetchConProgreso(
      BIN_PART3_URL,
      (pct) => {
        const mappedPct = Math.round(68 + (pct * 0.28));
        if (onProgreso) onProgreso(mappedPct, `Descargando geometría 3/3 (${pct}%)...`);
      },
      19861296
    );
    const bin3Buffer = await bin3Response.arrayBuffer();

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
      await cache.put(BIN_PART3_URL, new Response(bin3Buffer.slice(0), {
        headers: { 'Content-Type': 'application/octet-stream' }
      }));
      console.log('⚡ Modelo UniMap (partes 1, 2 y 3) guardado con éxito en Cache API.');
    } catch (cacheErr) {
      console.warn('Aviso guardando en Cache API:', cacheErr.message);
    }

    // Inyectar en THREE.Cache
    inyectarEnThreeCache(GLTF_URL, gltfText);
    inyectarEnThreeCache(BIN_PART1_URL, bin1Buffer);
    inyectarEnThreeCache(BIN_PART2_URL, bin2Buffer);
    inyectarEnThreeCache(BIN_PART3_URL, bin3Buffer);

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
    const keys = await window.caches.keys();
    let ok = true;
    for (const k of keys) {
      if (k.startsWith('unimap-3d-cache-')) {
        const deleted = await window.caches.delete(k);
        if (!deleted) ok = false;
      }
    }
    return ok;
  } catch (err) {
    return false;
  }
}
