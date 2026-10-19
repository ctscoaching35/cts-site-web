import Link from 'next/link';
import { notFound } from 'next/navigation';
import BanniereSemaine from '@/components/app/BanniereSemaine';
import EnTeteCoach from '@/components/app/EnTeteCoach';
import EnvoiPlan from '@/components/app/EnvoiPlan';
import EnvoiSemaine from '@/components/app/EnvoiSemaine';
import { AjouterCourse, AnnulerSemaine, DemarrerNolio } from '@/components/app/GestesEcriture';
import { retirerObjectif } from '@/lib/app/actionsCoaching';
import { objectifCoache, verifierEnvois } from '@/lib/app/coaching';
import { exigerCoach } from '@/lib/app/nolio';
import { ajouterJours, dateLongue } from '@/lib/app/plan';
import { aujourdhuiParis } from '@/lib/app/signauxSuivi';
import { allureDepuisVitesse } from '@/lib/app/allureCoach';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// Un objectif d'athlète coaché (CTS_NOLIO_CADRAGE.md, N1 à N9, V4) : son plan semaine par semaine, « Envoyer dans
// Nolio », puis « Envoyée le … » et « Mettre à jour dans Nolio » ; son PDF. Le nom Nolio et les valeurs de
// l'athlète sont sur sa fiche.
export default async function ObjectifCoache({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
  const o = await objectifCoache(coach.compteId, id);
  if (!o) notFound();
  // Un objectif écrit semaine par semaine (ses paramètres, depuis le 19/10/2026) : démarré dans Nolio par le coach, puis
  // écrit chaque dimanche ; ses semaines écrites et leurs ajustements, que le coach peut annuler.
  const service = clientService();
  const { data: ecriture } = await service.from('plans').select('parametres, demarre_le').eq('id', id).single();
  const { data: ecrites } = ecriture?.parametres
    ? await service.from('semaines_ecrites').select('numero, journal, bilan, sans_ajustement, ecrite_le').eq('plan_id', id)
    : { data: null };
  const nolio = o.athlete.nolio_athlete_id;
  const envois = nolio ? await verifierEnvois(id, nolio, o.plan, o.envois) : o.envois.map((e) => ({ ...e, retouchees: 0, supprimees: 0 }));
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

        {ecriture?.parametres && (
          <section className="bg-white shadow-sm p-4 space-y-3">
            <h2 className="eyebrow text-indigo/60">Dans Nolio, semaine par semaine</h2>
            {!ecriture.demarre_le ? (
              <>
                <p className="text-sm text-indigo/70">
                  La trame (bandeaux et fiches), les questionnaires du dimanche et la semaine en cours partent au départ ;
                  chaque dimanche, la semaine suivante s’écrit d’après la précédente.
                </p>
                <DemarrerNolio planId={id} actif={Boolean(nolio)} />
              </>
            ) : (
              <ul className="divide-y divide-indigo/10">
                {(ecrites ?? []).sort((a, b) => Number(String(a.numero).slice(1)) - Number(String(b.numero).slice(1))).map((w) => {
                  const journal = (w.journal ?? []) as { regle?: string }[];
                  return (
                    <li key={w.numero} className="py-2 space-y-1 text-sm">
                      <div className="font-semibold text-indigo">Semaine {String(w.numero).slice(1)}
                        <span className="font-normal text-indigo/60"> · écrite le {new Date(w.ecrite_le).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {w.bilan && <p className="text-indigo/75">{w.bilan}</p>}
                      {w.sans_ajustement && <p className="text-xs text-indigo/60">Ajustements annulés.</p>}
                      {journal.length > 0 && !w.sans_ajustement && <AnnulerSemaine planId={id} numero={w.numero} />}
                    </li>
                  );
                })}
              </ul>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-teal font-semibold">Ajouter une course secondaire</summary>
              <div className="mt-3"><AjouterCourse planId={id} /></div>
            </details>
          </section>
        )}

        {!ecriture?.parametres && <EnvoiPlan planId={id} actif={Boolean(nolio)} semaines={o.plan.semaines
          .filter((s) => s.lundi && ajouterJours(s.lundi, 6) >= aujourdhuiParis() && !envois.some((e) => e.semaine === s.numero))
          .map((s) => s.numero)} />}

        {!ecriture?.parametres && o.plan.semaines.map((s) => {
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
                <div className="space-y-1">
                  <p className="text-sm text-teal font-semibold">
                    Envoyée le {new Date(e.envoye_le).toLocaleDateString('fr-FR')}
                    {(e.retouchees > 0 || e.supprimees > 0) && (
                      <span className="font-normal text-indigo/70">
                        {' · '}{[e.retouchees && `${e.retouchees} retouchée${e.retouchees > 1 ? 's' : ''}`,
                          e.supprimees && `${e.supprimees} supprimée${e.supprimees > 1 ? 's' : ''}`].filter(Boolean).join(', ')} dans Nolio, gardée{e.retouchees + e.supprimees > 1 ? 's' : ''} telle{e.retouchees + e.supprimees > 1 ? 's' : ''} quelle{e.retouchees + e.supprimees > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                  <EnvoiSemaine planId={id} numero={s.numero} actif={Boolean(nolio)} envoyee />
                </div>
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
