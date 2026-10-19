import { passerComptesInactifs } from '@/lib/app/comptesInactifs';
import { passageQuotidien } from '@/lib/app/ecriture';
import { envoyerRelancesDues } from '@/lib/app/relance';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage quotidien (vercel.json, crons) : les relances ; les comptes inactifs (E7 : avertis 30 jours avant,
// supprimés 3 ans après leur dernière activité) ; l'écriture semaine par semaine (la fatigue du jour, les invitations
// Nolio à refaire, le résumé au coach). Vercel l'appelle avec le secret CRON_SECRET, saisi par le coach dans Vercel ;
// sans lui, rien ne part.
export const dynamic = 'force-dynamic';
// Un plan actif à la fois, quelques secondes chacun.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ envoyees: 0 });
  const envoyees = await envoyerRelancesDues();
  const comptesInactifs = await passerComptesInactifs();
  // L'écriture semaine par semaine : la fatigue du jour, les invitations à refaire, le résumé au coach.
  const ecriture = await passageQuotidien().catch((e) => [{ plan: '', quoi: 'passage en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  return Response.json({ envoyees, comptes_inactifs: comptesInactifs, ecriture: ecriture.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
