/**
 * Le lien privé de la fiche de course d'un athlète coaché (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, F2, décision
 * coach du 13/10/2026) : « Ta course » et « Ton jour J » de son plan, sans compte, par un lien impossible à deviner
 * que porte une note Nolio au début de l'affûtage. Le lien signe l'identifiant du plan avec un secret du serveur :
 * rien à garder, et il reste valable si le coach refait le plan (même identifiant).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { site } from '@/lib/content';

function signature(planId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHmac('sha256', secret).update(`fiche-course:${planId}`).digest('base64url').slice(0, 32);
}

export const lienFicheCourse = (planId: string) => `${site.url}/fiche-course/${planId}.${signature(planId)}`;

// L'identifiant du plan d'un jeton valide, ou null.
export function planDuJeton(jeton: string): string | null {
  const [planId, sig] = jeton.split('.');
  if (!planId || !sig || !/^[0-9a-f-]{36}$/.test(planId) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const attendue = Buffer.from(signature(planId));
  const recue = Buffer.from(sig);
  return attendue.length === recue.length && timingSafeEqual(attendue, recue) ? planId : null;
}
