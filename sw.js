// CACHE version must be updated manually here on every version bump.
// Hardcoded (not importScripts) so the browser detects this file changed
// and installs the new service worker automatically.
const CACHE = 'rcdd-v59';

// These are always fetched fresh from the network (network-first + cache fallback).
// Keeping them out of the precache list breaks the stale-cache loop: the browser
// always gets a fresh index.html and version.js, so it can detect SW changes on
// every load without the user ever needing to hard-refresh.
const NETWORK_FIRST = ['/Quiz/', '/Quiz/index.html', '/Quiz/version.js'];

const ASSETS = [
  '/Quiz/app.js',
  '/Quiz/manifest.json',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept Firestore — always go to network
  if (url.includes('firestore.googleapis.com') || url.includes('firebase')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for HTML and version: try network, cache on success, fall back to cache if offline
  const path = new URL(url).pathname;
  if (NETWORK_FIRST.includes(path)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (app.js, React, Firebase SDKs)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    })
  );
});
