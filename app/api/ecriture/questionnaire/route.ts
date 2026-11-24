import { questionnaireDuMatinV9 } from '@/lib/app/passagesV9';
import { selonLeMoteur } from '@/lib/app/chaineDuMoteur';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le questionnaire du dimanche, posé le matin (vercel.json, crons : dimanche 8 h UTC, hors de la fenêtre d'écriture du moteur, de dimanche 16 h 45 à lundi 5 h 30) :
// le moteur v1 choisit sa version (normale, aucune séance vue, fatigue) d'après ce que Nolio montre de la semaine écrite, et il se pose dans Nolio pour 12 h.
// Sous la 8.x, RIEN : le questionnaire du samedi d'avant est celui de la fiche (lib/app/dimanchesCoaches.ts). Vercel l'appelle avec le secret CRON_SECRET ;
// sans lui, rien ne part.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ questionnaires: [] });
  const comptes = await selonLeMoteur({ avant: async () => [], v1: () => questionnaireDuMatinV9(240_000) });
  const echecs = comptes.filter((c) => c.erreur);
  if (echecs.length) console.error('Questionnaire du dimanche :', echecs.map((c) => `${c.plan} — ${c.erreur}`).join(' ; '));
  return Response.json({ questionnaires: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
