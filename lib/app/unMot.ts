// Aucun réseau ni base : le seul mot d'une ligne de « Mes athlètes » sous la 9.x (scripts/test-parcours-moment3.mjs).
/**
 * « MES ATHLÈTES » EN UNE LISTE, UN MOT PAR COACHÉ (décision 241 du coach, 25/11/2026 ; « Parcours du coach dans l'app — proposition, 25-11 », moment 3, validée « A ») : le lundi, deux minutes. Chaque ligne porte
 * un seul mot : « Partie » (sa semaine est écrite dans Nolio, rien à faire) ou une seule action, la plus urgente ; un clic ouvre directement le bon geste. Rien d'autre sur la ligne.
 *
 * L'ORDRE DE L'URGENCE, du plus au moins urgent : sa santé (un arrêt, un silence, un message, une fatigue), sa semaine pas partie, une demande à relire, son compte Nolio à associer, son accord à recevoir, ce qui
 * manque à son objectif (sa côte, un critère, son tapis, sa trace, sa semaine), pas d'objectif, un objectif pas lancé, un test à saisir, pas de réponse au point du dimanche ; puis, quand rien n'attend, « Partie »,
 * « À la main » (le coach écrit lui-même) ou « Rien à faire ». Les textes sont lus par le coach seul.
 */
import type { Point } from './espaceParAthlete';
import type { TestASaisir } from './testsASaisir';

export const TEXTES_UN_MOT = {
  arret: 'Arrêt signalé',
  silence: 'Ne court plus',
  message: 'Message à lire',
  // « Signal à regarder » (choix du coach du 25/11/2026) : le même mot couvre une fatigue, un effort plus dur que prévu, des sensations.
  fatigue: 'Signal à regarder',
  semaine: 'Semaine pas partie',
  demande: 'Demande à relire',
  nolio: 'Nolio à associer',
  accord: 'Accord à recevoir',
  manque: (quoi: string) => `Il manque : ${quoi}`,
  sansObjectif: 'Pas d’objectif',
  lancer: 'À lancer',
  test: 'Saisir son test',
  sansReponse: 'Pas de réponse dimanche',
  partie: 'Partie',
  main: 'À la main',
  rien: 'Rien à faire',
  // Un coaché en saison de fond, quand rien d'autre n'attend (25/11/2026 : la v1 les écrit ; ses mots, une ligne).
  saison: 'Saison de fond',
} as const;

export type TonDuMot = 'ko' | 'warn' | 'ok' | 'neutre';
export type UnMot = { mot: string; href: string; externe?: boolean; ton: TonDuMot; rang: number };

export type DeQuoiDireUnMot = {
  id: string; nolio: boolean; accord: boolean; aLaMain: boolean;
  objectif: { plan_id: string; demarre: boolean; prevu: string | null; partie: boolean | null; suivante?: { partie: boolean } | null } | null;
  points: Pick<Point, 'genre' | 'niveau' | 'href' | 'externe'>[];
  // Ce qui manque à son objectif, le premier d'abord (verifierObjectif) ; null quand tout y est ou sans réponses à vérifier.
  manque: string | null;
  // Le geste de ce manque : la fiche (« profil »), ou le questionnaire de l'objectif (sa trace, sa semaine).
  gesteDuManque: 'profil' | 'trace' | 'semaine' | null;
  test: Pick<TestASaisir, 'geste'> | null;
  sansReponse: boolean;
  // En saison de fond, sans objectif daté.
  saison?: boolean;
};

const SANTE_MESSAGE = ['mot', 'commentaire'];

export function unMot(a: DeQuoiDireUnMot): UnMot {
  const page = `/app/coach/athlete/${a.id}`;
  const t = TEXTES_UN_MOT;
  const dit = (rang: number, mot: string, href: string, ton: TonDuMot, externe = false): UnMot => ({ mot, href, ton, rang, ...(externe ? { externe: true } : {}) });
  const point = (genre: (g: string) => boolean) => a.points.find((p) => genre(p.genre));

  const arret = point((g) => g === 'arret');
  if (arret) return dit(0, t.arret, arret.href, 'ko', arret.externe);
  const silence = point((g) => g === 'silence');
  if (silence) return dit(1, t.silence, silence.href, 'ko', silence.externe);
  const message = point((g) => SANTE_MESSAGE.includes(g));
  if (message) return dit(2, t.message, message.href, 'warn', message.externe);
  // Les autres signaux de santé (fatigue, effort plus dur, sensations, Hooper, sous le prévu).
  const sante = a.points.find((p) => p.niveau === 'sante');
  if (sante) return dit(3, t.fatigue, sante.href, 'warn', sante.externe);
  // Une saison refusée par le moteur : sa semaine ne partira pas.
  const semaine = point((g) => g === 'semaine' || g === 'saison');
  if (semaine) return dit(4, t.semaine, semaine.href, 'ko', semaine.externe);
  const demande = point((g) => g === 'demande');
  if (demande) return dit(5, t.demande, demande.href, 'warn', demande.externe);
  if (!a.nolio) return dit(6, t.nolio, page, 'warn');
  if (!a.accord && !a.aLaMain) return dit(7, t.accord, `${page}#son-entree`, 'warn');
  if (a.aLaMain) return dit(14, t.main, page, 'neutre');
  // Le manque ouvre sa carte sur le champ surligné (retouche de la 241) : la côte, le tapis, les critères ; la trace ; la semaine.
  if (a.manque) {
    const ancre = { profil: '#geste-profil', trace: '#champ-gpx', semaine: '#champ-semaine' } as const;
    return dit(8, t.manque(a.manque), a.gesteDuManque ? `${page}${ancre[a.gesteDuManque]}` : page, 'warn');
  }
  if (!a.objectif && !a.saison) return dit(9, t.sansObjectif, `/app/coach/nouveau?athlete=${a.id}`, 'neutre');
  if (a.objectif && !a.objectif.demarre && !a.objectif.prevu) return dit(10, t.lancer, `${page}#lancer-sa-preparation`, 'warn');
  if (a.test) return dit(11, t.test, `${page}#geste-${a.test.geste === 'test_vc' ? 'test-vc' : 'reperes'}`, 'warn');
  if (a.sansReponse) return dit(12, t.sansReponse, page, 'neutre');
  if (a.saison) return dit(13, t.saison, page, 'neutre');
  const partie = a.objectif?.suivante?.partie === true || a.objectif?.partie === true;
  return partie ? dit(15, t.partie, page, 'ok') : dit(13, t.rien, page, 'neutre');
}

// Sa ligne attend un geste du coach (tous les mots avant « Rien à faire », « À la main » et « Partie ») : ce que compte la pastille du menu, et ce qui retire
// « Rien à faire pour lui » de sa page (relecture du 25/11/2026 : la pastille disait 8 pour 11 lignes en attente).
export const attendLeCoach = (m: Pick<UnMot, 'rang'>): boolean => m.rang < 13;

// Les coachés rangés : ceux qui attendent le coach d'abord (le plus urgent en tête), puis « Partie » et les autres ; à égalité, par leur nom.
export function rangerLesMots<T extends { nom: string; un: UnMot }>(lignes: T[]): T[] {
  return [...lignes].sort((x, y) => x.un.rang - y.un.rang || x.nom.localeCompare(y.nom, 'fr'));
}
