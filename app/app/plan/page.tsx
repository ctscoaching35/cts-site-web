import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import { Avertissement } from '@/components/app/Texte';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// Mon plan (cadrage, 3.4) : ce que dit la couverture du PDF — repères, date de début, sur
// quoi le plan se construit —, puis ses quatre parties, et l'avertissement santé.
export default async function MonPlan({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const parties: [string, string][] = [
    ['/app/plan/ensemble', plan.architecture.titre],
    ['/app/plan/course', plan.ta_course.titre],
    ['/app/plan/jour-j', plan.jour_j.titre],
    ['/app/plan/mode-emploi', plan.mode_emploi.titre],
  ];
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <div>
          <div className="eyebrow text-teal mb-1">{plan.couverture.surtitre}</div>
          <h1 className="text-2xl text-indigo leading-tight">{plan.course.nom}</h1>
          <p className="text-sm text-indigo/60">{plan.course.format_clair}</p>
        </div>
        <dl className="grid grid-cols-4 bg-white shadow-sm border-t-2 border-teal">
          {plan.couverture.reperes.map(([cle, valeur]) => (
            <div key={cle} className="text-center px-1 py-3">
              <dt className="text-[0.58rem] font-bold tracking-cts-tight uppercase text-teal">{cle}</dt>
              <dd className="font-extrabold text-indigo text-sm leading-tight mt-0.5">{valeur}</dd>
            </div>
          ))}
        </dl>
        <div className="text-center px-2">
          <p className="font-semibold text-indigo">{plan.couverture.debut}</p>
          <p className="text-sm text-indigo/60">{plan.couverture.rendez_vous}</p>
        </div>

        <section>
          <h2 className="eyebrow text-indigo text-center mb-3">{plan.demarche.titre}</h2>
          <div className="grid grid-cols-2 gap-2">
            {plan.demarche.piliers.map(([titre, texte]) => (
              <div key={titre} className="bg-white shadow-sm p-3 text-center">
                <div className="text-[0.62rem] font-bold tracking-cts-tight uppercase text-teal mb-1">{titre}</div>
                <p className="text-xs text-indigo/75 leading-relaxed">{texte}</p>
              </div>
            ))}
          </div>
        </section>

        <nav aria-label="Les parties de ton plan">
          <ul className="bg-white shadow-sm divide-y divide-indigo/10">
            {parties.map(([chemin, titre]) => (
              <li key={chemin}>
                <Link href={lien(chemin, ctx)} className="flex items-center justify-between px-4 py-3.5 hover:bg-sand/60">
                  <span className="font-bold text-indigo">{titre}</span>
                  <span aria-hidden className="text-indigo/30">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Avertissement avertissement={plan.avertissement} />
      </main>
    </>
  );
}
