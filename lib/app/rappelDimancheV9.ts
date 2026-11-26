// Aucun réseau, aucune base : les deux textes du rappel du dimanche sous le moteur v1 (scripts/test-rappel-v9.mjs).
/**
 * LE RAPPEL DU DIMANCHE SOUS LE MOTEUR v1 (décision 206 du coach, 24/11/2026 ; son heure, vers 19 h au lieu de 15 h, par la décision 211) : « Ton point du dimanche », posé à midi, porte en tête « Pense à synchroniser ta montre avant de
 * répondre » (lib/app/dimancheV9.ts) ; un seul rappel part vers 19 h (Paris), à qui n'a pas répondu à son point et, sous le 9.1 (261 et 270 du coach, 26/11/2026), à qui a une séance de course de la semaine non remontée
 * dans Nolio. Les deux à la fois : les deux phrases, à la suite, dans un seul message.
 * L'interrupteur est celui d'avant, tel quel : `CTS_RAPPEL_DIMANCHE` (lib/app/rappelDimanche.ts, rappelActif) ; la lecture, l'envoi et la clé « un seul par dimanche » sont dans
 * lib/app/passagesV9.ts (rappelDuDimancheV9). Les deux textes sont ceux du coach, mot pour mot ; celui de l'acheteur n'invite à aucun échange avec le coach.
 */
import { relier } from './realiseV9';
import type { Prevue, Reelle } from './resumeSemaine';

export const TEXTE_RAPPEL_V9_VALIDE = true;
// La séance non remontée, les mots du coach (270, 26/11/2026), pour le coaché comme pour l'acheteur.
export const texteSeanceNonRemontee = (jour: string): string => `Ta séance de ${jour} n’est pas remontée : si tu l’as faite, synchronise ta montre ou ajoute-la à la main dans Nolio, avant ce soir.`;
export const TEXTES_RAPPEL_V9 = {
  coache: 'Petit rappel : réponds à ton point du dimanche avant ce soir, pour que je prépare ta semaine au plus juste.',
  acheteur: 'Petit rappel : réponds à ton point du dimanche avant ce soir, pour que ta semaine colle à ce que tu as fait.',
} as const;
export const texteDuRappelV9 = (coache: boolean): string => (coache ? TEXTES_RAPPEL_V9.coache : TEXTES_RAPPEL_V9.acheteur);

// L'heure du message, à Paris (décision 211) : 19 h, ou dans dix minutes si le passage de la tâche (Vercel la lance dans l'heure prévue) est plus tard, arrondie aux cinq minutes.
// Plus tard que 20 h 30 : null (trop près de l'écriture de la semaine, à 21 h ; rien ne part). Même calcul que celui de la 8.x (lib/app/rappelDimanche.ts, 15 h et 17 h).
export const HEURE_RAPPEL_V9 = '19:00';
export const HEURE_LIMITE_RAPPEL_V9 = '20:30';
export function heureDuRappelV9(maintenant: Date = new Date()): string | null {
  const [h, m] = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' })
    .format(maintenant).split(':').map(Number);
  const dans10 = Math.ceil((h * 60 + m + 10) / 5) * 5;
  const cible = Math.max(19 * 60, dans10);
  const hhmm = `${String(Math.floor(cible / 60)).padStart(2, '0')}:${String(cible % 60).padStart(2, '0')}`;
  return hhmm > HEURE_LIMITE_RAPPEL_V9 ? null : hhmm;
}

// Le message du dimanche soir : la phrase du point s'il manque, puis celle de la séance non remontée ; null quand ni l'un ni l'autre.
export const messageDuRappelV9 = ({ coache, sansReponse, jourNonRemonte }: { coache: boolean; sansReponse: boolean; jourNonRemonte: string | null }): string | null =>
  [sansReponse ? texteDuRappelV9(coache) : null, jourNonRemonte ? texteSeanceNonRemontee(jourNonRemonte) : null].filter(Boolean).join('\n') || null;

// Le jour (« mardi ») de la plus récente séance de course de la semaine, jusqu'à aujourd'hui, qui n'est pas remontée (261 : dehors, tapis, côte ; jamais le renfo) ; null sinon. Remontée : reliée par Nolio,
// sinon par le site à la séance la plus proche, en jour puis en durée, à ±25 % (A2, comme le résumé du réalisé).
export function jourDeLaSeanceNonRemontee({ lundi, jour, planifiees, reelles, sportsDeCourse }: {
  lundi: string; jour: string; planifiees: Prevue[]; reelles: Reelle[]; sportsDeCourse: readonly string[];
}): string | null {
  const course = (x: { sport?: string | null }) => sportsDeCourse.includes(String(x.sport));
  const prevues = planifiees.filter((p) => course(p) && p.date_start.slice(0, 10) >= lundi && p.date_start.slice(0, 10) <= jour);
  const faites = relier(prevues, reelles.filter((r) => r.planned || course(r)));
  const manquee = prevues.filter((p) => !faites.has(p.id)).sort((a, b) => b.date_start.localeCompare(a.date_start))[0];
  return manquee ? new Date(`${manquee.date_start.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' }) : null;
}
