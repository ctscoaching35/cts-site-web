import { passerComptesInactifs } from '@/lib/app/comptesInactifs';
import { programmerLesDimanches } from '@/lib/app/dimanchesCoaches';
import { saisonsDuJour } from '@/lib/app/fond';
import { passageQuotidienLeger, passageQuotidienLong, retirerLaTrameAuDela } from '@/lib/app/ecriture';
import { envoyerRelancesDues } from '@/lib/app/relance';
import { renvoyerLesConfirmations } from '@/lib/app/rangement';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage quotidien (vercel.json, crons) : les relances ; les comptes inactifs (E7 : avertis 30 jours avant,
// supprimés 3 ans après leur dernière activité) ; l'écriture semaine par semaine (la fatigue du jour, les invitations
// Nolio à refaire, le résumé au coach). Vercel l'appelle avec le secret CRON_SECRET, saisi par le coach dans Vercel ;
// sans lui, rien ne part.
// X1 (audits du 05/11/2026, lot 2) : les appels légers d'abord — les relances, la confirmation de commande à renvoyer
// (J1), les invitations, l'alerte du samedi et la relecture de l'équipe (E1), les départs, les semaines du dimanche à
// reprendre (E4) —, puis les tâches longues, chacune en temps compté ; la boucle de fatigue prend le temps qui reste.
export const dynamic = 'force-dynamic';
// Un plan actif à la fois, quelques secondes chacun.
export const maxDuration = 300;
// Le temps de la tâche moins une marge : ce qui reste se fait le soir suivant.
const BUDGET_MS = 280_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ envoyees: 0 });
  const debut = Date.now();
  const envoyees = await envoyerRelancesDues();
  // J1 (audits du 05/11/2026) : la confirmation de commande qui n'est pas partie, renvoyée (14 jours au plus).
  const confirmations = await renvoyerLesConfirmations().catch((e) => [{ plan: '', quoi: 'confirmations en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Les invitations, les alertes, les départs, les semaines du dimanche à reprendre : avant tout le reste (X1).
  const leger = await passageQuotidienLeger().catch((e) => [{ plan: '', quoi: 'passage léger en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  const comptesInactifs = await passerComptesInactifs();
  // La saison de fond (décisions coach du 24/10/2026) : celle de chaque coaché sans objectif à préparer, pour le lundi qui
  // vient ; le passage du dimanche l'écrit. D'abord : le dimanche soir, ses reprises de 21 h et 23 h l'attendent.
  const saisons = await saisonsDuJour().catch((e) => [{ plan: '', quoi: 'saisons de fond en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Le week-end de chaque coaché (décision coach du 21/10/2026), en temps compté : le reste, le soir suivant.
  const dimanches = await programmerLesDimanches().catch((e) => [{ plan: '', quoi: 'dimanches en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Une semaine à la fois (décision coach du 23/10/2026) : les bandeaux posés d'avance, au-delà de la semaine qui vient.
  const trames = await retirerLaTrameAuDela().catch((e) => [{ plan: '', quoi: 'trames en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // La fatigue du jour et les tests, dans le temps qui reste ; le résumé au coach.
  const reste = Math.max(20_000, BUDGET_MS - (Date.now() - debut));
  const long = await passageQuotidienLong(reste).catch((e) => [{ plan: '', quoi: 'passage en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  return Response.json({ envoyees, comptes_inactifs: comptesInactifs,
    ecriture: [...confirmations, ...leger, ...dimanches, ...saisons, ...trames, ...long].map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
