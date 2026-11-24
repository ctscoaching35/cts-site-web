// Sans import : lu par lib/app/moteurEnLigne.ts (la garde de version) et par lib/app/moteurV9.ts (préparé, pas branché).
/**
 * LA VERSION DU MOTEUR : une 9.x (le moteur v1, CONTRAT_API_CTS.md, « MOTEUR v1 ») se reconnaît à `version_moteur` de `GET /v1/config`.
 * Une 8.x, ou une valeur qui ne se lit pas, n'en est pas une.
 */
export const estMoteurV9 = (versionMoteur: unknown): boolean => typeof versionMoteur === 'string' && /^9(\.|$)/.test(versionMoteur.trim());
