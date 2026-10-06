import { Fragment } from 'react';
import EnTeteApp from '@/components/app/EnTeteApp';
import LienFiche from '@/components/app/LienFiche';
import RetourPlan from '@/components/app/RetourPlan';
import { Lignes, Partie, Puces } from '@/components/app/Texte';
import { contexte, type Recherche } from '@/lib/app/demonstration';
import { cheminFiche } from '@/lib/app/plan';

// Ton jour J (cts_contenu.contenu_jour_j) : la stratégie nutritionnelle chiffrée, puis la
// semaine de la course, le matin, pendant, après ; la fiche ultra au-delà de 8h d'effort.
export default async function JourJ({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const j = plan.jour_j;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <RetourPlan ctx={ctx} />
        <h1 className="text-2xl text-indigo leading-tight">{j.titre}</h1>
        <Partie titre={j.nutrition.titre}>
          <Lignes lignes={j.nutrition.lignes} />
          <LienFiche ctx={ctx} href={cheminFiche(plan, j.nutrition.fiche[0])} libelle={j.nutrition.fiche[1]} />
        </Partie>
        {j.parties.map((p) => (
          <Fragment key={p.titre}>
            {/* La fiche ultra se lit après la course, comme sur le PDF. */}
            {p.titre === 'Après' && j.fiche_ultra && (
              <div className="px-1">
                <LienFiche ctx={ctx} href={cheminFiche(plan, j.fiche_ultra[0])} libelle={j.fiche_ultra[1]} />
              </div>
            )}
            <Partie titre={p.titre}>
              <Puces puces={p.puces} />
            </Partie>
          </Fragment>
        ))}
      </main>
    </>
  );
}
