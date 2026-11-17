// Sans import : lu par lib/plan.ts (le questionnaire) comme par lib/app/profilGratuit.ts (la demande de coaching).

export type Experience = 'debutant' | 'intermediaire' | 'confirme';
// LA GRILLE DES TROIS NIVEAUX (décision du coach du 17/11/2026, « tout A ») : une seule source de textes pour le questionnaire
// du plan et la demande de coaching. La personne coche la case où elle se reconnaît le mieux, sans devoir remplir tous les
// critères ; ce qui part ne change pas (`debutant` | `intermediaire` | `confirme`).
export const EXPERIENCES: { cle: Experience; titre: string; texte: string }[] = [
  { cle: 'debutant', titre: 'Débutant',
    texte: 'Je cours régulièrement depuis moins de 2 ans, ou à l’envie, sans fractionné. Ma plus longue course fait moins de 20 km, ou je n’ai pas encore couru de trail. Je cours moins de 3 h par semaine.' },
  { cle: 'intermediaire', titre: 'Intermédiaire',
    texte: 'Je cours régulièrement depuis 2 à 5 ans et j’ai déjà suivi un plan avec du fractionné. J’ai déjà couru un trail ou une course de 20 à 50 km. Je cours 3 à 5 h par semaine.' },
  { cle: 'confirme', titre: 'Confirmé',
    texte: 'Je cours depuis plus de 5 ans, avec un plan structuré depuis plusieurs saisons. J’ai déjà couru un trail de plus de 50 km ou un marathon. Je cours plus de 5 h par semaine.' },
];
// La phrase sous les cases (confirmée par le coach le 17/11/2026) : une seule constante, pour la changer d'un seul endroit.
export const PHRASE_SOUS_LA_GRILLE = 'Si tu hésites entre deux cases, choisis la plus prudente : celle du niveau en dessous.';
