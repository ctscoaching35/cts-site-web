import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { exigerCoach } from '@/lib/app/nolio';
import { ajouterJours, dateLongue } from '@/lib/app/plan';
import { prevision, RANG, type Niveau, type Prevision } from '@/lib/app/prevision';
import { signauxGardes } from '@/lib/app/signauxGardes';
import { apresLePassage as passageFait, semainesDuDimanche } from '@/lib/app/semainesDuDimanche';
import { espaceCoachOuvert } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Dimanche », une seule vue (EC4, refonte par exception, décision coach du 04/11/2026, « A » ; l'aperçu du dimanche,
// proposé le 30/10/2026) : les semaines qui s'écrivent dimanche soir, avec leur niveau, lu dans les signaux gardés du soir
// (rouge : le moteur changera sa semaine ; orange : proche d'un seuil ; vert : elle suit le plan). Par exception
// (décisions coach du 04/11/2026, relecture écran par écran) : en cartes, seulement les rouges et les orange, les rouges en
// tête ; les verts en une ligne, leurs noms vers leur aperçu. Après le passage, une semaine pas encore partie reprend sa
// carte, avec les reprises de 20 h et 22 h. Chaque carte ouvre son aperçu, calculé à son ouverture (rien n'est lu dans
// Nolio ici). En cartes, pour le téléphone d'abord (EC5).
const NIVEAU: Record<Niveau, { libelle: string; classe: string }> = {
  rouge: { libelle: 'Rouge', classe: 'bg-[#F6E1DD] text-[#8A3326]' }, orange: { libelle: 'Orange', classe: 'bg-[#F6ECD8] text-[#6E4A0C]' },
  vert: { libelle: 'Vert', classe: 'bg-[#E3EFE9] text-[#22604F]' }, rien: { libelle: 'Sans signal lu', classe: 'bg-[#ECEBF2] text-[#4A4866]' },
};

// Des noms, chacun vers son aperçu : « Léa Martin, Hugo Bernard et Sarah Lambert ». nom : le nom à montrer (avec sa course
// quand l'athlète a deux semaines dans la liste).
function Noms({ vues, nom }: { vues: { a: { nom: string }; o: { plan_id: string } }[]; nom: (v: { a: { nom: string }; o: { plan_id: string } }) => string }) {
  return (
    <>
      {vues.map((v, i) => (
        <span key={v.o.plan_id}>
          {i > 0 && (i === vues.length - 1 ? ' et ' : ', ')}
          <Link href={`/app/coach/plan/${v.o.plan_id}/apercu`} className="font-semibold text-teal hover:underline">{nom(v)}</Link>
        </span>
      ))}
    </>
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
  // à côté du sien, « Alexandre Allin (OCC) », dans les cartes comme dans les noms (05/11/2026 au soir).
  const fois = new Map<string, number>();
  for (const v of vues) fois.set(v.a.nom, (fois.get(v.a.nom) ?? 0) + 1);
  const courseDe = (plan_id: string) => {
    const v = vues.find((x) => x.o.plan_id === plan_id);
    return v && (v.plan.parametres as { fond?: unknown } | null)?.fond ? 'saison de fond' : v?.o.course_nom ?? '';
  };
  const nomAffiche = ({ a, o }: { a: { nom: string }; o: { plan_id: string } }) =>
    (fois.get(a.nom) ?? 0) > 1 && courseDe(o.plan_id) ? `${a.nom} (${courseDe(o.plan_id)})` : a.nom;
  const enCarte = (v: (typeof vues)[number]) => v.p.niveau === 'rouge' || v.p.niveau === 'orange' || (apresLePassage && !v.partie);
  const cartes = vues.filter(enCarte);
  const verts = vues.filter((v) => !enCarte(v) && v.p.niveau === 'vert');
  const sansSignal = vues.filter((v) => !enCarte(v) && v.p.niveau === 'rien');
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
          {cartes.length > 0 && (
            <ul className="space-y-3">
              {cartes.map(({ a, o, plan, p, partie }) => {
                const fond = Boolean((plan.parametres as { fond?: unknown } | null)?.fond);
                return (
                  <li key={o.plan_id} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-[1_1_300px] space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{nomAffiche({ a, o })}</span>
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
          {verts.length > 0 && (
            <Carte className="!p-4">
              <p className="text-sm text-[#3B3957] leading-relaxed">
                <span className={clsx('mr-2 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full', NIVEAU.vert.classe)}>Vert</span>
                <strong>{verts.length} semaine{verts.length > 1 ? 's' : ''} sui{verts.length > 1 ? 'vent' : 't'} le plan</strong>
                {apresLePassage ? `, partie${verts.length > 1 ? 's' : ''} dans Nolio` : ''} : <Noms vues={verts} nom={nomAffiche} />.
              </p>
            </Carte>
          )}
          {sansSignal.length > 0 && (
            <p className="text-[0.8125rem] text-[#5E5C78] leading-relaxed">
              Sans signal lu (pas d’accord de lecture, ou rien de lu ce soir) : <Noms vues={sansSignal} nom={nomAffiche} />.
            </p>
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
