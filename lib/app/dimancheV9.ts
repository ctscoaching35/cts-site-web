// Fonctions pures, sans Nolio ni base : PRÉPARÉ, PAS BRANCHÉ (rien ne les lit encore ; scripts/test-dimanche-v9.mjs).
/**
 * LE QUESTIONNAIRE DU DIMANCHE (moteur 9.0, CONTRAT_API_CTS.md « MOTEUR v1 » ; rapport Nolio du 23/11/2026, décisions « A partout »
 * du coach) : il remplace « Ta semaine prochaine » du samedi 8 h. Trois versions, choisies par le moteur athlète par athlète
 * (`POST /v1/questionnaire`, le dimanche matin), posées vers midi (Paris) pour une écriture le dimanche soir ; ses réponses repartent
 * au moteur dans `reponses` (`POST /v1/semaine`).
 *
 * Ce que ce fichier fait : construire le questionnaire (nom, description, questions) pour une version, et lire ses réponses telles
 * que Nolio les rend (une question à un choix revient comme le RANG du choix, plusieurs choix comme une liste de rangs, un nombre
 * comme un nombre, une question facultative laissée vide comme `null`). Ce qu'il ne fait pas : poser ou relire dans Nolio, appeler
 * le moteur (lib/app/dimanchesCoaches.ts et lib/app/ecriture.ts le feront au branchement).
 *
 * LES REPLIS VALIDÉS PAR LE COACH (23/11/2026) : Nolio ne sait pas faire les questions conditionnelles, donc toutes les questions
 * s'affichent ensemble ; « depuis combien de semaines » et « pourquoi » restent facultatives, préfixées « Si tu as arrêté toute la
 * semaine : » ; la question des séances clés est une liste construite sur la semaine réelle (« Mardi · Seuil 1 »), sans « Aucune »,
 * facultative (une réponse vide vaut aucune), et absente s'il n'y a aucune séance clé ; le dimanche d'avant la semaine 1 ne pose que les
 * jours, le nombre de séances et le jour de la sortie longue.
 *
 * LES TEXTES : ceux de la consigne et du rapport Nolio (mots du coach) pour l'arrêt, la fatigue et les trois ouvertures ; les noms
 * de famille de la liste des séances clés (« Seuil 1 », « Sortie longue »…) sont un BROUILLON ; la ligne d'effet de la version
 * « fatigue » n'est pas écrite (le coach la donne : `ligneEffet`, vide ici).
 */
import {
  lireArret, lireJours, lireJourSl, lireNombre, normaliser, QUESTION_JOURS, QUESTION_NB, QUESTION_OUVERTE, QUESTION_SL_AVANT,
  type Arret,
} from './questionnaireSamedi';

export type VersionDimanche = 'normale' | 'aucune_seance_vue' | 'fatigue';
export const VERSIONS_DIMANCHE: VersionDimanche[] = ['normale', 'aucune_seance_vue', 'fatigue'];

// Son nom (décision du coach du 24/11/2026, entrée 198) : « Ton point du dimanche ». Il vient du site (le moteur ne rend pas de nom), et il n'est plus celui du samedi : les séries
// « Ta semaine prochaine » déjà posées dans Nolio y restent jusqu'à ce que le coach les retire, et leurs réponses ne sont jamais prises pour celles du dimanche.
export const NOM_DU_QUESTIONNAIRE = 'Ton point du dimanche';
// Le résultat de Nolio qui répond au questionnaire de la semaine `numero` : par l'identifiant Nolio posé ; celui d'avant la première semaine (que rien n'a posé) par son nom,
// jamais par celui du samedi (« Ta semaine prochaine »).
export const repondAuDimanche = (r: { name?: string | null; quiz_planned?: string | null }, numero: number, pose?: { nolio_id?: string | null } | null): boolean =>
  pose?.nolio_id ? r.quiz_planned === pose.nolio_id : numero === 0 && String(r.name ?? '').trim().toLowerCase() === NOM_DU_QUESTIONNAIRE.toLowerCase();
