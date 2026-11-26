// Sans import : lu par lib/app/moteurEnLigne.ts (la garde de version) et par lib/app/moteurV9.ts (préparé, pas branché).
/**
 * LA VERSION DU MOTEUR : une 9.x (le moteur v1, CONTRAT_API_CTS.md, « MOTEUR v1 ») se reconnaît à `version_moteur` de `GET /v1/config`.
 * Une 8.x, ou une valeur qui ne se lit pas, n'en est pas une.
 */
export const estMoteurV9 = (versionMoteur: unknown): boolean => typeof versionMoteur === 'string' && /^9(\.|$)/.test(versionMoteur.trim());

// La 9.1 et après (261 et 262 : une séance de course non remontée est manquée, « Séance tenue ? ») ; une valeur qui ne se lit pas n'en est pas une.
export const estAuMoins91 = (versionMoteur: unknown): boolean => {
  const m = /^(\d+)\.(\d+)/.exec(typeof versionMoteur === 'string' ? versionMoteur.trim() : '');
  return Boolean(m) && (Number(m![1]) > 9 || (Number(m![1]) === 9 && Number(m![2]) >= 1));
};
