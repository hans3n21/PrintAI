// Minimale Service-Worker-Datei: manche Clients/Extensions rufen /sw.js ab.
// Ohne diese Datei entstehen ständige 404-Logs im Dev-Server.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
