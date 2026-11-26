import { passerComptesInactifs } from '@/lib/app/comptesInactifs';
import { effacerLesDemandesEchues } from '@/lib/app/demandesCoaching';
import { programmerLesDimanches } from '@/lib/app/dimanchesCoaches';
import { selonLeMoteur } from '@/lib/app/chaineDuMoteur';
import { saisonsDuJour, saisonsDuV1 } from '@/lib/app/fond';
import { signauxDesALaMain } from '@/lib/app/pointALaMain';
import { passageQuotidienLeger, passageQuotidienLong, retirerLaTrameAuDela } from '@/lib/app/ecriture';
import { envoyerRelancesDues } from '@/lib/app/relance';
import { effacerLesAchatsEchus, renvoyerLesConfirmations } from '@/lib/app/rangement';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage quotidien (vercel.json, crons) : les relances ; les comptes inactifs (E7 : avertis 30 jours avant,
// supprimés 3 ans après leur dernière activité) ; les demandes de coaching sans suite (app gratuite : 3 mois après leur envoi) ; les achats de plus de 10 ans, effacés (3A, décision coach du
// 05/11/2026) ; l'écriture semaine par semaine (la fatigue du jour, les invitations
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
  // 3A : les achats gardés 10 ans pour la comptabilité, puis effacés (une requête, sans toucher aux comptes ni aux plans).
  const achats = await effacerLesAchatsEchus().catch((e) => [{ plan: '', quoi: 'achats échus en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Les invitations, les alertes, les départs, les semaines du dimanche à reprendre : avant tout le reste (X1).
  const leger = await passageQuotidienLeger().catch((e) => [{ plan: '', quoi: 'passage léger en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  const comptesInactifs = await passerComptesInactifs();
  // Les demandes de coaching sans suite (app gratuite, lot A2) : effacées 3 mois après leur envoi.
  const demandesEchues = await effacerLesDemandesEchues().catch(() => 0);
  // La saison de fond (décisions coach du 24/10/2026) : celle de chaque coaché sans objectif à préparer, pour le lundi qui
  // vient ; le passage du dimanche l'écrit. D'abord : le dimanche soir, ses reprises de 21 h et 23 h l'attendent.
  // Sous le moteur v1 (9.x), la saison de fond est la sienne (saisonsDuV1 : un coaché n'est jamais sans semaine, C6, C3) ; le questionnaire du dimanche se pose par app/api/ecriture/questionnaire, le Hooper plus bas.
  // Sous la 8.x, rien ne change.
  const saisons = await selonLeMoteur<{ plan: string; quoi: string; erreur?: string }[]>({ avant: () => saisonsDuJour(), v1: () => saisonsDuV1() })
    .catch((e) => [{ plan: '', quoi: 'saisons de fond en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Le week-end de chaque coaché (décision coach du 21/10/2026), en temps compté : le reste, le soir suivant. Sous la 9.x, le Hooper seul (décision 52 du coach, 20/11/2026 : sans lui
  // l'alerte fatigue ne part jamais) : « Ton point du dimanche » remplace le questionnaire du samedi, pas le Hooper du dimanche 8 h.
  const dimanches = await selonLeMoteur({ avant: () => programmerLesDimanches(), v1: () => programmerLesDimanches(120_000, { seulementLeHooper: true }) }).catch((e) => [{ plan: '', quoi: 'dimanches en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Les coachés à la main n'ont pas de semaine écrite : leurs signaux du soir se lisent ici, avec leur accord (demande du coach du 26/11/2026).
  const aLaMain = await selonLeMoteur({ avant: async () => [], v1: () => signauxDesALaMain(40_000) }).catch((e) => [{ plan: '', quoi: 'signaux à la main en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Une semaine à la fois (décision coach du 23/10/2026) : les bandeaux posés d'avance, au-delà de la semaine qui vient.
  const trames = await retirerLaTrameAuDela().catch((e) => [{ plan: '', quoi: 'trames en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // La fatigue du jour et les tests, dans le temps qui reste ; le résumé au coach.
  const reste = Math.max(20_000, BUDGET_MS - (Date.now() - debut));
  const long = await passageQuotidienLong(reste).catch((e) => [{ plan: '', quoi: 'passage en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  return Response.json({ envoyees, comptes_inactifs: comptesInactifs, demandes_coaching_effacees: demandesEchues,
    ecriture: [...confirmations, ...achats, ...leger, ...dimanches, ...saisons, ...aLaMain, ...trames, ...long].map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
