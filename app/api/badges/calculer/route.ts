import { calculerBadges } from '@/lib/app/badgesNolio';
import { supabaseConfigure } from '@/lib/app/supabase';

// La nuit (vercel.json, crons ; BG1 à BG3, décisions coach du 20/10/2026) : les badges de chaque athlète qui a donné
// son accord de lecture, recomptés depuis ses séances Nolio (lib/app/badgesNolio.ts). Vercel l'appelle avec le secret
// CRON_SECRET ; sans lui, rien ne bouge. Un athlète non calculé (Nolio injoignable, temps écoulé) l'est la nuit suivante.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ athletes: [] });
  const comptes = await calculerBadges();
  const echecs = comptes.filter((c) => c.erreur);
  // Sans l'athlète en clair : son identifiant Nolio suffit à le retrouver.
  if (echecs.length) console.error('Badges :', echecs.map((c) => `${c.athlete} — ${c.erreur}`).join(' ; '));
  return Response.json({ athletes: comptes.length, echecs: echecs.length });
}
