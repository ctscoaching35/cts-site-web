import { selonLeMoteur } from '@/lib/app/chaineDuMoteur';
import { estUnLancementDe8x, rappelDuDimancheV9ALHeure, RAPPEL_DU_DIMANCHE_8X } from '@/lib/app/heuresDePassage';
import { rappelDuDimancheV9 } from '@/lib/app/passagesV9';
import { rappelActif } from '@/lib/app/rappelDimanche';
import { TEXTE_RAPPEL_V9_VALIDE } from '@/lib/app/rappelDimancheV9';
import { rappelerLeDimanche } from '@/lib/app/rappelDuDimanche';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le rappel du dimanche (vercel.json, crons ; décision 5 du coach du 16/11/2026, lot 0) : vers 14 h UTC le dimanche, un message
// Nolio programmé vers 15 h (heure de Paris) pour qui n'a pas répondu au questionnaire du samedi ou a une séance de la semaine
// pas remontée (sous la 8.x) ; sous la 9.x, pour qui n'a pas répondu à son point du dimanche (décision 206). COUPÉ PAR DÉFAUT : sans CTS_RAPPEL_DIMANCHE=oui, la tâche ne lit rien et n'envoie rien ; le texte est provisoire
// (lib/app/rappelDimanche.ts). Vercel l'appelle avec le secret CRON_SECRET ; sans lui, rien ne part.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ actif: false, rappels: [] });
  // Sous le moteur v1 (9.x), le rappel est celui des décisions 206 et 211 du coach (24/11/2026) : un seul, vers 19 h à Paris, seulement à qui n'a pas répondu à son point du dimanche ;
  // plus de rappel pour les séances non remontées. Même interrupteur CTS_RAPPEL_DIMANCHE. vercel.json le lance à 14 h UTC (la 8.x) et à 17 h et 18 h UTC (la v1, dont un seul tombe à
  // 19 h à Paris selon la saison) : chaque moteur ignore les lancements qui ne sont pas les siens (lib/app/heuresDePassage.ts). Sous la 8.x, rien ne change.
  const planif = request.headers.get('x-vercel-cron-schedule');
  const maintenant = new Date();
  const { actif, texteValide, comptes } = await selonLeMoteur({
    avant: async () => (estUnLancementDe8x(planif, RAPPEL_DU_DIMANCHE_8X) ? rappelerLeDimanche(240_000) : { actif: rappelActif(), texteValide: true, comptes: [] }),
    v1: async () => (planif && !rappelDuDimancheV9ALHeure(maintenant) ? { actif: rappelActif(), texteValide: TEXTE_RAPPEL_V9_VALIDE, comptes: [] } : rappelDuDimancheV9(240_000)),
  });
  const echecs = comptes.filter((c) => c.erreur);
  if (echecs.length) console.error('Rappel du dimanche :', echecs.map((c) => `${c.plan} — ${c.quoi} : ${c.erreur}`).join(' ; '));
  return Response.json({ actif, texteValide, rappels: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
