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
  const edge = typeof navigator !== 'undefined' && /Edg\//.test(navigator.userAgent);
  const navigateur = edge ? 'Edge' : 'Chrome';
  return (
    <div className="space-y-3 text-sm text-[#4A4866] leading-relaxed">
      {invitation && (
        <>
          <button type="button" onClick={() => invitation.prompt()} className="btn btn-primary w-full">
            Installer l’app
          </button>
          <p className="text-[0.8125rem] text-[#5E5C78]">L’app CTS s’ouvre ensuite dans sa propre fenêtre, depuis son icône.</p>
        </>
      )}
      {appareil === 'chrome' && !invitation && (
        <>
          <Etapes etapes={[
            <>Repère l’icône <Pastille><IconeInstaller /></Pastille> tout à droite de la barre d’adresse, en haut de ta fenêtre.</>,
            <>Clique dessus, puis sur <strong>« Installer »</strong>.</>,
            <>L’app CTS s’ouvre dans sa propre fenêtre. Tu la retrouves ensuite dans ton Dock (Mac) ou ta barre des tâches (Windows).</>,
          ]} />
          <p className="text-[0.8125rem] text-[#5E5C78]">
            Pas d’icône ? Ouvre le menu <Pastille>⋮</Pastille> de {navigateur} et cherche « Installer »
            {edge ? ' (dans « Applications »)' : ' (dans « Caster, enregistrer et partager »)'}. Si l’app est déjà installée,
            l’icône n’apparaît pas : ouvre-la depuis ton Dock ou ta barre des tâches.
          </p>
        </>
      )}
      {appareil === 'iphone' && (
        <>
          <Etapes etapes={[
            <>Ouvre cette page dans <strong>Safari</strong>.</>,
            <>Touche <strong>Partager</strong> <Pastille><IconePartager /></Pastille>, en bas de l’écran.</>,
            <>Fais défiler, touche <strong>« Sur l’écran d’accueil »</strong>, puis <strong>« Ajouter »</strong>.</>,
          ]} />
          <p className="text-[0.8125rem] text-[#5E5C78]">À sa première ouverture, l’app installée te demande ton e-mail et un code, une fois.</p>
        </>
      )}
      {appareil === 'android' && !invitation && (
        <Etapes etapes={[
          <>Dans <strong>Chrome</strong>, touche le menu <Pastille>⋮</Pastille> en haut à droite.</>,
          <>Touche <strong>« Installer l’application »</strong> (ou « Ajouter à l’écran d’accueil »).</>,
          <>L’app CTS s’ouvre en plein écran depuis son icône.</>,
        ]} />
      )}
      {appareil === 'safari' && (
        <Etapes etapes={[
          <>Dans <strong>Safari</strong>, ouvre le menu <strong>Fichier</strong>, en haut de l’écran.</>,
          <>Clique <strong>« Ajouter au Dock »</strong>, puis <strong>« Ajouter »</strong>.</>,
          <>L’app CTS s’ouvre dans sa propre fenêtre, depuis son icône dans ton Dock.</>,
        ]} />
      )}
      {appareil === 'firefox' && (
        <p>Firefox n’installe pas les apps web : ouvre cette page dans Chrome, Edge ou Safari pour l’installer.</p>
      )}
    </div>
  );
}

// Des étapes numérotées (retour du coach du 20/10/2026 : « pas très clair, on peut pas faire mieux ? »).
function Etapes({ etapes }: { etapes: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {etapes.map((e, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="w-6 h-6 rounded-full bg-[#E1EFEA] text-teal-dark text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
          <span className="pt-0.5">{e}</span>
        </li>
      ))}
    </ol>
  );
}

// Une icône du navigateur, dessinée dans une pastille pour qu'on la reconnaisse.
function Pastille({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center align-middle min-w-7 h-7 px-1.5 mx-0.5 rounded-lg border border-indigo/15 bg-white text-indigo font-bold">
      {children}
    </span>
  );
}

// L'icône d'installation de Chrome et Edge : un écran, une flèche vers le bas.
function IconeInstaller() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-label="icône d’installation">
      <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 7v5.5M9.5 10l2.5 2.5 2.5-2.5M8 20h8" />
    </svg>
  );
}

// Le bouton Partager de Safari : un carré ouvert, une flèche vers le haut.
function IconePartager() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-label="bouton Partager">
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}
