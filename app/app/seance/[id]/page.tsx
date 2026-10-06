import Link from 'next/link';
import { notFound } from 'next/navigation';
import CarteSeance from '@/components/app/CarteSeance';
import EnTeteApp from '@/components/app/EnTeteApp';
import TexteRiche from '@/components/app/TexteRiche';
import { contexte, lien, type Recherche } from '@/lib/app/demonstration';
import { dateLongue, jourParId, tousLesJours } from '@/lib/app/plan';

// La fiche d'une séance (cadrage, 3.3) : la carte en codes, ce qu'est la séance (le glossaire
// du mode d'emploi), comment lire la carte (sa légende), la séance d'avant et d'après.
export default async function FicheSeance({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Recherche;
}) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const { id } = await params;
  const jour = jourParId(plan, decodeURIComponent(id));
  if (!jour) notFound();
  const seances = tousLesJours(plan).filter((j) => j.famille !== 'repos');
  const rang = seances.findIndex((j) => j.id === jour.id);
  const avant = seances[rang - 1];
  const apres = seances[rang + 1];
  const definition = plan.mode_emploi.seances.glossaire.find(([nom]) => nom === jour.definition);
  const lecture = plan.mode_emploi.lire_seance;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <Link href={lien('/app/calendrier', ctx, { s: jour.semaine.numero })} className="text-teal font-semibold text-sm">
          ‹ {jour.semaine.numero} · {jour.semaine.type}
        </Link>
        <div>
          <div className="eyebrow text-teal mb-1">{jour.date_iso ? dateLongue(jour.date_iso) : jour.jour}</div>
          <h1 className="text-2xl text-indigo leading-tight">{jour.seance}</h1>
        </div>
        <CarteSeance jour={jour} titre={false} />

        {definition && (
          <section className="bg-white shadow-sm p-4 text-sm text-indigo/80 leading-relaxed">
            <h2 className="eyebrow text-indigo/60 mb-2">Cette séance</h2>
            <p>
              <strong className="font-bold text-indigo">{definition[0]}</strong> — <TexteRiche texte={definition[1]} />
            </p>
          </section>
        )}

        <details className="bg-white shadow-sm p-4 text-sm text-indigo/80">
          <summary className="eyebrow text-indigo/60 cursor-pointer">{lecture.titre}</summary>
          <p className="mt-3 leading-relaxed">
            <TexteRiche texte={lecture.texte} />
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {lecture.codes.map(([code, sens]) => (
              <div key={code} className="contents">
                <dt className="font-bold text-indigo whitespace-nowrap">{code}</dt>
                <dd>{sens}</dd>
              </div>
            ))}
          </dl>
        </details>

        <nav className="flex justify-between gap-4 text-sm font-semibold">
          {avant ? (
            <Link href={lien(`/app/seance/${avant.id}`, ctx)} className="text-teal">‹ {avant.date}</Link>
          ) : <span />}
          {apres ? (
            <Link href={lien(`/app/seance/${apres.id}`, ctx)} className="text-teal">{apres.date} ›</Link>
          ) : <span />}
        </nav>
      </main>
    </>
  );
}
