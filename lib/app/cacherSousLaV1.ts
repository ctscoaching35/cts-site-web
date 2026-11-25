/**
 * CE QUE LA 9.x NE FAIT PAS ENCORE EST CACHÉ (décision 220 du coach, 24/11/2026 : « l'espace coach doit être très simple sous la 9.x » ; reports/Application coach — revue de
 * simplicité, 24-11.md, proposition 3 : pas de bouton qui ne marche pas, pas de ligne vide). TROISIÈME SIMPLIFICATION, après « un seul endroit pour ce qui est à faire »
 * (« Urgent » fondu dans « Mes athlètes ») et « une page athlète courte ». Sous la 8.x, rien ne change : chaque fonction de ce fichier est appelée derrière
 * `v9` (moteurEstV9, lib/app/moteurEnLigne.ts) et rend, sans `v9`, ce que les écrans montraient avant.
 *
 * Ce que la mise en ligne du moteur v1 ne porte pas encore (lib/app/passagesV9.ts : « PAS PORTÉ sous le moteur v1 »), et que le coach ne voit donc plus :
 *   (a) l'aperçu du dimanche : la page, les liens qui y mènent, « Voir ce que le moteur écrirait », le geste « Appliquer ce que le moteur aurait écrit » (la passe du lundi de
 *       la 8.x, /v1/semaine/lundi, n'existe plus) ;
 *   (b) les courses de préparation : leur section, le lien « En préparation » d'une course de Nolio, le point « course de préparation dans … jours », l'onglet « Course de
 *       préparation » de « Nouvel objectif » (/v1/course-secondaire est retirée ; `ajouterCourse` refuse déjà) ;
 *   (c) la saison de fond : son lien et ses étiquettes (« Saison de fond », « Bloc … », « tests dans … »), les points « Saison de fond refusée » et « Profil à remplir » (le profil pour
 *       sa saison de fond) ;
 *   (d) les tests lus (ce que la préparation lit comme test de vitesse critique ou de FC dans Nolio) : leurs lignes, « Ses cibles et ses zones ont suivi », le point « Test à
 *       revoir ». Le geste « Saisir son test de vitesse critique » et le test sur la carte restent : ils ne dépendent pas de cette lecture ;
 *   (e) les séances allégées en EF et « Garder la séance d'origine » (/v1/fatigue et /v1/veto sont retirées), et ce qui parle d'« Ajustements annulés » (« Annuler » est abandonné,
 *       décision 213).
 * Ce qui n'est PAS caché, après vérification : le lien « course Nolio » → « Créer l'objectif » (la course se lit dans Nolio par le site, jamais par le moteur) et « les prérequis du
 * marathon » (ils se calculent sur les réponses du questionnaire, que la 9.x lit encore).
 *
 * Le calcul seul, sans lecture ni réseau : il s'essaie avec des données fabriquées (scripts/test-espace-coach-simple-3.mjs). Les textes ci-dessous sont NOUVEAUX et ne sont lus
 * que par le coach.
 */

// ─── Les textes (pour le coach seul) ──────────────────────────────────────────────────────────────────────────────

export const TEXTES_CACHES = {
  // Sous « Saisir son test de vitesse critique » (d) : la phrase d'avant parlait de la lecture du test dans Nolio et d'un test « marqué lu » ; sous la 9.x, rien de cela, et sans « vitesse critique »
  // (décision 220, 24/11/2026, les mots du coach : lib/app/motsDuCoach.ts).
  testSaisi: 'S’il ne l’a pas fait dans l’app : ses deux efforts donnent sa vitesse critique et son profil de coureur.',
  // « Ses 7 jours », quand rien n'est encore lu (c) : sans « ou une saison » ni « Hooper ».
  septJoursVide: 'Rien de lu pour l’instant. Ses séances et sa fatigue déclarée des 7 derniers jours se lisent dans Nolio chaque soir, dès qu’un objectif a démarré. « Relire maintenant » les lit tout de suite.',
} as const;

// ─── (a) L'aperçu du dimanche ─────────────────────────────────────────────────────────────────────────────────────────

// L'aperçu du dimanche se montre-t-il (sa page, ses liens, son bouton, son calcul demandé par `?apercu=`) ? Sous la 9.x, `apercuDuDimanche` refuse (« pas encore porté sous le
// moteur v1 ») : rien ne le propose et une adresse d'avant ne calcule rien.
export const apercuDisponible = (v9: boolean): boolean => !v9;

// La carte « Sa semaine qui arrive » d'avant le passage du dimanche : sa phrase (ce que la couleur du soir prévoit) et « Voir ce que le moteur écrirait ». Sans ce lien, une carte
// qui n'a pas de phrase n'aurait que son titre : sous la 9.x, elle ne s'affiche que s'il y a une phrase à lire.
export const carteAvantVisible = (v9: boolean, prevoit: string | null | undefined): boolean => !v9 || Boolean(prevoit?.trim());

// « La passe du lundi n'a pas réécrit la semaine », ce qui aurait changé, et le geste « Appliquer ce que le moteur aurait écrit » : la passe du lundi de la 8.x n'existe plus.
export const passeDuLundiVisible = (v9: boolean): boolean => !v9;

