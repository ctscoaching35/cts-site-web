import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { athletesCoaches } from '@/lib/app/coaching';
import { exigerCoach } from '@/lib/app/nolio';
import { ajouterJours, dateLongue } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Dimanche » (l'aperçu du dimanche, proposé au coach le 30/10/2026) : chaque objectif dont la semaine peut s'écrire
// dimanche soir, et le lien vers ce qu'elle donnerait aujourd'hui (/app/coach/plan/[id]/apercu). Rien n'est lu dans
// Nolio ici : chaque aperçu se calcule à son ouverture.
export default async function Dimanche() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { data: compte } = await clientService().from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const lundi = ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const fiches = (await athletesCoaches(coach.compteId)).filter((a) => a.nolio_athlete_id);
  // Les objectifs encore en route, et ceux d'une course passée depuis moins de 6 semaines (sa récupération).
  const objectifs = fiches.flatMap((a) => a.objectifs.filter((o) => o.course_date >= ajouterJours(jour, -42)).map((o) => ({ a, o })));
  const { data: plans } = objectifs.length
    ? await clientService().from('plans').select('id, parametres, demarre_le, depart_prevu').in('id', objectifs.map((x) => x.o.plan_id))
    : { data: [] };
  const parId = new Map((plans ?? []).map((p) => [p.id as string, p]));
  const lignes = objectifs.filter(({ o }) => {
    const p = parId.get(o.plan_id);
    return p?.parametres && (p.demarre_le || (p.depart_prevu && String(p.depart_prevu) <= lundi));
  });
  const ecrites = lignes.filter(({ a }) => a.programmation === 'auto' && a.mode === 'coaching');
  const laissees = [...new Set(lignes.filter(({ a }) => !ecrites.some((e) => e.a.id === a.id)).map(({ a }) => a.nom))];
  return (
    <CadreCoach actif="dimanche" coach={String(compte?.nom ?? '')}>
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Dimanche</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] leading-relaxed">
          Les semaines du {dateLongue(lundi, true)}, qui s’écrivent dimanche soir. Ouvre un athlète pour voir celle que le moteur
          écrirait maintenant, ce qu’il change et ce qu’il a lu. Rien n’est envoyé.
        </p>
      </div>
      <Carte className="!p-5">
        {ecrites.length === 0 ? <p className="text-sm text-teal font-semibold">Aucune semaine à écrire dimanche.</p> : (
          <ul>
            {ecrites.map(({ a, o }) => {
              const p = parId.get(o.plan_id);
              const fond = Boolean((p?.parametres as { fond?: unknown } | null)?.fond);
              return (
                <li key={o.plan_id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-t first:border-t-0 border-indigo/[0.07]">
                  <div className="min-w-0 flex-[1_1_320px]">
                    <div className="font-bold">{a.nom}</div>
                    <div className="mt-0.5 text-sm text-[#4A4866]">
                      {fond ? 'Saison de fond' : o.course_nom}
                      {!p?.demarre_le ? ' · départ lundi' : o.course_date < jour ? ' · récupération' : ''}
                    </div>
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
      </Carte>
      {laissees.length > 0 && (
        <p className="text-[0.8125rem] text-[#5E5C78]">À la main ou en mode plan, rien ne s’écrit : {laissees.join(', ')}.</p>
      )}
    </CadreCoach>
  );
}
