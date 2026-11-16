/**
 * Le « monde » des tests de l'app gratuite : de quoi charger lib/app/acces.ts, gratuit.ts, accesGratuit.ts et
 * actionsGratuit.ts sous Node sans Next ni Supabase. Les modules qui lisent la session, les cookies ou la base sont
 * remplacés par ces pièces, que le test règle par globalThis.__monde (et qui comptent leurs appels).
 */
export const monde = () => globalThis.__monde;

const compte = (nom) => (...args) => {
  monde().appels.push(nom);
  return monde()[nom](...args);
};

// next/headers, next/navigation, next/cache
export const cookies = async () => ({ get: (k) => (monde().cookies[k] ? { value: monde().cookies[k] } : undefined) });
export class Redirection extends Error { constructor(vers) { super(`redirect ${vers}`); this.vers = vers; } }
export class Introuvable extends Error { constructor() { super('notFound'); } }
export const redirect = (vers) => { throw new Redirection(vers); };
export const notFound = () => { throw new Introuvable(); };
export const revalidatePath = () => {};

// contexte.ts, demandes.ts, demonstrationPorte.ts, nolio.ts, supabase.ts
export const plansDuCompte = compte('plansDuCompte');
export const ficheDuCompte = compte('ficheDuCompte');
export const demonstrationOuverte = () => monde().demonstration;
export const coachConnecte = compte('coachConnecte');
export const supabaseConfigure = () => monde().supabase;
export const clientServeur = async () => {
  monde().appels.push('clientServeur');
  return monde().client();
};
export const clientService = () => monde().service();

// react : `cache` n'existe que dans la version serveur de React ; ici, une fonction qui ne retient rien (un module frais par cas).
export const cache = (f) => f;