// ─── (b) Les courses de préparation ───────────────────────────────────────────────────────────────────────────────────────

// Leur section, leurs lignes, leurs gestes (ajouter, modifier, retirer), l'onglet « Course de préparation » de « Nouvel objectif ».
export const preparationsDisponibles = (v9: boolean): boolean => !v9;

// Une course posée dans Nolio que la 8.x propose d'ajouter en préparation (« En préparation ›») : une course B, tombée entre lundi prochain et la course de l'objectif en cours.
// `ecrit` : cet objectif s'écrit semaine par semaine ; `prochain` : son identifiant.
export function estUneCourseEnPreparation(c: { type: 'a' | 'b' | null; date: string }, { prochain, ecrit, lundiProchain, dateProchain }: {
  prochain: string | null; ecrit: boolean; lundiProchain: string; dateProchain: string;
}): boolean {
  return c.type === 'b' && Boolean(prochain) && ecrit && c.date >= lundiProchain && c.date < dateProchain;
}

// Ses courses dans Nolio, celles qui ont un geste : sous la 9.x, sans celles qui n'avaient pour geste que « En préparation » (ajouter une course de préparation). Les autres gardent
// « Créer l'objectif ».
export function coursesNolioVisibles<T>(courses: T[], enPreparation: (c: T) => boolean, v9: boolean): T[] {
  return v9 ? courses.filter((c) => !enPreparation(c)) : courses;
}

// ─── (c) La saison de fond ────────────────────────────────────────────────────────────────────────────────────────────────

// Une saison de fond n'est pas un objectif sous la 9.x (le moteur v1 n'en écrit pas) : la ligne d'un athlète dont le prochain « objectif » est une saison se lit comme celle d'un
// athlète sans objectif. `fond` : ce que la 8.x lit de la trame (lib/app/espaceCoach.ts, LigneAthlete.objectif.fond).
export function objectifSansSaison<T extends { fond?: unknown }>(o: T | null, v9: boolean): T | null {
  return v9 && o?.fond ? null : o;
}

// ─── (d) Les tests lus ────────────────────────────────────────────────────────────────────────────────────────────────────

// Les lignes « test lu », leurs statuts (illisible, sans réponse au questionnaire du soir, pas fait) et « Ses cibles et ses zones ont suivi » : la lecture des tests dans Nolio
// n'est pas portée sous la 9.x.
export const testsLusDisponibles = (v9: boolean): boolean => !v9;

// ─── Les points que la 9.x ne porte pas ───────────────────────────────────────────────────────────────────────────────────

// Les genres de points (lib/app/espaceCoach.ts, SIGNAL) qui parlent d'une fonction que la 9.x ne fait pas encore. Un point caché disparaît partout (« À faire » de « Mes athlètes »,
// « À faire pour lui », la colonne « Ce qui l'attend », la pastille du menu) : rien n'est lu de plus, il n'est simplement pas gardé.
export const GENRES_CACHES_9X: Record<string, string> = {
  preparation: 'une course de préparation dans les 14 jours : la course de préparation n’est pas portée (b)',
  test: 'un test illisible, sans réponse ou pas fait : la lecture des tests n’est pas portée (d)',
  saison: 'sa saison de fond refusée : la saison de fond n’existe pas sous la 9.x (c)',
  profil: 'le profil à remplir pour que sa saison de fond parte : la saison de fond n’existe pas sous la 9.x (c) ; la carte « Ce que j’ai besoin de savoir » dit déjà ce qui manque',
  lundi: 'la passe du lundi n’a pas réécrit sa semaine : la passe du lundi de la 8.x n’existe plus (a)',
};

export function pointsSousLaV1<T extends { genre: string }>(points: T[], v9: boolean): T[] {
  return v9 ? points.filter((p) => !(p.genre in GENRES_CACHES_9X)) : points;
}

// ─── (e) Les séances allégées en EF et « Garder la séance d'origine » ────────────────────────────────────────────────────────

// L'allègement en cours de semaine (/v1/fatigue) et le veto (/v1/veto) sont retirés : plus aucune séance n'est allégée, donc plus de « allégée en EF (fatigue franche) » ni de
// « Garder la séance d'origine ». Les ajustements du dimanche que le moteur d'avant avait écrits restent (ils ne passent par aucune route retirée). Un ajustement qui n'était qu'une
// séance allégée n'a plus rien à dire : il s'en va.
export function ajustementsSansAllegees<T extends { allegees: unknown[]; raisons: string[]; joursArret: number | null }>(ajustements: T[], v9: boolean): T[] {
  if (!v9) return ajustements;
  return ajustements.flatMap((a) => (a.allegees.length === 0 ? [a] : a.raisons.length === 0 && a.joursArret === null ? [] : [{ ...a, allegees: [] }]));
}

// « Ajustements annulés. » sous une semaine écrite : « Annuler » est abandonné sous la 9.x (décision 213) ; une semaine écrite par la 9.x n'a jamais cette mention, une semaine
// de la 8.x qui l'a garde son historique dans la base, pas sur l'écran.
export const ajustementsAnnulesVisibles = (v9: boolean): boolean => !v9;
