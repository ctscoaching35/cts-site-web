/**
 * LES LIENS VERS NOLIO DE L'ESPACE COACH (05/11/2026) : une seule source. Les gestes « Lire dans Nolio ›», « Lui
 * écrire ›», « Ouvrir dans Nolio » menaient à https://www.nolio.io/, la page publique, qui n'ouvre pas le compte du
 * coach ; son accueil, connecté, est son calendrier (adresse donnée par le coach). Les liens vers Nolio côté athlète ne
 * passent pas par ici.
 */

export const NOLIO_ACCUEIL_COACH = 'https://www.nolio.io/calendar/';

// La fiche d'un athlète dans Nolio, d'après son identifiant Nolio (usr).
// À COMPLÉTER : le coach doit encore donner l'adresse d'une fiche d'athlète dans Nolio ; d'ici là, l'accueil du coach.
export function lienNolioAthlete(usr?: string | null): string {
  void usr;
  return NOLIO_ACCUEIL_COACH;
}
