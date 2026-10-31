const CACHE='qr-attendance-v1';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
const LIBS=[
'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);for(const u of LIBS){try{await c.add(u)}catch(err){}}await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;e.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{const response=await fetch(req);if(new URL(req.url).origin===location.origin){const c=await caches.open(CACHE);c.put(req,response.clone())}return response}catch(err){if(req.mode==='navigate')return caches.match('./index.html');throw err}})())});
