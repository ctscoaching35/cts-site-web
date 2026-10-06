import EnTeteApp from '@/components/app/EnTeteApp';
import GraphiqueSemaines from '@/components/app/GraphiqueSemaines';
import RetourPlan from '@/components/app/RetourPlan';
import TexteRiche from '@/components/app/TexteRiche';
import { Partie, Puces } from '@/components/app/Texte';
import { COULEURS_TYPE_SEMAINE } from '@/lib/app/charte';
import { contexte, type Recherche } from '@/lib/app/demonstration';

// « Ton plan en un coup d'œil » et « Ton point de départ » (cts_contenu).
export default async function VueEnsemble({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const a = plan.architecture;
  const [entetes, ...blocs] = a.tableau;
  const depart = plan.point_de_depart;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <RetourPlan ctx={ctx} />
        <h1 className="text-2xl text-indigo leading-tight">{a.titre}</h1>

        <div className="bg-white shadow-sm p-4 space-y-3">
          <GraphiqueSemaines plan={plan} ctx={ctx} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-indigo/75">
            {a.types_semaine.map(([cle, libelle]) => (
              <span key={cle} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5" style={{ backgroundColor: COULEURS_TYPE_SEMAINE[cle] }} />
                {libelle}
              </span>
            ))}
          </div>
          <p className="text-xs text-indigo/60">{a.legende_graphique}</p>
        </div>

        <div className="space-y-2">
          {blocs.map((b) => (
            <article key={b[0]} className="bg-white shadow-sm p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-bold text-indigo">{b[2]}</h2>
                <span className="text-xs text-indigo/55 whitespace-nowrap">{b[0]} · {b[1]}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {[3, 4, 5].map((k) => (
                  <div key={k} className="contents">
                    <dt className="text-indigo/55">{entetes[k]}</dt>
                    <dd className="text-indigo">{b[k]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
          <p className="text-xs text-indigo/60 px-1">{a.note}</p>
        </div>

        <Partie titre={a.roles.titre}>
          <Puces puces={a.roles.blocs.map(([titre, role]) => `<b>${titre}</b> — ${role}`)} />
        </Partie>

        {depart && (
          <Partie titre={depart.titre}>
            {depart.texte && (
              <p>
                <TexteRiche texte={depart.texte} />
              </p>
            )}
            <Puces puces={depart.puces} />
          </Partie>
        )}
      </main>
    </>
  );
}
