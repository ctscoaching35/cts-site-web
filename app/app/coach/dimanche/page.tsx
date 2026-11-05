import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { exigerCoach } from '@/lib/app/nolio';
import { ajouterJours, dateAbregee, dateLongue } from '@/lib/app/plan';
import { prevision, RANG, type Niveau, type Prevision } from '@/lib/app/prevision';
import { signauxGardes } from '@/lib/app/signauxGardes';
import { apresLePassage as passageFait, semainesDuDimanche } from '@/lib/app/semainesDuDimanche';
import { clientService, espaceCoachOuvert } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Dimanche », une seule vue (EC4, refonte par exception, décision coach du 04/11/2026, « A » ; l'aperçu du dimanche,
// proposé le 30/10/2026) : les semaines qui s'écrivent dimanche soir, avec leur niveau, lu dans les signaux gardés du soir
// (rouge : le moteur changera sa semaine ; orange : proche d'un seuil ; vert : elle suit le plan). Par exception
// (décisions coach du 04/11/2026, relecture écran par écran) : en cartes, seulement les rouges et les orange, les rouges en
// tête. Après le passage, une semaine pas encore partie reprend sa carte, avec les reprises de 20 h et 22 h. Décision 3A
// du coach (05/11/2026) : une ligne de bilan en tête ; les autres semaines en deux listes repliées, « Suivent le plan » et
// « Sans signal » (pas d'accord de lecture, ou rien de lu ce soir), une ligne chacune vers son aperçu. Chaque aperçu se
// calcule à son ouverture (rien n'est lu dans Nolio ici). Pour le téléphone d'abord (EC5).
const NIVEAU: Record<Niveau, { libelle: string; classe: string }> = {
  rouge: { libelle: 'Rouge', classe: 'bg-[#F6E1DD] text-[#8A3326]' }, orange: { libelle: 'Orange', classe: 'bg-[#F6ECD8] text-[#6E4A0C]' },
  vert: { libelle: 'Vert', classe: 'bg-[#E3EFE9] text-[#22604F]' }, rien: { libelle: 'Sans signal lu', classe: 'bg-[#ECEBF2] text-[#4A4866]' },
};

type Vue = { a: { nom: string; nolio_athlete_id?: string | null }; o: { plan_id: string; course_nom: string; course_date: string };
  plan: Record<string, unknown> };
const estFond = (plan: Record<string, unknown>) => Boolean((plan.parametres as { fond?: unknown } | null)?.fond);

// Une ligne d'une liste repliée : le nom, la course, pourquoi (« Sans signal »), son aperçu.
function LigneListe({ nom, course, pourquoi, partie, planId }: { nom: string; course: string; pourquoi?: string; partie: boolean; planId: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 border-t first:border-t-0 border-indigo/[0.07]">
      <div className="min-w-0 flex-[1_1_160px] text-sm">
        <span className="font-bold">{nom}</span>
        <span className="text-[#4A4866]"> · {course}{pourquoi ? ` · ${pourquoi}` : ''}</span>
        {partie && <span className="ml-2 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-[#E3EFE9] text-[#22604F] whitespace-nowrap">Partie dans Nolio</span>}
      </div>
      <Link href={`/app/coach/plan/${planId}/apercu`} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal whitespace-nowrap hover:underline">
        Voir l’aperçu ›
      </Link>
    </li>
  );
}

export default async function Dimanche() {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const { lundi, ecrites, aLaMain, partis } = await semainesDuDimanche(coach.compteId, jour);
  const gardes = await signauxGardes(coach.compteId).catch(() => null);
  // Le dimanche soir, après le premier passage (17 h UTC) : ce qui n'est pas parti attend les reprises de 19 h et 21 h.
  const apresLePassage = passageFait();
  // La semaine que le passage juge : celle qui finit ce dimanche (prevision.ts).
  const juge = ajouterJours(lundi, -7);
  const vues = ecrites.map(({ a, o, plan }) => {
    const g = a.nolio_athlete_id ? gardes?.get(a.nolio_athlete_id) : undefined;
    const p: Prevision = g ? prevision({ prevues: g.prevues, faites: g.faites, hooper: g.hooper, signaux: g.signaux.map((x) => ({ ...x, seance: '' })) }, juge)
      : { niveau: 'rien', pourquoi: '', prevoit: '' };
    return { a, o, plan, p, partie: partis.has(o.plan_id) };
  }).sort((x, y) => RANG[x.p.niveau] - RANG[y.p.niveau] || x.a.nom.localeCompare(y.a.nom, 'fr'));
  // Un athlète qui a deux semaines dans la liste (deux objectifs, ou un objectif et sa saison de fond) : le nom de la course
  // à côté du sien, « Alexandre Allin (OCC) » (05/11/2026 au soir) ; deux courses du même nom, sa date en plus,
  // « Sébastien Deschamps (Trail, 12 avr.) » (décision 3A du coach, 05/11/2026). Dans les listes, la course a sa place.
  const courseDe = (v: Vue) => (estFond(v.plan) ? 'Saison de fond' : v.o.course_nom);
  const memesNoms = (v: Vue) => vues.filter((x) => x.a.nom === v.a.nom);
  const homonyme = (v: Vue) => memesNoms(v).filter((x) => courseDe(x) === courseDe(v)).length > 1;
  // BROUILLON (05/11/2026, à valider) : la date de la course quand l'athlète a deux courses du même nom.
  const courseDatee = (v: Vue) => `${courseDe(v)}${homonyme(v) ? `, ${dateAbregee(v.o.course_date, false)}` : ''}`;
  const nomAffiche = (v: Vue) => {
    if (memesNoms(v).length < 2) return v.a.nom;
    const course = estFond(v.plan) && !homonyme(v) ? 'saison de fond' : courseDatee(v);
    return course ? `${v.a.nom} (${course})` : v.a.nom;
  };
  // La ligne d'une liste : sa course, puis ce que la carte disait (le départ lundi, la récupération).
  const courseDeLaLigne = (v: Vue) =>
    `${courseDatee(v)}${!v.plan.demarre_le ? ' · départ lundi' : v.o.course_date < jour ? ' · récupération' : ''}`;
  const enCarte = (v: (typeof vues)[number]) => v.p.niveau === 'rouge' || v.p.niveau === 'orange' || (apresLePassage && !v.partie);
  const cartes = vues.filter(enCarte);
  const verts = vues.filter((v) => !enCarte(v) && v.p.niveau === 'vert');
  const sansSignal = vues.filter((v) => !enCarte(v) && v.p.niveau === 'rien');
  // Sans signal : pas d'accord de lecture (aucune ligne d'accord), ou rien dans les signaux gardés du soir.
  const usrs = [...new Set(sansSignal.map((v) => v.a.nolio_athlete_id).filter((x): x is string => Boolean(x)))];
  const { data: accords } = usrs.length
    ? await clientService().from('nolio_accords').select('nolio_athlete_id').eq('coach_id', coach.compteId).in('nolio_athlete_id', usrs)
    : { data: [] };
  const avecAccord = new Set((accords ?? []).map((x) => String(x.nolio_athlete_id)));
  // BROUILLON (05/11/2026, à valider) : le bilan, les deux listes et leurs raisons.
  const suivent = (n: number) => (n > 1 ? 'suivent le plan' : 'suit le plan');
  const pourquoiSansSignal = (v: Vue) => (v.a.nolio_athlete_id && avecAccord.has(v.a.nolio_athlete_id) ? 'pas encore lu' : 'pas d’accord de lecture');
  return (
    <CadreCoach actif="dimanche">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Dimanche</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] leading-relaxed">
          Les semaines du {dateLongue(lundi, true)}, qui s’écrivent dimanche soir, celles que le moteur changera en tête. Ouvre
          un athlète pour voir celle qu’il écrirait maintenant, ce qu’il change, pourquoi, et ce qu’il a lu. Rien n’est envoyé.
        </p>
      </div>
      {ecrites.length === 0 ? <Carte className="!p-5"><p className="text-sm text-teal font-semibold">Aucune semaine à écrire dimanche.</p></Carte> : (
        <>
          {/* BROUILLON (05/11/2026, à valider) */}
          <p className="text-sm text-indigo">
            <strong>{cartes.length} à regarder</strong> · {verts.length} {suivent(verts.length)} · {sansSignal.length} sans signal
          </p>
          {cartes.length > 0 && (
            <ul className="space-y-3">
              {cartes.map((v) => {
                const { o, plan, p, partie } = v;
                const fond = estFond(plan);
                return (
                  <li key={o.plan_id} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-[1_1_300px] space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{nomAffiche(v)}</span>
                        <span className={clsx('text-[0.6875rem] font-bold px-2 py-0.5 rounded-full', NIVEAU[p.niveau].classe)}>{NIVEAU[p.niveau].libelle}</span>
                        {partie && <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-[#E3EFE9] text-[#22604F]">Partie dans Nolio</span>}
                        {!partie && apresLePassage && (
                          <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-[#F6E1DD] text-[#8A3326]">Pas encore partie</span>
                        )}
                      </div>
                      <p className="text-sm text-[#4A4866]">
                        {fond ? 'Saison de fond' : o.course_nom}
                        {!plan.demarre_le ? ' · départ lundi' : o.course_date < jour ? ' · récupération' : ''}
                        {p.prevoit ? ` · ${p.prevoit}${p.pourquoi ? ` (${p.pourquoi})` : ''}` : ''}
                      </p>
                    </div>
                    <Link href={`/app/coach/plan/${o.plan_id}/apercu`}
                      className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl text-[0.8125rem] font-bold whitespace-nowrap bg-white text-indigo border border-indigo/20 hover:bg-sand">
                      Voir l’aperçu ›
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {/* BROUILLON (05/11/2026, à valider) */}
          {gardes !== null && cartes.length === 0 && verts.length > 0 && (
            <p className="text-sm text-teal font-semibold">Aucune semaine ne change dimanche.</p>
          )}
          {verts.length > 0 && (
            <Carte className="!p-5">
              <details>
                <summary className="cursor-pointer min-h-11 flex items-center justify-between gap-3">
                  {/* BROUILLON (05/11/2026, à valider) */}
                  <span className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#22604F]">
                    {verts.length > 1 ? 'Suivent le plan' : 'Suit le plan'} ({verts.length})
                  </span>
                  <span className="text-xs text-[#5E5C78]">Voir ›</span>
                </summary>
                <ul className="mt-1">
                  {verts.map((v) => <LigneListe key={v.o.plan_id} nom={v.a.nom} course={courseDeLaLigne(v)} partie={v.partie} planId={v.o.plan_id} />)}
                </ul>
              </details>
            </Carte>
          )}
          {sansSignal.length > 0 && (
            <Carte className="!p-5">
              <details>
                <summary className="cursor-pointer min-h-11 flex items-center justify-between gap-3">
                  {/* BROUILLON (05/11/2026, à valider) */}
                  <span className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#4A4866]">Sans signal ({sansSignal.length})</span>
                  <span className="text-xs text-[#5E5C78]">Voir ›</span>
                </summary>
                <ul className="mt-1">
                  {sansSignal.map((v) => (
                    <LigneListe key={v.o.plan_id} nom={v.a.nom} course={courseDeLaLigne(v)} pourquoi={pourquoiSansSignal(v)} partie={v.partie} planId={v.o.plan_id} />
                  ))}
                </ul>
              </details>
            </Carte>
          )}
        </>
      )}
      {apresLePassage && vues.some((v) => !v.partie) && (
        <p className="text-[0.8125rem] text-[#5E5C78]">
          Ce qui n’est pas encore parti se refait aux reprises de 20 h et 22 h ; lundi, ce qui manque encore est sur « Cette semaine », avec « Réessayer ».
        </p>
      )}
      {gardes === null && (
        <p className="text-[0.8125rem] text-[#5E5C78]">Les niveaux viennent des signaux gardés du soir : la migration du 04/11/2026 est à passer.</p>
      )}
      {aLaMain.length > 0 && (
        <p className="text-[0.8125rem] text-[#5E5C78]">À la main, rien ne s’écrit : {aLaMain.join(', ')}.</p>
      )}
    </CadreCoach>
  );
}
