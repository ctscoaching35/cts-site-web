import { notFound } from 'next/navigation';
import EnTeteApp from '@/components/app/EnTeteApp';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { athletesNolio, coachConnecte, estRelie, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';

// La page coach (CTS_NOLIO_CADRAGE.md, N2) : réservée aux comptes de CTS_COACHS. Étape 2 : relier le compte
// Nolio du coach et lire ses athlètes ; les plans des athlètes coachés et l'envoi des semaines suivent (étape 3).
const RESULTATS: Record<string, string> = {
  relie: 'Ton compte Nolio est relié.',
  refus: 'La liaison n’a pas abouti : recommence depuis cette page.',
  erreur: 'Nolio n’a pas accepté la liaison. Vérifie l’adresse de retour déclarée sur le portail API, puis recommence.',
};

export default async function Coach({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const coach = ctx.demonstration ? null : await coachConnecte();
  if (!coach) notFound();
  const r = await searchParams;
  const resultat = typeof r.nolio === 'string' ? RESULTATS[r.nolio] : undefined;
  const relie = nolioConfigure() && (await estRelie(coach.compteId));
  let athletes: AthleteNolio[] | null = null;
  let erreur = false;
  if (relie) {
    try {
      athletes = await athletesNolio(coach.compteId);
    } catch (e) {
      console.error('Athlètes Nolio :', e instanceof Error ? e.message : e);
      erreur = true;
    }
  }
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <h1 className="text-2xl text-indigo">Coach</h1>
        {resultat && <p className="text-sm font-semibold text-indigo bg-white shadow-sm p-3" role="status">{resultat}</p>}
        <section className="bg-white shadow-sm p-4 space-y-3">
          <h2 className="eyebrow text-indigo/60">Nolio</h2>
          {!nolioConfigure() ? (
            <p className="text-sm text-indigo/75">Les clés de l’API Nolio manquent dans Vercel (NOLIO_CLIENT_ID, NOLIO_CLIENT_SECRET).</p>
          ) : relie ? (
            <>
              <p className="text-sm text-indigo">Ton compte Nolio est relié.</p>
              {erreur && <p className="text-sm text-indigo/75">Nolio ne répond pas pour l’instant : réessaie dans un moment.</p>}
              {athletes && (
                <div>
                  <h3 className="text-sm font-bold text-indigo mb-1">Tes athlètes dans Nolio ({athletes.length})</h3>
                  <ul className="text-sm text-indigo/80 divide-y divide-indigo/10">
                    {athletes.map((a) => <li key={a.nolio_id} className="py-1.5">{a.name}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <a href="/app/coach/nolio/relier" className="btn btn-primary !py-2.5 inline-block">Relier mon compte Nolio</a>
          )}
        </section>
      </main>
    </>
  );
}
