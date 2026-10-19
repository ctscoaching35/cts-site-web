import { passageDuDimanche, prevenirCoach } from '@/lib/app/ecriture';
import { supabaseConfigure } from '@/lib/app/supabase';

// Le passage du dimanche soir (vercel.json, crons ; CTS_NOLIO_CADRAGE.md, T3) : la semaine suivante de chaque plan
// écrit semaine par semaine, d'après la semaine écoulée lue dans Nolio, puis envoyée. Vercel l'appelle avec le secret
// CRON_SECRET ; sans lui, rien ne part.
export const dynamic = 'force-dynamic';
// Une semaine par athlète, quelques secondes chacune.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ semaines: [] });
  const comptes = await passageDuDimanche();
  const echecs = comptes.filter((c) => c.erreur);
  if (echecs.length) {
    // Sans l'athlète : un journal ou un e-mail n'a pas à garder ses données (le plan suffit à le retrouver).
    console.error('Passage du dimanche :', echecs.map((c) => `${c.plan} — ${c.erreur}`).join(' ; '));
    await prevenirCoach(`Plans CTS : ${echecs.length} semaine${echecs.length > 1 ? 's' : ''} non écrite${echecs.length > 1 ? 's' : ''}`,
      'Le passage du dimanche n’a pas pu écrire ou envoyer certaines semaines dans Nolio. Ouvre ton espace coach : '
      + 'chaque plan concerné y garde son bouton pour réessayer.');
  }
  return Response.json({ semaines: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
