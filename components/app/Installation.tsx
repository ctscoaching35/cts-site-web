'use client';

import { useEffect, useState } from 'react';

type Appareil = 'iphone' | 'android' | 'chrome' | 'safari' | 'firefox' | 'installee';

// L'invitation à installer l'app : le bouton « Installer l'app » quand le navigateur le permet (Chrome et Edge, sur
// ordinateur et Android : leur annonce est gardée dès le chargement, app/app/layout.tsx), sinon le geste propre au
// navigateur (Safari n'autorise aucun bouton : Partager › « Sur l'écran d'accueil » sur iPhone, Fichier › « Ajouter au
// Dock » sur Mac ; Firefox n'installe pas les apps web), ou la confirmation qu'elle l'est déjà (retour du coach du
// 20/10/2026 : « un endroit où cliquer pour que l'app se retrouve sur son bureau »).
type InvitationInstallation = Event & { prompt: () => Promise<void> };
type FenetreCts = Window & { __ctsInstallation?: InvitationInstallation };

export default function Installation() {
  const [appareil, setAppareil] = useState<Appareil | null>(null);
  const [invitation, setInvitation] = useState<InvitationInstallation | null>(null);

  useEffect(() => {
    const autonome =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const firefox = /Firefox\//.test(ua);
    const safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg/.test(ua);
    setAppareil(autonome ? 'installee' : ios ? 'iphone' : /Android/.test(ua) ? 'android' : firefox ? 'firefox' : safari ? 'safari' : 'chrome');
    const fenetre = window as FenetreCts;
    const lire = () => setInvitation(fenetre.__ctsInstallation ?? null);
    const installee = () => {
      fenetre.__ctsInstallation = undefined;
      setInvitation(null);
      setAppareil('installee');
    };
    lire();
    window.addEventListener('cts-installation', lire);
    window.addEventListener('appinstalled', installee);
    return () => {
      window.removeEventListener('cts-installation', lire);
      window.removeEventListener('appinstalled', installee);
    };
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
      {appareil === 'chrome' && !invitation && (
        <p>
          Dans <strong>Chrome</strong> ou <strong>Edge</strong>, clique l’icône d’installation à droite de la barre d’adresse
          (un écran avec une flèche), puis <strong>« Installer »</strong> : l’app s’ouvre dans sa propre fenêtre, depuis ton
          Dock ou ta barre des tâches.
        </p>
      )}
      {appareil === 'safari' && (
        <p>
          Dans <strong>Safari</strong>, ouvre le menu <strong>Fichier</strong> puis <strong>« Ajouter au Dock »</strong> :
          l’app s’ouvre dans sa propre fenêtre, depuis son icône.
        </p>
      )}
      {appareil === 'firefox' && (
        <p>Firefox n’installe pas les apps web : ouvre cette page dans Chrome, Edge ou Safari pour l’installer.</p>
      )}
      {invitation && (
        <button type="button" onClick={() => invitation.prompt()} className="btn btn-primary w-full">
          Installer l’app
        </button>
      )}
    </div>
  );
}
