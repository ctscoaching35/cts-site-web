/**
 * LA PAGE D'UN ATHLÈTE, COURTE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : « l'espace coach doit être très simple sous la 9.x » ;
 * le document de départ est reports/Application coach — revue de simplicité, 24-11.md, proposition 2). DEUXIÈME SIMPLIFICATION, après « un seul
 * endroit pour ce qui est à faire » (« Urgent » fondu dans « Mes athlètes »). Sous la 8.x, rien ne change : tout ce qui est ici est appelé derrière `v9`
 * (moteurEstV9, lib/app/moteurEnLigne.ts) par la page app/app/coach/athlete/[id]/page.tsx, qui garde pour la 8.x ses treize blocs, dans leur ordre.
 *
 * Sous la 9.x, la page tient en quatre blocs, dans cet ordre, puis « Réglages », replié :
 *   (a) « À faire pour lui » : ses alertes et ce qui manque (ce qu'il doit revoir, une semaine pas partie, une alerte de fatigue, un arrêt ; son compte
 *       Nolio pas associé, son accord pas reçu, son objectif pas démarré). Un point n'y est dit qu'une fois.
 *   (b) « Ce que j’ai besoin de savoir » (décision 241 du coach, 25/11/2026, moment 2 ; components/app/CarteSavoir.tsx, lib/app/carteSavoir.ts) : le coureur et son objectif en un seul formulaire, ses zones et son style
 *       repliés ; ce qui manque en tête et surligné dans son champ ; dessous, « Lancer sa préparation ».
 *   (c) Ses objectifs : la course, la date, et de quoi vérifier que tout est rempli (côte, critères, tapis, trace GPX).
 *   (d) Sa semaine qui arrive (components/app/SemaineQuiArrive.tsx, inchangée).
 * Rien ne disparaît : tout le reste est dans « Réglages » (ORDRE_DES_REGLAGES_9X), sauf ce que la 9.x ne porte pas encore (ses courses de préparation, sa saison de fond : lib/app/cacherSousLaV1.ts).
 *
 * Le calcul seul, sans lecture ni réseau : il s'essaie avec des données fabriquées (scripts/test-espace-coach-simple-2.mjs). Les textes ci-dessous
 * sont NOUVEAUX et ne sont lus que par le coach ; ceux qui sont repris de la page d'avant le disent.
 */
import { coteEnClair, lireCote } from '@/lib/cote';
import { estReponseCritere, titreReponse } from '@/lib/criteres';
import { FORMATS_ROUTE } from '@/lib/plan';
import { NOTE_AVANT_DE_DEMARRER, type Entree } from './entree';
import { GROUPES_URGENT, groupeUrgent, type Point } from './espaceParAthlete';
import { lireGpx } from './gpxV9';
import { MOTS_DU_COACH } from './motsDuCoach';
import { ajouterJours } from './plan';

// ─── Les textes (pour le coach seul) ──────────────────────────────────────────────────────────────────────────────

