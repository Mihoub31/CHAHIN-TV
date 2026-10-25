const C='chahin-tv-v2',F=['./','index.html','tv.html','manifest-tv.webmanifest','manifest.webmanifest','icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;
e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
