#!/usr/bin/env node
/**
 * L'ESPACE COACH SIMPLE SOUS LA 9.x, TROISIÈME ET QUATRIÈME SIMPLIFICATIONS (décision 220 du coach, 24/11/2026 ; reports/Application coach — revue de simplicité, 24-11.md,
 * propositions 3 et 4) :
 *   - « ce que la v1 ne fait pas encore est CACHÉ » (pas de bouton qui ne marche pas, pas de ligne vide), sous la 9.x, sur tous les écrans de l'espace coach : (a) l'aperçu du dimanche,
 *     (b) les courses de préparation, (c) la saison de fond, (d) les tests lus, (e) les séances allégées en EF et « Garder la séance d'origine », « Ajustements annulés » ;
 *   - « les blocs qui ne servent plus sont SUPPRIMÉS » : « Corriger avant l'envoi » (aperçu) et « Tes corrections avant l'envoi » (« Chiffres »), éteints sous les deux moteurs.
 * Sous la 8.x, RIEN ne change (sauf la suppression de ces deux blocs, déjà morts). Les écrans ne se rendent pas ici : le calcul est essayé (lib/app/cacherSousLaV1.ts) et chaque
 * élément caché est lu dans le source de son écran, derrière `v9`. Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-espace-coach-simple-3.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const source = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');
const sansCommentaires = (texte) => texte.split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l)).join('\n');
const grep = (motif, ...dossiers) => {
  try {
    return execFileSync('grep', ['-rlE', motif, ...dossiers], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  } catch {
    return []; // grep rend 1 sans résultat
  }
};
const lib = await import(`${RACINE}lib/app/cacherSousLaV1.ts`);
const {
  GENRES_CACHES_9X, TEXTES_CACHES, ajustementsAnnulesVisibles, ajustementsSansAllegees, apercuDisponible, carteAvantVisible, estUneCourseEnPreparation,
  objectifSansSaison, passeDuLundiVisible, pointsSousLaV1, preparationsDisponibles, testsLusDisponibles,
} = lib;
const { SIGNAL, etiquettes, groupeUrgent, urgentDe, athletesUrgents } = await import(`${RACINE}lib/app/espaceParAthlete.ts`);
const { etiquettesSansAFaire, aFaireDe } = await import(`${RACINE}lib/app/espaceCoachSimple.ts`);
const { prerequisMarathon } = await import(`${RACINE}lib/app/route.ts`);
const { aFairePourLui } = await import(`${RACINE}lib/app/pageAthleteSimple.ts`);
const { entreeDe } = await import(`${RACINE}lib/app/entree.ts`);

const PLAN = 'app/app/coach/plan/[id]/page.tsx';
const APERCU = 'app/app/coach/plan/[id]/apercu/page.tsx';
const ATHLETE = 'app/app/coach/athlete/[id]/page.tsx';
const NOUVEAU = 'app/app/coach/nouveau/page.tsx';
const CHIFFRES = 'app/app/coach/chiffres/page.tsx';
const SEMAINE = 'components/app/SemaineQuiArrive.tsx';
const TABLEAU = 'components/app/TableauAthletes.tsx';
const OBJECTIFS = 'components/app/ObjectifsAVerifier.tsx';
const GESTES = 'components/app/GestesEcriture.tsx';
const plan = source(PLAN);
const athlete = source(ATHLETE);
const semaine = source(SEMAINE);

const point = (niveau, genre, extra = {}) => ({ niveau, genre, athlete: 'x', texte: `${genre} à voir.`, action: 'Voir ›', href: '#', cle: `${genre}:${niveau}`, ...extra });

// ─── Le journal, écran par écran : ce qui est caché sous la 9.x, derrière quelle garde, et ce que la 8.x garde ──────────────────────────

// [écran, ce qui est caché, fichier, la garde (sous la 9.x), [fichier, texte que la 8.x garde]]
const JOURNAL = [
  // (a) l'aperçu du dimanche
  ['Aperçu du dimanche', 'la page : l’adresse renvoie à l’objectif, avant de rien lire', APERCU,
    /if \(!apercuDisponible\(await moteurEstV9\(\)\.catch\(\(\) => false\)\)\) redirect\(`\/app\/coach\/plan\/\$\{id\}`\);/, [APERCU, 'Aperçu du dimanche']],
  ['Page d’un objectif', 'le lien « Voir ce qu’elle donnerait aujourd’hui »', PLAN,
    /\{apercuDisponible\(v9\) && \(\s*<Link href=\{`\/app\/coach\/plan\/\$\{id\}\/apercu`\}/, [PLAN, 'Voir ce qu’elle donnerait aujourd’hui ›']],
  ['Page d’un athlète › Sa semaine qui arrive', '« Voir ce que le moteur écrirait »', SEMAINE,
    /\{apercuDisponible\(v9\) && \(\s*<Link href=\{`\?apercu=\$\{s\.planId\}#semaine-qui-arrive`\}/, [SEMAINE, 'Voir ce que le moteur écrirait']],
  ['Page d’un athlète › Sa semaine qui arrive', '« Ouvrir l’aperçu complet » (trois états de la carte)', SEMAINE,
    /const apercuComplet = apercuDisponible\(v9\) \? \(/, [SEMAINE, 'Ouvrir l’aperçu complet ›']],
  ['Page d’un athlète › Sa semaine qui arrive', 'le calcul demandé par ?apercu= (une adresse d’avant ne calcule rien)', 'lib/app/semaineQuiArrive.ts',
    /if \(!apercuDisponible\(v9\) \|\| apercu !== o\.plan_id\) return \{ \.\.\.commun, etat: 'avant' \};/, ['lib/app/semaineQuiArrive.ts', 'return { ...commun, etat: \'avant\', apercu: await apercuDuDimanche(o.plan_id) }']],
  ['Page d’un athlète › Sa semaine qui arrive', 'la carte d’avant le passage, quand sa phrase manque (son titre seul)', SEMAINE,
    /if \(!a && !s\.erreur && !carteAvantVisible\(v9, prevision\.prevoit\)\) return null;/, [SEMAINE, 'Voir ce que le moteur écrirait']],
  ['Page d’un athlète › Sa semaine qui arrive', '« La passe du lundi n’a pas réécrit la semaine » et « Appliquer ce que le moteur aurait écrit »', SEMAINE,
    /revue\?\.lundi && \(passeDuLundiVisible\(v9\) \|\| revue\.lundi\.etat !== 'non_reecrite'\) \? revue\.lundi : undefined/, [SEMAINE, 'La passe du lundi n’a pas réécrit la semaine']],
  // (b) les courses de préparation
  ['Page d’un objectif', 'la carte « Ses courses de préparation » et ses gestes (ajouter, modifier, retirer)', PLAN,
    /\{preparationsDisponibles\(v9\) && ecriture\?\.parametres && \(\s*<Carte id="ajouter-course"/, [PLAN, '+ Ajouter une course de préparation']],
  ['Page d’un objectif', 'les fiches de ses courses de préparation (non lues)', PLAN,
    /ecriture\?\.parametres && preparationsDisponibles\(v9\) \? await fichesDePreparation\(id\)/, [PLAN, 'fichesDePreparation']],
  ['Page d’un objectif', 'la course de Nolio qui préremplit le formulaire (?course=, non lue)', PLAN,
    /courseId && preparationsDisponibles\(v9\) \? await courseNolio\(nolio, courseId\)/, [PLAN, 'Reprise de Nolio : relis la distance, le D+ et le chrono visé.']],
  ['Nouvel objectif', 'l’onglet « Course de préparation »', NOUVEAU,
    /\{court && !aModifier && !demande && preparationsDisponibles\(v9\) && \(\s*<div role="group" aria-label="Genre d’objectif"/, [NOUVEAU, 'Course de préparation']],
  // (c) la saison de fond
  ['Mes athlètes', 'les étiquettes « Saison de fond », « Bloc … », « tests dans … » et « jusqu’au … »', TABLEAU,
    /export function SaSemaine\(\{ e, jour, v9 = false \}[^\n]*\n[^\n]*\n\s*const o = objectifSansSaison\(a\.objectif, v9\);/, [TABLEAU, 'Saison de fond']],
  ['Mes athlètes', 'la ligne d’un athlète dont l’« objectif » est une saison (ni date, ni J-)', TABLEAU,
    /function Ligne\(\{ e, jour, v9 \}[^\n]*\n[^\n]*\n\s*const o = objectifSansSaison\(a\.objectif, v9\);/, [TABLEAU, 'jusqu’au']],
  ['Mes athlètes', 'les filtres (une saison se compte « Sans objectif »)', TABLEAU,
    /function categorie\(e: EtatAthlete, jour: string, v9: boolean\)[^\n]*\n\s*const o = objectifSansSaison\(e\.a\.objectif, v9\);/, [TABLEAU, 'Sans objectif']],
  ['Page d’un athlète', 'son nom de saison et sa date sous son nom (sous la 9.x, « Saison de fond » seul)', ATHLETE, /const sousLeNom = v9 && saisonEnCours \? \[TEXTES_UN_MOT\.saison, prochaineCourse\]/, [ATHLETE, 'en cours']],
  ['Page d’un athlète › Ses objectifs (9.x)', 'le lien « … · en cours » vers la saison', OBJECTIFS, /export default function ObjectifsAVerifier\(\{ athleteId, lignes, jour, plat = false \}: \{ athleteId: string; lignes: LigneObjectif\[\]; jour: string; plat\?: boolean \}\)/,
    [ATHLETE, '{saisonEnCours && (']],
  ['Page d’un athlète › Ses 7 jours', 'la mention « ou une saison » (rien de lu)', ATHLETE, /\{v9 \? TEXTES_CACHES\.septJoursVide : 'Rien de lu pour l’instant\./, [ATHLETE, 'dès qu’un objectif ou une saison a démarré']],
  // (d) les tests lus
  ['Page d’un objectif', 'les lignes « test lu », leurs statuts, « Ses cibles et ses zones ont suivi » (la table n’est pas lue)', PLAN,
    /const \{ data: tests \} = ecriture\?\.parametres && testsLusDisponibles\(v9\)\s*\? await service\.from\('tests_lus'\)/, [PLAN, 'Ses cibles et ses zones ont suivi']],
  ['Page d’un athlète › Saisir son test de vitesse critique', 'la phrase qui parlait de la lecture du test dans Nolio et du test « marqué lu »', ATHLETE,
    /\{testsLusDisponibles\(v9\) \? \(\s*<>\s*S’il ne l’a pas fait dans l’app, ou si sa lecture dans Nolio n’a pas abouti[^]*?<\/>\s*\) : TEXTES_CACHES\.testSaisi\}/, [ATHLETE, 'Un test écrit dans ses semaines et pas encore lu est alors marqué lu.']],
  // (e) les séances allégées, « Garder la séance d'origine », « Ajustements annulés »
  ['Mes athlètes et page d’un athlète', '« allégée en EF », « Garder la séance d’origine » et le détail de « Fatigue franche » (les données sont ôtées à la source)', 'lib/app/mesAthletes.ts',
    /const moteur = lignesDuMoteur\(ajustementsSansAllegees\(ajustements, v9\)\);/, [ATHLETE, 'Garder la séance d’origine']],
  ['Page d’un objectif', '« Ajustements annulés. » sous une semaine', PLAN, /\{ajustementsAnnulesVisibles\(v9\) && w\.sans_ajustement && <p/, [PLAN, 'Ajustements annulés.']],
  ['Page d’un objectif', '« Annuler les ajustements » (décision 213, déjà caché)', PLAN, /\{!v9 && ajuste && w\.numero === ecritesTriees\.find\([^\n]*<AnnulerSemaine planId=\{id\} numero=\{w\.numero\} \/>\}/, [GESTES, 'Annuler les ajustements']],
  // Les points, sur « Mes athlètes › À faire », « À faire pour lui » et la colonne « Ce qui l’attend »
  ['Mes athlètes, À faire, page d’un athlète', 'les points « course de préparation », « test à revoir », « passe du lundi à voir »', 'lib/app/mesAthletes.ts',
    /const dits = pointsSousLaV1\(vue\.aRegarder, v9\);/, ['lib/app/espaceCoach.ts', 'genre: \'preparation\'']],
];

test('le journal : chaque élément caché l’est derrière `v9` dans le source de son écran, et la 8.x garde son texte', () => {
  assert.ok(JOURNAL.length >= 20 && new Set(JOURNAL.map((j) => j[1])).size === JOURNAL.length, "chaque élément caché a sa ligne, une seule");
  for (const [ecran, ce, fichier, garde, [fichier8x, texte8x]] of JOURNAL) {
    assert.match(source(fichier), garde, `${ecran} : ${ce} (${fichier})`);
    assert.ok(source(fichier8x).includes(texte8x), `${ecran} : la 8.x garde « ${texte8x} » (${fichier8x})`);
  }
});

// ─── Les points que la 9.x ne porte pas ──────────────────────────────────────────────────────────────────────────────────────────────────

test('les points d’une fonction que la 9.x ne fait pas encore ne sont gardés sur aucun écran ; sous la 8.x, ils le sont tous', () => {
  // « saison » et « profil » ne sont plus cachés : la v1 écrit les saisons de fond (25/11/2026).
  const niveaux = { preparation: 'arrive', test: 'arrive', lundi: 'arrive' };
  assert.deepEqual(Object.keys(GENRES_CACHES_9X).sort(), Object.keys(niveaux).sort());
  const tous = [
    ...Object.entries(niveaux).map(([genre, niveau]) => point(niveau, genre)),
    // Ce qui reste : ce que la 9.x porte (et, après vérification, « course Nolio » et « prérequis du marathon »).
    point('bloque', 'nolio'), point('bloque', 'accord'), point('bloque', 'demarrer'), point('bloque', 'semaine'), point('sante', 'sensations'), point('sante', 'commentaire'),
    point('arrive', 'course_nolio'), point('arrive', 'prerequis'), point('arrive', 'suite'), point('arrive', 'chrono_route'), point('arrive', 'week_end_choc'), point('arrive', 'courses_proches'),
    point('bloque', 'saison'), point('bloque', 'profil'),
  ];
  const genres = (v9) => pointsSousLaV1(tous, v9).map((p) => p.genre);
  assert.deepEqual(genres(false), tous.map((p) => p.genre), 'sous la 8.x, rien n’est ôté');
  assert.equal(pointsSousLaV1(tous, false), tous, 'la même liste');
  assert.deepEqual(genres(true), ['nolio', 'accord', 'demarrer', 'semaine', 'sensations', 'commentaire', 'course_nolio', 'prerequis', 'suite', 'chrono_route', 'week_end_choc', 'courses_proches', 'saison', 'profil']);
  for (const g of Object.keys(GENRES_CACHES_9X)) assert.ok(g in SIGNAL, `${g} avait bien son étiquette sous la 8.x`);
  for (const g of ['course_nolio', 'prerequis']) assert.ok(!(g in GENRES_CACHES_9X), `${g} n’est pas caché`);
  assert.deepEqual(pointsSousLaV1([], true), []);
});

test('une fois ôtés, ni l’étiquette, ni la ligne de « À faire », ni la pastille du menu ne les disent plus ; une saison refusée et un profil à remplir restent dits', () => {
  const points = [point('arrive', 'preparation'), point('arrive', 'test'), point('bloque', 'saison'), point('bloque', 'profil'), point('arrive', 'lundi'), point('sante', 'sensations')];
  const avant = etiquettes(points, null).map((e) => e.texte);
  for (const t of ['Course de préparation', 'Test à revoir', 'Saison de fond refusée', 'Profil à remplir', 'Passe du lundi à voir']) assert.ok(avant.includes(t), `la 8.x dit « ${t} »`);
  const gardes = pointsSousLaV1(points, true);
  assert.deepEqual(etiquettes(gardes, null).map((e) => e.texte), ['Saison de fond refusée', 'Profil à remplir', 'Mauvaises sensations']);
  // « À faire » : un athlète qui n'a que des points cachés n'a plus aucune ligne, ni de pastille (athletesUrgents).
  const seuls = [{ id: 'a1', nom: 'A', points: pointsSousLaV1([point('arrive', 'preparation'), point('arrive', 'lundi')], true) }, { id: 'a2', nom: 'B', points: gardes }];
  const urgent = urgentDe(seuls);
  assert.deepEqual(aFaireDe(urgent).map((l) => l.point.genre).sort(), ['profil', 'saison', 'sensations']);
  assert.equal(athletesUrgents(urgent), 1);
  // La colonne « Ce qui l'attend » : sans eux, le tiret (aucune étiquette) plutôt qu'une ligne vide.
  assert.deepEqual(etiquettesSansAFaire(pointsSousLaV1([point('arrive', 'preparation')], true), null), etiquettes([], null), 'sans point, « Rien à signaler » comme avant');
  // La page de l'athlète : « À faire pour lui » ne redit pas le profil, la carte de coureur le dit ; la saison refusée y reste.
  const entree = entreeDe({ athleteId: 'a1', nolio: true, accord: true, programmation: 'auto', objectif: { plan_id: 'p', ecrit: true, demarre: true, prevu: null }, dimanchesJusqua: '2026-12-01', aujourdhui: '2026-11-24' });
  assert.deepEqual(aFairePourLui(pointsSousLaV1(points, true), entree, true).map((l) => l.point.genre).sort(), ['saison', 'sensations']);
  for (const g of ['saison', 'profil']) assert.equal(groupeUrgent({ niveau: 'bloque', genre: g }), 'bloque', `${g} est dans « Objectif bloqué »`);
});

test('« Mes athlètes » lit ses points et ses ajustements une seule fois, au même endroit, derrière `v9`', () => {
  const m = source('lib/app/mesAthletes.ts');
  assert.ok(m.indexOf('const v9 = await moteurEstV9().catch(() => false);') < m.indexOf('await Promise.all(['), 'la version est lue avant les ajustements');
  const code = sansCommentaires(m);
  assert.equal((code.match(/pointsSousLaV1\(/g) ?? []).length, 1);
  assert.equal((code.match(/vue\.aRegarder\.filter\(\(r\) => r\.athlete/g) ?? []).length, 0, 'plus aucune lecture des points sans le filtre');
  assert.equal((code.match(/dits\.filter\(\(r\) => r\.athlete === a\.nom/g) ?? []).length, 3, 'les trois niveaux (ce qui bloque, la santé, ce qui arrive)');
  // Le bilan du dimanche compte encore les semaines pas parties, filtrées ou non.
  assert.match(code, /bilanDuDimanche\(coachId, jour, dimanche, vue\.aRegarder\.filter\(\(r\) => r\.genre === 'semaine'\)\.length, v9\)/);
});

// ─── (e) Les séances allégées en EF et « Garder la séance d'origine » ─────────────────────────────────────────────────────────────────────

test('sous la 9.x, plus de séance allégée : un ajustement qui n’était que cela s’en va, les autres gardent leurs raisons', () => {
  const seul = { planId: 'p1', allegees: [{ id: 'S3-mardi', nom: 'Seuil', jour: 'mardi' }], raisons: [], joursArret: null };
  const avecRaison = { planId: 'p2', allegees: [{ id: 'S3-jeudi', nom: 'VMA', jour: 'jeudi' }], raisons: ['fatigue'], joursArret: null };
  const arret = { planId: 'p3', allegees: [{ id: 'S3-samedi', nom: 'Côtes', jour: 'samedi' }], raisons: [], joursArret: 9 };
  const sans = { planId: 'p4', allegees: [], raisons: ['semaine allégée'], joursArret: null };
  const liste = [seul, avecRaison, arret, sans];
  assert.equal(ajustementsSansAllegees(liste, false), liste, 'sous la 8.x, la même liste');
  const v9 = ajustementsSansAllegees(liste, true);
  assert.deepEqual(v9.map((a) => a.planId), ['p2', 'p3', 'p4']);
  assert.ok(v9.every((a) => a.allegees.length === 0), 'plus aucune séance allégée : ni « allégée en EF », ni « Garder la séance d’origine »');
  assert.deepEqual(v9.find((a) => a.planId === 'p2').raisons, ['fatigue']);
  assert.equal(v9.find((a) => a.planId === 'p3').joursArret, 9, 'un arrêt reste dit');
  assert.equal(v9.find((a) => a.planId === 'p4'), sans, 'sans séance allégée, rien ne bouge');
  assert.equal(avecRaison.allegees.length, 1, 'rien n’est modifié sur place');
});

test('« Garder la séance d’origine » : sous la 8.x, sa ligne reste sur la page ; ce qui y mène vient de /v1/fatigue et /v1/veto, retirées (rien ne les rappelle sous la 9.x)', () => {
  assert.ok(athlete.includes('{j.nom} allégée en EF (fatigue franche) ·'));
  assert.ok(athlete.includes('>Garder la séance d’origine</Link>'));
  assert.match(athlete, /const allegees = decisions\.flatMap\(\(l\) => l\.ajustements\.flatMap\(\(x\) => x\.allegees\.map/, 'la ligne se nourrit des décisions de mesAthletes');
  const e = source('lib/app/ecriture.ts');
  // Le moteur v1 ne rappelle plus ces routes (scripts/test-routes-retirees.mjs les lit aussi) : plus aucune séance allégée, plus de veto.
  assert.match(e, /if \(await moteurEstV9\(\)\) return null;\n\s*const r = await moteur<\{ remplacer: string \| null;/);
  assert.match(e, /export async function garderSeanceOrigine\([^\n]*\n[^\n]*\n\s*if \(await moteurEstV9\(\)\) return false;/);
  assert.match(e, /export async function refaireLesResumes\([^\n]*\n[^\n]*\n\s*if \(await moteurEstV9\(\)\) return \[\];/);
  assert.match(e, /export async function passageDuLundi\([^\n]*\n[^\n]*\n\s*if \(await moteurEstV9\(\)\) return \[\];/);
  // Le geste « Appliquer ce que le moteur aurait écrit » dépendait de la passe du lundi (/v1/semaine/lundi) : caché, et le serveur refuse avant de lire ou d'écrire.
  assert.match(e, /export async function appliquerLaSemaineDuLundi\(planId: string, numero: string\): Promise<void> \{[^]*?\n\s*if \(await moteurEstV9\(\)\) throw new Error\([^\n]*\n\s*const o = await objectifEcrit\(planId\);/);
  // La page « Garder » est celle de l'athlète (e-mails d'avant) : elle n'est pas dans l'espace coach et n'a pas bougé.
  assert.ok(!existsSync(`${RACINE}app/app/coach/garder`));
  assert.deepEqual(grep('/app/garder\\?plan', 'app/app/coach', 'components'), [ATHLETE]);
});

test('« Ajustements annulés » : caché sous la 9.x ; « Annuler » reste pour la 8.x et le serveur le refuse sous la 9.x (sa phrase « réécrite sans ses ajustements » n’y est pas atteignable)', () => {
  assert.equal(ajustementsAnnulesVisibles(false), true);
  assert.equal(ajustementsAnnulesVisibles(true), false);
  // Le bouton : la 8.x seulement (décision 213), son action et sa phrase restent pour la 8.x.
  assert.match(plan, /\{!v9 && ajuste && w\.numero === /);
  const g = source(GESTES);
  assert.match(g, /export function AnnulerSemaine\(/);
  assert.ok(source('lib/app/actionsEcriture.ts').includes('réécrite sans ses ajustements, et mise à jour dans Nolio.'));
  assert.deepEqual(grep('AnnulerSemaine', 'app', 'components', 'lib'), [PLAN, GESTES].sort(), 'rendu par la page de l’objectif seulement');
  const e = source('lib/app/ecriture.ts');
  assert.match(e, /export async function annulerAjustements\(planId: string, numero: string\): Promise<void> \{\n[^\n]*\n\s*if \(await moteurEstV9\(\)\) throw new Error\([^\n]*\n\s*const o = await objectifEcrit\(planId\);/);
});

// ─── (a) l'aperçu du dimanche ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('l’aperçu du dimanche : plus rien n’y mène sous la 9.x ; sous la 8.x, ses liens et sa page sont ceux d’avant', () => {
  assert.equal(apercuDisponible(false), true);
  assert.equal(apercuDisponible(true), false);
  // Chaque lien vers l'aperçu est dans un bloc gardé (la page de l'objectif, « Sa semaine qui arrive »).
  for (const [f, motif] of [[PLAN, /\/apercu`/g], [SEMAINE, /\/apercu`|\?apercu=/g]]) {
    const s = source(f);
    const liens = [...s.matchAll(motif)];
    assert.ok(liens.length >= 1, f);
    for (const m of liens) assert.ok(s.slice(Math.max(0, m.index - 260), m.index).includes('apercuDisponible(v9)'), `${f} : un lien vers l’aperçu sans garde`);
  }
  // Aucun autre écran du coach ne mène à l'aperçu.
  assert.deepEqual(grep('/apercu`|\\?apercu=', 'app/app/coach', 'components/app/SemaineQuiArrive.tsx', 'components/app/TableauAthletes.tsx', 'components/app/AFaire.tsx', 'components/app/PointsPourLui.tsx'),
    [PLAN, SEMAINE].sort());
  // La page : sous la 9.x elle renvoie à l'objectif avant de lire l'objectif, Nolio ou le moteur.
  const a = source(APERCU);
  assert.ok(a.indexOf('redirect(`/app/coach/plan/${id}`)') < a.indexOf('await objectifCoache('));
  assert.ok(a.indexOf('redirect(`/app/coach/plan/${id}`)') < a.indexOf('await apercuDuDimanche(id)'));
  // Sous la 8.x, ce que la page montre est ce qu'elle montrait : les deux cartes et les replis, sans « Corriger avant l'envoi ».
  for (const t of ['Ce que le moteur change', 'La note « Ta semaine » qu’il lira', 'La semaine qui partira']) assert.ok(a.includes(t), t);
  // Le calcul d'« Appliquer » n'est pas appelé par la page de l'aperçu ; la lib de l'aperçu refuse déjà sous la 9.x (une seconde porte).
  assert.match(source('lib/app/ecriture.ts'), /if \(await moteurEstV9\(\)\) throw new Error\('L’aperçu du dimanche n’est pas encore porté sous le moteur v1\.'\);/);
});

test('la carte « Sa semaine qui arrive » d’avant le passage : sans « Voir ce que le moteur écrirait », elle n’a de sens que si elle a une phrase', () => {
  assert.equal(carteAvantVisible(false, ''), true, 'sous la 8.x, la carte et son lien, avec ou sans phrase');
  assert.equal(carteAvantVisible(false, 'Elle changera'), true);
  assert.equal(carteAvantVisible(true, ''), false, 'sous la 9.x, un titre seul ne s’affiche pas');
  assert.equal(carteAvantVisible(true, undefined), false);
  assert.equal(carteAvantVisible(true, '   '), false);
  assert.equal(carteAvantVisible(true, 'La semaine suit le plan'), true);
  assert.equal(passeDuLundiVisible(false), true);
  assert.equal(passeDuLundiVisible(true), false);
  // La carte qui s'affiche sous la 9.x a sa phrase : celle de « Dimanche », comme avant ; son titre n'est jamais seul.
  assert.match(semaine, /\{prevision\.prevoit && \(\s*<p className="text-sm text-\[#4A4866\]">\{prevision\.prevoit\}/);
  // Les trois cartes portent encore leur phrase, leur pastille ou leur semaine quand le lien est ôté (pas_partie : sa pastille « Pas encore partie »).
  assert.ok(semaine.includes('Pas encore partie'));
  // L'aperçu calculé à la demande (?apercu=) ne l'est pas sous la 9.x : la page de l'athlète passe toujours son `v9`.
  assert.match(athlete, /semainesQuiArrivent\(ecrites, jour, apercu \?\? null, v9\)/);
  assert.match(source('lib/app/semaineQuiArrive.ts'), /export async function semainesQuiArrivent\(ecrites: SemaineDuDimanche\[\], jour: string, apercu: string \| null, v9 = false\)/);
});

// ─── (b) les courses de préparation ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('sous la 9.x, toutes ses courses de Nolio se voient, et chacune laisse le choix : objectif principal ou course secondaire (le coach, 27/11/2026)', () => {
  const contexte = { prochain: 'p1', ecrit: true, lundiProchain: '2026-11-30', dateProchain: '2027-03-14' };
  const bDedans = { id: 'b1', type: 'b', date: '2027-01-17' };
  const courses = [{ id: 'a', type: 'a', date: '2027-03-14' }, bDedans, { id: 'b2', type: 'b', date: '2026-11-28' }, { id: 'c', type: null, date: '2027-01-10' }];
  assert.deepEqual(courses.filter((c) => estUneCourseEnPreparation(c, contexte)).map((c) => c.id), ['b1']);
  assert.equal(estUneCourseEnPreparation(bDedans, { ...contexte, prochain: null }), false, 'sans objectif en cours');
  assert.equal(estUneCourseEnPreparation(bDedans, { ...contexte, ecrit: false }), false, 'un objectif envoyé en entier n’a pas de préparation à enrichir');
  assert.equal(estUneCourseEnPreparation({ ...bDedans, date: '2027-03-14' }, contexte), false, 'le jour de la course, plus de préparation');
  // Plus aucune course écartée ; sous la 8.x, le lien d'avant.
  assert.ok(athlete.includes('const coursesNolio = coursesPosees;'));
  assert.ok(athlete.includes('const preparation = enPreparation(c);'));
  assert.ok(athlete.includes('{!v9 && (') && athlete.includes("{preparation ? 'En préparation ›' : 'Créer l’objectif ›'}"));
  // Sous la 9.x, les deux choix sur chaque course, sans condition de type.
  assert.match(athlete, /\{v9 && \(\n\s+<div className="basis-full flex flex-wrap items-start gap-2">\n\s+<Link href=\{lienObjectif\} className=\{BOUTON_COURSE\}>Objectif principal ›<\/Link>/);
  assert.ok(athlete.includes('Course secondaire ›</summary>'));
  // La secondaire : avant l'objectif qui la suit, écrit semaine par semaine, à partir de lundi prochain ; sinon, dite avec sa raison.
  assert.ok(athlete.includes("const pourSecondaire = suivant && c.date >= lundiProchain && parPlan.get(suivant.plan_id)?.parametres ? suivant : null;"));
  assert.ok(athlete.includes('<AjouterCourse planId={pourSecondaire.plan_id} initial={{ nom: c.nom, date: c.date, distance_km: c.distance_km, dplus_m: c.dplus_m, chrono: c.chrono }} sansMode />'));
  assert.ok(athlete.includes('Une course secondaire se place avant un objectif principal : crée d’abord l’objectif qui la suit.'));
  assert.match(athlete, /const courseA = coursesPosees\.find\(\(c\) => c\.type === 'a'\) \?\? null;/);
});

test('les courses de préparation : la section de la page de l’objectif, ses liens et l’onglet restent cachés sous la 9.x ; leur saisie est dans « Ses objectifs » (C5, 25/11/2026)', () => {
  assert.equal(preparationsDisponibles(false), true);
  assert.equal(preparationsDisponibles(true), false);
  // Page de l'athlète : plus de section « Ses courses de préparation » sous la 9.x, ni de texte, ni de calcul ; l'ordre de « Réglages » ne la porte plus.
  const code = sansCommentaires(athlete);
  assert.ok(!/TEXTES_PAGE_ATHLETE\.preparations|const preparations\b|\bpreparations\.(map|length)/.test(code));
  const pa = source('lib/app/pageAthleteSimple.ts');
  assert.ok(!/preparations/.test(sansCommentaires(pa)), 'ni la section, ni son texte, ni sa place');
  // Sous la 8.x, la page de l'athlète garde ses courses de préparation dans « Ses objectifs » et la page de l'objectif sa carte entière.
  assert.ok(athlete.includes('<span className="text-[0.84rem]"><strong>{c.nom}</strong> · préparation · {c.distance_km} km'));
  for (const t of ['Ses courses de préparation', 'Aucune pour l’instant.', '+ Ajouter une course de préparation', '<AjouterCourse planId={id} initial={depuisNolio} />', '<ModifierCourse planId={id} course={c} />',
    '<RetirerCourse planId={id} date={c.date} nom={c.nom} />']) assert.ok(plan.includes(t), t);
  // Chaque lien vers le formulaire (#ajouter-course) est derrière la règle de la 9.x : le lien « En préparation » de la page de l'athlète (filtré) et l'onglet de « Nouvel objectif » (gardé).
  assert.deepEqual(grep('#ajouter-course', 'app/app/coach', 'components/app/SemaineQuiArrive.tsx', 'components/app/TableauAthletes.tsx', 'components/app/AFaire.tsx', 'components/app/PointsPourLui.tsx'), [ATHLETE, NOUVEAU].sort());
  assert.ok(plan.includes('<Carte id="ajouter-course"'), 'la carte est la cible de ces deux liens, sous la 8.x');
  assert.match(source(NOUVEAU), /\{court && !aModifier && !demande && preparationsDisponibles\(v9\) && \(\s*<div role="group" aria-label="Genre d’objectif"[^]*?Course de préparation[^]*?<\/div>\s*\)\}/);
  // Le serveur : sous la 9.x, un acheteur n'a pas de course de préparation (refusée) ; un coaché l'ajoute, sans le moteur de la 8.x (scripts/test-routes-retirees.mjs, scripts/test-courses-mineures.mjs).
  assert.match(source('lib/app/actionsEcriture.ts'), /if \(v9 && !o\.coache\) return \{ ok: false, message: MESSAGE_COURSE_DE_PREPARATION_FERMEE \};/);
});

// ─── (c) la saison de fond ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('la saison de fond : sous la 9.x, la ligne d’un athlète dont le prochain « objectif » est une saison se lit comme celle d’un athlète sans objectif', () => {
  const saison = { course_nom: 'Saison', course_date: '2027-08-20', fond: { saison: 1, theme: 'Vitesse', tests_dans: 3 } };
  const course = { course_nom: 'Trail', course_date: '2027-03-14' };
  assert.equal(objectifSansSaison(saison, false), saison, 'sous la 8.x, la même ligne');
  assert.equal(objectifSansSaison(saison, true), null);
  assert.equal(objectifSansSaison(course, true), course, 'un vrai objectif n’est pas touché');
  assert.equal(objectifSansSaison(null, true), null);
  // Les étiquettes ne sont écrites qu'à un endroit, derrière la même fonction ; les trois appels sont ceux de la ligne, de la colonne « Sa semaine » et des filtres.
  const t = source(TABLEAU);
  assert.equal((t.match(/objectifSansSaison\(/g) ?? []).length, 3, 'trois lectures de l’objectif : les filtres (categorie), la colonne « Sa semaine » (SaSemaine) et la ligne (Ligne)');
  assert.match(t, /<SaSemaine e=\{e\} jour=\{jour\} v9=\{v9\} \/>/);
  assert.match(t, /categorie\(e, jour, v9\) === f/);
  for (const m of ['Saison de fond', 'Bloc ${o.fond.theme}', 'tests dans ${o.fond.tests_dans} sem.', 'semaine de tests']) assert.ok(t.includes(m), `${m} : la 8.x garde ses étiquettes`);
});

test('la saison de fond : ni son lien ni sa date de fin sous la 9.x (ses mots seuls) ; ses points sont dits ; la 8.x garde son lien « en cours »', () => {
  const o = sansCommentaires(source(OBJECTIFS));
  assert.ok(!/saison|Saison|en cours/.test(o), 'ObjectifsAVerifier ne sait plus rien de la saison');
  assert.ok(!/saison9|saisonEnCours/.test(sansCommentaires(source('app/app/coach/athlete/[id]/page.tsx').split('{v9 ? (')[1].split('      ) : (')[0])), 'la branche 9.x non plus');
  assert.ok(athlete.includes('{saisonEnCours && ('), 'la 8.x garde son lien');
  assert.ok(athlete.includes('<span className="block text-[0.9375rem] font-bold">{saisonEnCours.course_nom} · en cours</span>'));
  // Les points : la v1 écrit les saisons, « Saison de fond refusée » et « Profil à remplir » sont dits ; la carte « Ce que j'ai besoin de savoir » dit ce qui manque de lui.
  assert.ok(!('saison' in GENRES_CACHES_9X) && !('profil' in GENRES_CACHES_9X));
  assert.ok(source('components/app/CarteSavoir.tsx').includes('<span>{repere}</span>') && source(ATHLETE).includes('const etatCarte = etatDeLaCarte('));
  // Ses 7 jours, rien de lu : la phrase de la 9.x est celle de la 8.x sans « ou une saison » (étape 5 : et sans « Hooper », « sa fatigue déclarée » à la place).
  assert.equal(TEXTES_CACHES.septJoursVide, 'Rien de lu pour l’instant. Ses séances et sa fatigue déclarée des 7 derniers jours se lisent dans Nolio chaque soir, dès qu’un objectif a démarré. « Relire maintenant » les lit tout de suite.');
  assert.ok(athlete.includes('Rien de lu pour l’instant. Ses séances et son Hooper des 7 derniers jours se lisent dans Nolio chaque soir, dès qu’un objectif ou une saison a démarré. « Relire maintenant » les lit tout de suite.'), 'la phrase de la 8.x : mot pour mot, avec « ou une saison »');
});

// ─── (d) les tests lus ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('les tests lus : cachés sous la 9.x ; le geste « Saisir son test de vitesse critique » et son test sur la carte restent', () => {
  assert.equal(testsLusDisponibles(false), true);
  assert.equal(testsLusDisponibles(true), false);
  // La page de l'objectif ne lit même pas la table sous la 9.x ; ses lignes (et « Ses cibles et ses zones ont suivi ») n'ont alors rien à montrer.
  assert.ok(plan.indexOf('testsLusDisponibles(v9)') < plan.indexOf("from('tests_lus')"));
  assert.ok(plan.includes('Ses cibles et ses zones ont suivi.') && plan.includes("const TESTS: Record<string, string>") && plan.includes('const STATUTS'));
  // Le geste du coach et sa carte : inchangés, sous la 9.x comme sous la 8.x.
  assert.ok(athlete.includes('<TestVcCoach athleteId={a.id} aujourdhui={jour} />'));
  assert.ok(athlete.includes('Saisir son test de vitesse critique'));
  // Sous la 9.x, son test est dans la carte « Ce que j'ai besoin de savoir », enregistré par le même geste, avec la phrase sans lecture dans Nolio.
  const carte = source('components/app/CarteSavoir.tsx');
  assert.ok(carte.includes('id="geste-test-vc"') && carte.includes('enregistrerTestVc(athleteId, null,') && athlete.includes('<CarteSavoir'));
  assert.ok(athlete.includes('aideDuTest: TEXTES_CACHES.testSaisi'));
  // Sa phrase d'explication : celle de la 8.x, mot pour mot ; sous la 9.x, sans la lecture dans Nolio ni le test « marqué lu ».
  const ancienne = 'S’il ne l’a pas fait dans l’app, ou si sa lecture dans Nolio n’a pas abouti : ses deux efforts donnent sa vitesse\n            critique et son profil de coureur. Un test écrit dans ses semaines et pas encore lu est alors marqué lu.';
  assert.ok(athlete.includes(ancienne));
  // Étape 5 (décision 220) : « vitesse critique » reste, c'est le mot du coach.
  assert.equal(TEXTES_CACHES.testSaisi, 'S’il ne l’a pas fait dans l’app : ses deux efforts donnent sa vitesse critique et son profil de coureur.');
  assert.ok(!/Nolio|lu\b/.test(TEXTES_CACHES.testSaisi));
  // Le point « Test à revoir » : ôté (voir plus haut). Le test saisi par le coach reste écrit comme avant (rien de lu ni d'écrit de plus).
  assert.ok('test' in GENRES_CACHES_9X);
  assert.ok(source('lib/app/coaching.ts').includes("service.from('tests_lus').upsert("), 'enregistrerTestVc est inchangée');
});

// ─── (f) ce qui n'est pas caché, après vérification ──────────────────────────────────────────────────────────────────────────────────────

test('« course Nolio » → « Créer l’objectif » et « prérequis du marathon » ne reposent sur rien que la 9.x doive écrire : ils restent', () => {
  // La course A se lit dans Nolio par le site (jamais par le moteur) ; « Créer l'objectif » ouvre le questionnaire, que la 9.x lit encore.
  const e = source('lib/app/espaceCoach.ts');
  assert.ok(e.includes("genre: 'course_nolio'") && e.includes('action: \'Créer l’objectif ›\''));
  const c = source('lib/app/coursesNolio.ts');
  assert.ok(c.includes('planned/competitions/') && !/\/v1\//.test(sansCommentaires(c)), 'la lecture des courses de Nolio n’appelle aucune route du moteur');
  // Les prérequis du marathon : un calcul sur les réponses du questionnaire (volume, sortie longue, premier marathon).
  assert.ok(!/\/v1\//.test(sansCommentaires(source('lib/app/route.ts'))), 'le calcul n’appelle aucune route du moteur');
  assert.match(prerequisMarathon({ format: 'R42', volume_hebdo_actuel: '2h30', sortie_longue_actuelle: '1h00' }, 30), /moins de 3 h de course par semaine, une plus longue sortie sous 1h15/);
  assert.equal(prerequisMarathon({ format: 'R21', volume_hebdo_actuel: '2h' }, 30), null);
  assert.ok(!('course_nolio' in GENRES_CACHES_9X) && !('prerequis' in GENRES_CACHES_9X));
});

// ─── Les blocs supprimés ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('« Corriger avant l’envoi » et « Tes corrections avant l’envoi » : supprimés, avec leur code, leurs gestes, leurs textes et leur lecture', () => {
  assert.ok(!existsSync(`${RACINE}lib/app/corrections.ts`), 'lib/app/corrections.ts est supprimé');
  const fichiers = grep('.', 'app', 'components', 'lib').filter((f) => /\.(ts|tsx)$/.test(f));
  const code = fichiers.map((f) => [f, sansCommentaires(source(f))]);
  for (const mot of ['CorrigerSemaine', 'choisirCorrections', 'annulerCorrections', 'correctionsComptees', 'choixDeLaSemaine', 'garderLeChoix', 'annulerLeChoix', 'correctionsAEnvoyer',
    'marquerAppliquees', 'appliqueesDuJournal', 'CORRECTIONS_ACTIVES', 'corrections_semaine', 'Corriger avant l’envoi', 'Tes corrections avant l’envoi', 'Garder pour dimanche', 'Retirer mes corrections',
    'RAISONS', "from './corrections'", "lib/app/corrections'"]) {
    assert.deepEqual(code.filter(([, c]) => c.includes(mot)).map(([f]) => f), [], `${mot} n’est plus nulle part`);
  }
  // L'aperçu et « Chiffres » n'ont plus de bloc de corrections ; « Tes retouches dans Nolio » et « Semaines envoyées sans retouche » restent.
  const chiffres = source(CHIFFRES);
  assert.ok(!/orrections|CORRECTIONS|RAISONS/.test(chiffres));
  assert.ok(chiffres.includes('Tes retouches dans Nolio') && chiffres.includes('Semaines envoyées sans retouche') && chiffres.includes('<Retouches r={c.retouches} enCours={c.lundi} />'));
  assert.ok(!/orrections|CORRECTIONS|choix/.test(sansCommentaires(source(APERCU))));
  // Ce qui est gardé parce que d'autres le lisent : les noms des quatre corrections, pour le journal du moteur en clair (l'entrée « COACH » d'un journal déjà écrit).
  const t = source('lib/app/correctionsTextes.ts');
  assert.deepEqual([...sansCommentaires(t).matchAll(/export (const|type) (\w+)/g)].map((m) => m[2]), ['CORRECTIONS', 'Correction']);
  assert.ok(source('lib/app/journalEnClair.ts').includes("import { CORRECTIONS, type Correction } from './correctionsTextes';"));
  assert.deepEqual(grep("from '[^']*correctionsTextes'", 'app', 'components', 'lib'), ['lib/app/journalEnClair.ts']);
  // Le corps envoyé au moteur de la 8.x est celui d'avant : sans correction choisie (l'interrupteur était éteint), il n'en portait pas.
  const corps = source('lib/app/ecriture.ts');
  const debut = corps.indexOf('async function corpsDeLaSemaine(');
  const fin = corps.indexOf('\n}\n', debut);
  const retour = sansCommentaires(corps.slice(debut, fin));
  assert.ok(!/\bcorrections\b/.test(retour));
  for (const c of ['parametres', 'numero', 'etat', 'retours', 'sans_ajustement', 'valeurs', 'reprise', 'charges_avant', 'sl_avant', 'historique']) assert.ok(new RegExp(`\\b${c}\\b`).test(retour), c);
  // Les actions de « Gestes » qui restent sont celles d'avant.
  assert.match(source('lib/app/actionsEcriture.ts'), /export async function arreterPreparationRemboursee\(/);
});

test('les quatre pages de redirection mortes ne sont pas supprimées (la 8.x et d’anciens liens) ; plus aucun lien du code n’y mène', () => {
  for (const f of ['app/app/coach/a-regarder/page.tsx', 'app/app/coach/dimanche/page.tsx', 'app/app/coach/dimanche/rapport/page.tsx', 'app/app/coach/mes-athletes/page.tsx', 'app/app/coach/suivi/route.ts']) {
    assert.ok(existsSync(`${RACINE}${f}`), f);
  }
  assert.deepEqual(grep('coach/(a-regarder|dimanche|mes-athletes|suivi)', 'app', 'components', 'lib', 'proxy.ts', 'next.config.mjs', 'vercel.json').sort(), [], 'aucun lien du code, ni redirection ailleurs');
  // « Urgent » est lié par la 8.x seulement (le bandeau de « Mes athlètes »), les e-mails d'avant et le menu 8.x.
  assert.ok(grep('/app/coach/urgent', 'app', 'components', 'lib').includes('app/app/coach/page.tsx'));
});

// ─── Les textes, la garde ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('les textes nouveaux : lus par le coach seul, apostrophe typographique, phrases courtes, sans les mots à bannir', () => {
  assert.deepEqual(Object.keys(TEXTES_CACHES), ['testSaisi', 'septJoursVide']);
  for (const [cle, t] of Object.entries(TEXTES_CACHES)) {
    assert.ok(!/\w'\w/.test(t), `${cle} : apostrophe droite`);
    assert.ok(!/trame|pilier|charge tenue|\bmarche\b|\bdose\b/i.test(t), `${cle} : jargon`);
    assert.ok(t.length < 200 && t === t.trim(), cle);
  }
  // Le fichier n'est lu que par l'espace coach : ses pages, ses deux composants du coach et deux lectures du coach.
  assert.deepEqual(grep("from '[^']*cacherSousLaV1'", 'app', 'components', 'lib'), [
    APERCU, ATHLETE, NOUVEAU, PLAN, SEMAINE, TABLEAU, 'lib/app/mesAthletes.ts', 'lib/app/semaineQuiArrive.ts',
  ].sort());
  assert.deepEqual(grep("from '[^']*cacherSousLaV1'", 'app/app/coach', 'components/app/SemaineQuiArrive.tsx', 'components/app/TableauAthletes.tsx').length, 6);
  for (const nom of ['SemaineQuiArrive', 'TableauAthletes']) {
    const dehors = grep(`components/app/${nom}'`, 'app', 'components', 'lib');
    assert.ok(dehors.every((f) => f.startsWith('app/app/coach/')), `${nom} n’est montré qu’à l’espace coach`);
  }
  assert.deepEqual(grep("from '[^']*semaineQuiArrive'", 'app', 'components', 'lib').filter((f) => !f.startsWith('app/app/coach/') && !f.startsWith('components/app/')), [], 'lib/app/semaineQuiArrive.ts n’est lu que par le coach');
  // Seul texte lu hors d'un écran du coach : aucun. Les textes ne sont pas dans un module que l'athlète lit.
  assert.deepEqual(grep('TEXTES_CACHES', 'app', 'components', 'lib'), [ATHLETE, 'lib/app/cacherSousLaV1.ts'].sort());
});

test('la garde : chaque écran lit le moteur lui-même, et rien de ce qui est caché ne se rend sans `v9`', () => {
  for (const f of [PLAN, ATHLETE, NOUVEAU]) assert.match(source(f), /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/, f);
  assert.match(source(APERCU), /apercuDisponible\(await moteurEstV9\(\)\.catch\(\(\) => false\)\)/);
  assert.match(source('lib/app/mesAthletes.ts'), /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/);
  // La version est lue avant d'être lue par un autre : la page de l'objectif lit `v9` avant sa première lecture de la base.
  assert.ok(plan.indexOf('const v9 = await moteurEstV9()') < plan.indexOf("from('plans')"));
  // Les composants reçoivent `v9` de leur page : ils ne lisent pas le moteur.
  assert.ok(!/moteurEstV9/.test(sansCommentaires(semaine)) && !/moteurEstV9/.test(sansCommentaires(source(TABLEAU))));
  assert.match(athlete, /<SemainesQuiArrivent semaines=\{semaines\}[^]*?v9=\{v9\}/);
  // Les fonctions pures ne lisent rien : ni réseau, ni base, ni import.
  assert.ok(!/^import /m.test(source('lib/app/cacherSousLaV1.ts')));
});
