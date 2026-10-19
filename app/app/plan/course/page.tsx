import { Fragment } from 'react';
import EnTeteApp from '@/components/app/EnTeteApp';
import LienFiche from '@/components/app/LienFiche';
import ProfilCourse from '@/components/app/ProfilCourse';
import RepartitionPentes from '@/components/app/RepartitionPentes';
import RetourPlan from '@/components/app/RetourPlan';
import { Lignes, Partie, Puces, Tableau } from '@/components/app/Texte';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { cheminFiche } from '@/lib/app/plan';

// Ta fiche de course (cadrage, 3.4 ; maquette validée le 19/10/2026 : « profil, tronçons, ravitaillement ») : la fiche,
// le profil et ses pentes, ton terrain, les tronçons, les déterminants de la performance, puis ton jour J et ta
// stratégie nutritionnelle de course (cts_contenu), comme la fiche de course privée des coachés.
export default async function TaCourse({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const { profil, terrain, determinants: d, jour_j: j } = plan;
  const t = profil.troncons;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <RetourPlan ctx={ctx} />
        <h1 className="text-2xl text-indigo leading-tight">{plan.ta_course.titre}</h1>
        <div className="bg-white shadow-sm px-4 py-1">
          <Lignes lignes={plan.ta_course.lignes} />
        </div>

        <Partie titre={profil.titre}>
          {profil.sans_trace ? (
            <p>{profil.sans_trace}</p>
          ) : (
            <>
              {profil.points && <ProfilCourse points={profil.points} />}
              {profil.pentes && <RepartitionPentes pentes={profil.pentes} />}
            </>
          )}
        </Partie>

        {terrain && (
          <Partie titre={terrain.titre}>
            <p>{terrain.texte}</p>
          </Partie>
        )}

        {t && (t.homogene || t.tableau) && (
          <Partie titre={t.titre}>
            {t.homogene ? <p>{t.homogene}</p> : t.tableau && <Tableau lignes={t.tableau} />}
          </Partie>
        )}

        <h2 className="text-xl text-indigo leading-tight pt-2">{d.titre}</h2>
        <Partie titre={d.physio.titre}>
          <Puces puces={d.physio.puces} />
        </Partie>
        {d.sans_trace && <p className="text-sm text-indigo/75 px-1">{d.sans_trace}</p>}
        {d.mecanique && (
          <Partie titre={d.mecanique.titre}>
            <Puces puces={d.mecanique.puces} />
          </Partie>
        )}
        {d.secteurs_cles && (
          <Partie titre={d.secteurs_cles.titre}>
            <Puces puces={d.secteurs_cles.puces} />
          </Partie>
        )}

        <h2 id="jour-j" className="text-2xl text-indigo leading-tight pt-4 scroll-mt-20">{j.titre}</h2>
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