// L'heure d'envoi, à Paris (décision du coach du 23/11/2026) : le moteur lit la semaine le matin, choisit la version, puis le site
// l'envoie, visible à midi ; la semaine s'écrit le dimanche soir vers 21 h (décision 211, lib/app/heuresDePassage.ts).
export const HEURE_D_ENVOI = '12:00';
// Sa deuxième ligne, en deux voix (« Deux voix », 24/11/2026) : celle de l'acheteur, neutre (`DESCRIPTION_DE_BASE`), et celle du coaché, la voix du coach (« je »).
export const DESCRIPTION_DE_BASE = 'Une minute, d’ici dimanche 18 h : tes séances de la semaine prochaine sont préparées dimanche soir à partir de tes réponses.';
export const DESCRIPTION_DE_BASE_COACHE = 'Une minute, d’ici dimanche 18 h : je prépare tes séances de la semaine prochaine dimanche soir à partir de tes réponses.';
export const descriptionDeBase = (coache: boolean): string => (coache ? DESCRIPTION_DE_BASE_COACHE : DESCRIPTION_DE_BASE);
// La première ligne de la description, quelle que soit la version (décision 211 du coach, 24/11/2026 : les athlètes répondent après leur dernière sortie, souvent le dimanche soir) ;
// elle remplace « Pense à synchroniser ta montre avant de répondre. » (décision 206). Deux voix : le coaché lit celle du coach (« je »), l'acheteur une voix neutre.
export const ACCUEIL_COACHE = 'Réponds après ta dernière sortie de la semaine, une fois ta montre synchronisée : je vois ainsi toute ta semaine.';
export const ACCUEIL_ACHETEUR = 'Réponds après ta dernière sortie de la semaine, une fois ta montre synchronisée : ta semaine suivante tiendra compte de tout ce que tu as fait.';
export const accueilDuPoint = (coache: boolean): string => (coache ? ACCUEIL_COACHE : ACCUEIL_ACHETEUR);
// Le nombre de séances (décision 207 du coach, 24/11/2026) : « peux-tu faire par semaine », un maximum. Les questionnaires déjà posés disent encore « veux-tu faire » : les deux se lisent.
export const QUESTION_SEANCES = 'Combien de séances peux-tu faire par semaine ?';

// Le mot d'ouverture de chaque version, en tête de la description. « Aucune séance vue » invite à dire l'arrêt : « dis-le-moi » pour un coaché (`OUVERTURES_COACHE`), « indique-le »
// pour un acheteur (`OUVERTURES`, une forme sans invitation à échanger ; « Deux voix », 24/11/2026). Le reste de ces phrases ne change pas.
export const OUVERTURES: Record<VersionDimanche, string | null> = {
  normale: null,
  aucune_seance_vue: 'On n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, indique-le : depuis combien de temps et pourquoi.',
  fatigue: 'Cette semaine, ton ressenti, ton RPE ou ton Hooper sortent de tes habitudes. Ça peut traduire de la fatigue. Pour que tu récupères et repartes bien, on peut alléger ta semaine prochaine.',
};
export const OUVERTURES_COACHE: Record<VersionDimanche, string | null> = {
  ...OUVERTURES,
  aucune_seance_vue: 'On n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, dis-le-moi : depuis combien de temps et pourquoi.',
};

// L'ouverture d'une version. « Aucune séance vue » invite à dire depuis combien de temps on s'est arrêté et pourquoi ; sans l'accord de lecture, la cause (donnée de santé, décision 209)
// n'est plus demandée : « et pourquoi » part, « depuis combien de temps » reste. coache : la voix du coaché (« dis-le-moi »), sinon celle de l'acheteur (« indique-le »).
export const ouvertureDe = (version: VersionDimanche, accord: boolean, coache = false): string | null => {
  const texte = (coache ? OUVERTURES_COACHE : OUVERTURES)[version];
  return accord || version !== 'aucune_seance_vue' ? texte : (texte as string).replace(' et pourquoi.', '.');
};

