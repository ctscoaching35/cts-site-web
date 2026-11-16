'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EtatDossier } from '@/lib/app/actionsCourses';
import { dessinerCarte, ACCROCHE_CARTE, COMPTE_INSTAGRAM, HAUTEUR, LARGEUR, nomDuFichier } from '@/lib/app/carteStory';
import type { ModeleCarte } from '@/lib/app/courseLibre';
import { BOUTON, BOUTON_DANGER, BOUTON_SECONDAIRE } from '../Ui';

// Les gestes du dossier de course (lot B) : partager la carte, supprimer le dossier, effacer la stratégie. Chacun reçoit
// l'action à faire (celle du serveur pour un compte, celle de l'onglet pour un visiteur) et ne sait rien d'autre.

const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// L'image de la carte : le logo chargé (s'il ne vient pas, la marque en lettres), la police du site, le dessin, un PNG.
async function fabriquerCarte(m: ModeleCarte): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  const c = canvas.getContext('2d');
  if (!c) return null;
  const famille = getComputedStyle(document.body).fontFamily || 'sans-serif';
  try {
    await Promise.all([800, 700, 600].map((p) => document.fonts.load(`${p} 40px ${famille}`)));
  } catch {
    // La police du système fait l'affaire.
  }
  const logo = await new Promise<HTMLImageElement | null>((fini) => {
    const i = new Image();
    i.onload = () => fini(i);
    i.onerror = () => fini(null);
    i.src = '/logo/cts-logo-white.png';
  });
  dessinerCarte(c, m, { famille, logo });
  return new Promise((fini) => canvas.toBlob((b) => fini(b), 'image/png'));
}

// « Partager ma carte en story » : ouvre l'écran de la carte (maquette « Partager »). La phrase qui invite à la mettre en story
// est celle de la maquette.
export function BoutonPartager({ modele }: { modele: ModeleCarte }) {
  const [ouvert, setOuvert] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [message, setMessage] = useState('');
  const fermer = useRef<HTMLButtonElement>(null);
  // Le modèle est refait à chaque rendu du parent : l'image ne se refabrique qu'à l'ouverture, pas à chaque rendu.
  const modeleRef = useRef(modele);
  modeleRef.current = modele;

  useEffect(() => {
    if (!ouvert) return;
    let vivant = true;
    let url = '';
    setMessage('');
    fabriquerCarte(modeleRef.current).then((blob) => {
      if (!vivant) return;
      if (!blob) { setMessage('La carte n’a pas pu être fabriquée sur cet appareil.'); return; }
      url = URL.createObjectURL(blob);
      setImage({ blob, url });
    });
    fermer.current?.focus();
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('keydown', touche);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      vivant = false;
      document.removeEventListener('keydown', touche);
      document.body.style.overflow = defilement;
      if (url) URL.revokeObjectURL(url);
      setImage(null);
    };
  }, [ouvert]);

  const fichier = () => (image ? new File([image.blob], nomDuFichier(modele.nom), { type: 'image/png' }) : null);
  const telecharger = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = nomDuFichier(modele.nom);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  async function partager() {
    const f = fichier();
    if (!f) return;
    // Le partage du téléphone quand il existe ; sinon l'image se télécharge.
    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({ files: [f] });
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') setMessage('Le partage n’a pas abouti : télécharge l’image, puis mets-la en story.');
      }
    } else telecharger();
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={`${BOUTON_SECONDAIRE} w-full gap-2`}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" {...trait} /></svg>
        Partager ma carte en story
      </button>
      {ouvert && (
        <div role="dialog" aria-modal="true" aria-label="Ta carte de course" className="fixed inset-0 z-50 flex flex-col bg-[#1F1D38]">
          <div className="flex items-center justify-between h-16 px-5 shrink-0">
            <span className="text-[0.8125rem] font-bold text-sand-dark/80 truncate">{modele.nom} · ton dossier de course</span>
            <button ref={fermer} type="button" onClick={() => setOuvert(false)} aria-label="Fermer" className="w-11 h-11 flex items-center justify-center text-white shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden><path d="M6 6l12 12M18 6L6 18" {...trait} strokeWidth={2} /></svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto bg-sand rounded-t-3xl px-5 pt-4 pb-8">
            <div className="mx-auto max-w-sm flex flex-col items-center gap-4">
              <h2 className="text-[1.375rem] font-extrabold text-indigo tracking-tight text-center">Ta carte de course est prête</h2>
              <div className="w-[216px] rounded-2xl overflow-hidden bg-[#1F1D38] shadow-[0_14px_30px_rgba(31,29,56,0.35)]" style={{ aspectRatio: `${LARGEUR} / ${HAUTEUR}` }}>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={`Aperçu de ta carte au format story : ${modele.nom}, ${modele.distance_km} km, ${Math.round(modele.dplus_m)} m D+, et son profil`} className="w-full h-full" />
                ) : <div className="w-full h-full flex items-center justify-center text-xs text-sand-dark/70">{message || 'La carte se prépare…'}</div>}
              </div>
              <p className="text-sm text-[#4A4866] leading-relaxed text-center">
                Mets-la en story : montre ta course à ceux qui la préparent avec toi, et identifie {COMPTE_INSTAGRAM}.
              </p>
              {message && image && <p role="status" className="text-sm text-[#9A3B2C] text-center">{message}</p>}
              <button type="button" onClick={partager} disabled={!image} className={`${BOUTON} w-full`}>Partager en story</button>
              <button type="button" onClick={telecharger} disabled={!image} className={`${BOUTON_SECONDAIRE} w-full`}>Télécharger l’image</button>
              <button type="button" onClick={() => setOuvert(false)} className="min-h-11 px-4 text-sm font-bold text-teal">Fermer</button>
              <span className="sr-only">{ACCROCHE_CARTE}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// « Supprimer ce dossier » : une confirmation, puis l'action, puis la liste.
export function SupprimerDossier({ action, apres }: { action: () => Promise<EtatDossier>; apres: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  return (
    <details>
      <summary className="cursor-pointer list-none inline-flex items-center min-h-11 text-sm font-semibold text-[#5E5C78] underline underline-offset-2">Supprimer ce dossier</summary>
      <div className="pb-1 space-y-2">
        <p className="text-sm text-[#4A4866]">Ce dossier s’efface, sans retour possible.</p>
        {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
        <button type="button" disabled={enCours} className={BOUTON_DANGER} onClick={async () => {
          setEnCours(true);
          const r = await action();
          if (!r.ok) { setMessage(r.message); setEnCours(false); return; }
          router.push(apres);
          router.refresh();
        }}>Confirmer</button>
      </div>
    </details>
  );
}

// « Effacer ma stratégie » (le même geste que dans la fiche de course des acheteurs).
export function EffacerStrategie({ action }: { action: () => Promise<EtatDossier> }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  return (
    <details>
      <summary className="cursor-pointer list-none inline-flex items-center min-h-11 text-sm font-semibold text-[#5E5C78] underline underline-offset-2">Effacer ma stratégie</summary>
      <div className="pb-1 space-y-2">
        <p className="text-sm text-[#4A4866]">Ta stratégie gardée s’efface ; le calculateur reste là pour la refaire.</p>
        {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
        <button type="button" className={BOUTON_DANGER} onClick={async () => {
          const r = await action();
          if (!r.ok) { setMessage(r.message); return; }
          router.refresh();
        }}>Confirmer</button>
      </div>
    </details>
  );
}