export const TEXTES_PAGE_ATHLETE = {
  // (a) Le titre et la ligne « rien » sont ceux de la page d'avant ; le reste est nouveau.
  aFaire: 'À faire pour lui',
  rienAFaire: 'Rien à faire pour lui pour l’instant.',
  nolio: 'Son compte Nolio n’est pas associé.',
  accord: 'Son accord de lecture n’est pas reçu.',
  accordSous: 'Envoie-lui le message d’accord dans Nolio. Quand il répond oui, clique sur « Accord reçu ».',
  depart: 'Son objectif n’a pas démarré dans Nolio.',
  boutonAccord: 'Accord reçu',
  // (b) Les autres textes de la carte « Ce que j’ai besoin de savoir » sont dans lib/app/carteSavoir.ts.
  ilManque: (liste: string[]) => `Il manque : ${liste.join(', ')}`,
  manqueObjectif: 'son objectif',
  lancer: 'Lancer sa préparation',
  // Sous le champ de date, quand sa préparation commence plus tard (`date` : en clair).
  departAuPlusTot: (date: string) => `Vide : dès que possible, au plus tôt le ${date}.`,
  pourquoiCarte: 'Sa carte n’est pas complète.',
  // Les gestes sont ceux de la page d'avant, mot pour mot.
  modifierProfil: 'Modifier son profil',
  saisirTest: MOTS_DU_COACH.simple.test.geste,
  modifierReperes: 'Modifier ses repères',
  ceQuIlLit: 'Ce qu’il lit dans son app',
  // (c)
  objectifs: 'Ses objectifs',
  aucunObjectif: 'Aucun pour l’instant.',
  complet: 'Complet',
  envoyeEnEntier: 'Envoyé en entier : rien à vérifier.',
  manqueCote: 'sa côte en minutes',
  manqueIntensite: 'son critère d’intensité',
  manqueMecanique: 'son critère de mécanique',
  manqueTapis: 'son tapis (oui ou non)',
  manqueGpx: 'sa trace GPX',
  manqueSemaine: 'sa semaine habituelle',
  // Les gestes d'un objectif (inventaire du 25/11/2026, « Préparer ses coachés pour la v1 ») : sa côte, ses critères et son tapis sont sur sa fiche (« Modifier son profil ») ; sa trace et
  // sa semaine habituelle sont dans l'objectif (« Modifier »). Les mots de « Modifier son profil » sont ceux de la carte ; « Ajouter la trace » est celui du bouton de l'athlète.
  gesteTrace: 'Ajouter la trace',
  gesteObjectif: 'Modifier l’objectif',
  // Les cinq choses qu'un objectif doit avoir, avec ce que le moteur en lit : « Côte : 12 min », « Mécanique : Jamais », « Trace GPX : donnée » ; « — » quand il manque. Les titres des
  // deux critères sont ceux de la fiche du coaché (lib/criteres.ts : « Intensité », « Mécanique »).
  titreCote: 'Côte',
  titreIntensite: 'Intensité',
  titreMecanique: 'Mécanique',
  titreTapis: 'Tapis',
  titreGpx: 'Trace GPX',
  titreSemaine: 'Semaine',
  // Ses courses de préparation (décision du coach du 25/11/2026, C5), sous chaque objectif de « Ses objectifs ».
  coursesDePreparation: 'Ses courses de préparation',
  aucuneCourse: 'Aucune pour l’instant.',
  ajouterUneCourse: 'Ajouter une course de préparation',
  traceDonnee: 'donnée',
  sansValeur: '—',
  // « Réglages » : les rubriques qui s'y ajoutent sous la 9.x. Sans « sa semaine passée » (décision 220 du coach, 24/11/2026, suite) : elle ne s'y trouve que s'il y a un réalisé à montrer, ce que le moteur v1 n'écrit
  // pas (lib/app/semainePasseeSimple.ts) ; la phrase est la même pour tous, elle ne promet pas ce qui n'est presque jamais là (comme « ses courses », qui n'y sont que s'il y en a dans Nolio).
  reglagesSous: 'ses courses, sa programmation, l’app, son compte Nolio, son accord',
  ouEnEstIl: 'Où il en est',
  aVenir: 'À venir pour lui',
  anciensObjectifs: 'Ses objectifs passés',
} as const;

// ─── L'ordre des blocs : sous la 8.x, celui d'avant ; sous la 9.x, le nouveau ────────────────────────────────────────

// Les treize blocs de la page d'avant, dans l'ordre d'un téléphone (sur ordinateur, ses objectifs, ses courses, ses repères et son profil sont dans une colonne, ses zones et son
// style dans l'autre). « demande » et « entree » ne s'y affichent que s'il y a une demande de coaching, ou que l'entrée n'est pas complète.
export const ORDRE_8X = [
  'demande', 'entree', 'a_faire', 'semaine_qui_arrive', 'semaine_passee', 'objectifs', 'courses_nolio', 'reperes', 'zones', 'style', 'profil', 'reglages',
] as const;
export type Bloc8x = (typeof ORDRE_8X)[number];

// Sous la 9.x : quatre blocs, puis « Réglages ».
export const ORDRE_9X = ['a_faire', 'carte', 'objectifs', 'semaine_qui_arrive', 'reglages'] as const;
export type BlocHaut9x = (typeof ORDRE_9X)[number];

// Dans « Réglages » : ce qui y est déjà sous la 8.x (le bloc `details` qui existe), puis ce qui s'y ajoute sous la 9.x, « Retirer cet athlète » toujours en dernier.
export const ORDRE_DES_REGLAGES_8X = ['programmation', 'app', 'nolio', 'accord', 'retirer'] as const;
export const ORDRE_DES_REGLAGES_9X = [
  'etat', 'programmation', 'app', 'nolio', 'accord', 'a_venir', 'revue', 'semaine_passee', 'courses_nolio', 'anciens_objectifs', 'demande', 'entree', 'retirer',
] as const;
export type SectionDesReglages = (typeof ORDRE_DES_REGLAGES_9X)[number];

