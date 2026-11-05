/**
 * LES DEUX PROTECTIONS DE LA ROUTE DU RAPPEL (app/api/relance/route.ts, la case « Envoie-moi un rappel » du
 * questionnaire ; A-43 des audits du 05/11/2026, 7B, décision coach du 05/11/2026 au soir). Avant, n'importe qui pouvait
 * inscrire n'importe quelle adresse au rappel du lendemain. La route de mesure reste ouverte (sans conséquence).
 * - L'en-tête Origin : notre site seulement (www.cts-coaching.com, cts-coaching.com, l'adresse du site de lib/content.ts),
 *   ou le site lui-même à l'adresse qui le sert (même hôte : un déploiement d'essai, le développement en local). Un
 *   navigateur l'envoie toujours avec un POST ; un autre site ne peut pas le contrefaire.
 * - Une limite par adresse IP et par jour (UTC), en mémoire : rien n'existait pour compter en base, et le rappel n'a pas
 *   besoin d'une limite exacte. Chaque instance du serveur compte de son côté, et repart de zéro à son démarrage. La case
 *   envoie un appel par adresse e-mail tapée (une seconde après la dernière frappe) et un pour la décocher : 20 par jour
 *   laissent la place aux corrections.
 * Sans dépendance : sondée à part.
 */
import { site } from '@/lib/content';

export const ORIGINES_ADMISES = new Set(['https://www.cts-coaching.com', 'https://cts-coaching.com', new URL(site.url).origin]);

export function origineAdmise(origine: string | null, hote: string | null): boolean {
  if (!origine) return false;
  if (ORIGINES_ADMISES.has(origine)) return true;
  try {
    return Boolean(hote) && new URL(origine).host === hote;
  } catch {
    return false;
  }
}

// L'adresse IP du visiteur : celle que Vercel pose (x-real-ip, ou la première de x-forwarded-for).
export function adresseIp(entetes: Headers): string {
  return entetes.get('x-real-ip')?.trim() || entetes.get('x-forwarded-for')?.split(',')[0]?.trim() || 'inconnue';
}

export const APPELS_PAR_JOUR = 20;
// Au-delà, la table repart de zéro (un afflux d'adresses ne fait pas grossir la mémoire sans fin).
const ADRESSES_MAX = 10_000;
let jourCompte = '';
const appels = new Map<string, number>();

// Compte un appel de cette adresse IP ; vrai tant qu'elle reste sous la limite du jour.
export function appelPermis(ip: string, maintenant = new Date()): boolean {
  const jour = maintenant.toISOString().slice(0, 10);
  if (jour !== jourCompte || appels.size >= ADRESSES_MAX) {
    appels.clear();
    jourCompte = jour;
  }
  const n = (appels.get(ip) ?? 0) + 1;
  appels.set(ip, n);
  return n <= APPELS_PAR_JOUR;
}