const PREFIXE_ARRET_SEMAINE = 'Si tu as arrêté toute la semaine : ';
export const QUESTION_ARRET = 'As-tu arrêté de courir cette semaine ?';
export const CHOIX_ARRET = ['Non', 'Quelques jours', 'Oui, toute la semaine'];
export const QUESTION_SEMAINES_ARRET = `${PREFIXE_ARRET_SEMAINE}depuis combien de semaines as-tu arrêté, en tout ?`;
export const CHOIX_SEMAINES_ARRET = ['1', '2', '3', '4', 'Plus de 4'];
export const QUESTION_CAUSE = `${PREFIXE_ARRET_SEMAINE}pourquoi ?`;
export const CHOIX_CAUSE = ['Blessure', 'Maladie', 'Autre'];
export const QUESTION_CLES = 'Une séance clé pas faite comme prévu ?';
// Les questionnaires déjà posés disent encore « comme écrite » (avant les deux voix, 24/11/2026) : les deux textes se lisent, comme QUESTION_SEANCES et QUESTION_NB.
export const QUESTION_CLES_AVANT = 'Une séance clé pas faite comme écrite ?';
export const QUESTION_FATIGUE = 'Veux-tu une semaine plus légère ?';
export const CHOIX_OUI_NON = ['Oui', 'Non'];

const CAUSES = ['blessure', 'maladie', 'autre'] as const;
export type Cause = (typeof CAUSES)[number];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LIBELLES_JOURS = JOURS.map((j) => j[0].toUpperCase() + j.slice(1));

// ─── Les séances clés de la semaine écrite ──────────────────────────────────────────────────────────

// Les familles que le moteur range dans les séances clés (moteur/semaine.py, trame : seuil1, tempo, seuil2, vo2max, mecanique, sl,
// wec, test, course), sans la course : une course n'est pas « pas faite comme écrite ».
export const FAMILLES_CLES = ['seuil1', 'tempo', 'seuil2', 'vo2max', 'mecanique', 'sl', 'wec', 'test'] as const;
// BROUILLON : les noms que l'athlète lit dans la liste.
const NOM_DE_FAMILLE: Record<string, string> = {
  seuil1: 'Seuil 1', tempo: 'Tempo', seuil2: 'Seuil 2', vo2max: 'VO2max', mecanique: 'Mécanique', sl: 'Sortie longue',
  wec: 'Week-end choc', test: 'Test',
};

export type SeanceCle = { id: string; jour: string; famille: string; libelle: string };
type JourDeLaSemaine = { jour?: string | null; seance?: { id?: string | null; famille?: string | null } | null };

// Les séances clés d'une semaine rendue par `POST /v1/semaine` (`semaine.jours[].seance`), dans l'ordre des jours : l'identifiant du
// moteur (« S9-mardi »), pour que la réponse le retrouve, et le libellé de la liste (« Mardi · Seuil 1 »). Une séance sans identifiant
// ne se propose pas : sa réponse ne se retrouverait pas.
export function seancesCles(semaine: { jours?: JourDeLaSemaine[] | null } | null | undefined): SeanceCle[] {
  const lignes: SeanceCle[] = [];
  for (const j of semaine?.jours ?? []) {
    const s = j.seance;
    const jour = String(j.jour ?? '').toLowerCase();
    if (!s?.id || !s.famille || !(FAMILLES_CLES as readonly string[]).includes(s.famille) || !JOURS.includes(jour)) continue;
    lignes.push({ id: s.id, jour, famille: s.famille, libelle: `${LIBELLES_JOURS[JOURS.indexOf(jour)]} · ${NOM_DE_FAMILLE[s.famille]}` });
  }
  return lignes.sort((a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour));
}

// ─── Le questionnaire posé ──────────────────────────────────────────────────────────────────────────

type Question = { question: string; type: 'unique_choice' | 'multiple_choices' | 'number' | 'long_text'; is_mandatory: boolean;
  choices?: { choices: string[] }; unit?: string };
export type QuestionnaireDimanche = { name: string; description: string; items: Question[] };

const choixUnique = (question: string, choix: string[], obligatoire: boolean): Question =>
  ({ question, type: 'unique_choice', is_mandatory: obligatoire, choices: { choices: choix } });

