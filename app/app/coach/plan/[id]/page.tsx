import Link from 'next/link';
import { notFound } from 'next/navigation';
import BanniereSemaine from '@/components/app/BanniereSemaine';
import EnTeteCoach from '@/components/app/EnTeteCoach';
import EnvoiSemaine from '@/components/app/EnvoiSemaine';
import { retirerObjectif } from '@/lib/app/actionsCoaching';
import { objectifCoache, verifierEnvois } from '@/lib/app/coaching';
import { exigerCoach } from '@/lib/app/nolio';
import { dateLongue } from '@/lib/app/plan';
import { allureDepuisVitesse } from '@/lib/app/allureCoach';
import { supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// Un objectif d'athlète coaché (CTS_NOLIO_CADRAGE.md, N1 à N9) : son plan semaine par semaine, « Envoyer dans
// Nolio » ou « Envoyée le … » (N4), son PDF. Le nom Nolio et les valeurs de l'athlète sont sur sa fiche.
export default async function ObjectifCoache({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
  const o = await objectifCoache(coach.compteId, id);
  if (!o) notFound();
  const nolio = o.athlete.nolio_athlete_id;
  const envois = nolio ? await verifierEnvois(coach.compteId, id, nolio, o.plan, o.envois) : o.envois;
  const valeurs = [o.athlete.fc_seuil1 && `FC seuil 1 ${o.athlete.fc_seuil1}`, o.athlete.v_seuil1_ms && `allure seuil 1 ${allureDepuisVitesse(o.athlete.v_seuil1_ms)} min/km`, o.athlete.vc_ms && `VC ${allureDepuisVitesse(o.athlete.vc_ms)} min/km`,
    o.athlete.fc_seuil2 && `FC seuil 2 ${o.athlete.fc_seuil2}`].filter(Boolean).join(' · ');
  return (
    <>
      <EnTeteCoach />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <Link href={`/app/coach/athlete/${o.athlete.id}`} className="text-teal font-semibold text-sm">‹ {o.athlete.nom}</Link>
        <div>
          <div className="eyebrow text-teal mb-1">Objectif</div>
          <h1 className="text-2xl text-indigo leading-tight">{o.plan.course.nom}</h1>
          <p className="text-sm text-indigo/70">{dateLongue(o.plan.course.date, true)} · {o.plan.course.format_clair}</p>
          <p className="text-sm text-indigo/70 mt-1">
            {nolio ? 'Associé à Nolio.' : 'Pas encore associé à Nolio : choisis son nom sur sa fiche.'}
            {' '}{valeurs ? `Cibles : ${valeurs}.` : 'Sans valeurs : cibles au RPE.'}
          </p>
          {o.pdf && <a href={`/app/coach/plan/${id}/pdf`} className="inline-block mt-2 text-sm text-teal font-semibold">Télécharger le PDF ›</a>}
        </div>

        {o.plan.semaines.map((s) => {
          const e = envois.find((x) => x.semaine === s.numero);
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
          <summary className="cursor-pointer">Retirer cet objectif</summary>
          <p className="mt-2">Son plan et son PDF quittent ton espace coach. Les séances déjà envoyées restent dans Nolio.</p>
          <form action={retirerObjectif.bind(null, id)} className="mt-2">
            <button type="submit" className="underline underline-offset-2">Retirer {o.plan.course.nom}</button>
          </form>
        </details>
      </main>
    </>
  );
}
