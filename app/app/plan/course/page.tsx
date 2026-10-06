import EnTeteApp from '@/components/app/EnTeteApp';
import ProfilCourse from '@/components/app/ProfilCourse';
import RepartitionPentes from '@/components/app/RepartitionPentes';
import RetourPlan from '@/components/app/RetourPlan';
import { Lignes, Partie, Puces, Tableau } from '@/components/app/Texte';
import { contexte, type Recherche } from '@/lib/app/contexte';

// Ta course (cadrage, 3.4) : la fiche, le profil et ses pentes, ton terrain, les tronçons,
// les déterminants de la performance (cts_contenu).
export default async function TaCourse({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const { profil, terrain, determinants: d } = plan;
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
      </main>
    </>
  );
}
