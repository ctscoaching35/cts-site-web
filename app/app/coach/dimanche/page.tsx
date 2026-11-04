import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { athletesCoaches } from '@/lib/app/coaching';
import { CORRECTIONS } from '@/lib/app/corrections';
import { exigerCoach } from '@/lib/app/nolio';
import { ajouterJours, dateLongue } from '@/lib/app/plan';
import { prevision, RANG, type Niveau, type Prevision } from '@/lib/app/prevision';
import { signauxGardes } from '@/lib/app/signauxGardes';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Dimanche », une seule vue (EC4, refonte par exception, décision coach du 04/11/2026, « A » ; l'aperçu du dimanche,
// proposé le 30/10/2026) : une ligne par objectif dont la semaine s'écrit dimanche soir, avec son niveau, lu dans les
// signaux gardés du soir (rouge : le moteur changera sa semaine ; orange : proche d'un seuil ; vert : elle suit le plan),
// les rouges en tête ; chaque ligne ouvre son aperçu, calculé à son ouverture (rien n'est lu dans Nolio ici). Après le
// passage, la même page dit ce qui est parti et ce qui ne l'est pas. En cartes, pour le téléphone d'abord (EC5).
const NIVEAU: Record<Niveau, { libelle: string; classe: string }> = {
  rouge: { libelle: 'Rouge', classe: 'bg-[#F6E1DD] text-[#8A3326]' }, orange: { libelle: 'Orange', classe: 'bg-[#F6ECD8] text-[#6E4A0C]' },
  vert: { libelle: 'Vert', classe: 'bg-[#E3EFE9] text-[#22604F]' }, rien: { libelle: 'Sans signal lu', classe: 'bg-[#ECEBF2] text-[#4A4866]' },
};

export default async function Dimanche() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const service = clientService();
  const { data: compte } = await service.from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const lundi = ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const fiches = (await athletesCoaches(coach.compteId)).filter((a) => a.nolio_athlete_id);
  // Les objectifs encore en route, et ceux d'une course passée depuis moins de 6 semaines (sa récupération).
  const objectifs = fiches.flatMap((a) => a.objectifs.filter((o) => o.course_date >= ajouterJours(jour, -42)).map((o) => ({ a, o })));
  const ids = objectifs.map((x) => x.o.plan_id);
  const { data: plans } = ids.length
    ? await service.from('plans').select('id, parametres, demarre_le, depart_prevu').in('id', ids) : { data: [] };
  const parId = new Map((plans ?? []).map((p) => [p.id as string, p]));
  const lignes = objectifs.filter(({ o }) => {
    const p = parId.get(o.plan_id);
    return p?.parametres && (p.demarre_le || (p.depart_prevu && String(p.depart_prevu) <= lundi));
  });
  const ecrites = lignes.filter(({ a }) => a.programmation === 'auto' && a.mode === 'coaching');
  const laissees = [...new Set(lignes.filter(({ a }) => !ecrites.some((e) => e.a.id === a.id)).map(({ a }) => a.nom))];
  // Ce qui est déjà parti pour ce lundi (après le passage), et les corrections choisies sur l'aperçu (EC3).
  const { data: parties } = ids.length
    ? await service.from('semaines_ecrites').select('plan_id').in('plan_id', ids).eq('donnees->>lundi', lundi) : { data: [] };
  const partis = new Set((parties ?? []).map((x) => x.plan_id as string));
  const { data: corrigees, error: sansCorrections } = ids.length
    ? await service.from('corrections_semaine').select('plan_id, corrections').in('plan_id', ids).eq('lundi', lundi) : { data: [], error: null };
  const corrections = new Map(sansCorrections ? [] : (corrigees ?? []).map((x) => [x.plan_id as string, (x.corrections ?? []) as string[]]));
  const gardes = await signauxGardes(coach.compteId).catch(() => null);
  // Le dimanche soir, après le premier passage (17 h UTC) : ce qui n'est pas parti attend les reprises de 19 h et 21 h.
  const apresLePassage = new Date().getUTCDay() === 0 && new Date().getUTCHours() >= 17;
  const vues = ecrites.map(({ a, o }) => {
    const g = a.nolio_athlete_id ? gardes?.get(a.nolio_athlete_id) : undefined;
    const p: Prevision = g ? prevision({ prevues: g.prevues, faites: g.faites, hooper: g.hooper, signaux: g.signaux.map((x) => ({ ...x, seance: '' })) },
      { ecrit: true, aLaMain: false }) : { niveau: 'rien', pourquoi: '', prevoit: '' };
    return { a, o, p };
  }).sort((x, y) => RANG[x.p.niveau] - RANG[y.p.niveau] || x.a.nom.localeCompare(y.a.nom, 'fr'));
  return (
    <CadreCoach actif="dimanche" coach={String(compte?.nom ?? '')}>
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Dimanche</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] leading-relaxed">
          Les semaines du {dateLongue(lundi, true)}, qui s’écrivent dimanche soir, celles que le moteur changera en tête. Ouvre
          un athlète pour voir celle qu’il écrirait maintenant, ce qu’il change, pourquoi, et ce qu’il a lu. Rien n’est envoyé.
        </p>
      </div>
      {ecrites.length === 0 ? <Carte className="!p-5"><p className="text-sm text-teal font-semibold">Aucune semaine à écrire dimanche.</p></Carte> : (
        <ul className="space-y-3">
          {vues.map(({ a, o, p }) => {
            const plan = parId.get(o.plan_id);
            const fond = Boolean((plan?.parametres as { fond?: unknown } | null)?.fond);
            const corr = corrections.get(o.plan_id) ?? [];
            return (
              <li key={o.plan_id} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-[1_1_300px] space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{a.nom}</span>
                    <span className={clsx('text-[0.6875rem] font-bold px-2 py-0.5 rounded-full', NIVEAU[p.niveau].classe)}>{NIVEAU[p.niveau].libelle}</span>
                    {partis.has(o.plan_id) && <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-[#E3EFE9] text-[#22604F]">Partie dans Nolio</span>}
                    {!partis.has(o.plan_id) && apresLePassage && (
                      <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-[#F6E1DD] text-[#8A3326]">Pas encore partie</span>
                    )}
                  </div>
                  <p className="text-sm text-[#4A4866]">
                    {fond ? 'Saison de fond' : o.course_nom}
                    {!plan?.demarre_le ? ' · départ lundi' : o.course_date < jour ? ' · récupération' : ''}
                    {p.prevoit ? ` · ${p.prevoit}${p.pourquoi ? ` (${p.pourquoi})` : ''}` : ''}
                  </p>
                  {corr.length > 0 && (
                    <p className="text-[0.8125rem] text-[#6E4A0C]">Tes corrections : {corr.map((c) => CORRECTIONS[c as keyof typeof CORRECTIONS] ?? c).join(', ')}.</p>
                  )}
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
      {apresLePassage && ecrites.some(({ o }) => !partis.has(o.plan_id)) && (
        <p className="text-[0.8125rem] text-[#5E5C78]">
          Ce qui n’est pas encore parti se refait aux reprises de 20 h et 22 h ; lundi, ce qui manque encore est sur « Cette semaine », avec « Réessayer ».
        </p>
      )}
      {gardes === null && (
        <p className="text-[0.8125rem] text-[#5E5C78]">Les niveaux viennent des signaux gardés du soir : la migration du 04/11/2026 est à passer.</p>
      )}
      {laissees.length > 0 && (
        <p className="text-[0.8125rem] text-[#5E5C78]">À la main ou en mode plan, rien ne s’écrit : {laissees.join(', ')}.</p>
      )}
    </CadreCoach>
  );
}
