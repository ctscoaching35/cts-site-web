import { Suspense } from 'react';
import { demonstrationOuverte, etatsDuBandeau, notesDeLaSemaine, plansDeDemonstration } from '@/lib/app/demonstration';
import EnTeteMarque, { PastilleCompte } from './EnTeteMarque';
import { initiales, lien, type Contexte } from '@/lib/app/contexte';

// L'en-tête de l'app de l'athlète : l'en-tête unique (EnTeteMarque), et les initiales de l'athlète, qui ouvrent son compte
// (le compte n'est plus un onglet ; refonte de l'app payante, décisions du coach du 16/11/2026).
export default function EnTeteApp({ ctx }: { ctx: Contexte }) {
  return (
    <>
      <EnTeteMarque accueil={lien('/app', ctx)} droite={<PastilleCompte href={lien('/app/compte', ctx)} initiales={initiales(ctx.plan.athlete.nom)} />} />
      {ctx.demonstration && demonstrationOuverte() && <Demonstration ctx={ctx} />}
    </>
  );
}

// Le bandeau de la démonstration (développement seulement) : les plans, le jour simulé, les états à parcourir, et ce
// que le moteur a écrit pour la semaine montrée.
// Son composant n'est chargé qu'en développement : `next build` retire l'import (et le bandeau) du paquet servi.
async function Demonstration({ ctx }: { ctx: Contexte }) {
  if (process.env.NODE_ENV === 'production') return null;
  const { default: BarreDemonstration } = await import('./BarreDemonstration');
  const [plans, groupes, notes] = await Promise.all([plansDeDemonstration(), etatsDuBandeau(), notesDeLaSemaine(ctx)]);
  return (
    <Suspense>
      <BarreDemonstration exemples={Object.entries(plans).map(([cle, x]) => ({ cle, titre: x.titre }))} cle={ctx.cle} jour={ctx.jour}
        sansObjectif={ctx.sansObjectif} groupes={groupes} notes={notes} />
    </Suspense>
  );
}
