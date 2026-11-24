/**
 * L'ESPACE COACH SIMPLE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : « l'espace coach doit être très simple sous la 9.x » ;
 * le document de départ est reports/Application coach — revue de simplicité, 24-11.md). Sous la 8.x, rien ne change : chaque fonction de ce
 * fichier est appelée derrière `v9` (moteurEstV9, lib/app/moteurEnLigne.ts) et rend, sans `v9`, ce que les écrans montraient avant.
 *
 * PREMIÈRE SIMPLIFICATION, « un seul endroit pour ce qui est à faire » : « Urgent » est fondu dans « Mes athlètes » (une section « À faire » en
 * haut, un seul « Réglé »), et un même point ne s'affiche plus deux fois (le bandeau de l'accueil, la page « Urgent », le bloc « À faire
 * pour lui » de la page de l'athlète). Avec elle, la partie « messages techniques » de la cinquième : la clé de l'API Nolio qui manque, la
 * migration à passer dans Supabase et les messages de ce genre ne sont plus lus par le coach, ils restent au journal du serveur.
 *
 * Le calcul seul (rien n'est lu dans la base, sauf `lesSeriesAFaire`, qui lit la base du site et jamais Nolio) : il s'essaie sans réseau
 * (scripts/test-espace-coach-simple-1.mjs). Les textes ci-dessous sont NOUVEAUX et ne sont lus que par le coach.
 */
import type { Entree } from './entree';
import {
  etiquettes, groupeUrgent, type DecisionMoteur, type Etiquette, type GroupeUrgent, type LigneUrgente, type Point,
} from './espaceParAthlete';
import { lireLesSeriesDuSamedi, TEXTES_SERIES } from './seriesDuSamedi';

// ─── Les textes (pour le coach seul) ──────────────────────────────────────────────────────────────────────────────

export const TEXTES_A_FAIRE = {
  titre: 'À faire',
  // Rien ne l'attend : une ligne, en mots simples.
  rien: 'Rien à faire aujourd’hui.',
  // Sous la date, en haut de « Mes athlètes ».
  sousTitre: 'ce qui t’attend, puis tes athlètes',
  // Nolio ne répond pas : la phrase de la 8.x pour un Nolio muet, sans le nom de la clé ni de Vercel.
  nolioMuet: 'Nolio ne répond pas pour l’instant : réessaie dans un moment.',
  // La semaine du dimanche soir pas partie, après le passage de 22 h : plus de « reprises de 20 h et 22 h » (celles de la 8.x).
  pasPartieDetail: 'Pas partie : « Réessayer » lundi',
  pasPartieSous: 'Lundi, le bouton « Réessayer » apparaîtra.',
  // Sur la page de l'athlète, dans « Sa semaine qui arrive », quand le point n'est pas dans « À faire pour lui ».
  pasPartieCarte: 'Elle n’est pas partie dans Nolio. Lundi, le bouton « Réessayer » apparaîtra ici.',
  // Le courriel que le coach reçoit quand une semaine n'a pas pu s'écrire : où retrouver « Réessayer ».
  ouReessayer: (url: string) => `« À faire », sur « Mes athlètes » (${url}/app/coach)`,
} as const;

// ─── Le menu de gauche ────────────────────────────────────────────────────────────────────────────────────────────

export type RubriqueCoach = 'athletes' | 'urgent' | 'chiffres' | 'demandes';
type LienDuMenu = [RubriqueCoach, string, string];

const MENU_8X: LienDuMenu[] = [
  ['athletes', 'Mes athlètes', '/app/coach'],
  ['urgent', 'Urgent', '/app/coach/urgent'],
  ['chiffres', 'Chiffres', '/app/coach/chiffres'],
];

// Sous la 9.x, plus d'entrée « Urgent » : ses points sont dans « Mes athlètes ». Sous la 8.x, le menu d'avant, ligne pour ligne.
export const liensDuMenu = (v9: boolean): LienDuMenu[] => (v9 ? MENU_8X.filter(([cle]) => cle !== 'urgent') : MENU_8X);
// La page « Séries du samedi » se dit « urgent » : sous la 9.x, c'est « Mes athlètes » qui est allumé.
export const rubriqueActive = (actif: RubriqueCoach, v9: boolean): RubriqueCoach => (v9 && actif === 'urgent' ? 'athletes' : actif);
// La pastille qui compte les athlètes qui attendent le coach : sur « Urgent » sous la 8.x, sur « Mes athlètes » sous la 9.x.
export const rubriqueDeLaPastille = (v9: boolean): RubriqueCoach => (v9 ? 'athletes' : 'urgent');

// ─── « À faire », sur « Mes athlètes » ────────────────────────────────────────────────────────────────────────────

// Les points d'« Urgent » (espace.urgent : mêmes données, mêmes gestes, même « Réglé »), en une seule liste à la suite : l'ordre des quatre groupes
// d'avant (« A besoin de toi », « Ne court plus », « Semaine pas partie », « Objectif bloqué »), puis celui de « Mes athlètes » dans chaque groupe.
export const aFaireDe = (urgent: GroupeUrgent[]): LigneUrgente[] => urgent.flatMap((g) => g.lignes);

