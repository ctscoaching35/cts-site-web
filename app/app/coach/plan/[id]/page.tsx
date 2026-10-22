import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import BanniereSemaine from '@/components/app/BanniereSemaine';
import CadreCoach from '@/components/app/CadreCoach';
import EnvoiPlan from '@/components/app/EnvoiPlan';
import EnvoiSemaine from '@/components/app/EnvoiSemaine';
import { AjouterCourse, AnnulerSemaine, DemarrerNolio, RetirerCourse } from '@/components/app/GestesEcriture';
import { Montagne } from '@/components/app/TableauDeBord';
import { Carte, CarteSombre, PastilleDate, Surtitre } from '@/components/app/Ui';
import { garderObjectif, retirerObjectif } from '@/lib/app/actionsCoaching';
import { objectifCoache, verifierEnvois } from '@/lib/app/coaching';
import { courseNolio } from '@/lib/app/coursesNolio';
import { demandesDuCoach } from '@/lib/app/demandes';
import { annonceDepart, trameDuPlan, type Realise } from '@/lib/app/ecriture';
import { lienFicheCourse } from '@/lib/app/ficheCourse';
import { exigerCoach } from '@/lib/app/nolio';
import { ajouterJours, dateLongue, jMoins, jourMois } from '@/lib/app/plan';
import { aujourdhuiParis } from '@/lib/app/signauxSuivi';
import { allureDepuisVitesse } from '@/lib/app/allureCoach';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';
import { enHeures, jaugeDuPlan, momentDe } from '@/lib/app/tableau';
import { fichesDePreparation, type CourseSecondaire } from '@/lib/app/tableauDuPlan';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

const TESTS: Record<string, string> = { parole: 'Test de la parole', vitesse_critique: 'Test de vitesse critique', fc_seuil2: 'FC au seuil 2' };
// Un test que la lecture dans Nolio n'a pas eu à lire : saisi par le coach ou par l'athlète dans l'app.
const SAISI: Record<string, string> = { coach: ', saisi par toi', athlete: ', saisi par l’athlète' };
const STATUTS: Record<string, string> = { illisible: 'illisible dans Nolio', sans_reponse: 'sans réponse au questionnaire du soir', non_fait: 'pas fait' };

// Ce qu'un test lu a donné, en clair.
function resultatTest(r: Record<string, unknown>): string {
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  return [n('fc_seuil1') && `FC au seuil 1 à ${n('fc_seuil1')} bpm`, n('v_seuil1_ms') && `à ${allureDepuisVitesse(n('v_seuil1_ms') as number)}/km`,
    n('vc_ms') && `vitesse critique à ${allureDepuisVitesse(n('vc_ms') as number)}/km`, n('fc_seuil2') && `FC au seuil 2 à ${n('fc_seuil2')} bpm`]
    .filter(Boolean).join(' ');
}

