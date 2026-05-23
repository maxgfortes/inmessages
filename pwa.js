
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] registered, scope:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] update available — will apply on next load');
            }
          });
        });
      })
      .catch(err => console.warn('[SW] registration failed:', err));
  });
}

function swMessage(type, payload) {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) { resolve(null); return; }
    const channel = new MessageChannel();
    channel.port1.onmessage = e => resolve(e.data);
    navigator.serviceWorker.controller.postMessage({ type, payload }, [channel.port2]);
    setTimeout(() => reject(new Error('SW timeout')), 3000);
  });
}

export async function cacheMessages(conversationId, messages) {
  try { await swMessage('CACHE_MESSAGES', { conversationId, messages }); }
  catch (e) { console.warn('[SW] cacheMessages failed:', e); }
}

export async function getCachedMessages(conversationId) {
  try {
    const res = await swMessage('GET_CACHED_MESSAGES', { conversationId });
    return res?.messages ?? [];
  } catch { return []; }
}

export async function clearMessageCache() {
  try { await swMessage('CLEAR_MESSAGE_CACHE', {}); }
  catch (e) { console.warn('[SW] clearMessageCache failed:', e); }
}