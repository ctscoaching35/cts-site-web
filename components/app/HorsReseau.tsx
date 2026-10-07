'use client';

import { useEffect } from 'react';

// Enregistre le service worker (public/app-sw.js) : lire son plan sans réseau. En production
// seulement — en développement, il servirait du code périmé — et en HTTPS, seule condition où
// les navigateurs l'acceptent (localhost compris).
export default function HorsReseau() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('/app-sw.js', { scope: '/' }).catch(() => {
      // Sans service worker, l'app marche comme un site : rien à dire à l'athlète.
    });
  }, []);
  return null;
}

// À la déconnexion ou à la suppression du compte : ce que l'appareil a gardé s'efface, pour
// qu'un téléphone partagé ne garde pas le plan de quelqu'un d'autre.
export async function oublierCeQueLAppareilAGarde() {
  try {
    navigator.serviceWorker?.controller?.postMessage('oublier');
    if ('caches' in window) await Promise.all((await caches.keys()).map((cle) => caches.delete(cle)));
  } catch {
    // Rien de gardé : rien à effacer.
  }
}
