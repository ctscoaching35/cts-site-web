/**
 * LE CODE PARTAGÉ AVEC LE MOTEUR (P2, audits du 05/11/2026 ; contrat avec la session du moteur) : chaque appel au moteur
 * fait depuis le serveur du site (la fonction moteur() de lib/app/ecriture.ts, les routes, les actions serveur, les
 * webhooks, les passages planifiés) porte l'en-tête X-CTS-Cle, égal à CTS_API_CLE, quand la variable est posée ; sans
 * elle, aucun en-tête. Le moteur exige ce code sur toutes ses routes, sauf celles que le navigateur appelle (config,
 * vérification, trace, checkout), qui restent publiques : les appels du navigateur ne changent pas.
 * La valeur, Romain la pose lui-même dans Vercel et dans Render ; elle n'est jamais dans une variable NEXT_PUBLIC_* et ne
 * part jamais au navigateur (process.env.CTS_API_CLE n'existe pas côté navigateur). Côté serveur seulement.
 */
export function enTetesMoteur(autres: Record<string, string> = {}): Record<string, string> {
  const cle = process.env.CTS_API_CLE?.trim();
  return cle ? { ...autres, 'X-CTS-Cle': cle } : { ...autres };
}