export const ordreDeLaPage = (v9: boolean): readonly string[] => (v9 ? ORDRE_9X : ORDRE_8X);
export const ordreDesReglages = (v9: boolean): readonly string[] => (v9 ? ORDRE_DES_REGLAGES_9X : ORDRE_DES_REGLAGES_8X);

// Où va, sous la 9.x, chacun des blocs d'avant : en haut, ou dans « Réglages ». Rien ne disparaît.
//   - « À faire pour lui » : ses points à faire en (a) ; ce qui arrive (« À venir ») et sa revue du dimanche dans « Réglages » ;
//   - « Son entrée » : ses étapes à faire sont des lignes de (a) ; la carte, une fois ces étapes faites, est dans « Réglages » ;
//   - « Ses repères », « Son profil de coureur », « Ses zones », « Son style » : une seule carte, (b), « Ce que j’ai besoin de savoir » ;
//   - « Ses objectifs » : la course et ce qui se vérifie en (c) ; ses objectifs passés dans « Réglages ». Ses courses de préparation et sa saison de fond n'y sont plus : la 9.x ne les
//     porte pas encore (troisième simplification, lib/app/cacherSousLaV1.ts) ; sous la 8.x, la page d'avant les montre.
export const PLACE_EN_9X: Record<Bloc8x, readonly (BlocHaut9x | SectionDesReglages)[]> = {
  demande: ['demande'],
  entree: ['a_faire', 'entree'],
  a_faire: ['a_faire', 'a_venir', 'revue'],
  semaine_qui_arrive: ['semaine_qui_arrive'],
  semaine_passee: ['semaine_passee'],
  objectifs: ['objectifs', 'anciens_objectifs'],
  courses_nolio: ['courses_nolio'],
  reperes: ['carte'],
  zones: ['carte'],
  style: ['carte'],
  profil: ['carte'],
  reglages: ['reglages', 'etat', 'programmation', 'app', 'nolio', 'accord', 'retirer'],
};

// ─── (a) « À faire pour lui » ─────────────────────────────────────────────────────────────────────────────────────────

// Les étapes de « Son entrée » (lib/app/entree.ts) que le coach fait lui-même : son compte Nolio à associer, son accord de lecture à cocher, son objectif à démarrer. Sous la 9.x,
// ce sont des lignes de « À faire pour lui » et non plus une carte à part ; une étape sans geste possible n'a pas de ligne (l'accord attend le compte Nolio, le départ attend
// l'objectif). Les étapes de l'objectif (« + Nouvel objectif », dit par « Ses objectifs ») et du week-end (rien à faire) restent dans la carte, dans « Réglages ».
export type LigneEntree = {
  cle: 'nolio' | 'accord' | 'depart'; texte: string; sous?: string; action?: { texte: string; href: string }; bouton?: 'accord';
};
// Le genre de point que dit la même chose : la ligne le remplace (un point n'est dit qu'une fois).
const POINT_DE_LA_LIGNE: Record<LigneEntree['cle'], string> = { nolio: 'nolio', accord: 'accord', depart: 'demarrer' };

export function lignesDEntree(entree: Pick<Entree, 'etapes'>): LigneEntree[] {
  const etape = (cle: string) => entree.etapes.find((e) => e.cle === cle);
  const nolio = etape('nolio');
  const accord = etape('accord');
  const depart = etape('depart');
  const lignes: (LigneEntree | false | undefined)[] = [
    nolio && !nolio.fait && Boolean(nolio.action) && { cle: 'nolio', texte: TEXTES_PAGE_ATHLETE.nolio, action: nolio.action },
    accord && !accord.fait && Boolean(nolio?.fait) && { cle: 'accord', texte: TEXTES_PAGE_ATHLETE.accord, sous: TEXTES_PAGE_ATHLETE.accordSous, bouton: 'accord' },
    depart && !depart.fait && Boolean(depart.action) && { cle: 'depart', texte: TEXTES_PAGE_ATHLETE.depart, sous: NOTE_AVANT_DE_DEMARRER, action: depart.action },
  ];
  return lignes.filter((l): l is LigneEntree => Boolean(l));
}

