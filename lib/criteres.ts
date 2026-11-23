// Sans import : lu par lib/plan.ts (le questionnaire, l'intake) et par components/plan/CriteresEntree.tsx.

/**
 * LES DEUX QUESTIONS DES CRITÈRES (doctrine du 21/11/2026, consigne App du 21/11) : elles REMPLACENT la case « niveau » du
 * questionnaire d'entrée (plus de niveau nulle part). Deux critères seulement, l'endurance est retirée ; le volume et la plus
 * longue sortie restent déclarés comme aujourd'hui. Réponses : jamais / de temps en temps (moins d'une fois par semaine) /
 * régulièrement (au moins une fois par semaine).
 *
 * PRÉPARÉ, PAS BRANCHÉ : la consigne les classe « après le moteur ». Tant que `CRITERES_BRANCHES` est faux, le questionnaire
 * demande encore le niveau, l'intake garde ses champs d'aujourd'hui et rien de ce fichier ne part au moteur. Le brancher, le jour
 * où le nouveau moteur est en ligne : passer la constante à vrai, puis ajuster `CHAMPS_CRITERES` et `intakePourApi`
 * (lib/plan.ts) au contrat d'API du nouveau moteur, dont les noms de champs ne sont pas encore connus.
 *
 * Les questions sont les mots du coach ; les titres de réponses et l'intitulé de la section sont des BROUILLONS à lui faire
 * valider.
 */

export type ReponseCritere = 'jamais' | 'parfois' | 'regulier';

export const REPONSES_CRITERE: { valeur: ReponseCritere; titre: string; precision: string | null }[] = [
  { valeur: 'jamais', titre: 'Jamais', precision: null },
  { valeur: 'parfois', titre: 'De temps en temps', precision: 'moins d’une fois par semaine' },
  { valeur: 'regulier', titre: 'Régulièrement', precision: 'au moins une fois par semaine' },
];

// Les deux critères, dans l'ordre où le questionnaire les pose. `champ` : la clé du formulaire (Champs), PROVISOIRE jusqu'au
// contrat du nouveau moteur ; `court` : le libellé du récapitulatif (BROUILLON).
export const CRITERES = [
  { champ: 'critere_intensite', question: 'Ces 3 derniers mois, as-tu fait des séances de fractionné ou de seuil ?', court: 'Fractionné ou seuil, 3 mois',
    fiche: 'Intensité', fichePrecision: 'Fractionné ou seuil, ces 3 derniers mois' },
  { champ: 'critere_denivele', question: 'Ces 3 derniers mois, as-tu couru avec du dénivelé (côtes, trails) ?', court: 'Dénivelé, 3 mois',
    fiche: 'Mécanique', fichePrecision: 'Dénivelé (côtes, trails), ces 3 derniers mois' },
] as const;
export type ChampCritere = (typeof CRITERES)[number]['champ'];
export const CHAMPS_CRITERES: ChampCritere[] = CRITERES.map((q) => q.champ);

// SUR ROUTE (10 km, semi, marathon ; décision du coach du 23/11/2026) : la seule question d'intensité. Pas celle du dénivelé : la
// route n'a pas de catégorie de mécanique (les sauts du renfo suivent la catégorie d'intensité). La question et la réponse du
// dénivelé ne sont ni posées, ni résumées, ni envoyées (intakePourApi, lib/plan.ts).
export const criteresDe = (route: boolean) => (route ? CRITERES.filter((q) => q.champ === 'critere_intensite') : CRITERES);

// LA FICHE DU COACHÉ (entrée 183 de la mémoire du coach, 23/11/2026) : le coach remplit lui-même les deux critères, sur la fiche (« Modifier
// son profil »), dans le profil (jsonb, sans migration) sous les mêmes clés ; un critère manquant vaut « jamais ». `fiche` et
// `fichePrecision` : ses mots, `Intensité` et `Mécanique` (BROUILLONS). Rien n'en part au moteur tant que `CRITERES_BRANCHES` est faux.
export const TITRE_CRITERES_FICHE = 'Ses deux critères';
export const SANS_CRITERE = 'Pas renseigné : compte comme « Jamais »';
export const estReponseCritere = (v: unknown): v is ReponseCritere => REPONSES_CRITERE.some((r) => r.valeur === v);

// L'intitulé de la section à la place de « Ton niveau » (BROUILLON).
export const TITRE_SECTION_CRITERES = 'Ton entraînement';

// Le commutateur : faux jusqu'à la mise en ligne du nouveau moteur (voir plus haut).
export const CRITERES_BRANCHES = false;

export const titreReponse = (v: string): string => REPONSES_CRITERE.find((r) => r.valeur === v)?.titre ?? '';