// Le nombre de lignes de la section : les points, plus la ligne des séries du samedi quand il y en a.
export const nombreAFaire = (lignes: LigneUrgente[], series: number): number => lignes.length + (series > 0 ? 1 : 0);

// La ligne des séries du samedi (le texte de la carte d'« Urgent », validé avec l'écran « Séries du samedi », le 28/11/2026).
export const texteDesSeries = (n: number): string => TEXTES_SERIES.carte(n);

// Les séries du samedi à retirer de Nolio (lib/app/seriesDuSamedi.ts, entrée 198 : lues dans la base du site, jamais dans Nolio) : combien, sous la 9.x
// seulement ; 0 sous la 8.x et quand la base ne se lit pas. `lire` et `aujourdhui` : pour les essais.
export async function lesSeriesAFaire(coachId: string, v9: boolean, lire: typeof lireLesSeriesDuSamedi = lireLesSeriesDuSamedi,
  aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())): Promise<number> {
  if (!v9) return 0;
  try {
    return (await lire(coachId, aujourdhui))?.length ?? 0;
  } catch {
    return 0;
  }
}

// ─── Un point n'est dit qu'une fois ───────────────────────────────────────────────────────────────────────────────

// La colonne « Ce qui l'attend » de « Mes athlètes » : sous la 9.x, ce qui attend le coach est dans « À faire » (une étiquette par point, c'était la
// même chose dite deux fois) ; il reste ce qui arrive (en gris) et ce que le moteur a réglé seul. Un athlète qui a un point dans « À faire » et rien d'autre :
// aucune étiquette (la colonne le dit par un tiret) ; « Rien à signaler » n'est dit que de quelqu'un qui n'a rien du tout.
export function etiquettesSansAFaire(points: Point[], moteur: DecisionMoteur | null): Etiquette[] {
  const reste = points.filter((p) => groupeUrgent(p) === null);
  if (reste.length === 0 && !moteur && points.length > 0) return [];
  return etiquettes(reste, moteur);
}

// Ce qui manque à un athlète, sous son nom, dans « Mes athlètes » : sous la 9.x, pas ce que « À faire » dit déjà (« Associer Nolio », « Accord reçu ») ;
// sans point (rien à démarrer, un point marqué « Réglé »), la pastille reste.
export function manqueDeLaLigne(a: { nolio: boolean; accord: boolean }, points: Pick<Point, 'genre'>[], v9: boolean): string[] {
  const dit = (genre: string) => v9 && points.some((p) => p.genre === genre);
  return [!a.nolio && !dit('nolio') && 'Nolio à associer', a.nolio && !a.accord && !dit('accord') && 'sans accord'].filter(Boolean) as string[];
}

// Le bandeau du dimanche : sous la 9.x, ce qui est parti seulement. Les semaines pas parties sont des points de « À faire », et les athlètes qui attendent
// le coach aussi : ni l'un ni l'autre n'est redit. null : rien de parti, rien à dire.
export function texteBilanV9(parties: number): string | null {
  if (parties <= 0) return null;
  return `${parties} semaine${parties > 1 ? 's' : ''} partie${parties > 1 ? 's' : ''}.`;
}

// Les étapes de « Son entrée » (lib/app/entree.ts) que disent aussi des points : « Relié à Nolio », « Son accord de lecture », « Démarré dans Nolio ».
const ETAPE_DU_GENRE: Record<string, string> = { nolio: 'nolio', accord: 'accord', demarrer: 'depart' };

// « À faire pour lui », sur la page de l'athlète, sous la 9.x : ses points, une seule fois sur la page. Tant que « Son entrée » est affichée, elle porte déjà
// ceux qu'elle dit (associer Nolio, « Accord reçu », démarrer) ; ils ne sont pas redits dans « À faire pour lui ».
export function pointsDeSaPage<T extends Pick<Point, 'genre'>>(points: T[], entree: Pick<Entree, 'complete' | 'etapes'>): T[] {
  if (entree.complete) return points;
  const aFaire = new Set(entree.etapes.filter((e) => !e.fait).map((e) => e.cle));
  return points.filter((p) => !(p.genre in ETAPE_DU_GENRE && aFaire.has(ETAPE_DU_GENRE[p.genre])));
}

// Les objectifs dont la semaine pas partie est un point de « À faire pour lui » : « Sa semaine qui arrive » n'y redit pas le bouton « Réessayer ».
export const semainesDansSesPoints = (points: Pick<Point, 'genre' | 'planId'>[]): string[] =>
  points.filter((p) => p.genre === 'semaine' && p.planId).map((p) => String(p.planId));

// ─── Les messages d'infrastructure ────────────────────────────────────────────────────────────────────────────────

// Un message pour le développeur (la clé de l'API Nolio qui manque, une migration à passer dans Supabase) : sous la 8.x, le coach le lit comme avant (true) ;
// sous la 9.x, il n'est plus affiché (false) et reste au journal du serveur (console.error). `journal` : pour les essais.
export function montrerLInfra(v9: boolean, message: string, journal: (m: string) => void = (m) => console.error(m)): boolean {
  if (!v9) return true;
  journal(message);
  return false;
}
