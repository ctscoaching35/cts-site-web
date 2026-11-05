import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import clsx from 'clsx';
import EnTeteApp from '@/components/app/EnTeteApp';
import { AjouterCourse, ModifierCourse, RetirerCourse } from '@/components/app/GestesEcriture';
import { Carte, LIEN, PastilleDate, Surtitre } from '@/components/app/Ui';
import { choisirPlan } from '@/lib/app/actionsPlan';
import { contexte, lien, plansDuCompte, type PlanDuCompte, type Recherche } from '@/lib/app/contexte';
import { annulerDemande, demanderRetrait } from '@/lib/app/actionsObjectifs';
import { demandesDeLAthlete, estRetrait, ficheDuCompte } from '@/lib/app/demandes';
import { clientServeur, clientService } from '@/lib/app/supabase';
import { aujourdhuiIso, dateLongue } from '@/lib/app/plan';
import { blocsDuPlan, jaugeDuPlan } from '@/lib/app/tableau';
import { donneesTableau, fichesDePreparation, type CourseSecondaire } from '@/lib/app/tableauDuPlan';
import { BlocsDeLaSaison } from '@/components/app/SaisonDeFond';
import { datesDesFiches, objectifsDeDemonstration } from '@/lib/app/demonstration';
import SemainesDuPlan from '@/components/app/SemainesDuPlan';

export const metadata: Metadata = { title: 'Ta préparation' };

