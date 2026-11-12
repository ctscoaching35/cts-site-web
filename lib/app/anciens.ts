/**
 * L'ÉQUIPE NOLIO ET LES FICHES DU COACH (lot 2 de l'app, décision A du coach du 12/11/2026) : à chaque ouverture de
 * l'app coach, l'équipe Nolio (GET me/athletes/, lib/app/nolio.ts, athletesNolio) et les fiches se rapprochent.
 * - L'entrée : un athlète de l'équipe qui n'a encore de fiche chez aucun coach reçoit la sienne, comme « Créer sa fiche »
 *   (lib/app/actionsCoaching.ts, creerFicheDepuisNolio) : reliée, sans objectif. Les acheteurs de plans restent à part ;
 *   le coach lui-même, « (toi) », garde son bouton.
 * - Le départ : une fiche du coach dont l'athlète n'est plus dans l'équipe passe dans « Anciens athlètes » (ancien_le) :
 *   hors de la liste principale, plus aucune écriture du moteur pour lui (sansEcriture), son historique gardé.
 * - Le retour : revenu dans l'équipe, sa fiche revient d'elle-même (ancien_le effacé).
 * - La sécurité : Nolio muet, en erreur, ou une équipe vide (le coach seul) : on ne touche à personne.
 * Fonctions pures (lib/app/espaceCoach.ts lit et écrit, synchroniserLEquipe).
 */
export type MembreNolio = { id: string; name: string };
export type FicheEquipe = {
  id: string; coach_id: string; nom?: string; nolio_athlete_id: string | null; ancien_le?: string | null;
};
export type Rapprochement = { creer: MembreNolio[]; partis: string[]; revenus: string[] };

// L'identifiant d'un athlète dans l'API v2 de Nolio ; un numéro de la v1 (pas encore converti) ne se compare pas.
const USR = /^usr_[A-Za-z0-9]+$/;
const RIEN: Rapprochement = { creer: [], partis: [], revenus: [] };

// equipe : la liste de athletesNolio (le coach en dernier, « (toi) ») ; null quand Nolio n'a pas répondu ou a renvoyé une
// erreur. fiches : toutes les fiches, de tous les coachs (une fiche chez un autre coach suffit : pas de seconde fiche).
// acheteurs : les comptes Nolio des acheteurs de plans (lib/app/acheteurs.ts, usrAcheteurs).
export function rapprocherEquipe({ equipe, fiches, acheteurs, coachId }: {
  equipe: MembreNolio[] | null; fiches: FicheEquipe[]; acheteurs: Set<string>; coachId: string;
}): Rapprochement {
  if (!equipe) return RIEN;
  const moi = equipe.find((x) => x.name.endsWith('(toi)'))?.id ?? null;
  const membres = equipe.filter((x) => x.id !== moi && USR.test(x.id));
  // Une équipe vide (le coach seul) : une lecture ratée plutôt qu'une équipe partie ; personne ne bouge.
  if (!membres.length) return RIEN;
  const dans = new Set([...membres.map((x) => x.id), ...(moi ? [moi] : [])]);
  const avecFiche = new Set(fiches.map((f) => String(f.nolio_athlete_id ?? '')));
  const vus = new Set<string>();
  const creer = membres.filter((x) => {
    if (avecFiche.has(x.id) || acheteurs.has(x.id) || vus.has(x.id)) return false;
    vus.add(x.id);
    return true;
  });
  const siennes = fiches.filter((f) => f.coach_id === coachId && USR.test(String(f.nolio_athlete_id ?? '')));
  return {
    creer,
    partis: siennes.filter((f) => !f.ancien_le && !dans.has(String(f.nolio_athlete_id))).map((f) => f.id),
    revenus: siennes.filter((f) => f.ancien_le && dans.has(String(f.nolio_athlete_id))).map((f) => f.id),
  };
}

// Une fiche créée d'elle-même pour un nouveau de l'équipe (réponse du coach du 12/11/2026) : programmée à la main, ni
// questionnaire du samedi, ni Hooper, ni saison de fond tentée, tant que le coach n'a pas rempli son profil (ou créé son
// premier objectif) ; ensuite, le chemin habituel (lib/app/coaching.ts, quitterLAttenteDuProfil).
export const enAttenteDeProfil = (f: { en_attente_profil?: unknown }) => f.en_attente_profil === true;

// Un ancien athlète : sorti de l'équipe Nolio (la colonne de la migration du 12/11/2026 ; sans elle, personne).
export const estAncien = (f: { ancien_le?: unknown }) => Boolean(f.ancien_le);

// Une fiche pour laquelle le moteur n'écrit rien (lib/app/ecriture.ts, plansALaMain, et les passages du soir qui lisent
// les fiches) : programmée à la main (décision coach du 20/10/2026), passée en mode plan (23/10/2026), ou d'un ancien
// athlète (12/11/2026).
export const sansEcriture = (f: { programmation?: unknown; mode?: unknown; ancien_le?: unknown }) =>
  f.programmation === 'main' || f.mode === 'plan' || estAncien(f);