// Un objectif d'athlète coaché (CTS_NOLIO_CADRAGE.md, N1 à N9, V4, OM3, RO1 ; maquette validée par le coach le
// 19/10/2026). Écrit semaine par semaine : son départ dans Nolio, puis le journal des semaines écrites (ce qui a été
// fait, les ajustements, que le coach peut annuler, les tests lus), sa montagne, ses courses de préparation. Envoyé en
// entier (avant le 19/10/2026) : ses semaines et leur envoi, comme avant.
export default async function ObjectifCoache({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ course?: string }>;
}) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
  const o = await objectifCoache(coach.compteId, id);
  if (!o) notFound();
  const service = clientService();
  const { data: ecriture } = await service.from('plans').select('parametres, demarre_le, depart_prevu').eq('id', id).single();
  const { data: ecrites } = ecriture?.parametres
    ? await service.from('semaines_ecrites').select('numero, journal, bilan, sans_ajustement, ecrite_le, realise').eq('plan_id', id)
    : { data: null };
  const { data: tests } = ecriture?.parametres
    ? await service.from('tests_lus').select('jour_id, cle, statut, resultat, lu_le').eq('plan_id', id).order('lu_le', { ascending: false })
    : { data: null };
  const demandes = await demandesDuCoach(coach.compteId).catch(() => []);
  // La demande de retrait de l'athlète, en attente (décision coach du 20/10/2026).
  const retrait = demandes.find((d) => d.plan_id === id) ?? null;
  const nolio = o.athlete.nolio_athlete_id;
  // Une course B de Nolio, depuis sa fiche (« En préparation ») : le formulaire s'ouvre déjà rempli.
  const { course: courseId } = await searchParams;
  const depuisNolio = nolio && courseId ? await courseNolio(nolio, courseId).catch(() => null) : null;
  const envois = nolio ? await verifierEnvois(id, nolio, o.plan, o.envois) : o.envois.map((e) => ({ ...e, retouchees: 0, supprimees: 0 }));
  const jour = aujourdhuiParis();
  const trame = ecriture?.parametres ? await trameDuPlan(id).catch(() => null) : null;
  // PC1 : avant le départ, la date où l'écriture commencera si le coach a déjà posé des séances.
  const annonce = ecriture?.parametres && !ecriture.demarre_le && !ecriture.depart_prevu && nolio ? await annonceDepart(id) : null;
  const realises = (ecrites ?? []).map((w) => w.realise as Realise | null).filter((r): r is Realise => Boolean(r))
    .sort((a, b) => Number(a.numero.slice(1)) - Number(b.numero.slice(1)));
  const jauge = trame ? jaugeDuPlan(trame.semaines, realises, jour) : null;
  const prochaine = trame?.semaines.find((l) => l.lundi && momentDe(l.lundi, jour) === 'avenir') ?? null;
  // Le coaching individualisé dit une semaine par son lundi, pas par son numéro (décision coach du 19/10/2026).
  const lundiDe = new Map((trame?.semaines ?? []).map((l) => [l.numero, l.lundi]));
  const preps = (((ecriture?.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[])
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const fichesPrepa = ecriture?.parametres ? await fichesDePreparation(id) : new Set<string>();
  const valeurs = [o.athlete.fc_seuil1 && `FC seuil 1 ${o.athlete.fc_seuil1}`, o.athlete.v_seuil1_ms && `allure seuil 1 ${allureDepuisVitesse(o.athlete.v_seuil1_ms)}/km`,
    o.athlete.vc_ms && `VC ${allureDepuisVitesse(o.athlete.vc_ms)}/km`, o.athlete.fc_seuil2 && `FC seuil 2 ${o.athlete.fc_seuil2}`].filter(Boolean).join(' · ');
  const { course } = o.plan;
  const ecritesTriees = (ecrites ?? []).slice().sort((a, b) => Number(String(b.numero).slice(1)) - Number(String(a.numero).slice(1)));
  const statut = !ecriture?.parametres ? 'envoyé en entier' : ecriture.demarre_le ? 'en route dans Nolio'
    : ecriture.depart_prevu ? `démarre le ${dateLongue(String(ecriture.depart_prevu), true)}` : 'pas encore démarré';
  return (
    <CadreCoach actif="athletes" demandes={demandes.length}>
      <Link href={`/app/coach/athlete/${o.athlete.id}`} className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">‹ {o.athlete.nom}</Link>
      {retrait && (
        <Carte id="retrait" className="!p-5 space-y-3 border-[1.5px] border-[#C9A25A] scroll-mt-6">
          <p className="text-sm text-indigo">
            <strong>{o.athlete.nom}</strong> demande le retrait de cet objectif. Le retirer le fait partir de ton espace et,
            dans Nolio, ce qui est encore à venir ; le passé reste.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={retirerObjectif.bind(null, id)}>
              <button type="submit" className="min-h-11 px-4 rounded-[10px] bg-indigo text-white text-sm font-bold">Retirer l’objectif</button>
            </form>
            <form action={garderObjectif.bind(null, retrait.id)}>
              <button type="submit" className="min-h-11 px-4 rounded-[10px] border border-indigo/25 bg-white text-indigo text-sm font-bold">Le garder</button>
            </form>
          </div>
        </Carte>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 !mt-2">
        <div>
          <Surtitre as="div">Objectif · {statut}</Surtitre>
          <h1 className="mt-1.5 text-[1.75rem] font-extrabold tracking-tight">{course.nom}</h1>
          <p className="mt-1.5 text-sm text-[#5E5C78]">
            {dateLongue(course.date, true)} · {Math.round(course.distance_km)} km · {course.dplus_m.toLocaleString('fr-FR')} m D+
            {course.temps_cible ? ` · chrono visé ${course.temps_cible}` : ''}{course.date >= jour ? ` · ${jMoins(jour, course.date)}` : ''}
          </p>
          <p className="mt-1 text-[0.8125rem] text-[#5E5C78]">
            {nolio ? 'Associé à Nolio.' : 'Pas encore associé à Nolio : choisis son nom sur sa fiche.'} {valeurs ? `Cibles : ${valeurs}.` : 'Sans valeurs : cibles au RPE.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a href={lienFicheCourse(id)} target="_blank" rel="noopener" className="inline-flex items-center min-h-11 px-4 rounded-xl border border-indigo/[0.18] bg-white text-[0.8125rem] font-bold">Fiche de course</a>
          <a href="https://www.nolio.io/" target="_blank" rel="noopener" className="inline-flex items-center min-h-11 px-4 rounded-xl bg-indigo text-white text-[0.8125rem] font-bold">Ouvrir dans Nolio</a>
        </div>
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[1_1_460px] min-w-0 space-y-5">
          {ecriture?.parametres && (
            <Carte className="!p-5 space-y-3.5">
              <Surtitre>Semaine par semaine</Surtitre>
              {!ecriture.demarre_le ? (
                <div className="space-y-3">
                  {/* Coaching individualisé, les objectifs s'enchaînent (décision coach du 22/10/2026) : ni le début
                      calendaire du plan ni la semaine rejointe, seulement ce qui part et quand. */}
                  <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
                    Au départ partent le bandeau de chaque semaine, ses questionnaires du dimanche et sa première semaine ;
                    ensuite, chaque dimanche, la semaine suivante s’écrit d’après la précédente.
                  </p>
                  {annonce && (
                    <p className="p-3.5 rounded-xl bg-[#E1EFEA] text-[0.8125rem] leading-relaxed text-[#0B4A40]">
                      Tu as déjà posé ses séances jusqu’au {dateLongue(annonce.derniere, true)} : l’écriture commence le{' '}
                      {dateLongue(annonce.lundi, true)}, sa première semaine part la veille au soir. Rien n’est écrasé.
                    </p>
                  )}
                  {ecriture.depart_prevu && (
                    <p className="text-[0.8125rem] font-semibold text-teal">Programmé : il démarre tout seul le {dateLongue(String(ecriture.depart_prevu), true)}.</p>
                  )}
                  <DemarrerNolio planId={id} actif={Boolean(nolio)} />
                </div>
              ) : (
                <>
                  {prochaine && (
                    <div className="flex gap-3.5 p-3.5 rounded-xl border border-dashed border-indigo/[0.22]">
                      <span className="w-12 text-[0.8125rem] font-extrabold text-[#5E5C78]">{jourMois(prochaine.lundi)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">S’écrit dimanche {dateLongue(ajouterJours(prochaine.lundi, -1), true)}, vers 18 h</p>
                        <p className="mt-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">
                          D’après sa semaine et son questionnaire du matin. {prochaine.type}
                          {prochaine.seances_cles.length ? ` · ${prochaine.seances_cles.map((c) => c.seance.split(' — ')[0]).join(' · ')}` : ''}
                          {prochaine.sl_min ? ` · sortie longue de ${enHeures(prochaine.sl_min)} annoncée` : ''}.
                        </p>
                      </div>
                    </div>
                  )}
                  {ecritesTriees.map((w) => {
                    const journal = (w.journal ?? []) as unknown[];
                    const r = w.realise as Realise | null;
                    const ajuste = journal.length > 0 && !w.sans_ajustement;
                    const lus = (tests ?? []).filter((t) => String(t.jour_id).startsWith(`${w.numero}-`) || String(t.jour_id).startsWith(`${w.numero}:`));
                    return (
                      <div key={w.numero} className={clsx('flex gap-3.5 p-3.5 rounded-xl', ajuste ? 'bg-[#FBF3F5] border border-[#EBC9D3]' : 'bg-sand')}>
                        <span className={clsx('w-12 text-[0.8125rem] font-extrabold', ajuste ? 'text-[#8A2E4A]' : 'text-teal')}>
                          {lundiDe.get(String(w.numero)) ? jourMois(lundiDe.get(String(w.numero)) as string) : w.numero}
                        </span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold">
                              {r ? `Faite · ${r.seances_faites} séance${r.seances_faites > 1 ? 's' : ''} sur ${r.seances_prevues}` : `Écrite le ${dateLongue(String(w.ecrite_le).slice(0, 10), true)}`}
                            </span>
                            {ajuste && <span className="text-[0.72rem] font-bold px-2 py-0.5 rounded-xl bg-[#F6E3E8] text-[#8A2E4A]">{journal.length} ajustement{journal.length > 1 ? 's' : ''}</span>}
                          </div>
                          {r && (
                            <p className="text-[0.8125rem] text-[#4A4866]">
                              {[r.rpe_lu && r.charge_faite ? `Charge ${Math.round(r.charge_faite).toLocaleString('fr-FR')}` : null,
                                r.duree_faite_min !== null ? `${enHeures(r.duree_faite_min)} courues sur ${enHeures(r.duree_prevue_min)}` : null,
                                r.sl_faite_min ? `sortie longue ${enHeures(r.sl_faite_min)}` : null, r.hooper !== null ? `Hooper ${r.hooper}` : null].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {w.bilan && <p className="text-[0.8125rem] leading-relaxed text-[#3B3957]">{w.bilan}</p>}
                          {w.sans_ajustement && <p className="text-xs text-[#5E5C78]">Ajustements annulés.</p>}
                          {lus.map((t) => (
                            <p key={t.jour_id} className="flex items-start gap-2 p-2.5 rounded-[10px] bg-white text-[0.8rem] leading-relaxed text-[#3B3957]">
                              <span aria-hidden className={t.statut === 'lu' ? 'text-teal' : 'text-[#8A5E10]'}>{t.statut === 'lu' ? '✓' : '·'}</span>
                              <span>{TESTS[t.cle] ?? 'Test'} : {t.statut === 'lu' ? `${resultatTest(t.resultat as Record<string, unknown>)}${SAISI[String((t.resultat as Record<string, unknown>)?.saisi)] ?? ''}. Ses cibles et ses zones ont suivi.` : STATUTS[t.statut] ?? t.statut}</span>
                            </p>
                          ))}
                          {ajuste && <AnnulerSemaine planId={id} numero={w.numero} />}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </Carte>
          )}

          {!ecriture?.parametres && (
            <Carte className="!p-5 space-y-4">
              <EnvoiPlan planId={id} actif={Boolean(nolio)} semaines={o.plan.semaines
                .filter((s) => s.lundi && ajouterJours(s.lundi, 6) >= jour && !envois.some((e) => e.semaine === s.numero))
                .map((s) => s.numero)} />
              {o.plan.semaines.map((s) => {
                const e = envois.find((x) => x.semaine === s.numero);
                return (
                  <section key={s.numero} className="space-y-2">
                    <BanniereSemaine semaine={s} course={o.plan.course.date} />
                    <ul className="bg-white divide-y divide-indigo/10 text-sm">
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
            </Carte>
          )}
        </div>

        <div className="flex-[1_1_320px] min-w-0 space-y-5">
          {jauge && (
            <CarteSombre className="space-y-2.5">
              <Surtitre ton="clair">Sa préparation</Surtitre>
              <Montagne score={jauge.score} ton={jauge.verdict?.ton ?? null} />
              <p className="text-[0.9375rem] font-bold">{jauge.verdict?.libelle ?? 'Pas encore assez de semaines faites pour un verdict'}</p>
              {jauge.piliers.length > 0 && <p className="text-[0.8rem] text-[#D6D5E6] leading-relaxed">{jauge.piliers.map((p) => p.detail).join(' · ')}</p>}
            </CarteSombre>
          )}

          {ecriture?.parametres && (
            <Carte id="ajouter-course" className="!p-5 space-y-3 scroll-mt-6">
              <Surtitre>Ses courses de préparation</Surtitre>
              {preps.length === 0 && <p className="text-[0.8125rem] text-[#4A4866]">Aucune pour l’instant.</p>}
              {preps.map((c) => (
                <div key={`${c.date}-${c.nom}`}>
                  <div className="flex items-center gap-3">
                    <PastilleDate iso={c.date} />
                    <span className="flex-1 min-w-0"><span className="block text-sm font-bold">{c.nom}</span>
                      <span className="block text-xs text-[#5E5C78]">
                        {c.distance_km} km{c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}{c.chrono ? ` · ${c.chrono}` : ''}
                        {fichesPrepa.has(c.date) ? ` · fiche de course le ${dateLongue(ajouterJours(c.date, -7) > jour ? ajouterJours(c.date, -7) : jour, true)}` : ''}
                      </span></span>
                    {fichesPrepa.has(c.date) && (
                      <a href={`${lienFicheCourse(id)}?course=${c.date}`} target="_blank" rel="noopener" className="shrink-0 inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Fiche ›</a>
                    )}
                  </div>
                  {c.date > jour && <div className="pl-14 -mt-1"><RetirerCourse planId={id} date={c.date} nom={c.nom} /></div>}
                </div>
              ))}
              {course.date >= jour && (
                <details className="text-sm" open={preps.length === 0 || Boolean(depuisNolio)}>
                  <summary className="cursor-pointer flex items-center justify-center min-h-11 rounded-xl border-[1.5px] border-dashed border-teal/45 text-[0.8125rem] font-bold text-teal list-none">
                    + Ajouter une course de préparation
                  </summary>
                  {depuisNolio && <p className="mt-3 text-[0.8125rem] text-[#4A4866]">Reprise de Nolio : relis la distance, le D+ et le chrono visé.</p>}
                  <div className="mt-3"><AjouterCourse planId={id} initial={depuisNolio} /></div>
                </details>
              )}
            </Carte>
          )}

          <details className="bg-white rounded-2xl border border-indigo/[0.08] px-5 py-4 text-[0.8125rem] text-[#4A4866]">
            <summary className="cursor-pointer min-h-8 font-bold text-indigo">Retirer cet objectif</summary>
            <p className="mt-2 mb-3 leading-relaxed">
              {ecriture?.parametres
                ? 'Il quitte ton espace coach. Dans Nolio, ce qu’il a posé et qui est encore à venir part aussi (bandeaux, notes, séances, questionnaires, course) ; le passé reste.'
                : 'Il quitte ton espace coach. Les séances déjà envoyées restent dans Nolio.'}
            </p>
            <form action={retirerObjectif.bind(null, id)}>
              <button type="submit" className="min-h-11 px-4 rounded-[10px] border border-indigo/25 bg-white text-indigo font-bold">Retirer {course.nom}</button>
            </form>
          </details>
        </div>
      </div>
    </CadreCoach>
  );
}
