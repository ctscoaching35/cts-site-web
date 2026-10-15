import { passerComptesInactifs } from '@/lib/app/comptesInactifs';
import { envoyerRelancesDues } from '@/lib/app/relance';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage quotidien (vercel.json, crons) : les relances, puis les comptes inactifs (E7 : avertis 30 jours avant,
// supprimés 3 ans après leur dernière activité). Vercel l'appelle avec le secret CRON_SECRET, saisi par le coach dans
// Vercel ; sans lui, rien ne part.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ envoyees: 0 });
  const envoyees = await envoyerRelancesDues();
  return Response.json({ envoyees, comptes_inactifs: await passerComptesInactifs() });
}