// La carte « Son entrée » n'a sa place en haut de nulle part : sous la 9.x, tant qu'une étape est à faire par le coach, elle est dans « À faire pour lui » ; sinon la carte est dans « Réglages ».
export const entreeDansLesReglages = (entree: Pick<Entree, 'etapes'>): boolean => lignesDEntree(entree).length === 0;

// `alerte` : l'alerte du moteur sur un objectif qui n'a pas démarré (entrée 234, lib/app/alerteCoach.ts) : ses phrases, et le lien qui mène à l'objectif à modifier.
export type LigneAlerte = { planId: string; nom: string; phrases: string[]; href: string };
// `test` : un test que la v1 a écrit et dont le résultat n'est pas saisi (lib/app/testsASaisir.ts) : sa phrase, le geste de la carte qui le saisit (ses mots sont ceux de la carte), le lien qui y mène.
export type LigneTest = { cle: string; texte: string; geste: GesteDeLaCarte; href: string };
export type LigneAFaire = { type: 'point'; point: Point } | { type: 'entree'; ligne: LigneEntree } | { type: 'alerte'; alerte: LigneAlerte } | { type: 'test'; test: LigneTest };

// Ses points à faire, rangés comme les quatre groupes d'« Urgent » (« A besoin de toi », « Ne court plus », « Semaine pas partie », « Objectif bloqué » ; dans chaque groupe,
// l'ordre reçu), puis les étapes de son entrée. Jamais « À venir » (ils sont dans « Réglages »). Un point n'y est dit qu'une fois : celui que dit déjà une ligne de l'entrée
// (compte Nolio, accord, départ) ou la carte « Ce que j’ai besoin de savoir » (profil à remplir) est retiré. `profilManque` : sa fiche n'a pas son profil entier, la carte le dit.
export function aFairePourLui(points: Point[], entree: Pick<Entree, 'etapes'>, profilManque: boolean, alertes: LigneAlerte[] = [], tests: LigneTest[] = []): LigneAFaire[] {
  const lignes = lignesDEntree(entree);
  const dit = new Set(lignes.map((l) => POINT_DE_LA_LIGNE[l.cle]));
  const rang = (p: Point) => GROUPES_URGENT.findIndex((g) => g.cle === groupeUrgent(p));
  const aFaire = points
    .filter((p) => groupeUrgent(p) !== null && !dit.has(p.genre) && !(profilManque && p.genre === 'profil'))
    .map((point, i) => ({ point, i }))
    .sort((x, y) => rang(x.point) - rang(y.point) || x.i - y.i)
    .map(({ point }) => point);
  return [...aFaire.map((point): LigneAFaire => ({ type: 'point', point })), ...alertes.map((alerte): LigneAFaire => ({ type: 'alerte', alerte })),
    ...tests.map((test): LigneAFaire => ({ type: 'test', test })),
    // Sous la 9.x (décision 241), le départ se fait par « Lancer sa préparation », sur sa page : la ligne y mène (et non à la page de l'objectif).
    ...lignes.map((ligne): LigneAFaire => ({ type: 'entree', ligne: ligne.cle === 'depart' && ligne.action ? { ...ligne, action: { ...ligne.action, href: '#lancer-sa-preparation' } } : ligne }))];
}

// Ce qui arrive (niveau « À venir » : une course A dans Nolio, rien après l'objectif… ; plus de course de préparation, la 9.x ne la porte pas) : il quitte le haut de la page et va dans « Réglages ».
export const pointsAVenir = (points: Point[]): Point[] => points.filter((p) => groupeUrgent(p) === null);

// ─── (b) « Ce que j’ai besoin de savoir » ─────────────────────────────────────────────────────────────────────────────

type Reponses = Record<string, unknown> | null | undefined;

// Les cinq réponses sans lesquelles une saison ne part pas (la même règle que le point « Profil à remplir » : lib/app/espaceCoach.ts).
const REPONSES_DU_PROFIL = ['niveau', 'terrain', 'jour_sl', 'freq_hebdo', 'jours_disponibles'];
export const profilEstRempli = (profil: Reponses): boolean => REPONSES_DU_PROFIL.every((k) => profil?.[k] !== undefined && String(profil[k]).length > 0);

// Les trois parties de la carte où un lien peut mener (lib/app/testsASaisir.ts) : sa côte, son tapis et ses critères ; son test ; ses repères.
export type GesteDeLaCarte = 'profil' | 'test_vc' | 'reperes';

