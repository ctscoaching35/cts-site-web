import Link from 'next/link';
import { notFound } from 'next/navigation';
import BanniereSemaine from '@/components/app/BanniereSemaine';
import EnTeteCoach from '@/components/app/EnTeteCoach';
import EnvoiSemaine from '@/components/app/EnvoiSemaine';
import { associerNolio, retirerAthlete } from '@/lib/app/actionsCoaching';
import { athleteCoache, verifierEnvois } from '@/lib/app/coaching';
import { supabaseConfigure } from '@/lib/app/supabase';
import { athletesNolio, coachConnecte, estRelie, type AthleteNolio } from '@/lib/app/nolio';
import { dateLongue } from '@/lib/app/plan';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// Un athlète coaché (CTS_NOLIO_CADRAGE.md, N1 à N5) : son athlète Nolio, son plan semaine par semaine,
// « Envoyer dans Nolio » ou « Envoyée le … », son PDF.
export default async function AthleteCoache({ params }: { params: Promise<{ id: string }> }) {
  const coach = supabaseConfigure() ? await coachConnecte() : null;
  if (!coach) notFound();
  const { id } = await params;
  const a = await athleteCoache(coach.compteId, id);
  if (!a) notFound();
  const relie = await estRelie(coach.compteId);
  let liste: AthleteNolio[] = [];
  try {
    liste = relie ? await athletesNolio(coach.compteId) : [];
  } catch {
    liste = [];
  }
  const nolio = a.coaching.nolio_athlete_id as number | null;
  const envois = nolio ? await verifierEnvois(coach.compteId, id, nolio, a.plan, a.envois) : a.envois;
  const envoi = (numero: string) => envois.find((e) => e.semaine === numero);
  return (
    <>
      <EnTeteCoach />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <Link href="/app/coach" className="text-teal font-semibold text-sm">‹ Espace coach</Link>
        <div>
          <div className="eyebrow text-teal mb-1">Athlète coaché</div>
          <h1 className="text-2xl text-indigo leading-tight">{a.coaching.athlete_nom}</h1>
          <p className="text-sm text-indigo/70">{a.plan.course.nom} · {dateLongue(a.plan.course.date, true)} · {a.plan.course.format_clair}</p>
          {a.pdf && <a href={`/app/coach/athlete/${id}/pdf`} className="inline-block mt-2 text-sm text-teal font-semibold">Télécharger son PDF ›</a>}
        </div>

        <section className="bg-white shadow-sm p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Dans Nolio</h2>
          {!relie ? (
            <p className="text-sm text-indigo/75">Relie d’abord ton compte Nolio depuis l’espace coach.</p>
          ) : (
            <form action={associerNolio.bind(null, id)} className="flex flex-wrap items-center gap-2">
              <select name="nolio_id" defaultValue={nolio ?? ''} className="border border-indigo/20 px-2 py-2 text-sm text-indigo bg-white">
                <option value="" disabled>Choisis son nom</option>
                {liste.map((x) => <option key={x.nolio_id} value={x.nolio_id}>{x.name}</option>)}
              </select>
              <button type="submit" className="text-sm font-semibold text-teal">{nolio ? 'Changer' : 'Associer'}</button>
              {nolio && <span className="text-sm text-indigo/70">Associé à {liste.find((x) => x.nolio_id === nolio)?.name ?? `l’athlète Nolio n° ${nolio}`}.</span>}
            </form>
          )}
        </section>

        {a.plan.semaines.map((s) => {
          const e = envoi(s.numero);
          return (
            <section key={s.numero} className="space-y-2">
              <BanniereSemaine semaine={s} />
              <ul className="bg-white divide-y divide-indigo/10 shadow-sm text-sm">
                {s.jours.map((j) => (
                  <li key={j.id} className="flex gap-3 px-3 py-2">
                    <span className="w-[4.6rem] shrink-0 text-xs text-indigo/55 pt-0.5">{j.date}</span>
                    <span className={j.famille === 'repos' ? 'text-indigo/40' : 'text-indigo font-semibold'}>
                      {j.seance}
                      {j.famille !== 'repos' && j.duree !== '—' && <span className="font-normal text-indigo/55"> · {j.duree}{j.rpe !== '—' ? ` · RPE ${j.rpe}` : ''}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {e ? (
                <p className="text-sm text-teal font-semibold">Envoyée le {new Date(e.envoye_le).toLocaleDateString('fr-FR')}</p>
              ) : (
                <EnvoiSemaine planId={id} numero={s.numero} actif={Boolean(nolio)} />
              )}
            </section>
          );
        })}

        <details className="text-sm text-indigo/70">
          <summary className="cursor-pointer">Retirer cet athlète</summary>
          <p className="mt-2">Son plan et son PDF quittent ton espace coach. Les séances déjà envoyées restent dans Nolio.</p>
          <form action={retirerAthlete.bind(null, id)} className="mt-2">
            <button type="submit" className="underline underline-offset-2">Retirer {a.coaching.athlete_nom}</button>
          </form>
        </details>
      </main>
    </>
  );
}
