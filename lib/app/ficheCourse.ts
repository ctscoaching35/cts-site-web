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

// LE LIEN COURT ET LA NOTE (décision coach du 26/10/2026 : « quelque chose de plus professionnel » qu'un lien brut d'une
// centaine de caractères). Le code court : 8 lettres ou chiffres tirés de la même signature (rien à garder) ; la page
// /c/{code} retrouve le plan parmi ceux en cours et renvoie vers son lien privé.
export function codeCourt(planId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHmac('sha256', secret).update(`fiche-court:${planId}`).digest('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
}
export const lienCourtFicheCourse = (planId: string) => `${site.url}/c/${codeCourt(planId)}`;

// La note « Ta fiche de course » de Nolio : avec l'app, sans lien (elle y est, onglet « Mon plan ») ; sans l'app, ce
// qu'elle contient et le lien court.
export function noteFicheCourse(planId: string, avecApp: boolean): string {
  if (avecApp) return 'Ton affûtage commence : ta fiche de course est prête dans ton app CTS, onglet « Mon plan ».';
  return ['Ton affûtage commence : ta fiche de course est prête.', '· ta course et ton jour J', '· le profil et les tronçons',
    '· ta stratégie nutritionnelle', `Ouvre-la : ${lienCourtFicheCourse(planId)}`].join('\n');
}

