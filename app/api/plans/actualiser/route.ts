import { actualiserPlans } from '@/lib/app/actualisation';
import { supabaseConfigure } from '@/lib/app/supabase';

// La nuit (vercel.json, crons ; décision coach du 19/10/2026) : les plans en cours refaits par le moteur du jour quand
// il a changé de version (lib/app/actualisation.ts). Vercel l'appelle avec le secret CRON_SECRET ; sans lui, rien ne
// bouge.
export const dynamic = 'force-dynamic';
// Un plan refait en quelques secondes ; le moteur peut d'abord devoir se réveiller.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ plans: [] });
  const comptes = await actualiserPlans();
  const echecs = comptes.filter((c) => c.erreur);
  // Sans l'athlète : le plan suffit à le retrouver ; un plan non refait garde son contenu et réessaie la nuit suivante.
  if (echecs.length) console.error('Plans refaits :', echecs.map((c) => `${c.plan} — ${c.erreur}`).join(' ; '));
  return Response.json({ plans: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
