/**
 * LA TRACE LUE PAR LE MOTEUR v1 (côté serveur) : `POST /v1/trace` rend le profil de la trace (lib/app/gpxV9.ts). Appelée seulement sous une 9.x, quand une trace est donnée
 * en créant ou en refaisant l'objectif d'un coaché (app/app/coach/athletes/route.ts) ou en l'ajoutant à un objectif déjà écrit (lib/app/actionsEcriture.ts, ajouterTraceObjectif). Une trace illisible, un moteur muet ou une forme inattendue rendent null : l'objectif
 * se crée sans profil de trace, jamais refusé pour cela (le moteur se replie sur la classe de la course).
 */
import { API_URL } from '@/lib/plan';
import { enTetesMoteur } from './cleMoteur';
import { avecLeGpx, gpxDeLaTrace, type GpxV9 } from './gpxV9';
import { clientService } from './supabase';

export async function lireLaTraceV9(fichier: Blob, appel: typeof fetch = fetch): Promise<GpxV9 | null> {
  try {
    const envoi = new FormData();
    envoi.append('gpx', fichier, 'trace.gpx');
    const r = await appel(`${API_URL}/v1/trace`, { method: 'POST', body: envoi, headers: enTetesMoteur(), cache: 'no-store' });
    return r.ok ? gpxDeLaTrace(await r.json().catch(() => null)) : null;
  } catch {
    return null;
  }
}

// Le profil de la trace s'ajoute aux paramètres d'un plan déjà écrit (`champs.gpx`) : rien d'autre ne change dans ses paramètres, la semaine suivante le lit (le moteur v1 le
// reçoit dans `parametres.gpx`). Le plan est relu juste avant, pour ne rien écraser de ce qu'un autre a changé ; la trame gardée repart de zéro (elle se refait avec lui).
// true : gardé ; false : le plan n'a pas de paramètres ou la base a refusé.
export async function garderLeGpxDuPlan(planId: string, gpx: GpxV9): Promise<boolean> {
  const service = clientService();
  const { data, error } = await service.from('plans').select('parametres').eq('id', planId).single();
  if (error || !data?.parametres) return false;
  const { error: erreur } = await service.from('plans').update({ parametres: avecLeGpx(data.parametres as Record<string, unknown>, gpx), trame: null }).eq('id', planId);
  return !erreur;
}
