/**
 * Le parcours « plan clé en main » reste fermé tant que CTS_PLAN_OUVERT ne vaut pas
 * « 1 » dans l'environnement : sans elle, /plan et /plan/merci répondent 404, en
 * production comme ailleurs. Pour tester en local : CTS_PLAN_OUVERT=1 dans
 * .env.local (fichier jamais versionné).
 */
export const planOuvert = () => process.env.CTS_PLAN_OUVERT === '1';
