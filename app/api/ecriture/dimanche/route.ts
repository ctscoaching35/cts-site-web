import { passageDuDimanche, prevenirCoach, REMIS } from '@/lib/app/ecriture';
import { saisonsDuJour } from '@/lib/app/fond';
import { site } from '@/lib/content';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage du dimanche soir (vercel.json, crons ; CTS_NOLIO_CADRAGE.md, T3) : la semaine suivante de chaque plan
// écrit semaine par semaine, d'après la semaine écoulée lue dans Nolio, puis envoyée. Vercel l'appelle avec le secret
// CRON_SECRET ; sans lui, rien ne part. Trois passages le dimanche soir (vercel.json, deux heures d'écart : une tâche de
// l'offre gratuite part dans l'heure prévue, jamais deux en même temps) : le premier, puis deux reprises qui ne font que
// ce qui manque (décision coach du 20/10/2026). Le coach n'est prévenu qu'après la dernière, de ce qui reste.
export const dynamic = 'force-dynamic';
// Une semaine par athlète, quelques secondes chacune.
export const maxDuration = 300;
// La dernière reprise du dimanche soir, dans vercel.json.
const DERNIERE = '0 21 * * 0';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ semaines: [] });
  // Les saisons de fond du lundi qui vient d'abord (25/10/2026 : créées par le passage du soir, lancé à 21 h 16, elles
  // n'avaient que la dernière reprise) : elles s'écrivent avec les départs, les reprises en secours. Rien en double : une
  // saison déjà là couvre son lundi.
  const debut = Date.now();
  const saisons = await saisonsDuJour(60_000).catch((e) => [{ plan: '', quoi: 'saisons de fond en échec', erreur: e instanceof Error ? e.message : String(e) }]);
  // Le temps qui reste aux semaines, dans les 5 minutes de la tâche.
  const comptes = [...saisons.filter((c) => c.erreur), ...await passageDuDimanche(Math.max(60_000, 240_000 - (Date.now() - debut)))];
  // Sans l'athlète : un journal ou un e-mail n'a pas à garder ses données (le plan suffit à le retrouver).
  const echecs = comptes.filter((c) => c.erreur || c.quoi === REMIS);
  if (echecs.length) console.error('Passage du dimanche :', echecs.map((c) => `${c.plan} — ${c.erreur ?? c.quoi}`).join(' ; '));
  // La dernière reprise (ou un appel à la main, sans en-tête de planification) : le coach apprend ce qui reste.
  const planif = request.headers.get('x-vercel-cron-schedule');
  if (echecs.length && (!planif || planif === DERNIERE)) {
    await prevenirCoach(`Plans CTS : ${echecs.length} semaine${echecs.length > 1 ? 's' : ''} non écrite${echecs.length > 1 ? 's' : ''}`,
      'Le passage du dimanche n’a pas pu écrire ou envoyer certaines semaines dans Nolio, même après ses reprises. Dès lundi, '
      + `chacune est dans « À regarder », dans ton espace coach, avec son bouton « Réessayer » (${site.url}/app/coach).`);
  }
  return Response.json({ semaines: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