// ─── (c) Ses objectifs : de quoi vérifier que tout est rempli ────────────────────────────────────────────────────────────

export type ItemObjectif = { cle: 'cote' | 'intensite' | 'mecanique' | 'tapis' | 'gpx' | 'semaine'; titre: string; valeur: string | null; manque: string };
export type VerifObjectif = { route: boolean; items: ItemObjectif[]; manque: string[]; complet: boolean };

// Sa semaine habituelle comme le moteur la lit dans les réponses de l'objectif : « 4 séances · mar, jeu, sam · sortie longue le samedi » ; null s'il en manque un morceau (ses jours, sa sortie
// longue, son nombre de séances). Elle ne suit pas la fiche : celle de la fiche sert aux prochains objectifs, « Modifier » l'objectif change celle-ci.
export function semaineDeLObjectif(champs: Reponses): string | null {
  const jours = Array.isArray(champs?.jours_disponibles) ? (champs.jours_disponibles as unknown[]).map(String).filter(Boolean) : [];
  const n = Number(champs?.freq_hebdo);
  const sl = String(champs?.jour_sl ?? '');
  if (!jours.length || !(n > 0) || !sl) return null;
  return `${n} séance${n > 1 ? 's' : ''} · ${jours.map((j) => j.slice(0, 3)).join(', ')} · sortie longue le ${sl}`;
}

// Un 10 km, un semi ou un marathon : le questionnaire de la route ne pose ni terrain (côte, tapis), ni dénivelé (mécanique), ni trace ; l'intensité seule.
export const estUneCourseSurRoute = (champs: Reponses): boolean => FORMATS_ROUTE.some((f) => f.code === champs?.format);

// Ce que contient un objectif de ce qu'il faut pour que le moteur v1 ait tout : sa côte en minutes, ses deux critères (intensité, mécanique), son tapis, la trace de sa course.
// `champs` : les réponses de l'objectif (parametres.champs). `fiche` : le profil du coaché, lu d'abord comme le moteur le lit (lib/app/passeUnPlanV9.ts, parametresDuPlanV9) ; sans
// réponse sur la fiche, celle de l'objectif. Les critères sont ceux de la fiche (lib/criteres.ts) ; ils se lisent à plat (`critere_intensite`, `critere_denivele`) ou dans `criteres`.
export function verifierObjectif(champs: Reponses, fiche: Reponses = null): VerifObjectif {
  const route = estUneCourseSurRoute(champs);
  const objet = (typeof champs?.criteres === 'object' && champs.criteres !== null ? champs.criteres : {}) as Record<string, unknown>;
  const critere = (flat: 'critere_intensite' | 'critere_denivele', court: 'intensite' | 'mecanique') => {
    const v = [fiche?.[flat], objet[court], champs?.[flat]].find(estReponseCritere);
    return v ? titreReponse(String(v)) : null;
  };
  const cote = [fiche?.cote_min, champs?.cote_min].map(lireCote).find((c) => c !== null) ?? null;
  const tapis = [fiche?.tapis, champs?.tapis].find((v) => v === 'oui' || v === 'non');
  const t = TEXTES_PAGE_ATHLETE;
  const tous: ItemObjectif[] = [
    { cle: 'cote', titre: t.titreCote, valeur: coteEnClair(cote), manque: t.manqueCote },
    { cle: 'intensite', titre: t.titreIntensite, valeur: critere('critere_intensite', 'intensite'), manque: t.manqueIntensite },
    { cle: 'mecanique', titre: t.titreMecanique, valeur: critere('critere_denivele', 'mecanique'), manque: t.manqueMecanique },
    { cle: 'tapis', titre: t.titreTapis, valeur: typeof tapis === 'string' ? tapis : null, manque: t.manqueTapis },
    { cle: 'gpx', titre: t.titreGpx, valeur: lireGpx(champs?.gpx) ? t.traceDonnee : null, manque: t.manqueGpx },
    { cle: 'semaine', titre: t.titreSemaine, valeur: semaineDeLObjectif(champs), manque: t.manqueSemaine },
  ];
  const items = route ? tous.filter((i) => i.cle === 'intensite' || i.cle === 'semaine') : tous;
  const manque = items.filter((i) => i.valeur === null).map((i) => i.manque);
  return { route, items, manque, complet: manque.length === 0 };
}

