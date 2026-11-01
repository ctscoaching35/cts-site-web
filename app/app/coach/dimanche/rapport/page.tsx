import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import PourquoiSemaine from '@/components/app/PourquoiSemaine';
import { Carte, Surtitre } from '@/components/app/Ui';
import { athletesCoaches } from '@/lib/app/coaching';
import { apercuDuDimanche, type Apercu } from '@/lib/app/ecriture';
import { enClair } from '@/lib/app/journalEnClair';
import { exigerCoach } from '@/lib/app/nolio';
import { ajouterJours, dateLongue } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit Nolio et demande chaque semaine au moteur, sans rien garder.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Le rapport du dimanche (demande du coach du 31/10/2026 : « que tu reprennes les athlètes un par un et que tu me
// justifies ce que tu proposes la semaine prochaine […] Je vais regarder tes justifications et je vais corriger ce qui
// ne va pas et t'expliquer pourquoi ») : pour chaque objectif dont la semaine s'écrit dimanche soir, la semaine que le
// moteur écrirait maintenant, son pourquoi et ce qu'il change, à la suite. Rien n'est envoyé. Le moteur l'écrit sans IA
// (les conditions de l'API Nolio encadrent le traitement des données des athlètes par une IA).
export default async function RapportDuDimanche() {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { data: compte } = await clientService().from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const lundi = ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  // Les mêmes objectifs que « Dimanche » : en route, ou d'une course passée depuis moins de 6 semaines.
  const fiches = (await athletesCoaches(coach.compteId)).filter((a) => a.nolio_athlete_id && a.programmation === 'auto'
    && a.mode === 'coaching');
  const objectifs = fiches.flatMap((a) => a.objectifs.filter((o) => o.course_date >= ajouterJours(jour, -42)).map((o) => ({ a, o })));
  // Trois à la fois : chaque aperçu lit Nolio et appelle le moteur.
  const resultats: { nom: string; course: string; planId: string; apercu: Apercu | null; erreur: string | null }[] = [];
  for (let i = 0; i < objectifs.length; i += 3) {
    resultats.push(...await Promise.all(objectifs.slice(i, i + 3).map(async ({ a, o }) => {
      try {
        return { nom: a.nom, course: o.course_nom, planId: o.plan_id, apercu: await apercuDuDimanche(o.plan_id), erreur: null };
      } catch (e) {
        console.error(`Rapport, aperçu de ${o.plan_id} :`, e instanceof Error ? e.message : e);
        return { nom: a.nom, course: o.course_nom, planId: o.plan_id, apercu: null, erreur: 'Nolio ou le moteur ne répond pas.' };
      }
    })));
  }
  return (
    <CadreCoach actif="dimanche" coach={String(compte?.nom ?? '')}>
      <Link href="/app/coach/dimanche" className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">‹ Dimanche</Link>
      <div className="!mt-2">
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Le rapport du dimanche</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] leading-relaxed">
          Les semaines du {dateLongue(lundi, true)}, athlète par athlète : ce que le moteur écrirait maintenant, et pourquoi.
          Confronte-les à ce que tu leur proposerais ; ce qui ne va pas, dis-le avec ta raison, et la règle se corrige.
          Rien n’est envoyé.
        </p>
      </div>
      {resultats.length === 0 && <Carte className="!p-5"><p className="text-sm font-semibold">Aucune semaine à écrire dimanche.</p></Carte>}
      {resultats.map((r) => (
        <section key={r.planId} className="space-y-3">
          <h2 className="pt-4 text-xl font-extrabold tracking-tight">{r.nom} <span className="font-semibold text-[#5E5C78]">· {r.course}</span></h2>
          {r.erreur && <Carte className="!p-5"><p className="text-sm text-[#8A3326] font-semibold">{r.erreur}</p></Carte>}
          {r.apercu && !r.apercu.sortie && <Carte className="!p-5"><p className="text-sm font-semibold">{r.apercu.quoi}</p></Carte>}
          {r.apercu?.sortie && (
            <>
              <Carte className="!p-5 space-y-2">
                <Surtitre>{r.apercu.quoi === 'Semaine' ? `La semaine qui partira (${r.apercu.numero})` : r.apercu.quoi}</Surtitre>
                <ul className="divide-y divide-indigo/10 text-sm">
                  {r.apercu.sortie.semaine.jours.filter((j) => j.famille !== 'repos').map((j) => (
                    <li key={j.id} className="flex gap-3 py-1.5">
                      <span className="w-[4.6rem] shrink-0 text-xs text-indigo/55 pt-0.5">{j.date}</span>
                      <span className="text-indigo font-semibold">{j.seance}
                        {j.duree !== '—' && <span className="font-normal text-indigo/55"> · {j.duree}{j.rpe !== '—' ? ` · RPE ${j.rpe}` : ''}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {r.apercu.sortie.journal.length > 0 && (
                  <ul className="pt-1 space-y-1 text-sm leading-relaxed text-[#3B3957] list-disc pl-5">
                    {r.apercu.sortie.journal.flatMap((e, i) => enClair(e).map((t, k) => <li key={`${i}-${k}`}>{t}</li>))}
                  </ul>
                )}
                <Link href={`/app/coach/plan/${r.planId}/apercu`} className="inline-block pt-1 text-[0.8125rem] font-bold text-teal">L’aperçu complet ›</Link>
              </Carte>
              {r.apercu.sortie.pourquoi && <PourquoiSemaine pourquoi={r.apercu.sortie.pourquoi} />}
            </>
          )}
        </section>
      ))}
    </CadreCoach>
  );
}
