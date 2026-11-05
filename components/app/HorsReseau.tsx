'use client';

import { useEffect, useState } from 'react';

// « 30 mars, 8h12 », à l'heure de Paris.
const quand = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const [h, m] = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).split(':');
  return `${jour}, ${Number(h)}h${m}`;
};

// Enregistre le service worker (public/app-sw.js) : lire son plan sans réseau. En production
// seulement — en développement, il servirait du code périmé — et en HTTPS, seule condition où
// les navigateurs l'acceptent (localhost compris).
// C8 (audits du 05/11/2026) : hors réseau, l'app le dit en une ligne, avec l'heure de ce qu'elle montre (rendu : l'heure
// où le serveur a fait la page, gardée avec elle par le service worker). BROUILLON, à valider par le coach.
export default function HorsReseau({ rendu }: { rendu?: string }) {
  const [horsReseau, setHorsReseau] = useState(false);
  useEffect(() => {
    const lire = () => setHorsReseau(!navigator.onLine);
    lire();
    window.addEventListener('online', lire);
    window.addEventListener('offline', lire);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/app-sw.js', { scope: '/' }).catch(() => {
        // Sans service worker, l'app marche comme un site : rien à dire à l'athlète.
      });
    }
    return () => {
      window.removeEventListener('online', lire);
      window.removeEventListener('offline', lire);
    };
  }, []);
  if (!horsReseau) return null;
  const date = rendu ? quand(rendu) : null;
  return (
    <p role="status" className="fixed top-0 inset-x-0 z-30 bg-[#2F2D4E] text-white text-xs font-semibold text-center px-4 py-2">
      {date ? `Hors réseau : ce que tu vois date du ${date}.` : 'Hors réseau : ce que tu vois n’est peut-être pas à jour.'}
    </p>
  );
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
