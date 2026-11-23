// Sans import : lu par le questionnaire du plan (components/plan/Questionnaire.tsx) et par ses tests.

/**
 * L'ATTESTATION SUR L'HONNEUR PAR FORMAT (doctrine du 19/11/2026, point 3 ; consigne App du 21/11) : une case sous la course,
 * selon sa distance, SANS REFUS. Le moteur ne vérifie rien : la personne atteste, et le site la laisse passer ou lui propose,
 * avant l'achat, une course plus courte ou le coaching. Elle remplace les formats ouverts par niveau, la course de référence et
 * sa moitié de km-effort, la règle des 10 h et la fréquence minimale à l'achat, tous retirés du moteur.
 *
 *   Trail Court     : rien ;
 *   Trail Marathon  : « j'ai déjà couru des trails courts » et « je peux m'entraîner au moins 3 fois par semaine » ;
 *   Trail Long      : « j'ai déjà couru un trail marathon », au moins 4 fois par semaine ;
 *   Ultra           : « j'ai déjà couru un trail long », au moins 4 fois par semaine.
 *
 * LES PHRASES CI-DESSOUS SONT DES BROUILLONS : le fond est celui du coach (19/11/2026), la rédaction est à lui faire valider,
 * avec la clause correspondante des conditions générales de vente. Rien ici n'invite un acheteur à échanger avec le coach : le
 * coaching se propose AVANT l'achat, dans la phrase de la case non cochée.
 */

export type AttestationFormat = {
  /** Le format qu'elle couvre (code du moteur : TM, TL, UT). */
  format: string;
  /** Ce que la personne coche, en une phrase. */
  texte: string;
  /** Le format un cran plus court, nommé pour la phrase d'orientation (« un trail marathon »). */
  pluscourt: string;
};

export const ATTESTATIONS: Record<string, AttestationFormat> = {
  TM: {
    format: 'TM',
    texte: 'J’atteste sur l’honneur avoir déjà couru des trails courts, et pouvoir m’entraîner au moins 3 fois par semaine.',
    pluscourt: 'un trail court',
  },
  TL: {
    format: 'TL',
    texte: 'J’atteste sur l’honneur avoir déjà couru un trail marathon, et pouvoir m’entraîner au moins 4 fois par semaine.',
    pluscourt: 'un trail marathon',
  },
  UT: {
    format: 'UT',
    texte: 'J’atteste sur l’honneur avoir déjà couru un trail long, et pouvoir m’entraîner au moins 4 fois par semaine.',
    pluscourt: 'un trail long',
  },
};

/** L'attestation que demande ce format ; null pour le Trail Court, la route ou un format inconnu. */
export const attestationDuFormat = (format: string): AttestationFormat | null => ATTESTATIONS[format] ?? null;

/** Ce que la page dit quand la case n'est pas cochée (BROUILLON) : une course plus courte, ou le coaching. */
export const phraseCaseNonCochee = (a: AttestationFormat): string =>
  `Si tu ne peux pas cocher cette case, vise d’abord ${a.pluscourt}, ou regarde le coaching individualisé.`;
