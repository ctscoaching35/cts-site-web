/**
 * LA TRACE LUE PAR LE MOTEUR v1 (côté serveur) : `POST /v1/trace` rend le profil de la trace (lib/app/gpxV9.ts). Appelée seulement sous une 9.x, quand une trace est donnée
 * en créant ou en refaisant l'objectif d'un coaché (app/app/coach/athletes/route.ts). Une trace illisible, un moteur muet ou une forme inattendue rendent null : l'objectif
 * se crée sans profil de trace, jamais refusé pour cela (le moteur se replie sur la classe de la course).
 */
import { API_URL } from '@/lib/plan';
import { enTetesMoteur } from './cleMoteur';
import { gpxDeLaTrace, type GpxV9 } from './gpxV9';

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
