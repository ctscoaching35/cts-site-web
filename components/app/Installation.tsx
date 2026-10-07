'use client';

import { useEffect, useState } from 'react';

type Appareil = 'iphone' | 'android' | 'ordinateur' | 'installee';

// L'invitation à installer l'app sur l'écran d'accueil : le geste propre à l'appareil, ou la
// confirmation qu'elle l'est déjà. Sur Android en HTTPS, Chrome propose aussi son propre bouton.
type InvitationInstallation = Event & { prompt: () => Promise<void> };

export default function Installation() {
  const [appareil, setAppareil] = useState<Appareil | null>(null);
  const [invitation, setInvitation] = useState<InvitationInstallation | null>(null);

  useEffect(() => {
    const autonome =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setAppareil(autonome ? 'installee' : ios ? 'iphone' : /Android/.test(ua) ? 'android' : 'ordinateur');
    const retenir = (e: Event) => {
      e.preventDefault();
      setInvitation(e as InvitationInstallation);
    };
    window.addEventListener('beforeinstallprompt', retenir);
    return () => window.removeEventListener('beforeinstallprompt', retenir);
  }, []);

  if (!appareil) return null;
  if (appareil === 'installee') return <p className="text-sm text-indigo/70">L’app est installée sur cet appareil.</p>;
  return (
    <div className="space-y-3 text-sm text-indigo/80 leading-relaxed">
      {appareil === 'iphone' && (
        <>
          <p>
            Dans <strong>Safari</strong>, touche le bouton <strong>Partager</strong> (le carré avec une flèche vers le
            haut), puis <strong>« Sur l’écran d’accueil »</strong>. L’app s’ouvrira en plein écran depuis son icône.
          </p>
          <p className="text-indigo/60">À sa première ouverture, l’app installée te demandera ton e-mail et un code, une fois.</p>
        </>
      )}
      {appareil === 'android' && (
        <p>
          Dans <strong>Chrome</strong>, ouvre le menu <strong>⋮</strong> puis <strong>« Installer l’application »</strong>{' '}
          (ou « Ajouter à l’écran d’accueil »). L’app s’ouvrira en plein écran depuis son icône.
        </p>
      )}
      {appareil === 'ordinateur' && (
        <p>Sur ordinateur, Chrome et Edge proposent de l’installer depuis la barre d’adresse.</p>
      )}
      {invitation && (
        <button type="button" onClick={() => invitation.prompt()} className="btn btn-primary w-full">
          Installer l’app
        </button>
      )}
    </div>
  );
}
