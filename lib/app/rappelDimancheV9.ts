// Aucun réseau, aucune base : les deux textes du rappel du dimanche sous le moteur v1 (scripts/test-rappel-v9.mjs).
/**
 * LE RAPPEL DU DIMANCHE SOUS LE MOTEUR v1 (décision 206 du coach, 24/11/2026) : « Ton point du dimanche », posé à midi, porte en tête « Pense à synchroniser ta montre avant de
 * répondre » (lib/app/dimancheV9.ts) ; il n'y a plus de rappel pour les séances non remontées ; un seul rappel part vers 15 h (Paris), seulement à qui n'a pas répondu à son point.
 * L'interrupteur est celui d'avant, tel quel : `CTS_RAPPEL_DIMANCHE` (lib/app/rappelDimanche.ts, rappelActif) ; la lecture, l'envoi et la clé « un seul par dimanche » sont dans
 * lib/app/passagesV9.ts (rappelDuDimancheV9). Les deux textes sont ceux du coach, mot pour mot ; celui de l'acheteur n'invite à aucun échange avec le coach.
 */
export const TEXTE_RAPPEL_V9_VALIDE = true;
export const TEXTES_RAPPEL_V9 = {
  coache: 'Petit rappel : réponds à ton point du dimanche avant ce soir, pour que je prépare ta semaine au plus juste.',
  acheteur: 'Petit rappel : réponds à ton point du dimanche avant ce soir, pour que ta semaine colle à ce que tu as fait.',
} as const;
export const texteDuRappelV9 = (coache: boolean): string => (coache ? TEXTES_RAPPEL_V9.coache : TEXTES_RAPPEL_V9.acheteur);
