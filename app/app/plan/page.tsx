import Link from 'next/link';
import { redirect } from 'next/navigation';
import clsx from 'clsx';
import EnTeteApp from '@/components/app/EnTeteApp';
import { AjouterCourse, RetirerCourse } from '@/components/app/GestesEcriture';
import { Carte, PastilleDate, Surtitre } from '@/components/app/Ui';
import { choisirPlan } from '@/lib/app/actionsPlan';
import { contexte, lien, plansDuCompte, type PlanDuCompte, type Recherche } from '@/lib/app/contexte';
import { annulerDemande, demanderRetrait } from '@/lib/app/actionsObjectifs';
import { demandesDeLAthlete, estRetrait, ficheDuCompte } from '@/lib/app/demandes';
import { clientServeur, clientService } from '@/lib/app/supabase';
import { dateLongue, jMoins } from '@/lib/app/plan';
import { blocsDuPlan, jaugeDuPlan } from '@/lib/app/tableau';
import { donneesTableau, fichesDePreparation, type CourseSecondaire } from '@/lib/app/tableauDuPlan';

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
  const prep = new Map((params ?? []).map((p) => [p.id as string,
    (((p.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[]).slice().sort((a, b) => a.date.localeCompare(b.date))]));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const fiche = await ficheDuCompte(compteId);
  return {
    liste: liste.map((p: PlanDuCompte) => ({ ...p, preparations: prep.get(p.id) ?? [] })),
    enCours: liste.find((p) => p.course_date >= aujourdhui)?.id ?? null,
    demandes: fiche ? await demandesDeLAthlete(fiche.id) : [],
  };
}

// L'objectif (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, AP1 ; maquette validée par le coach le 19/10/2026) :
// ouvert depuis l'accueil, sa fiche de course, ses jalons, sa préparation bloc par bloc (ce que chaque bloc développe,
// en J- ; décision coach du 19/10/2026, à la place des semaines, de leurs volumes et de leurs sorties longues), ses
// courses de préparation (O2) ; puis les autres objectifs du compte (OM2).
export default async function Objectif({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const r = await searchParams;
  // Un coaché sans objectif : son accueil, qui dit aussi qu'une demande est partie.
  if (ctx.sansObjectif) redirect(r.demande === 'envoyee' ? '/app?demande=envoyee' : '/app');
  const { plan, jour } = ctx;
  const d = await donneesTableau(ctx);
  const objectifs = ctx.demonstration ? null : await mesObjectifs();
  const jauge = jaugeDuPlan(d.trame, d.realises, jour);
  const courseAVenir = plan.course.date >= jour;
  const fichesPrepa = ctx.demonstration ? new Set<string>() : await fichesDePreparation(ctx.cle);
  const { course } = plan;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-3 pb-6 space-y-4">
        <Link href={lien('/app', ctx)} className="inline-flex items-center min-h-11 text-sm font-bold text-teal">‹ Accueil</Link>
        <div className="-mt-1">
          <Surtitre as="div">Objectif principal</Surtitre>
          <h1 className="mt-1.5 text-[1.75rem] font-extrabold text-indigo tracking-tight leading-tight">{course.nom}</h1>
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78]">
            {dateLongue(course.date)} · {course.format_clair} · {Math.round(course.distance_km)} km · {course.dplus_m.toLocaleString('fr-FR')} m D+
          </p>
        </div>

        {/* Plus de PDF dans l'app (décision coach du 19/10/2026) : la préparation vit et s'ajuste semaine après semaine ;
            l'acheteur garde celui de l'e-mail de bienvenue. */}
        <Link href={lien('/app/plan/course', ctx)} className="bg-indigo text-white rounded-[14px] p-3.5 flex items-center justify-between gap-3">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-bold">Ta fiche de course</span>
            {/* Ce qu'elle contient vraiment, dans l'ordre de ses parties (retour du coach du 20/10/2026). */}
            <span className="text-xs text-[#D6D5E6]">Profil, tronçons, déterminants de la performance, stratégie nutritionnelle</span>
          </span>
          <span aria-hidden>›</span>
        </Link>

        {r.demande === 'envoyee' && (
          <Carte className="text-sm text-indigo"><p role="status">Ta demande est partie chez ton coach : il la relit et lance ta préparation.</p></Carte>
        )}

        {/* Programmé à la main (décision coach du 20/10/2026) : ni jalons ni blocs, qui suivent la trame du moteur. */}
        {jauge.jalons.length > 0 && !ctx.aLaMain && (
          <Carte className="space-y-3">
            <Surtitre>Tes jalons</Surtitre>
            <ul className="grid grid-cols-3 gap-2">
              {jauge.jalons.map((j) => (
                <li key={j.titre} className={clsx('rounded-xl p-2.5 flex flex-col gap-1.5',
                  j.atteint ? 'bg-[#E1EFEA]' : 'bg-sand border border-dashed border-indigo/20')}>
                  <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round"
                    stroke={j.atteint ? '#085044' : '#5E5C78'} strokeWidth={j.atteint ? 2 : 1.8}>
                    {j.atteint ? <path d="M5 12.5 10 17 19 7" /> : <path d="M3 20 9 9l4 6 3-4 5 9z" />}
                  </svg>
                  <span className={clsx('text-xs leading-snug', j.atteint ? 'font-bold text-teal-dark' : 'font-semibold text-[#4A4866]')}>
                    {j.titre}<span className="sr-only">{j.atteint ? ' : atteint' : ' : à venir'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        )}

        {!ctx.aLaMain && <Carte className="!pb-1.5">
          <Surtitre>Ta préparation, bloc par bloc</Surtitre>
          <p className="mt-1 mb-1 text-xs text-[#5E5C78] leading-relaxed">
            Ce que chaque bloc développe, jusqu’à ton jour J ; tes séances s’écrivent chaque dimanche dans Nolio.
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
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={clsx('text-sm text-indigo', b.moment === 'encours' ? 'font-extrabold' : 'font-bold')}>
                      {b.nom}{b.moment === 'encours' && <span className="ml-2 text-[0.6875rem] font-bold text-teal-dark">tu es ici</span>}
                      <span className="sr-only">{b.moment === 'fait' ? ', fait' : b.moment === 'encours' ? ', en cours' : ', à venir'}</span>
                    </span>
                    <span className="text-xs font-bold text-[#5E5C78] whitespace-nowrap">{jMoins(b.du, course.date)} → {jMoins(b.au, course.date)}</span>
                  </span>
                  {b.travail.length > 0 && (
                    <span className="block mt-1 text-[0.78rem] text-[#4A4866] leading-snug">
                      <span className="font-semibold text-indigo">Tu travailles :</span> {b.travail.join(', ')}
                    </span>
                  )}
                  {b.rappel.length > 0 && (
                    <span className="block mt-0.5 text-[0.75rem] text-[#5E5C78] leading-snug">En rappel : {b.rappel.join(', ')}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Carte>}

        {d.ecrit && !ctx.demonstration && (
          <Carte id="ajouter-course" className="space-y-3 scroll-mt-20">
            <Surtitre>Tes courses de préparation</Surtitre>
            {d.courses.map((c) => (
              <div key={`${c.date}-${c.nom}`}>
                <div className="flex items-center gap-3">
                  <PastilleDate iso={c.date} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-indigo">{c.nom}</span>
                    <span className="block text-xs text-[#5E5C78]">{c.distance_km} km{c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}{c.chrono ? ` · objectif ${c.chrono}` : ''}</span>
                  </span>
                  {fichesPrepa.has(c.date) && (
                    <Link href={lien('/app/plan/course', ctx, { course: c.date })} className="shrink-0 inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Sa fiche ›</Link>
                  )}
                </div>
                {c.date > jour && <div className="pl-14 -mt-1"><RetirerCourse planId={ctx.cle} date={c.date} nom={c.nom} /></div>}
              </div>
            ))}
            {courseAVenir && (
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

        {objectifs && (
          <Carte className="space-y-2">
            <Surtitre>Tes objectifs</Surtitre>
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
                          {o.id === ctx.cle ? 'Affiché' : `${o.course_date < jour ? 'Passé' : o.id === objectifs.enCours ? 'En cours' : 'À venir'} · ${dateLongue(o.course_date, true)}`}
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
                      <form action={demanderRetrait.bind(null, o.id)}>
                        <button type="submit" className="min-h-11 text-xs font-semibold text-[#5E5C78] underline underline-offset-2">Demander le retrait de cet objectif</button>
                      </form>
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
            <Link href="/app/objectif/nouveau" className="inline-flex items-center min-h-11 text-sm font-bold text-teal">Nouvel objectif ›</Link>
          </Carte>
        )}
      </main>
    </>
  );
}
