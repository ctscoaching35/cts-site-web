import { compterLesRetouches } from '@/lib/app/retouches';
import { supabaseConfigure } from '@/lib/app/supabase';

// La nuit (vercel.json, crons ; décision coach du 26/10/2026, « compter tes retouches ») : les retouches du coach dans
// Nolio sur la semaine en cours et la précédente de chaque objectif coaché écrit par le moteur, par famille de séances
// (lib/app/retouches.ts). Vercel l'appelle avec le secret CRON_SECRET ; sans lui, rien ne bouge. Ce qui n'est pas
// compté l'est la nuit suivante.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ semaines: 0 });
  const comptes = await compterLesRetouches();
  const echecs = comptes.filter((c) => c.erreur);
  // Sans l'athlète en clair : l'objectif suffit à le retrouver.
  if (echecs.length) console.error('Retouches :', echecs.map((c) => `${c.plan} — ${c.erreur}`).join(' ; '));
  return Response.json({ semaines: comptes.filter((c) => !c.erreur).length, echecs: echecs.length });
}
