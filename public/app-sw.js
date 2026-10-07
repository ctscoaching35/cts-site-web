// Le service worker de l'app CTS (cadrage de l'app, étape 1e) : lire son plan sans réseau, en
// montagne. Enregistré par l'app seulement (components/app/Installation.tsx), en production et
// en HTTPS. Le reste du site passe sans être touché.
//
// - Les pages de l'app et les fiches : le réseau d'abord (toujours la dernière version quand il y
//   a du réseau) ; sans réseau, la dernière version vue sur cet appareil.
// - Les fichiers de Next (/_next/static) ne changent jamais à nom égal : la mémoire d'abord.
// - À la déconnexion, l'app demande « oublier » : tout ce qui a été gardé s'efface.
const VERSION = 'cts-app-1';
const PAGES = `${VERSION}-pages`;
const FICHIERS = `${VERSION}-fichiers`;
const GARDES = ['/app', '/bibliotheque', '/pwa/', '/logo/', '/_next/image'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    for (const cle of await caches.keys()) if (!cle.startsWith(VERSION)) await caches.delete(cle);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evenement) => {
  if (evenement.data === 'oublier') {
    evenement.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(FICHIERS)]));
  }
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // Supabase et les autres : jamais gardés
  if (url.pathname.startsWith('/_next/static/')) {
    evenement.respondWith(memoireDabord(requete));
  } else if (GARDES.some((debut) => url.pathname.startsWith(debut))) {
    evenement.respondWith(reseauDabord(requete));
  }
});

async function memoireDabord(requete) {
  const cache = await caches.open(FICHIERS);
  const garde = await cache.match(requete);
  if (garde) return garde;
  const reponse = await fetch(requete);
  if (reponse.ok) cache.put(requete, reponse.clone());
  return reponse;
}

async function reseauDabord(requete) {
  const cache = await caches.open(PAGES);
  try {
    const reponse = await fetch(requete);
    if (reponse.ok && reponse.type === 'basic' && !reponse.redirected) cache.put(requete, reponse.clone());
    return reponse;
  } catch {
    const garde = await cache.match(requete, { ignoreVary: true });
    if (garde) return garde;
    if (requete.mode === 'navigate') {
      const accueil = await cache.match('/app', { ignoreVary: true });
      if (accueil) return accueil;
    }
    return new Response('Pas de réseau, et cette page n’a pas encore été ouverte sur cet appareil.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
