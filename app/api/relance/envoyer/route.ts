import { passerComptesInactifs } from '@/lib/app/comptesInactifs';
import { programmerLesDimanches } from '@/lib/app/dimanchesCoaches';
import { saisonsDuJour } from '@/lib/app/fond';
import { passageQuotidien, retirerLaTrameAuDela } from '@/lib/app/ecriture';
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
  // La saison de fond (décisions coach du 24/10/2026) : celle de chaque coaché sans objectif à préparer, pour le lundi qui
  // vient ; le passage du dimanche l'écrit. D'abord : le dimanche soir, ses reprises de 21 h et 23 h l'attendent.
  const saisons = await saisonsDuJour().catch((e) => [{ plan: '', quoi: 'saisons de fond en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Le week-end de chaque coaché (décision coach du 21/10/2026), en temps compté : le reste, le soir suivant.
  const dimanches = await programmerLesDimanches().catch((e) => [{ plan: '', quoi: 'dimanches en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Une semaine à la fois (décision coach du 23/10/2026) : les bandeaux posés d'avance, au-delà de la semaine qui vient.
  const trames = await retirerLaTrameAuDela().catch((e) => [{ plan: '', quoi: 'trames en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // L'écriture semaine par semaine : la fatigue du jour, les invitations à refaire, le résumé au coach.
  const ecriture = await passageQuotidien().catch((e) => [{ plan: '', quoi: 'passage en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  return Response.json({ envoyees, comptes_inactifs: comptesInactifs,
    ecriture: [...dimanches, ...saisons, ...trames, ...ecriture].map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
