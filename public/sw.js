/**
 * UniMap 3D Service Worker - Acelerador de Caché de Recursos 3D
 * Almacena en la Cache API local todos los recursos de /Modelo3D/ (gltf, bin, fbx, texturas)
 * para proporcionar tiempos de carga ultrarrápidos (0ms de red) y navegación offline.
 */

const CACHE_NAME = 'unimap-3d-cache-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('unimap-3d-cache-')) {
            console.log('[SW] Purgando versión antigua de caché 3D:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Interceptar exclusivamente los recursos 3D estáticos del campus
  if (url.pathname.startsWith('/Modelo3D/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // 1. Si existe en caché local, responder inmediatamente desde disco/memoria
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Si no existe, descargar de la red y guardar en caché para la próxima vez
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (networkError) {
          console.warn('[SW] Error de red al solicitar recurso 3D:', url.pathname, networkError);
          return cachedResponse || Promise.reject(networkError);
        }
      })
    );
  }
});
