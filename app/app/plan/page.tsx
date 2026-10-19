import Link from 'next/link';
import clsx from 'clsx';
import EnTeteApp from '@/components/app/EnTeteApp';
import { AjouterCourse } from '@/components/app/GestesEcriture';
import { Avertissement } from '@/components/app/Texte';
import { BANNIERE } from '@/lib/app/charte';
import { choisirPlan } from '@/lib/app/actionsPlan';
import { contexte, lien, plansDuCompte, type PlanDuCompte, type Recherche } from '@/lib/app/contexte';
import { demandesDeLAthlete, ficheDuCompte } from '@/lib/app/demandes';
import { clientServeur, clientService } from '@/lib/app/supabase';
import { dateLongue } from '@/lib/app/plan';
import { enHeures, momentDe } from '@/lib/app/tableau';
import { donneesTableau, type CourseSecondaire } from '@/lib/app/tableauDuPlan';

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

// Mon plan (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1 : il absorbe le calendrier) : ce que dit la couverture
// du PDF, la trame semaine par semaine rangée par bloc (type, volume prévu, séances clés, week-end choc annoncé
// d'avance), les courses secondaires (O2), puis la course, le jour J, le mode d'emploi, les zones ; le PDF.
export default async function MonPlan({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan, jour } = ctx;
  const d = await donneesTableau(ctx);
  const r = await searchParams;
  const objectifs = ctx.demonstration ? null : await mesObjectifs();
  const parties: [string, string][] = [
    ['/app/plan/ensemble', plan.architecture.titre],
    ['/app/plan/course', plan.ta_course.titre],
    ['/app/plan/jour-j', plan.jour_j.titre],
    ['/app/plan/mode-emploi', plan.mode_emploi.titre],
    // « Tes zones » (moteur v8.311) : absente d'un plan plus ancien.
    ...(plan.zones ? [['/app/plan/zones', plan.zones.titre] as [string, string]] : []),
  ];
  // Les semaines rangées par bloc, dans l'ordre du plan.
  const blocs: { bloc: string; lignes: typeof d.trame }[] = [];
  for (const l of d.trame) {
    if (blocs[blocs.length - 1]?.bloc !== l.bloc) blocs.push({ bloc: l.bloc, lignes: [] });
    blocs[blocs.length - 1].lignes.push(l);
  }
  const courseAVenir = plan.course.date >= jour;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <div>
          <div className="eyebrow text-teal mb-1">{plan.couverture.surtitre}</div>
          <h1 className="text-2xl text-indigo leading-tight">{plan.course.nom}</h1>
          <p className="text-sm text-indigo/60">{plan.course.format_clair}</p>
        </div>
        <dl className="grid grid-cols-4 bg-white shadow-sm border-t-2 border-teal">
          {plan.couverture.reperes.map(([cle, valeur]) => (
            <div key={cle} className="text-center px-1 py-3">
              <dt className="text-[0.58rem] font-bold tracking-cts-tight uppercase text-teal">{cle}</dt>
              <dd className="font-extrabold text-indigo text-sm leading-tight mt-0.5">{valeur}</dd>
            </div>
          ))}
        </dl>
        <div className="text-center px-2">
          <p className="font-semibold text-indigo">{plan.couverture.debut}</p>
          <p className="text-sm text-indigo/60">{plan.couverture.rendez_vous}</p>
        </div>

        {r.demande === 'envoyee' && (
          <p className="bg-white border-l-4 border-teal shadow-sm p-4 text-sm text-indigo" role="status">
            Ta demande est partie chez ton coach : il la relit et lance ta préparation.
          </p>
        )}
        {objectifs && (
          <section className="bg-white shadow-sm p-4 space-y-2" aria-labelledby="objectifs">
            <h2 id="objectifs" className="eyebrow text-indigo/60">Mes objectifs</h2>
            <ul className="divide-y divide-indigo/10">
              {objectifs.liste.map((o) => (
                <li key={o.id} className="py-2">
                  <form action={choisirPlan.bind(null, o.id)}>
                    <button type="submit" disabled={o.id === ctx.cle} className="w-full flex justify-between items-baseline gap-3 text-sm text-left disabled:cursor-default">
                      <span className="font-semibold text-indigo">{o.course_nom}</span>
                      <span className={o.id === ctx.cle ? 'text-teal font-semibold' : 'text-indigo/60'}>
                        {o.id === ctx.cle ? 'Affiché' : `${o.course_date < jour ? 'Passé' : o.id === objectifs.enCours ? 'En cours' : 'À venir'} · ${dateLongue(o.course_date, true)}`}
                      </span>
                    </button>
                  </form>
                  {o.preparations.length > 0 && (
                    <ul className="mt-1 pl-3 space-y-0.5 text-xs text-indigo/65">
                      {o.preparations.map((c) => <li key={`${c.date}-${c.nom}`}>{c.nom} · {dateLongue(c.date)}</li>)}
                    </ul>
                  )}
                </li>
              ))}
              {objectifs.demandes.map((dm) => (
                <li key={dm.id} className="py-2 flex justify-between gap-3 text-sm">
                  <span className="font-semibold text-indigo">{String(dm.champs.course_nom ?? '')}</span>
                  <span className="text-indigo/60">En attente de ton coach</span>
                </li>
              ))}
            </ul>
            <Link href="/app/objectif/nouveau" className="inline-block text-sm font-semibold text-teal">Nouvel objectif ›</Link>
          </section>
        )}

        <section className="space-y-3" aria-labelledby="semaines">
          <h2 id="semaines" className="eyebrow text-indigo/60">Semaine par semaine</h2>
          <p className="text-sm text-indigo/65">
            Le détail de tes séances est dans Nolio ; chaque semaine s’y écrit le dimanche d’avant, d’après la précédente.
          </p>
          {blocs.map((b) => (
            <div key={`${b.bloc}-${b.lignes[0].numero}`} className="space-y-1">
              <h3 className="text-sm font-bold text-indigo">{b.bloc}</h3>
              <ul className="bg-white shadow-sm divide-y divide-indigo/10">
                {b.lignes.map((l) => {
                  const m = l.lundi ? momentDe(l.lundi, jour) : 'avenir';
                  return (
                    <li key={l.numero} id={l.numero} className={clsx('px-3 py-2.5 border-l-4', m === 'encours' && 'bg-[#F1F7F4]', m === 'passee' && 'opacity-60')}
                      style={{ borderLeftColor: BANNIERE[l.type] ?? '#2F2D4E' }}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-bold text-indigo">
                          {l.numero.replace('S', 'Semaine ')} · {l.type}
                          {m === 'encours' && <span className="ml-2 text-xs font-semibold text-teal">en cours</span>}
                        </span>
                        <span className="text-xs text-indigo/55">{l.dates} · {enHeures(Math.round(l.volume_h * 60))}</span>
                      </div>
                      {(l.seances_cles.length > 0 || l.week_end_choc) && (
                        <p className="text-xs text-indigo/70 mt-0.5">
                          {l.week_end_choc && <span className="font-semibold text-teal">Week-end choc · </span>}
                          {l.seances_cles.map((c) => c.seance).join(' · ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {d.ecrit && !ctx.demonstration && (
          <section className="bg-white shadow-sm p-4 space-y-3">
            <h2 className="eyebrow text-indigo/60">Tes courses de préparation</h2>
            {d.courses.length > 0 ? (
              <ul className="space-y-1 text-sm text-indigo">
                {d.courses.map((c) => (
                  <li key={`${c.date}-${c.nom}`}><span className="font-semibold">{c.nom}</span> · {dateLongue(c.date)} · {c.distance_km} km, {c.dplus_m} m D+</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-indigo/65">
                Une course avant ton objectif ? Ajoute-la : les jours autour d’elle s’ajustent (quelques jours plus légers
                avant, de la récupération après), sans toucher à la suite de ton plan.
              </p>
            )}
            {courseAVenir && (
              <details className="text-sm">
                <summary className="cursor-pointer text-teal font-semibold">Ajouter une course</summary>
                <div className="mt-3"><AjouterCourse planId={ctx.cle} /></div>
              </details>
            )}
          </section>
        )}

        <nav aria-label="Les parties de ton plan">
          <ul className="bg-white shadow-sm divide-y divide-indigo/10">
            {parties.map(([chemin, titre]) => (
              <li key={chemin}>
                <Link href={lien(chemin, ctx)} className="flex items-center justify-between px-4 py-3.5 hover:bg-sand/60">
                  <span className="font-bold text-indigo">{titre}</span>
                  <span aria-hidden className="text-indigo/30">›</span>
                </Link>
              </li>
            ))}
            {!ctx.demonstration && (
              <li>
                <a href="/app/plan/pdf" className="flex items-center justify-between px-4 py-3.5 hover:bg-sand/60">
                  <span className="font-bold text-indigo">Ton plan en PDF</span>
                  <span aria-hidden className="text-indigo/30">↓</span>
                </a>
              </li>
            )}
          </ul>
        </nav>

        <section>
          <h2 className="eyebrow text-indigo text-center mb-3">{plan.demarche.titre}</h2>
          <div className="grid grid-cols-2 gap-2">
            {plan.demarche.piliers.map(([titre, texte]) => (
              <div key={titre} className="bg-white shadow-sm p-3 text-center">
                <div className="text-[0.62rem] font-bold tracking-cts-tight uppercase text-teal mb-1">{titre}</div>
                <p className="text-xs text-indigo/75 leading-relaxed">{texte}</p>
              </div>
            ))}
          </div>
        </section>

        <Avertissement avertissement={plan.avertissement} />
      </main>
    </>
  );
}
