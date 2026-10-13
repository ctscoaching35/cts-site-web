import Link from 'next/link';
import { notFound } from 'next/navigation';
import { athletesCoaches } from '@/lib/app/coaching';
import { dateLongue } from '@/lib/app/plan';
import EnTeteCoach from '@/components/app/EnTeteCoach';
import { supabaseConfigure } from '@/lib/app/supabase';
import { athletesNolio, exigerCoach, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// La page coach (CTS_NOLIO_CADRAGE.md, N2) : réservée aux comptes de CTS_COACHS. Ses athlètes coachés : en
// ajouter un, ouvrir son plan pour l'envoyer dans Nolio ; ses athlètes dans Nolio, lus avec la clé de l'API v2.
export default async function Coach() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  let athletes: AthleteNolio[] | null = null;
  // La raison d'un échec, dite au coach : les refus de Nolio ont leur phrase (lib/app/nolio.ts, refusNolio).
  let erreur: string | null = null;
  if (nolioConfigure()) {
    try {
      athletes = await athletesNolio();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Athlètes Nolio :', message);
      erreur = message.startsWith('Nolio') ? message : `Nolio ne répond pas pour l’instant : réessaie dans un moment (${message}).`;
    }
  }
  const coaches = await athletesCoaches(coach.compteId);
  return (
    <>
      <EnTeteCoach />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <h1 className="text-2xl text-indigo">Coach</h1>
        <section className="bg-white shadow-sm p-4 space-y-3">
          <h2 className="eyebrow text-indigo/60">Tes athlètes coachés</h2>
          {coaches.length === 0 && <p className="text-sm text-indigo/70">Aucun pour l’instant.</p>}
          <ul className="divide-y divide-indigo/10">
            {coaches.map((x) => {
              // Le prochain objectif, sinon le dernier couru.
              const aujourdhui = new Date().toISOString().slice(0, 10);
              const o = x.objectifs.find((y) => y.course_date >= aujourdhui) ?? x.objectifs[x.objectifs.length - 1];
              return (
                <li key={x.id}>
                  <Link href={`/app/coach/athlete/${x.id}`} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="font-semibold text-indigo">{x.nom}</span>
                    <span className="text-indigo/60 text-right">{o ? `${o.course_nom} · ${dateLongue(o.course_date, true)}` : 'Aucun objectif'} ›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/app/coach/nouveau" className="btn btn-primary !py-2.5 inline-block">Ajouter un athlète</Link>
        </section>
        <Link href="/app/coach/chiffres" className="block bg-white shadow-sm p-4 text-sm font-semibold text-teal">
          Les chiffres de la vente des plans ›
        </Link>
        <section className="bg-white shadow-sm p-4 space-y-3">
          <h2 className="eyebrow text-indigo/60">Nolio</h2>
          {!nolioConfigure() ? (
            <p className="text-sm text-indigo/75">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
          ) : (
            <>
              {erreur && <p className="text-sm text-indigo/75">{erreur}</p>}
              {athletes && (
                <div>
                  <h3 className="text-sm font-bold text-indigo mb-1">Tes athlètes dans Nolio ({athletes.length})</h3>
                  <ul className="text-sm text-indigo/80 divide-y divide-indigo/10">
                    {athletes.map((a) => <li key={a.id} className="py-1.5">{a.name}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
