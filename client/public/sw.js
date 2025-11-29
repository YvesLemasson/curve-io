// Service Worker para curve.io PWA
const CACHE_NAME = 'curve-io-v2'; // Cambiado para forzar actualización
const urlsToCache = [
  '/',
  '/index.html'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Error al cachear', error);
      })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Eliminando cache antiguo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estrategia: Network First, fallback a Cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const requestUrl = event.request.url.toLowerCase();
  
  // Lista de patrones que NO deben ser interceptados por el service worker
  // Si la petición coincide con alguno, dejarla pasar directamente
  const isSocketIO = requestUrl.includes('/socket.io/');
  const isChromeExtension = url.protocol.startsWith('chrome-extension');
  const isWebSocket = url.protocol.startsWith('ws');
  const isNotGet = event.request.method !== 'GET';
  const isAPI = url.pathname.startsWith('/api/');
  
  // Verificar si es un origen diferente (diferente hostname o puerto)
  // Esto captura peticiones a localhost:3001 desde localhost:3000
  const currentOrigin = self.location.origin;
  const requestOrigin = url.origin;
  const isDifferentOrigin = requestOrigin !== currentOrigin;
  
  // Si debemos saltar esta petición, NO interceptarla
  if (isSocketIO || isChromeExtension || isWebSocket || isNotGet || isAPI || isDifferentOrigin) {
    return; // No llamar event.respondWith(), permite que la petición pase directamente
  }
  
  // Solo interceptar peticiones que queremos cachear
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Solo cachear respuestas exitosas y que sean del mismo origen
        if (response.status === 200 && response.type === 'basic') {
          // Clonar la respuesta para poder usarla en el cache
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            })
            .catch((error) => {
              // Silenciar errores de cache (pueden ocurrir con algunos tipos de requests)
              console.warn('Service Worker: Error al cachear', error);
            });
        }
        
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar desde el cache
        return caches.match(event.request);
      })
  );
});

