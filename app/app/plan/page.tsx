import Link from 'next/link';
import clsx from 'clsx';
import EnTeteApp from '@/components/app/EnTeteApp';
import { AjouterCourse } from '@/components/app/GestesEcriture';
import { Carte, PastilleDate, Surtitre } from '@/components/app/Ui';
import { BANNIERE } from '@/lib/app/charte';
import { choisirPlan } from '@/lib/app/actionsPlan';
import { contexte, lien, plansDuCompte, type PlanDuCompte, type Recherche } from '@/lib/app/contexte';
import { demandesDeLAthlete, ficheDuCompte } from '@/lib/app/demandes';
import { clientServeur, clientService } from '@/lib/app/supabase';
import { dateLongue } from '@/lib/app/plan';
import { enHeures, jaugeDuPlan, momentDe } from '@/lib/app/tableau';
import { donneesTableau, fichesDePreparation, type CourseSecondaire } from '@/lib/app/tableauDuPlan';
import { lienFicheCourse } from '@/lib/app/ficheCourse';

// « Mes objectifs » (OM2, décision coach du 19/10/2026) : chaque objectif majeur du compte (les siens, ceux que son
// coach lui prépare), en cours, à venir ou passé, et ses courses de préparation ; un toucher l'affiche ; les demandes
// d'un coaché en attente ; « Nouvel objectif ».
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
// ouvert depuis l'accueil, sa fiche de course et sa trame en PDF, ses jalons, sa préparation semaine par semaine
// (type, volume prévu, séances clés et week-ends choc annoncés d'avance, ce qui a été fait), ses courses de
// préparation (O2) ; puis les autres objectifs du compte (OM2).
export default async function Objectif({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan, jour } = ctx;
  const d = await donneesTableau(ctx);
  const r = await searchParams;
  const objectifs = ctx.demonstration ? null : await mesObjectifs();
  const jauge = jaugeDuPlan(d.trame, d.realises, jour);
  const faits = new Map(d.realises.map((x) => [x.numero, x]));
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

        {/* Plus de PDF dans l'app (décision coach du 20/10/2026) : la préparation vit et s'ajuste semaine après semaine ;
            l'acheteur garde celui de l'e-mail de bienvenue. */}
        <Link href={lien('/app/plan/course', ctx)} className="bg-indigo text-white rounded-[14px] p-3.5 flex items-center justify-between gap-3">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-bold">Ta fiche de course</span>
            <span className="text-xs text-[#D6D5E6]">Profil, tronçons, ravitaillement, ton jour J</span>
          </span>
          <span aria-hidden>›</span>
        </Link>

        {r.demande === 'envoyee' && (
          <Carte className="text-sm text-indigo"><p role="status">Ta demande est partie chez ton coach : il la relit et lance ta préparation.</p></Carte>
        )}

        {jauge.jalons.length > 0 && (
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

        <Carte className="!pb-2">
          <Surtitre>Ta préparation semaine par semaine</Surtitre>
          <p className="mt-1 mb-2.5 text-xs text-[#5E5C78] leading-relaxed">
            Les séances clés et les week-ends choc sont annoncés d’avance ; le détail s’écrit chaque dimanche dans Nolio.
          </p>
          <ul>
            {d.trame.map((l) => {
              const m = l.lundi ? momentDe(l.lundi, jour) : 'avenir';
              const fait = faits.get(l.numero);
              const statut = !fait || m !== 'passee' ? null
                : fait.seances_faites >= fait.seances_prevues ? { signe: '✓', texte: 'semaine complète', ton: 'text-teal' }
                  : fait.seances_faites > 0 ? { signe: '½', texte: 'semaine en partie faite', ton: 'text-[#8A5E10]' } : null;
              const cles = [l.week_end_choc ? 'Week-end choc' : null, ...l.seances_cles.filter((c) => c.famille !== 'sl').map((c) => c.seance.split(' — ')[0]),
                l.sl_min ? `SL ${enHeures(l.sl_min)}` : null].filter(Boolean);
              return (
                <li key={l.numero} id={l.numero}
                  className={clsx('grid grid-cols-[34px_4px_1fr_auto] gap-x-2.5 items-center min-h-[52px] scroll-mt-20',
                    m === 'encours' ? 'bg-[#E1EFEA] -mx-2.5 px-2.5 rounded-xl min-h-14' : 'border-t border-indigo/[0.06]')}>
                  <span className={clsx('text-xs', m === 'encours' ? 'font-extrabold text-teal-dark' : 'font-bold text-[#5E5C78]')}>{l.numero}</span>
                  <span className="w-1 h-8 rounded-sm" style={{ backgroundColor: BANNIERE[l.type] ?? '#2F2D4E' }} aria-hidden />
                  <span className="min-w-0 py-1.5">
                    <span className={clsx('block text-[0.8125rem] text-indigo', m === 'encours' ? 'font-extrabold' : 'font-bold')}>
                      {l.type}{m === 'encours' ? ' · cette semaine' : ''}
                    </span>
                    <span className="block text-[0.72rem] text-[#5E5C78] truncate">{[l.dates.split(' — ')[0], ...cles].join(' · ')}</span>
                  </span>
                  <span className={clsx('text-xs font-bold whitespace-nowrap', statut?.ton ?? (m === 'avenir' ? 'text-[#5E5C78] font-semibold' : 'text-teal-dark'))}>
                    {enHeures(Math.round(l.volume_h * 60))}{statut && <> {statut.signe}<span className="sr-only">, {statut.texte}</span></>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Carte>

        {d.ecrit && !ctx.demonstration && (
          <Carte id="ajouter-course" className="space-y-3 scroll-mt-20">
            <Surtitre>Tes courses de préparation</Surtitre>
            {d.courses.map((c) => (
              <div key={`${c.date}-${c.nom}`} className="flex items-center gap-3">
                <PastilleDate iso={c.date} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-indigo">{c.nom}</span>
                  <span className="block text-xs text-[#5E5C78]">{c.distance_km} km{c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}{c.chrono ? ` · objectif ${c.chrono}` : ''}</span>
                </span>
                {fichesPrepa.has(c.date) && (
                  <a href={`${lienFicheCourse(ctx.cle)}?course=${c.date}`} className="shrink-0 inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Sa fiche ›</a>
                )}
              </div>
            ))}
            {courseAVenir && (
              <>
                <p className="text-xs text-[#5E5C78] leading-relaxed">
                  Une course avant ton objectif ? Ajoute-la : les jours autour d’elle s’ajustent (quelques jours plus légers avant,
                  de la récupération après), sans toucher à la suite de ton plan.
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
              {objectifs.liste.map((o) => (
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
                </li>
              ))}
              {objectifs.demandes.map((dm) => (
                <li key={dm.id} className="min-h-11 flex justify-between items-center gap-3 text-sm">
                  <span className="font-bold text-indigo">{String(dm.champs.course_nom ?? '')}</span>
                  <span className="text-[#5E5C78]">En attente de ton coach</span>
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