// Le questionnaire d'une version. cles : les séances clés de la semaine écrite (rien : pas de question). premiere : le dimanche d'avant
// la semaine 1 (sans semaine écoulée : ni arrêt, ni séance clé, ni fatigue). coache : la question ouverte du coaché au bout, comme
// celle d'aujourd'hui. ligneEffet : la ligne d'effet de la version « fatigue » (les mots du coach), à la suite de son ouverture.
// accord : l'accord de lecture de l'athlète (le même que pour le RPE et le Hooper). La CAUSE d'un arrêt (blessure, maladie, autre) est une donnée de santé (décision 209 du coach,
// 24/11/2026) : elle ne se pose qu'avec cet accord ; sans lui, l'arrêt et sa durée suffisent, et le moteur le traite « sans cause ».
export function questionnaireDuDimanche({ version, cles = [], premiere = false, coache = false, ligneEffet = null, accord = false }: {
  version: VersionDimanche; cles?: SeanceCle[]; premiere?: boolean; coache?: boolean; ligneEffet?: string | null; accord?: boolean;
}): QuestionnaireDimanche {
  const ouverture = premiere ? null : ouvertureDe(version, accord, coache);
  const description = [accueilDuPoint(coache), ouverture, ouverture && version === 'fatigue' ? ligneEffet : null, descriptionDeBase(coache)].filter(Boolean).join('\n\n');
  const items: Question[] = [];
  if (!premiere) {
    if (version === 'fatigue') items.push(choixUnique(QUESTION_FATIGUE, CHOIX_OUI_NON, true));
    items.push(choixUnique(QUESTION_ARRET, CHOIX_ARRET, true));
    items.push(choixUnique(QUESTION_SEMAINES_ARRET, CHOIX_SEMAINES_ARRET, false));
    if (accord) items.push(choixUnique(QUESTION_CAUSE, CHOIX_CAUSE, false));
    if (cles.length) items.push({ question: QUESTION_CLES, type: 'multiple_choices', is_mandatory: false, choices: { choices: cles.map((c) => c.libelle) } });
  }
  items.push({ question: QUESTION_JOURS, type: 'multiple_choices', is_mandatory: true, choices: { choices: LIBELLES_JOURS } });
  items.push({ question: QUESTION_SEANCES, type: 'number', is_mandatory: true, unit: 'séances' });
  items.push(choixUnique(QUESTION_SL_AVANT, LIBELLES_JOURS, true));
  if (coache) items.push({ question: QUESTION_OUVERTE, type: 'long_text', is_mandatory: false });
  return { name: NOM_DU_QUESTIONNAIRE, description, items };
}

// ─── Les réponses, pour le moteur ───────────────────────────────────────────────────────────────────

// `reponses` de `POST /v1/semaine` (contrat 9.0). Un champ non lu est ABSENT, jamais deviné ; `semaines_arret` : 1 à 5 (5 : plus de 4).
export type ReponsesDimanche = {
  version: VersionDimanche; arret?: Arret; semaines_arret?: 1 | 2 | 3 | 4 | 5; cause?: Cause; cles_pas_faites?: string[];
  fatigue_oui?: boolean; jours?: string[]; nb_seances?: number; jour_sl?: string;
};
export type ItemRepondu = { question?: string; order?: number | null; value: unknown };
export type ChampDimanche = 'arret' | 'semaines_arret' | 'cause' | 'cles_pas_faites' | 'fatigue_oui' | 'jours' | 'nb_seances' | 'jour_sl';

const vide = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

// Le rang d'un choix à un choix : un nombre entier (ou `[rang]`), dans la liste ; null sinon.
function rang(v: unknown, n: number): number | null {
  if (Array.isArray(v)) return v.length === 1 ? rang(v[0], n) : null;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : null;
}
// Un libellé de la liste, comparé après normalisation (la réponse écrite au lieu du rang).
const parLibelle = (v: unknown, libelles: string[]): number | null => {
  const i = typeof v === 'string' ? libelles.findIndex((l) => normaliser(l) === normaliser(v)) : -1;
  return i >= 0 ? i : null;
};
// Un choix : son rang (nombre), sinon son libellé (texte).
const choix = (v: unknown, libelles: string[]): number | null => (typeof v === 'string' ? parLibelle(v, libelles) : rang(v, libelles.length));

