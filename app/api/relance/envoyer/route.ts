import { envoyerRelancesDues } from '@/lib/app/relance';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage quotidien des relances (vercel.json, crons) : Vercel l'appelle avec le secret CRON_SECRET, saisi par
// le coach dans Vercel ; sans lui, rien ne part.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ envoyees: 0 });
  return Response.json({ envoyees: await envoyerRelancesDues() });
}
