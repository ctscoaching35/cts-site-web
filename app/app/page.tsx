import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AccueilAthlete from '@/components/app/AccueilAthlete';
import { COOKIE_BIENVENUE, COOKIE_DEMARRAGE } from '@/lib/app/bienvenue';
import { contexte, lien, objectifAVenir, type Recherche } from '@/lib/app/contexte';

// L'accueil de l'athlète connecté (components/app/AccueilAthlete.tsx).
export default async function Accueil({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  // La première fois sur cet appareil : l'écran de bienvenue d'un acheteur (cadrage, 2.6), son avertissement santé lu
  // avant d'entrer ; un coaché entre directement (décision coach du 20/10/2026).
  if (!ctx.coache && !(await cookies()).get(COOKIE_BIENVENUE)) redirect(lien('/app/bienvenue', ctx));
  // « Pour bien démarrer » (décision coach du 21/10/2026), tant qu'elle n'est pas masquée sur cet appareil.
  const demarrage = !(await cookies()).get(COOKIE_DEMARRAGE);
  return <AccueilAthlete ctx={ctx} demarrage={demarrage} demande={(await searchParams).demande === 'envoyee'} aVenir={objectifAVenir} />;
}
