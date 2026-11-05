import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AccueilAthlete from '@/components/app/AccueilAthlete';
import { COOKIE_BIENVENUE, COOKIE_DEMARRAGE, demarrageMasque } from '@/lib/app/bienvenue';
import type { Metadata } from 'next';
import { contexte, lien, objectifAVenir, type Recherche } from '@/lib/app/contexte';

// Le gabarit du titre (app/app/layout.tsx) ne vaut que pour les pages filles : l'accueil écrit le sien en entier.
export const metadata: Metadata = { title: { absolute: 'Accueil · CTS' } };

// L'accueil de l'athlète connecté (components/app/AccueilAthlete.tsx).
export default async function Accueil({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  // La première fois sur cet appareil : l'écran de bienvenue d'un acheteur (cadrage, 2.6), son avertissement santé lu
  // avant d'entrer ; un coaché entre directement (décision coach du 20/10/2026).
  // En démonstration, sans cookie : la bienvenue est un état à part (/app/bienvenue), « Pour bien démarrer » se masque
  // par l'adresse (?demarrage=masque).
  if (!ctx.demonstration && !ctx.coache && !(await cookies()).get(COOKIE_BIENVENUE)) redirect(lien('/app/bienvenue', ctx));
  // « Pour bien démarrer » (décision coach du 21/10/2026), tant qu'elle n'est pas masquée sur cet appareil, pour ce plan
  // (C12 ; un coaché sans objectif : « sans-objectif »).
  const demarrage = ctx.demo ? ctx.demo.demarrage
    : !demarrageMasque((await cookies()).get(COOKIE_DEMARRAGE)?.value, ctx.sansObjectif ? 'sans-objectif' : ctx.cle);
  return <AccueilAthlete ctx={ctx} demarrage={demarrage} demande={(await searchParams).demande === 'envoyee'} aVenir={objectifAVenir} />;
}
