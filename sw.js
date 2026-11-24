// Bump VERSION whenever any file changes so installed copies update.
const VERSION = "sand-v8";
const SHELL = ["./", "index.html", "style.css", "app.js", "data.js", "manifest.webmanifest",
    "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== "GET") return;
    // Never cache analytics; let it fail quietly offline
    if (url.hostname.includes("googletagmanager.com") || url.hostname.includes("google-analytics.com")) return;
    const isFont = url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com");
    if (url.origin !== location.origin && !isFont) return;
    e.respondWith(
        caches.match(e.request).then((hit) => {
            const net = fetch(e.request).then((res) => {
                if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
                return res;
            }).catch(() => hit || new Response("You're offline, and this page hasn't been saved on this device yet.",
                { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
            return hit || net;
        })
    );
});
