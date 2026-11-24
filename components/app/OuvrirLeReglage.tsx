'use client';
import { useEffect } from 'react';
import { suivreLAncre } from '@/lib/app/ancresDuReglage';

// « RÉGLAGES » S'OUVRE QUAND UN LIEN MÈNE À UN RÉGLAGE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026, suite ; lib/app/ancresDuReglage.ts). La page d'un athlète (app/app/coach/athlete/[id]/page.tsx)
// range ses réglages dans un `details` replié : une ancre qui est dedans (`#sa-semaine-passee`, `#courses-nolio`, `#son-nolio`, `#retirer`, `#son-entree`) n'ouvrait rien. Ce composant ne
// rend rien : au chargement, à chaque changement de `window.location.hash` et à chaque clic sur un lien qui reste sur la page avec une ancre, il ouvre le `details` « Réglages » (et ses parents `details`)
// qui contient l'élément visé, puis fait défiler jusqu'à lui. L'ouverture qui existe déjà (Nolio pas associé, athlète plus dans l'équipe : `open` de la page) n'est pas touchée. Sous la 8.x, la page ne le rend pas.
export default function OuvrirLeReglage() {
  useEffect(() => suivreLAncre(window, document), []);
  return null;
}