// « Mes objectifs » (OM2, décision coach du 19/10/2026) : chaque objectif majeur du compte (les siens, ceux que son
// coach lui prépare), en cours, à venir ou passé, et ses courses de préparation ; un toucher l'affiche ; les demandes
// d'un coaché en attente, qu'il peut annuler, et la demande de retrait d'un objectif lancé (décision coach du
// 20/10/2026) ; « Nouvel objectif ».
async function mesObjectifs() {
  const { data } = await (await clientServeur()).auth.getClaims();
  const compteId = String(data?.claims?.sub ?? '');
  const liste = await plansDuCompte(compteId);
  const { data: params } = liste.length
    ? await clientService().from('plans').select('id, parametres').in('id', liste.map((p) => p.id))
    : { data: [] };
  // Les saisons de fond ne sont pas des objectifs (décisions coach du 24/10/2026) : « Mon plan » les montre à part.
  const saisons = new Set((params ?? []).filter((p) => (p.parametres as { fond?: unknown } | null)?.fond).map((p) => p.id as string));
  const prep = new Map((params ?? []).map((p) => [p.id as string,
    (((p.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[]).slice().sort((a, b) => a.date.localeCompare(b.date))]));
  // L'heure de Paris, comme le reste de l'app (§8, point 8 : en UTC, l'étiquette se trompait entre minuit et 2 h).
  const aujourdhui = aujourdhuiIso();
  const fiche = await ficheDuCompte(compteId);
  return {
    liste: liste.filter((p) => !saisons.has(p.id)).map((p: PlanDuCompte) => ({ ...p, preparations: prep.get(p.id) ?? [] })),
    // Son coaching d'abord (décision coach du 23/10/2026).
    enCours: (liste.find((p) => p.coache && !saisons.has(p.id) && p.course_date >= aujourdhui)
      ?? liste.find((p) => !saisons.has(p.id) && p.course_date >= aujourdhui))?.id ?? null,
    demandes: fiche ? await demandesDeLAthlete(fiche.id) : [],
  };
}

// « Ta préparation » (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, AP1 ; maquette validée par le coach le
// 19/10/2026 ; Q3, décision coach du 05/11/2026 au soir : un seul nom, le bouton « Voir ma préparation », le titre « Ta
// préparation », le retour « ‹ Ta préparation ») : ouverte depuis l'accueil, sa fiche de course, sa préparation bloc par
// bloc (ce que chaque bloc développe ; décision coach du 19/10/2026, à la place des semaines, de leurs volumes et de leurs
// sorties longues), ses semaines pour l'acheteur, ses courses de préparation (O2) ; puis les autres objectifs du compte
// (OM2). Plus de jalons (Q9, « A ») : la montagne et les piliers disent l'avancée, les badges la célèbrent.
export default async function Objectif({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const r = await searchParams;
  // Un coaché sans objectif : son accueil, qui dit aussi qu'une demande est partie.
  if (ctx.sansObjectif) redirect(r.demande === 'envoyee' ? '/app?demande=envoyee' : '/app');
  const { plan, jour } = ctx;
  const d = await donneesTableau(ctx);
  // En démonstration : l'objectif affiché, et l'objectif suivant demandé (?objectif=demande).
  const objectifs = ctx.demonstration ? await objectifsDeDemonstration(ctx, d.courses) : await mesObjectifs();
  const jauge = jaugeDuPlan(d.trame, d.realises, jour);
  const courseAVenir = plan.course.date >= jour;
  const fichesPrepa = ctx.demonstration ? await datesDesFiches(ctx) : await fichesDePreparation(ctx.cle);
  const { course } = plan;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-3 pb-6 space-y-4">
        <Link href={lien('/app', ctx)} className="inline-flex items-center min-h-11 text-sm font-bold text-teal">‹ Accueil</Link>
        {plan.fond ? (
          <div className="-mt-1">
            <Surtitre as="div">Ta saison de fond</Surtitre>
            <h1 className="mt-1.5 text-[1.75rem] font-extrabold text-indigo tracking-tight leading-tight">Saison {plan.fond.saison}</h1>
            <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78]">
              Du {dateLongue(plan.fond.debut, true)} au {dateLongue(plan.fond.fin, true)} · tes tests la semaine du {dateLongue(plan.fond.tests_le, true)}
            </p>
          </div>
        ) : (
          <div className="-mt-1">
            {/* C25 : après la course, « Ta dernière course », comme l'accueil. */}
            <Surtitre as="div">{courseAVenir ? 'Ta préparation' : 'Ta dernière course'}</Surtitre>
            <h1 className="mt-1.5 text-[1.75rem] font-extrabold text-indigo tracking-tight leading-tight">{course.nom}</h1>
            <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78]">
              {dateLongue(course.date, course.date.slice(0, 4) !== jour.slice(0, 4))} · {course.format_clair}{course.dplus_m ? ` · ${Math.round(course.distance_km)} km · ${course.dplus_m.toLocaleString('fr-FR')} m D+` : ' sur route'}
            </p>
          </div>
        )}

        {/* Plus de PDF dans l'app (décision coach du 19/10/2026) : la préparation vit et s'ajuste semaine après semaine ;
            l'acheteur garde celui de l'e-mail de bienvenue. */}
        {!plan.fond && <Link href={lien('/app/plan/course', ctx)} className="bg-indigo text-white rounded-[14px] p-3.5 flex items-center justify-between gap-3">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-bold">Ta fiche de course</span>
            {/* Ce qu'elle contient vraiment, dans l'ordre de ses parties (retour du coach du 20/10/2026) ; C29 : sans trace,
                ni profil ni tronçons. BROUILLON, à valider par le coach (la version sans trace). */}
            <span className="text-xs text-[#D6D5E6]">{plan.profil.sans_trace
              ? 'Déterminants de la performance, stratégie nutritionnelle ; le profil avec sa trace GPX'
              : 'Profil, tronçons, déterminants de la performance, stratégie nutritionnelle'}</span>
          </span>
          <span aria-hidden>›</span>
        </Link>}

        {r.demande === 'envoyee' && (
          <Carte className="text-sm text-indigo"><p role="status">Ta demande est partie chez ton coach : il la relit et lance ta préparation.</p></Carte>
        )}

        {plan.fond && <BlocsDeLaSaison trame={d.trame} jour={jour} />}

        {/* Programmé à la main (décision coach du 20/10/2026) : pas de blocs, qui suivent la trame du moteur. */}
        {!ctx.aLaMain && !plan.fond && <Carte className="!pb-1.5">
          <Surtitre>Ta préparation, bloc par bloc</Surtitre>
          {/* C24 : « tes séances s'écrivent chaque dimanche dans Nolio » une seule fois ; l'acheteur le lit sous ses semaines. */}
          <p className="mt-1 mb-1 text-xs text-[#5E5C78] leading-relaxed">
            Ce que chaque bloc développe, jusqu’à ton jour J{ctx.coache ? ' ; tes séances s’écrivent chaque dimanche dans Nolio' : ''}.
          </p>
          <ol>
            {blocsDuPlan(d.trame, plan, jour, ctx.coache ? plan.course.rejoint?.lundi ?? null : null).map((b) => (
              <li key={b.du} className={clsx('grid grid-cols-[22px_1fr] gap-x-2.5 py-3 border-t border-indigo/[0.06] first:border-t-0',
                b.moment === 'encours' && 'bg-[#E1EFEA] -mx-2.5 px-2.5 rounded-xl border-t-0')}>
                <span aria-hidden className={clsx('mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center',
                  b.moment === 'fait' ? 'bg-teal' : b.moment === 'encours' ? 'bg-teal-dark' : 'border-2 border-indigo/25')}>
                  {b.moment === 'fait' && (
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
                  )}
                  {b.moment === 'encours' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="min-w-0">
                  {/* C24 : « tu es ici » en pastille sous le nom, sans se couper ; C4 : les blocs en dates, le J- restant au
                      compte à rebours. */}
                  <span className={clsx('block text-sm text-indigo', b.moment === 'encours' ? 'font-extrabold' : 'font-bold')}>
                    {b.nom}<span className="sr-only">{b.moment === 'fait' ? ', fait' : b.moment === 'encours' ? ', en cours' : ', à venir'}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold text-[#5E5C78]">{jourEtMois(b.du)} → {jourEtMois(b.au)}</span>
                    {b.moment === 'encours' && <span className="text-[0.6875rem] font-bold text-white bg-teal-dark rounded-full px-2 py-0.5 whitespace-nowrap">tu es ici</span>}
                  </span>
                  {b.travail.length > 0 && (
                    <span className="block mt-1 text-[0.78rem] text-[#4A4866] leading-snug">
                      <span className="font-semibold text-indigo">Tu travailles :</span> {b.travail.map(enMotsDeCoureur).join(', ')}
                    </span>
                  )}
                  {b.rappel.length > 0 && (
                    <span className="block mt-0.5 text-[0.75rem] text-[#5E5C78] leading-snug">En rappel : {b.rappel.map(enMotsDeCoureur).join(', ')}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Carte>}

        {/* S16 (décision coach du 05/11/2026) : la trame semaine par semaine que promettent les CGV, pour l'acheteur. */}
        {!ctx.coache && !ctx.aLaMain && !plan.fond && <SemainesDuPlan trame={d.trame} jour={jour} course={course.date} />}

        {d.ecrit && !plan.fond && (
          <Carte id="ajouter-course" className="space-y-3 scroll-mt-20">
            <Surtitre>Tes courses de préparation</Surtitre>
            {d.courses.map((c) => (
              <div key={`${c.date}-${c.nom}`}>
                <div className="flex items-center gap-3">
                  <PastilleDate iso={c.date} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-indigo">{c.nom}</span>
                    <span className="block text-xs text-[#5E5C78]">{c.distance_km} km{c.discipline === 'route' ? ' sur route' : c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}{c.chrono ? ` · objectif ${c.chrono}` : ''}</span>
                  </span>
                  {fichesPrepa.has(c.date) && (
                    <Link href={lien('/app/plan/course', ctx, { course: c.date })} className="shrink-0 inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Sa fiche ›</Link>
                  )}
                </div>
                {c.date > jour && <div className="pl-14 -mt-1 flex flex-wrap gap-x-5"><ModifierCourse planId={ctx.cle} course={c} /><RetirerCourse planId={ctx.cle} date={c.date} nom={c.nom} /></div>}
              </div>
            ))}
            {/* C19 : une préparation arrêtée n'ajoute plus de course (le serveur la refuse aussi). */}
            {courseAVenir && d.nolio !== 'arrete' && (
              <>
                <p className="text-xs text-[#5E5C78] leading-relaxed">
                  Une course avant ton objectif ? Ajoute-la : les jours autour d’elle s’ajustent (quelques jours plus légers avant,
                  de la récupération après), sans toucher à la suite de ta préparation.
                </p>
                <AjouterCourse planId={ctx.cle} />
              </>
            )}
          </Carte>
        )}

        {/* Q6-d (décision coach du 05/11/2026 au soir, « A ») : à partir de deux objectifs (avant, un acheteur à un seul
            plan lisait « OCC · Affiché ») ; un coaché la garde, avec ses demandes, le retrait et « Proposer un objectif ». */}
        {objectifs && (objectifs.liste.length >= 2 || objectifs.demandes.length > 0 || ctx.coache) && (
          <Carte className="space-y-2">
            {/* « Objectif majeur » (décisions coach du 20/10/2026, coachés puis acheteurs) : à ne pas confondre avec les
                courses de préparation. */}
            <Surtitre>Tes objectifs majeurs</Surtitre>
            <ul className="divide-y divide-indigo/[0.06]">
              {objectifs.liste.map((o) => {
                // Un objectif lancé par son coach, encore à venir : l'athlète en demande le retrait, son coach confirme
                // (décision coach du 20/10/2026) ; sa demande en attente, il peut l'annuler.
                const retrait = objectifs.demandes.find((dm) => dm.plan_id === o.id);
                return (
                  <li key={o.id} className="py-1">
                    <form action={choisirPlan.bind(null, o.id)}>
                      <button type="submit" disabled={o.id === ctx.cle}
                        className="w-full min-h-11 flex justify-between items-center gap-3 text-sm text-left disabled:cursor-default">
                        <span className="font-bold text-indigo">{o.course_nom}</span>
                        <span className={o.id === ctx.cle ? 'text-teal font-semibold' : 'text-[#5E5C78]'}>
                          {/* C26 : « Celui-ci », plus « Affiché ». */}
                          {o.id === ctx.cle ? 'Celui-ci' : `${o.course_date < jour ? 'Passé' : o.id === objectifs.enCours ? 'En cours' : 'À venir'} · ${dateLongue(o.course_date, true)}`}
                        </span>
                      </button>
                    </form>
                    {o.coache && o.course_date >= jour && (retrait ? (
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-[#8A5E10] font-semibold">Retrait demandé à ton coach</span>
                        <form action={annulerDemande.bind(null, retrait.id)}>
                          <button type="submit" className="min-h-11 font-bold text-teal">Annuler la demande</button>
                        </form>
                      </div>
                    ) : (
                      // Un geste qui demande confirmation (§8, point 11, audit du 03/11/2026).
                      <details className="text-xs">
                        <summary className="cursor-pointer min-h-11 flex items-center font-semibold text-[#5E5C78] underline underline-offset-2">Demander le retrait de cet objectif</summary>
                        <div className="pb-2 space-y-1.5">
                          <p className="text-[#4A4866]">Ton coach reçoit ta demande et retire l’objectif ; ta préparation s’arrête alors.</p>
                          <form action={demanderRetrait.bind(null, o.id)}>
                            <button type="submit" className="min-h-11 px-3 rounded-lg border border-[#E2725B]/50 font-bold text-[#B5462F]">Confirmer la demande de retrait</button>
                          </form>
                        </div>
                      </details>
                    ))}
                  </li>
                );
              })}
              {objectifs.demandes.filter((dm) => !estRetrait(dm)).map((dm) => (
                <li key={dm.id} className="py-1">
                  <div className="min-h-11 flex justify-between items-center gap-3 text-sm">
                    <span className="font-bold text-indigo">{String(dm.champs.course_nom ?? '')}</span>
                    <span className="text-[#5E5C78]">En attente de ton coach</span>
                  </div>
                  <form action={annulerDemande.bind(null, dm.id)}>
                    <button type="submit" className="min-h-11 text-xs font-semibold text-[#5E5C78] underline underline-offset-2">Annuler cette demande</button>
                  </form>
                </li>
              ))}
            </ul>
            {/* Q3 : un seul nom par geste ; l'acheteur « Préparer une nouvelle course » (un achat), le coaché « Proposer un
                objectif ». */}
            <Link href={lien('/app/objectif/nouveau', ctx)} className={LIEN}>{ctx.coache ? 'Proposer un objectif ›' : 'Préparer une nouvelle course ›'}</Link>
          </Carte>
        )}
      </main>
    </>
  );
}

// « 21 décembre » (C4, audits du 05/11/2026).
const jourEtMois = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^1 /, '1er ');

// AT5 (décision coach du 04/11/2026) : « mécanique », une famille de coach, se dit « force et terrain » au coureur.
const enMotsDeCoureur = (qualite: string) => qualite.replace(/^m[ée]canique/i, (m) => (m[0] === 'M' ? 'Force et terrain' : 'force et terrain'));
