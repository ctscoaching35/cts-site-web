// Les corrections d'une semaine avant son envoi (EC3, audit de l'app coach du 03/11/2026) : leurs noms seuls, lus par le journal du moteur en clair
// (lib/app/journalEnClair.ts, l'entrée « COACH » que le moteur de la 8.x écrit pour une correction appliquée). L'écran qui les choisissait (« Corriger avant l'envoi »,
// sur l'aperçu), la carte « Tes corrections avant l'envoi » de « Chiffres », leurs gestes et leur lecture dans la base sont supprimés (décision 220 du coach, 24/11/2026 :
// le coach corrige dans Nolio, le moteur repart de sa correction) ; ce qui reste ne sert qu'à lire un journal déjà écrit.
export const CORRECTIONS = {
  semaine_allegee: 'Semaine allégée', sans_qualite: 'Sans qualité', sl_courte: 'Sortie longue plus courte',
  decaler_qualite: 'Décaler la qualité',
} as const;
export type Correction = keyof typeof CORRECTIONS;
