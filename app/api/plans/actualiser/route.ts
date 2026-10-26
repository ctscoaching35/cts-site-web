import { actualiserPlans } from '@/lib/app/actualisation';
import { rattraperLesZones } from '@/lib/app/ecriture';
import { supabaseConfigure } from '@/lib/app/supabase';

// La nuit (vercel.json, crons ; décision coach du 19/10/2026) : les plans en cours refaits par le moteur du jour quand
// il a changé de version (lib/app/actualisation.ts). Vercel l'appelle avec le secret CRON_SECRET ; sans lui, rien ne
// bouge.
export const dynamic = 'force-dynamic';
// Un plan refait en quelques secondes ; le moteur peut d'abord devoir se réveiller.
export const maxDuration = 300;
const RATTRAPAGE_ZONES_JUSQUAU = '2026-10-28';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ plans: [] });
  const debut = Date.now();
  const comptes = await actualiserPlans();
  // Le rattrapage des zones dans Nolio (décision coach du 25/10/2026, l'écriture ouverte à tous) : la nuit du 25 au
  // 26/10, puis celle du 26 au 27/10 pour les numéros du coach (décision du 26/10/2026), et celle du 27 au 28/10 pour
  // les métriques (la VC, les FC aux seuils, la vitesse au seuil 1), dans le temps qui reste à la tâche.
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  if (jour <= RATTRAPAGE_ZONES_JUSQUAU) {
    comptes.push(...await rattraperLesZones(Math.max(30_000, 240_000 - (Date.now() - debut)))
      .catch((e) => [{ plan: '', quoi: 'zones non rattrapées', erreur: e instanceof Error ? e.message : String(e) }]));
  }
  const echecs = comptes.filter((c) => c.erreur);
  // Sans l'athlète : le plan suffit à le retrouver ; un plan non refait garde son contenu et réessaie la nuit suivante.
  if (echecs.length) console.error('Plans refaits :', echecs.map((c) => `${c.plan} — ${c.erreur}`).join(' ; '));
  return Response.json({ plans: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
