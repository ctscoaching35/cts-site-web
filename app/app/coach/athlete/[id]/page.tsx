import Link from 'next/link';
import { notFound } from 'next/navigation';
import EnTeteCoach from '@/components/app/EnTeteCoach';
import FormulaireValeurs from '@/components/app/FormulaireValeurs';
import { associerNolio, retirerAthlete } from '@/lib/app/actionsCoaching';
import { ficheAthlete } from '@/lib/app/coaching';
import { athletesNolio, exigerCoach, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';
import { dateLongue } from '@/lib/app/plan';
import { allureDepuisVitesse } from '@/lib/app/allureCoach';
import { supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// La fiche d'un athlète coaché (CTS_NOLIO_CADRAGE.md, N8, N9) : ses objectifs successifs, « Nouvel objectif »,
// son nom Nolio, ses valeurs.
export default async function FicheAthleteCoache({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
  const a = await ficheAthlete(coach.compteId, id);
  if (!a) notFound();
  const relie = nolioConfigure();
  let liste: AthleteNolio[] = [];
  try {
    liste = relie ? await athletesNolio() : [];
  } catch {
    liste = [];
  }
  return (
    <>
      <EnTeteCoach />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <Link href="/app/coach" className="text-teal font-semibold text-sm">‹ Espace coach</Link>
        <div>
          <div className="eyebrow text-teal mb-1">Athlète coaché</div>
          <h1 className="text-2xl text-indigo leading-tight">{a.nom}</h1>
        </div>

        <section className="bg-white shadow-sm p-4 space-y-3">
          <h2 className="eyebrow text-indigo/60">Ses objectifs</h2>
          {a.objectifs.length === 0 && <p className="text-sm text-indigo/70">Aucun pour l’instant.</p>}
          <ul className="divide-y divide-indigo/10">
            {a.objectifs.map((o) => (
              <li key={o.plan_id}>
                <Link href={`/app/coach/plan/${o.plan_id}`} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="font-semibold text-indigo">{o.course_nom}</span>
                  <span className="text-indigo/60">{o.course_date ? dateLongue(o.course_date, true) : ''} ›</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/app/coach/nouveau?athlete=${a.id}`} className="btn btn-primary !py-2.5 inline-block">Nouvel objectif</Link>
        </section>

        <section className="bg-white shadow-sm p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Dans Nolio</h2>
          {!relie ? (
            <p className="text-sm text-indigo/75">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
          ) : (
            <form action={associerNolio.bind(null, a.id)} className="flex flex-wrap items-center gap-2">
              <select name="nolio_id" defaultValue={a.nolio_athlete_id ?? ''} className="border border-indigo/20 px-2 py-2 text-sm text-indigo bg-white">
                <option value="" disabled>Choisis son nom</option>
                {liste.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <button type="submit" className="text-sm font-semibold text-teal">{a.nolio_athlete_id ? 'Changer' : 'Associer'}</button>
              {a.nolio_athlete_id && (
                <span className="text-sm text-indigo/70">Associé à {liste.find((x) => x.id === a.nolio_athlete_id)?.name ?? 'un athlète que Nolio ne retrouve pas : choisis à nouveau son nom'}.</span>
              )}
            </form>
          )}
        </section>

        <section className="bg-white shadow-sm p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Ses valeurs</h2>
          <p className="text-sm text-indigo/70">Avec elles, les séances partent avec une allure sur le plat ou une FC, puis le RPE. Sans elles, au RPE.</p>
          <FormulaireValeurs athleteId={a.id} fc1={a.fc_seuil1} vs1Allure={a.v_seuil1_ms ? allureDepuisVitesse(a.v_seuil1_ms) : null}
            vcAllure={a.vc_ms ? allureDepuisVitesse(a.vc_ms) : null} fc2={a.fc_seuil2} />
        </section>

        <details className="text-sm text-indigo/70">
          <summary className="cursor-pointer">Retirer cet athlète</summary>
          <p className="mt-2">Sa fiche, ses objectifs et leurs PDF quittent ton espace coach. Les séances déjà envoyées restent dans Nolio.</p>
          <form action={retirerAthlete.bind(null, a.id)} className="mt-2">
            <button type="submit" className="underline underline-offset-2">Retirer {a.nom}</button>
          </form>
        </details>
      </main>
    </>
  );
}
