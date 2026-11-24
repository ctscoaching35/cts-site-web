import { nomsDesPlans, passageDuLundi } from '@/lib/app/ecriture';
import { supabaseConfigure } from '@/lib/app/supabase';

// La passe du lundi (vercel.json, crons ; lot 0 du 16/11/2026, D5 du moteur 8.466) : chaque lundi vers 5 h UTC (6 h à Paris
// l'hiver, 7 h l'été ; jamais dans la fenêtre d'écriture du moteur, de 0 h 45 à 4 h 30 UTC), elle relit la semaine écoulée de
// chaque semaine écrite dimanche, rappelle le moteur quand quelque chose de nouveau est arrivé, puis pose la note du lundi.
// Elle repasse ensuite toutes les deux heures, jusqu'à 21 h UTC (décision du coach du 24/11/2026, entrée 191 : une réponse donnée
// lundi avant la première séance doit être lue ; lib/app/lundiV9.ts) : une semaine déjà passée (sa note du lundi posée) est sautée,
// ces passages ne changent rien d'autre tant que le moteur est une 8.x.
// Vercel l'appelle avec le secret CRON_SECRET ; sans lui, rien ne part. Offre Hobby : une tâche par jour, lancée dans l'heure.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ semaines: [] });
  const comptes = await passageDuLundi(240_000);
  // Sans le nom de l'athlète : un journal n'a pas à le garder (le plan suffit à le retrouver).
  const echecs = comptes.filter((c) => c.erreur);
  if (echecs.length) {
    const noms = await nomsDesPlans(echecs.map((c) => c.plan).filter(Boolean)).catch(() => new Map<string, string>());
    console.error('Passe du lundi :', echecs.map((c) => `${c.plan} (${noms.has(c.plan) ? 'nommé' : '?'}) — ${c.quoi} : ${c.erreur}`).join(' ; '));
  }
  return Response.json({ semaines: comptes.map(({ plan, quoi, erreur }) => ({ plan, quoi, erreur: erreur ?? null })) });
}
