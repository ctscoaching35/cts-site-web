// Aucun réseau, aucune base : les deux textes du rappel du dimanche sous le moteur v1 (scripts/test-rappel-v9.mjs).
/**
 * LE RAPPEL DU DIMANCHE SOUS LE MOTEUR v1 (décision 206 du coach, 24/11/2026 ; son heure, vers 19 h au lieu de 15 h, par la décision 211) : « Ton point du dimanche », posé à midi, porte en tête « Pense à synchroniser ta montre avant de
 * répondre » (lib/app/dimancheV9.ts) ; il n'y a plus de rappel pour les séances non remontées ; un seul rappel part vers 19 h (Paris), seulement à qui n'a pas répondu à son point.
 * L'interrupteur est celui d'avant, tel quel : `CTS_RAPPEL_DIMANCHE` (lib/app/rappelDimanche.ts, rappelActif) ; la lecture, l'envoi et la clé « un seul par dimanche » sont dans
 * lib/app/passagesV9.ts (rappelDuDimancheV9). Les deux textes sont ceux du coach, mot pour mot ; celui de l'acheteur n'invite à aucun échange avec le coach.
 */
export const TEXTE_RAPPEL_V9_VALIDE = true;
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
