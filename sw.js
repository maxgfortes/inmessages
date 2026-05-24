const CACHE_VERSION = 'v1';
const STATIC_CACHE = `inMessages-static-${CACHE_VERSION}`;
const MSG_CACHE    = `inMessages-messages-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './direct.html',
  './login.html',
  './register.html',
  './src/style/direct.css',
  './src/style/login.css',
  './src/style/register.css',
  './src/style/root.css',
  './src/components/direct-chat.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== MSG_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (
    request.destination === 'script'   ||
    request.destination === 'style'    ||
    request.destination === 'document' ||
    request.destination === 'font'     ||
    request.destination === 'image'
  ) {
    event.respondWith(staleWhileRevalidate(STATIC_CACHE, request));
    return;
  }

  event.respondWith(networkFirst(STATIC_CACHE, request));
});

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || await networkFetch;
}

async function networkFirst(cacheName, request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline — check your connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

self.addEventListener('message', async event => {
  const { type, payload } = event.data || {};

  if (type === 'CACHE_MESSAGES') {
    const cache = await caches.open(MSG_CACHE);
    const key = `messages-${payload.conversationId}`;
    await cache.put(
      new Request(key),
      new Response(JSON.stringify(payload.messages), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
    event.ports[0]?.postMessage({ ok: true });
  }

  if (type === 'GET_CACHED_MESSAGES') {
    const cache = await caches.open(MSG_CACHE);
    const key = `messages-${payload.conversationId}`;
    const res = await cache.match(new Request(key));
    const messages = res ? await res.json() : [];
    event.ports[0]?.postMessage({ messages });
  }

  if (type === 'CLEAR_MESSAGE_CACHE') {
    await caches.delete(MSG_CACHE);
    event.ports[0]?.postMessage({ ok: true });
  }
});