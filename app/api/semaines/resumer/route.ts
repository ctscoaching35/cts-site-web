import { refaireLesResumes } from '@/lib/app/ecriture';
import { reperesDeNolio } from '@/lib/app/reperesNolio';
import { resumerSemaines } from '@/lib/app/semainesNolio';
import { supabaseConfigure } from '@/lib/app/supabase';

// La nuit (vercel.json, crons ; décisions coach du 20/10/2026, « tableau de bord complet » et « oui, chaque nuit ») : les
// semaines que le moteur n'a pas écrites, résumées depuis Nolio pour chaque coaché qui a donné son accord
// (lib/app/semainesNolio.ts), puis les deux dernières semaines écrites par le moteur, résumées à nouveau avec les
// retours tardifs (refaireLesResumes). Vercel l'appelle avec le secret CRON_SECRET ; sans lui, rien ne bouge. Ce qui
// n'est pas fait l'est la nuit suivante.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Refusé', { status: 401 });
  if (!supabaseConfigure()) return Response.json({ athletes: [] });
  // Les repères déjà saisis dans Nolio (VC, FC au seuil 2), la plus récente valeur l'emporte (décision coach du 24/10/2026).
  const reperes = await reperesDeNolio(40_000).catch((e) => [{ athlete: '', quoi: 'repères non lus', erreur: e instanceof Error ? e.message : String(e) }]);
  const echecsReperes = reperes.filter((c) => c.erreur);
  if (echecsReperes.length) console.error('Repères de Nolio :', echecsReperes.map((c) => `${c.athlete} — ${c.erreur}`).join(' ; '));
  const comptes = await resumerSemaines(120_000);
  const echecs = comptes.filter((c) => c.erreur);
  // Sans l'athlète en clair : son identifiant Nolio, ou l'objectif, suffit à le retrouver.
  if (echecs.length) console.error('Semaines résumées :', echecs.map((c) => `${c.athlete} — ${c.erreur}`).join(' ; '));
  const refaits = await refaireLesResumes(120_000).catch((e) => [{ plan: '', quoi: 'non refaits', erreur: e instanceof Error ? e.message : String(e) }]);
  const echecsRefaits = refaits.filter((c) => c.erreur);
  if (echecsRefaits.length) console.error('Résumés refaits :', echecsRefaits.map((c) => `${c.plan} — ${c.erreur}`).join(' ; '));
  return Response.json({ athletes: comptes.length, echecs: echecs.length, refaits: refaits.length, echecs_refaits: echecsRefaits.length,
    reperes_repris: reperes.filter((c) => !c.erreur).length, echecs_reperes: echecsReperes.length });
}
