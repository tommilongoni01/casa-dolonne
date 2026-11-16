// Servizio offline: i file dell'app vengono tenuti in cache, così si apre anche senza rete
// (i dati condivisi richiedono comunque la connessione). Cambia VERSIONE a ogni aggiornamento.
const VERSIONE = 'casa-dolonne-22';

self.addEventListener('install', evento => {
    self.skipWaiting();
    evento.waitUntil(caches.open(VERSIONE).then(cache => cache.addAll([
        './', './index.html', './css/app.css', './manifest.webmanifest',
        './vendor/vue.esm-browser.prod.js', './vendor/supabase.js', './vendor/qrcode.js', './icone/icona-180.png'
    ])));
});

self.addEventListener('activate', evento => {
    evento.waitUntil((async () => {
        for (const nome of await caches.keys()) if (nome !== VERSIONE) await caches.delete(nome);
        await self.clients.claim();
    })());
});

// File dell'app: prima la rete (per avere sempre l'ultima versione), la cache se offline.
self.addEventListener('fetch', evento => {
    const richiesta = evento.request;
    if (richiesta.method !== 'GET' || new URL(richiesta.url).origin !== self.location.origin) return;
    evento.respondWith((async () => {
        try {
            // "no-cache": chiede sempre al server se il file è cambiato, invece di usare
            // la copia del browser (GitHub Pages la considera valida per 10 minuti).
            const risposta = await fetch(richiesta, { cache: 'no-cache' });
            if (risposta.ok) (await caches.open(VERSIONE)).put(richiesta, risposta.clone());
            return risposta;
        } catch {
            return (await caches.match(richiesta)) ?? (await caches.match('./index.html'));
        }
    })());
});
