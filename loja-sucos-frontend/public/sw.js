// Service worker mínimo: só existe para o sistema poder ser instalado no celular (e aparecer no
// "Compartilhar" do WhatsApp). Não guarda nada em cache: tudo vem sempre do servidor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request));
});