// Lit les réponses d'une version. Chaque question à part : une question illisible n'efface pas les autres, elle est dite (`illisibles`).
// Une question facultative laissée vide n'est ni lue ni illisible. cles : la liste posée (même ordre) ; sans elle, aucune réponse de la
// question des séances clés ne se retrouve.
// accord : sans l'accord de lecture, la cause d'un arrêt n'est jamais lue ni envoyée au moteur (décision 209), même si une réponse en porte une (un point posé avant le retrait de l'accord).
export function lireReponsesDimanche(items: ItemRepondu[], { version, cles = [], accord = false }: { version: VersionDimanche; cles?: SeanceCle[]; accord?: boolean }):
  { reponses: ReponsesDimanche; illisibles: ChampDimanche[] } {
  const parTexte = new Map(items.map((i) => [normaliser(i.question), i]));
  const de = (...questions: string[]) => questions.map((q) => parTexte.get(normaliser(q))).find(Boolean);
  const reponses: ReponsesDimanche = { version };
  const illisibles: ChampDimanche[] = [];
  const lire = <T>(champ: ChampDimanche, question: string | string[], lecteur: (v: unknown) => T | null, poser: (x: T) => void) => {
    const item = de(...(Array.isArray(question) ? question : [question]));
    if (!item || vide(item.value)) return;
    const x = lecteur(item.value);
    if (x === null) illisibles.push(champ);
    else poser(x);
  };

  if (version === 'fatigue') {
    lire('fatigue_oui', QUESTION_FATIGUE, (v) => { const i = choix(v, CHOIX_OUI_NON); return i === null ? null : i === 0; }, (x) => { reponses.fatigue_oui = x; });
  }
  // L'arrêt a deux écritures : celle du dimanche, et celle du samedi d'avant (« Oui, quelques jours », lue par `lireArret`).
  lire('arret', QUESTION_ARRET, (v) => (typeof v === 'string' ? lireArret(v) : lireArret(rang(v, CHOIX_ARRET.length))), (x) => { reponses.arret = x; });
  // Ses semaines d'arrêt et sa cause : lues quand elles sont données (le moteur ne lit les semaines que pour un arrêt de la semaine
  // entière ; la cause compte aussi pour quelques jours) ; sans arrêt, elles ne partent pas.
  lire('semaines_arret', QUESTION_SEMAINES_ARRET, (v) => {
    const i = choix(v, CHOIX_SEMAINES_ARRET);
    return i === null ? null : ((i + 1) as 1 | 2 | 3 | 4 | 5);
  }, (x) => { reponses.semaines_arret = x; });
  if (accord) lire('cause', QUESTION_CAUSE, (v) => { const i = choix(v, CHOIX_CAUSE); return i === null ? null : CAUSES[i]; }, (x) => { reponses.cause = x; });
  if (!reponses.arret || reponses.arret === 'non') { delete reponses.semaines_arret; delete reponses.cause; }
  else if (reponses.arret === 'quelques_jours') delete reponses.semaines_arret;

  lire('cles_pas_faites', [QUESTION_CLES, QUESTION_CLES_AVANT], (v) => {
    const liste = Array.isArray(v) ? v : [v];
    const ids = liste.map((e) => { const i = choix(e, cles.map((c) => c.libelle)); return i === null ? null : cles[i].id; });
    return ids.every((id) => id !== null) ? [...new Set(ids as string[])] : null;
  }, (x) => { reponses.cles_pas_faites = x; });

  lire('jours', QUESTION_JOURS, lireJours, (x) => { reponses.jours = x; });
  lire('nb_seances', [QUESTION_SEANCES, QUESTION_NB], lireNombre, (x) => { reponses.nb_seances = x; });
  lire('jour_sl', QUESTION_SL_AVANT, lireJourSl, (x) => { reponses.jour_sl = x; });
  return { reponses, illisibles };
}
