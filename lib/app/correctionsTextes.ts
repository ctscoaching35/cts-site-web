// Les corrections d'une semaine avant son envoi et leurs raisons (EC3, lib/app/corrections.ts) : les mots seuls, lus
// aussi par le formulaire de l'aperçu (côté navigateur).
export const CORRECTIONS = {
  semaine_allegee: 'Semaine allégée', sans_qualite: 'Sans qualité', sl_courte: 'Sortie longue plus courte',
  decaler_qualite: 'Décaler la qualité',
} as const;
export type Correction = keyof typeof CORRECTIONS;

// Pourquoi (les causes du diagnostic des retouches) : là où chaque correction se corrigera ensuite.
export const RAISONS = {
  etat: 'Son état du moment (fatigue, douleur, imprévu)', info: 'Une info que le moteur n’a pas (temps, terrain, charge)',
  placement: 'Le placement dans sa semaine', dose: 'La dose ne lui va pas', facon: 'Ta façon de coacher',
} as const;
export type Raison = keyof typeof RAISONS;

export type Choix = { corrections: Correction[]; raison: Raison | null; appliquee: boolean };