// Le geste qui règle ce qui manque à un objectif, un seul par chose : la côte, les critères et le tapis se donnent sur la fiche (la carte « Ce que j’ai besoin de savoir »), la trace et la semaine habituelle dans
// l'objectif. Dans l'ordre de l'objectif ; rien quand tout y est.
export type GesteDeLObjectif = 'profil' | 'trace' | 'semaine';
export function gestesDeLObjectif(v: VerifObjectif): GesteDeLObjectif[] {
  const manque = new Set(v.items.filter((i) => i.valeur === null).map((i) => i.cle));
  return [
    ...(['cote', 'intensite', 'mecanique', 'tapis'] as const).some((c) => manque.has(c)) ? ['profil' as const] : [],
    ...(manque.has('gpx') ? ['trace' as const] : []),
    ...(manque.has('semaine') ? ['semaine' as const] : []),
  ];
}

// Le repère d'un objectif : « Complet », ou « Il manque : … ».
export const repereDeLObjectif = (v: VerifObjectif): string => (v.complet ? TEXTES_PAGE_ATHLETE.complet : TEXTES_PAGE_ATHLETE.ilManque(v.manque));

// Le repère en tête de « Ce que j’ai besoin de savoir », et les champs à surligner : ceux de son objectif en cours, comme « Ses objectifs » les vérifie. `objectif` : null sans objectif à venir (seuls
// sa côte, ses critères et son tapis se vérifient, et son objectif manque) ; `champs` null : un objectif envoyé en entier, qui n'a pas de réponses à vérifier.
export type EtatDeLaCarte = { repere: string; complet: boolean; manquants: ItemObjectif['cle'][] };
export function etatDeLaCarte(objectif: { champs: Reponses } | null, fiche: Reponses = null): EtatDeLaCarte {
  if (objectif && !objectif.champs) return { repere: TEXTES_PAGE_ATHLETE.envoyeEnEntier, complet: false, manquants: [] };
  const v = verifierObjectif(objectif?.champs ?? {}, fiche);
  const manquants = v.items.filter((i) => i.valeur === null && (objectif !== null || (i.cle !== 'gpx' && i.cle !== 'semaine')));
  const cles = manquants.map((i) => i.cle);
  if (!objectif) return { repere: TEXTES_PAGE_ATHLETE.ilManque([...manquants.map((i) => i.manque), TEXTES_PAGE_ATHLETE.manqueObjectif]), complet: false, manquants: cles };
  return { repere: repereDeLObjectif(v), complet: v.complet, manquants: cles };
}

// Le premier lundi possible d'une préparation qui commence plus tard (la règle de la page de l'objectif, « au plus tôt le … ») ; null quand elle peut partir tout de suite. `debutPlan` : le lundi de sa première semaine.
export const auPlusTot = (debutPlan: string | null | undefined, aujourdhui: string): string | null => (debutPlan && debutPlan > ajouterJours(aujourdhui, 1) ? debutPlan : null);

// « Lancer sa préparation », pour son objectif à venir : rien à montrer sans objectif écrit semaine par semaine, une fois démarré, ou s'il est programmé à la main ; programmé, la date ; sinon le bouton, actif quand sa
// carte est complète, son compte Nolio associé et son accord de lecture reçu, avec une ligne qui dit le premier qui manque.
export type EtatDuLancement = { programme: string } | { actif: boolean; pourquoi: string | null };
export function etatDuLancement({ objectif, complet, nolio, accord, aLaMain }: {
  objectif: { ecrit: boolean; demarre: boolean; prevu: string | null } | null; complet: boolean; nolio: boolean; accord: boolean; aLaMain: boolean;
}): EtatDuLancement | null {
  if (!objectif || !objectif.ecrit || objectif.demarre || aLaMain) return null;
  if (objectif.prevu) return { programme: objectif.prevu };
  const t = TEXTES_PAGE_ATHLETE;
  const pourquoi = !complet ? t.pourquoiCarte : !nolio ? t.nolio : !accord ? t.accord : null;
  return { actif: pourquoi === null, pourquoi };
}

// Ses objectifs à vérifier : ceux dont la course n'est pas passée ; les autres sont dans « Réglages » (« Ses objectifs passés »).
export function departagerLesObjectifs<T extends { course_date: string }>(objectifs: T[], aujourdhui: string): { aVenir: T[]; passes: T[] } {
  return { aVenir: objectifs.filter((o) => o.course_date >= aujourdhui), passes: objectifs.filter((o) => o.course_date < aujourdhui) };
}
