import { resumerSemaines } from '@/lib/app/semainesNolio';
import { supabaseConfigure } from '@/lib/app/supabase';

// La nuit (vercel.json, crons ; décision coach du 20/10/2026, « tableau de bord complet ») : les semaines que le moteur
// n'a pas écrites, résumées depuis Nolio pour chaque coaché qui a donné son accord (lib/app/semainesNolio.ts). Vercel
// l'appelle avec le secret CRON_SECRET ; sans lui, rien ne bouge. Un athlète non résumé l'est la nuit suivante.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ athletes: [] });
  const comptes = await resumerSemaines();
  const echecs = comptes.filter((c) => c.erreur);
  // Sans l'athlète en clair : son identifiant Nolio suffit à le retrouver.
  if (echecs.length) console.error('Semaines résumées :', echecs.map((c) => `${c.athlete} — ${c.erreur}`).join(' ; '));
  return Response.json({ athletes: comptes.length, echecs: echecs.length });
}
