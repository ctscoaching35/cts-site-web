'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Retour from './Retour';

// Une page du site ouverte dans l'app (une fiche, un calculateur, un document), sous la barre d'onglets (décision
// coach du 19/10/2026 : « tout reste dans l'app ») : sans l'en-tête ni le pied du site ; ses liens restent dans l'app
// (une fiche, un calculateur, un document s'ouvrent à leur place dans l'app), un lien vers un autre site s'ouvre
// dans un nouvel onglet.
const DOCUMENTS = ['cgv', 'confidentialite', 'mentions-legales'];

export function versApp(chemin: string, requete = ''): string {
  const morceaux = chemin.replace(/\/+$/, '').split('/').filter(Boolean);
  if (morceaux[0] === 'bibliotheque') return morceaux[1] ? `/app/bibliotheque/${morceaux[1]}` : '/app/bibliotheque';
  if (morceaux[0] === 'calculateurs') return '/app/bibliotheque';
  if (morceaux[0]?.startsWith('calculateur')) return `/app/calculateurs/${morceaux[0]}${requete}`;
  if (morceaux[0] && DOCUMENTS.includes(morceaux[0])) return `/app/document/${morceaux[0]}`;
  if (morceaux[0] === 'app') return `${chemin}${requete}`;
  return '/app';
}

// garder : le calculateur de nutrition ouvert depuis une fiche de course (décision coach du 20/10/2026) ; son bouton
// « Garder ma stratégie » envoie ses réponses et ses repères au cadre, qui les range puis revient à la fiche.
export default function CadreSite({ src, titre, retour, garder }: {
  src: string; titre: string; retour: { href: string; libelle: string };
  garder?: (donnees: unknown) => Promise<{ ok: boolean; message: string }>;
}) {
  const router = useRouter();
  const cadre = useRef<HTMLIFrameElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!garder) return;
    const recevoir = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== cadre.current?.contentWindow) return;
      if ((e.data as { type?: unknown } | null)?.type !== 'cts-strategie') return;
      setMessage('Enregistrement…');
      const r = await garder(e.data).catch(() => ({ ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' }));
      if (r.ok) router.push(retour.href);
      else setMessage(r.message);
    };
    window.addEventListener('message', recevoir);
    return () => window.removeEventListener('message', recevoir);
  }, [garder, retour.href, router]);
  const brancher = () => {
    const doc = cadre.current?.contentDocument;
    if (!doc || doc.getElementById('cts-dans-l-app')) return;
    const style = doc.createElement('style');
    style.id = 'cts-dans-l-app';
    style.textContent = 'header, footer { display: none !important; }';
    doc.head.appendChild(style);
    doc.addEventListener('click', (e) => {
      const a = (e.target as Element | null)?.closest?.('a');
      const href = a?.getAttribute('href') ?? '';
      if (!a || !href || href.startsWith('#')) return;
      let url: URL;
      try {
        url = new URL(href, doc.location.href);
      } catch {
        return;
      }
      e.preventDefault();
      const duSite = url.origin === window.location.origin || /(^|\.)cts-coaching\.com$/.test(url.hostname);
      if (!duSite) {
        window.open(url.href, '_blank', 'noopener');
        return;
      }
      router.push(versApp(url.pathname, url.search));
    });
  };
  // Un cadre déjà chargé avant que la page prenne la main (depuis le cache) : son chargement est passé, on se branche.
  useEffect(() => {
    if (cadre.current?.contentDocument?.readyState === 'complete') brancher();
  });
  // Le cadre occupe l'écran jusqu'à la barre d'onglets (h-16 et la zone sûre, BarreOnglets).
  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-col bg-sand">
      <div className="bg-white border-b border-indigo/[0.08]">
        <div className="mx-auto max-w-2xl h-14 px-2 flex items-center gap-2">
          <Retour href={retour.href} libelle={retour.libelle} />
          <span className="text-sm font-bold text-indigo truncate">{titre}</span>
        </div>
        {message && <p role="status" className="mx-auto max-w-2xl px-4 pb-2 text-sm font-semibold text-indigo">{message}</p>}
      </div>
      <iframe ref={cadre} src={src} title={titre} onLoad={brancher} className="flex-1 w-full border-0 bg-white" />
    </div>
  );
}
