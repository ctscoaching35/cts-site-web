#!/usr/bin/env node
/**
 * L'ESPACE COACH SIMPLE SOUS LA 9.x, SIXIÈME ÉTAPE (décision 220 du coach, 24/11/2026, suite ; reports/Application coach — revue de simplicité, 24-11.md) : quatre points.
 *   (i)   « SA SEMAINE PASSÉE » ne se montre que s'il y a un réalisé à montrer (le moteur v1 n'en écrit pas) : le bloc de la page de l'athlète, la colonne de « Mes athlètes » (en-tête compris),
 *         la légende de « Semaine par semaine » ; piloté par la donnée. « Ses 7 jours » n'est pas touché.
 *   (ii)  les messages techniques renvoyés au coach après un geste (la clé de l'API Nolio, CTS_CLE_COACH, « la migration du … est-elle passée ? ») deviennent une phrase simple sous la 9.x, le détail au journal.
 *   (iii) le « Réessayer » d'une ancienne saison de fond de la 8.x ne s'affiche plus sous la 9.x (il ne pourrait pas réussir).
 *   (iv)  un lien vers un réglage (une ancre dans « Réglages », replié) ouvre « Réglages » sous la 9.x.
 * Sous la 8.x, RIEN ne change. Les écrans ne se rendent pas ici : le calcul est essayé (lib/app/semainePasseeSimple.ts, erreursDuCoach.ts, reessayerDeSaison.ts, ancresDuReglage.ts) et chaque morceau
 * est lu dans le source de son écran, derrière `v9`. Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-espace-coach-simple-6.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

const passee = await import(`${RACINE}lib/app/semainePasseeSimple.ts`);
const erreurs = await import(`${RACINE}lib/app/erreursDuCoach.ts`);
const saison = await import(`${RACINE}lib/app/reessayerDeSaison.ts`);
const ancres = await import(`${RACINE}lib/app/ancresDuReglage.ts`);
const { MOTS_DU_COACH } = await import(`${RACINE}lib/app/motsDuCoach.ts`);
const { moteurEstV9, oublierLaVersionDuMoteur } = await import(`${RACINE}lib/app/moteurEnLigne.ts`);

const ATHLETE = 'app/app/coach/athlete/[id]/page.tsx';
const PLAN = 'app/app/coach/plan/[id]/page.tsx';
const TABLEAU = 'components/app/TableauAthletes.tsx';
const ECRIT = 'lib/app/ecriture.ts';
const page = source(ATHLETE);
const plan = source(PLAN);
const tableau = source(TABLEAU);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// (i) « SA SEMAINE PASSÉE »
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const RIEN = { semaine: null, hooper: null };
const SEMAINE = { semaine: { faites: 3, prevues: 4, tenue: 87, sansRpe: false }, hooper: null };
const HOOPER = { semaine: null, hooper: { valeur: 9, tendance: 'hausse' } };

test('le réalisé d’une semaine n’est écrit par aucune chaîne du moteur v1 : la colonne `realise` n’a que les écritures de la 8.x et du résumé de la nuit', () => {
  // Les fichiers de la chaîne de la 9.x ne disent pas même le mot, hors commentaires : ni lecture ni écriture du réalisé.
  for (const f of ['ecritureV9', 'stockageV9', 'passagesV9', 'moteurV9', 'passeUnPlanV9', 'departV9', 'dimancheV9', 'lundiV9', 'nolioV9', 'rappelDimancheV9', 'parametresPlanV9', 'gpxV9', 'traceV9']) {
    assert.ok(!/\brealise\b/.test(sansCommentaires(source(`lib/app/${f}.ts`))), `lib/app/${f}.ts n’écrit ni ne lit le réalisé`);
  }
  // La semaine du moteur v1 est gardée sans `realise` : ni la colonne dans son `upsert`, ni `SortieV9` pour la porter.
  const stockage = sansCommentaires(source('lib/app/stockageV9.ts'));
  const garder = stockage.slice(stockage.indexOf('export async function garderUneEcriture'), stockage.indexOf('export async function garderLEtat'));
  assert.match(garder, /from\('semaines_ecrites'\)\.upsert\(\{\s*plan_id: planId, numero: cleDeLaSemaine\(ecrite\.numero\), donnees: ecrite\.semaine,/);
  assert.ok(!/realise/.test(garder));
  // Qui écrit la colonne (`semaines_ecrites` ou `semaines_athlete`), dans tout le code : la 8.x, le résumé de la nuit des semaines hors moteur, et deux effacements.
  const ecrivains = grep('(semaines_ecrites|semaines_athlete)', 'app', 'lib').filter((f) => /\.(update|upsert)\(\{[^}]*\brealise\b/.test(sansCommentaires(source(f))));
  assert.deepEqual(ecrivains, ['lib/app/actionsSuivi.ts', ECRIT, 'lib/app/semainesNolio.ts'].sort());
  // Ceux qui ne vident pas : exactement deux dans ecriture.ts (le rangement de la semaine de la 8.x, le résumé refait la nuit), un dans semainesNolio.ts (les semaines hors moteur).
  const e = sansCommentaires(source(ECRIT));
  const ecritures = [...e.matchAll(/\.(?:update|upsert)\(\{ realise(?::\s*([^}]*?))? \}\)/g)].filter((m) => m[1] !== 'null');
  assert.equal(ecritures.length, 2);
  const fonctionDe = (i) => [...e.slice(0, i).matchAll(/\n(?:export )?async function (\w+)/g)].pop()[1];
  assert.deepEqual(ecritures.map((m) => fonctionDe(m.index)).sort(), ['envoyerEtRanger', 'refaireLesResumes']);
  assert.equal((sansCommentaires(source('lib/app/semainesNolio.ts')).match(/semaines_athlete'\)\s*\.upsert\(\{ athlete_id: f\.id, lundi, realise,/g) ?? []).length, 1);
  assert.ok(!/realise: (?!null)/.test(sansCommentaires(source('lib/app/actionsSuivi.ts'))), 'actionsSuivi.ts ne fait que vider');
});

test('les écrivains de la 8.x ne sont pas atteints sous la 9.x : chaque chemin vers `envoyerEtRanger` et `refaireLesResumes` est refusé sous le moteur v1', () => {
  const e = sansCommentaires(source(ECRIT));
  // Cinq occurrences : sa définition et ses quatre appels.
  assert.equal((e.match(/\benvoyerEtRanger\(/g) ?? []).length, 5);
  // L'écriture d'une semaine (ecrireEtEnvoyer) et la récupération passent par `semaineDuMoteur` / `recuperationDuMoteur`, qui refusent d'abord sous la 9.x.
  assert.match(e, /async function semaineDuMoteur\([^]*?\): Promise<SortieMoteur> \{\n\s*await refuserSousLeMoteurV1\(`La semaine \$\{numero\}`\);/);
  assert.match(e, /const recuperationDuMoteur = async \([^\n]*\n\s*await refuserSousLeMoteurV1\(`La récupération \$\{numero\}`\);/);
  assert.match(e, /async function refuserSousLeMoteurV1\(quoi: string\): Promise<void> \{\n\s*if \(await moteurEstV9\(\)\) throw new Error/);
  // La passe du lundi (qui appelle `relireLaSemaine`, qui appelle `envoyerEtRanger`) ne tourne pas ; « Appliquer » non plus ; le résumé de la nuit ne refait rien.
  assert.equal((e.match(/\brelireLaSemaine\(/g) ?? []).length, 2, 'sa définition et un seul appel : la passe du lundi');
  assert.match(e, /export async function passageDuLundi\([^\n]*\n\s*if \(await moteurEstV9\(\)\) return \[\];/);
  assert.match(e, /export async function appliquerLaSemaineDuLundi\([^\n]*\n\s*if \(await moteurEstV9\(\)\) throw new Error/);
  assert.match(e, /export async function refaireLesResumes\(budgetMs = 120_000\): Promise<Compte\[\]> \{\n\s*if \(await moteurEstV9\(\)\) return \[\];/);
  // Le « Réessayer » de la 9.x passe par la chaîne de passagesV9.ts, sans réalisé.
  assert.match(e, /if \(await moteurEstV9\(\)\) \{\n\s*if \(o\.envois[^\n]*\n[^\n]*\n\s*\}\n\s*const \{ ecrireLaSemaineDemandee \} = await import\('\.\/passagesV9'\);/);
});

test('le résumé de la nuit saute les semaines que le moteur a écrites (celles de la 9.x comprises) : il ne résume que les semaines hors moteur', () => {
  const n = sansCommentaires(source('lib/app/semainesNolio.ts'));
  assert.match(n, /async function lundisEcrits\(planIds: string\[\]\): Promise<Set<string>> \{[^]*?from\('semaines_ecrites'\)\.select\('plan_id, lundi:donnees->>lundi'\)\.in\('plan_id', planIds\)/);
  assert.match(n, /const aResumer = lundis\.filter\(\(l\) => !ecrits\.has\(l\)\);/);
  // La semaine du moteur v1 garde son lundi dans `donnees` (la clé que `lundisEcrits` lit) : le moteur la rend avec son lundi, le site le vérifie, le stockage la garde telle quelle.
  assert.match(sansCommentaires(source('lib/app/ecritureV9.ts')), /sortie\.semaine\.lundi !== undefined && sortie\.semaine\.lundi !== lundi/);
  assert.match(sansCommentaires(source('lib/app/stockageV9.ts')), /donnees: ecrite\.semaine,/);
});

test('la semaine passée n’existe que si la donnée est là : `semaine` ou `hooper` ; le même critère que le « — » de la colonne d’avant', () => {
  assert.equal(passee.aUneSemainePassee(RIEN), false);
  assert.equal(passee.aUneSemainePassee(SEMAINE), true);
  assert.equal(passee.aUneSemainePassee(HOOPER), true);
  assert.equal(passee.aUneSemainePassee({ semaine: SEMAINE.semaine, hooper: HOOPER.hooper }), true);
  // La colonne d'avant disait « — » dans ce seul cas.
  assert.ok(tableau.includes('if (!s && !a.hooper) return <span className="text-[#5E5C78]">—</span>;'));
  // Et la ligne d'un athlète en dit autant : `semaine` et `hooper` viennent de son résumé de la semaine passée (null sans lui).
  const c = source('lib/app/espaceCoach.ts');
  assert.ok(c.includes('semaine: rPassee && rPassee.seances_prevues ? {'));
  assert.ok(c.includes('hooper: hooperPasse !== null ? {'));
});

test('sous la 8.x, la semaine passée et sa colonne sont toujours là ; sous la 9.x, seulement avec un réalisé', () => {
  for (const a of [RIEN, SEMAINE, HOOPER]) assert.equal(passee.semainePasseeVisible(false, a), true, 'la 8.x : toujours, avec ses « — »');
  assert.equal(passee.semainePasseeVisible(true, RIEN), false);
  assert.equal(passee.semainePasseeVisible(true, SEMAINE), true);
  assert.equal(passee.semainePasseeVisible(true, HOOPER), true);
  // La colonne : aucun athlète affiché n'a de réalisé, elle disparaît ; un seul suffit pour la garder.
  const ligne = (a) => ({ a });
  assert.equal(passee.colonnePasseeVisible(true, []), false);
  assert.equal(passee.colonnePasseeVisible(true, [ligne(RIEN), ligne(RIEN)]), false);
  assert.equal(passee.colonnePasseeVisible(true, [ligne(RIEN), ligne(HOOPER)]), true);
  assert.equal(passee.colonnePasseeVisible(true, [ligne(SEMAINE)]), true);
  assert.equal(passee.colonnePasseeVisible(false, []), true);
  assert.equal(passee.colonnePasseeVisible(false, [ligne(RIEN)]), true);
});

test('la légende de « Mes athlètes » : sans la colonne, ses deux lignes (« Part du prévu », « Fatigue déclarée ») s’en vont, « Objectif » reste ; sous la 8.x, rien ne change', () => {
  const simple = MOTS_DU_COACH.simple.legendeDesChiffres;
  assert.equal(simple.length, 3);
  assert.deepEqual(passee.legendeSansLaColonnePassee(simple, true), simple);
  const reste = passee.legendeSansLaColonnePassee(simple, false);
  assert.equal(reste.length, 1);
  assert.match(reste[0], /^Objectif : /);
  assert.deepEqual(passee.LEGENDE_DE_LA_COLONNE_PASSEE, ['Part du prévu', 'Fatigue déclarée']);
  // La 8.x n'a pas de légende de ses chiffres : rien à ôter, et la colonne y est toujours.
  assert.deepEqual(MOTS_DU_COACH.ancien.legendeDesChiffres, []);
  assert.deepEqual(passee.legendeSansLaColonnePassee(MOTS_DU_COACH.ancien.legendeDesChiffres, false), []);
});

test('« Semaine par semaine » : la légende de ses chiffres n’est dite que si une semaine écrite en a ; une semaine du moteur v1 n’en a pas', () => {
  const legende = MOTS_DU_COACH.simple.semaines.legende;
  assert.equal(legende.length, 3);
  const ecriteParLaV1 = { numero: 'S5', realise: null };
  const ecriteParLa8x = { numero: 'S4', realise: { numero: 'S4', seances_faites: 3 } };
  assert.deepEqual(passee.legendeDesSemainesLues(legende, [ecriteParLaV1], true), []);
  assert.deepEqual(passee.legendeDesSemainesLues(legende, [], true), []);
  assert.deepEqual(passee.legendeDesSemainesLues(legende, [ecriteParLaV1, ecriteParLa8x], true), legende);
  // Sous la 8.x, sa légende est vide : la même, quoi qu'il y ait.
  assert.deepEqual(passee.legendeDesSemainesLues(MOTS_DU_COACH.ancien.semaines.legende, [ecriteParLaV1], false), []);
  assert.deepEqual(passee.legendeDesSemainesLues(legende, [ecriteParLaV1], false), legende, 'sous la 8.x, la fonction ne retire rien');
});

test('« Mes athlètes » : la colonne, son en-tête, sa phrase de dates et ses lignes de légende ne se rendent que derrière `avecPassee` ; la 8.x garde ses six colonnes', () => {
  // Le calcul : un seul, sur les lignes affichées (celles que le filtre garde).
  assert.ok(tableau.includes('const avecPassee = colonnePasseeVisible(v9, lignes);'));
  assert.ok(tableau.includes('const legendeDesChiffres = legendeSansLaColonnePassee(mots.legendeDesChiffres, avecPassee);'));
  // L'en-tête, la phrase de ses dates, la liste de légende (sa condition d'avant est restée), la cellule de chaque ligne.
  assert.ok(tableau.includes('<span>Sa semaine</span>{avecPassee && <span>Semaine passée</span>}<span>Ce qui l’attend</span>'));
  assert.match(tableau, /\{avecPassee && \(\s*<p className="py-1\.5 text-\[0\.72rem\] text-\[#5E5C78\] border-b border-indigo\/\[0\.06\]">\s*\{mots\.entetePassee\(dateAbregee\(passee\), dimanche\)\}\s*<\/p>\s*\)\}/);
  assert.ok(tableau.includes('{mots.legendeDesChiffres.length > 0 && ('));
  assert.ok(tableau.includes('{legendeDesChiffres.map((t) => <li key={t}>{t}</li>)}'));
  assert.ok(tableau.includes('{e.avecPassee && <SemainePassee a={a} v9={v9} />}'));
  assert.ok(tableau.includes('lignes.map((e) => <Ligne key={e.id} e={{ ...e, avecPassee }} jour={jour} v9={v9} />)'));
  // Les gabarits : six colonnes comme avant, cinq sans la colonne, les mêmes proportions.
  assert.ok(tableau.includes("const COLONNES = 'grid-cols-[1.45fr_1.2fr_1.05fr_1.05fr_2.05fr_16px]';"));
  assert.ok(tableau.includes("const COLONNES_SANS_PASSEE = 'grid-cols-[1.45fr_1.2fr_1.05fr_2.05fr_16px]';"));
  assert.equal((tableau.match(/, avecPassee \? COLONNES : COLONNES_SANS_PASSEE\)\}>/g) ?? []).length, 1, 'l’en-tête');
  assert.equal((tableau.match(/, e\.avecPassee \? COLONNES : COLONNES_SANS_PASSEE\)\}>/g) ?? []).length, 1, 'chaque ligne');
  // Sous la 8.x, `colonnePasseeVisible(false, …)` est vrai : rien de ce qui est derrière `avecPassee` ne disparaît ; le composant ne lit pas le moteur lui-même.
  assert.ok(!/moteurEstV9/.test(sansCommentaires(tableau)));
  // La cellule d'une ligne sans réalisé, dans une colonne qui existe, dit toujours « — » (au moins un autre athlète en a un).
  assert.ok(tableau.includes('if (!s && !a.hooper) return <span className="text-[#5E5C78]">—</span>;'));
});

test('la page d’un athlète : « Sa semaine passée » et sa revue ne se rendent que derrière `aUneSemaine` ; « Ses 7 jours » n’est pas touché ; la 8.x garde sa carte', () => {
  assert.match(page, /const aUneSemaine = semainePasseeVisible\(v9, \{ semaine: s, hooper \}\);/);
  // Le bloc : sa colonne de gauche (le titre « Sa semaine passée » avec), seulement avec un réalisé ; « Ses 7 jours » garde sa condition d'avant.
  assert.match(page, /\{aUneSemaine && \(\s*<div className="flex-\[1_1_300px\] min-w-0 space-y-3">\s*<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">\s*<Surtitre>Sa semaine passée<\/Surtitre>/);
  assert.ok(page.includes('{accord && a.nolio_athlete_id && septJoursVisibles && ('));
  assert.ok(page.includes('<Surtitre>Ses 7 jours</Surtitre>'));
  // La section de « Réglages » (9.x) : sans la semaine passée ni ses 7 jours, pas de section vide.
  assert.match(page, /const septJoursAffiches = Boolean\(accord && a\.nolio_athlete_id && septJoursVisibles\);/);
  assert.ok(page.includes('{(aUneSemaine || septJoursAffiches) && <section id="sa-semaine-passee" className="py-4 scroll-mt-6">{contenuSemainePassee}</section>}'));
  // La revue : sans réalisé (9.x), pas de « Sa semaine passée : rien de lu » ni de lien vers une section qui n'existe pas.
  assert.ok(page.includes("].filter((x) => aUneSemaine || x.ancre !== '#sa-semaine-passee');"));
  // Sous la 8.x : la carte d'avant, sans condition, avec son contenu.
  assert.match(page, /<Carte id="sa-semaine-passee" className="!p-5 scroll-mt-6">\s*\{contenuSemainePassee\}\s*<\/Carte>/);
  // « Réglages » ne promet plus « sa semaine passée » dans sa ligne d'aide (elle n'y est que s'il y a un réalisé).
  const { TEXTES_PAGE_ATHLETE } = passeeAthlete;
  assert.ok(!/semaine passée/.test(TEXTES_PAGE_ATHLETE.reglagesSous));
});
const passeeAthlete = await import(`${RACINE}lib/app/pageAthleteSimple.ts`);

test('la page d’un objectif : la légende de « Semaine par semaine » passe par `legendeDesSemainesLues` ; la 8.x garde sa condition ; la ligne d’une semaine sans réalisé dit « Écrite le … »', () => {
  assert.ok(plan.includes('const legendeDesSemaines = legendeDesSemainesLues(mots.semaines.legende, ecritesTriees, v9);'));
  assert.match(plan, /\{mots\.semaines\.legende\.length > 0 && \(\s*legendeDesSemaines\.length > 0 && \(\s*<ul className="space-y-0\.5 text-\[0\.72rem\] leading-snug text-\[#5E5C78\]">\s*\{legendeDesSemaines\.map\(\(t\) => <li key=\{t\}>\{t\}<\/li>\)\}/);
  assert.ok(plan.includes('r ? `Faite · ${r.seances_faites}/${r.seances_prevues}` : `Écrite le ${dateLongue(String(w.ecrite_le).slice(0, 10), true)}`'));
  // Le bloc entier ne disparaît pas : il porte le départ dans Nolio, la prochaine semaine, les notes et les ajustements ; ce qui se cache est ce qui parle d'un réalisé absent.
  assert.ok(plan.includes('<Surtitre>Semaine par semaine</Surtitre>'));
  assert.ok(plan.includes('<DemarrerNolio planId={id}'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// (ii) LES MESSAGES TECHNIQUES APRÈS UN CLIC
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// Les messages que le code écrit aujourd'hui (chacun est lu dans son source plus bas : la table ne s'écarte pas du code).
const TECHNIQUES_NOLIO = [
  'Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel.',
  'La variable NOLIO_API_KEY de Vercel ne contient pas une clé Nolio (elle commence par nolio_sk_) : recolle la clé, puis redéploie.',
  'Nolio a refusé la lecture (500 server_error).',
  'Nolio a refusé le bandeau du 2 déc. (422).',
];
const TECHNIQUES_MOTEUR = ['Moteur /v1/semaine : 502', 'Moteur /v1/nolio/seances : 500', 'Moteur /v1/semaine : 400 — semaine inconnue'];
const TECHNIQUES_AUTRES = [
  'Le code du coach (CTS_CLE_COACH) manque dans Vercel.',
  'L’enregistrement n’a pas abouti : la migration du 19/10/2026 est-elle passée ?',
  'L’enregistrement n’a pas abouti : la migration du 07/11/2026 (test de vitesse critique du coach) est-elle passée ?',
  'semaine 12 : plans.etat_moteur : relation absente (la migration du 24/11/2026 (état du moteur v1) est-elle passée ?)',
  'Les signaux ne sont pas gardés : à passer dans Supabase.',
  'La variable d’environnement manque dans Vercel.',
];
// Les messages que le coach lit tels quels : faits pour lui, ou qui disent un geste qu'il peut faire.
const POUR_LE_COACH = [
  'Choisis un lundi.',
  'Pas encore son accord : associe-le à Nolio, envoie-lui le message d’accord, puis coche « Accord reçu » dans le Suivi quand il a répondu oui.',
  'Ton équipe Nolio interdit l’écriture par l’API : autorise-la dans les options de l’équipe (API et MCP), puis recommence.',
  'Léa a coupé l’accès de l’API à son compte Nolio.',
  'Nolio limite le nombre d’appels pour l’instant : réessaie dans quelques minutes.',
  'Nolio n’a pas répondu en 15 s : réessaie dans un moment.',
  'Des séances que tu as posées sont déjà dans son Nolio cette semaine : elles restent les tiennes, rien ne s’écrit par-dessus.',
  'Choisis d’abord son nom dans ta liste Nolio, sur sa fiche.',
  'Ce plan ne s’écrit pas semaine par semaine (pas de Nolio relié, ou saison de fond, pas portée sous le moteur v1).',
  'Le moteur ne place aucune semaine de ce plan au lundi 2026-12-07 : son plan d’achat et la trame du moteur v1 ne tombent pas sur les mêmes semaines.',
  'Une valeur ne semble pas juste : FC entre 80 et 230, allures en min/km (par exemple 6:00 au seuil 1, 4:10 pour la vitesse critique).',
  'Allure variable sur ce terrain : prévois une marge.',
  'Rien à appliquer : la passe du lundi n’a rien gardé pour cette semaine.',
];

test('messageDuCoach : sous la 8.x, le message d’avant, mot pour mot, et rien au journal', () => {
  for (const m of [...TECHNIQUES_NOLIO, ...TECHNIQUES_MOTEUR, ...TECHNIQUES_AUTRES, ...POUR_LE_COACH]) {
    const journal = [];
    assert.equal(erreurs.messageDuCoach(m, false, (x) => journal.push(x)), m);
    assert.deepEqual(journal, []);
  }
});

test('messageDuCoach : sous la 9.x, un message technique devient une phrase simple et va au journal ; tout autre message reste tel quel', () => {
  for (const [liste, phrase] of [[TECHNIQUES_NOLIO, erreurs.TEXTES_ERREURS.nolio], [TECHNIQUES_MOTEUR, erreurs.TEXTES_ERREURS.moteur], [TECHNIQUES_AUTRES, erreurs.TEXTES_ERREURS.autre]]) {
    for (const m of liste) {
      const journal = [];
      assert.equal(erreurs.messageDuCoach(m, true, (x) => journal.push(x)), phrase, m);
      assert.deepEqual(journal, [`Message technique caché au coach : ${m}`], 'le détail est au journal');
    }
  }
  for (const m of POUR_LE_COACH) {
    const journal = [];
    assert.equal(erreurs.messageDuCoach(m, true, (x) => journal.push(x)), m, m);
    assert.deepEqual(journal, [], m);
  }
  // Le cas de l'énoncé : le refus 401 de Nolio.
  assert.equal(erreurs.messageDuCoach('Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel.', true, () => {}), 'Nolio ne répond pas pour l’instant : réessaie dans quelques minutes.');
});

test('les phrases du coach : une liste fermée, apostrophe typographique, courtes, en français courant, et elles ne se reconnaissent pas elles-mêmes comme techniques', () => {
  assert.deepEqual(Object.keys(erreurs.TEXTES_ERREURS), ['nolio', 'moteur', 'autre']);
  for (const [cle, t] of Object.entries(erreurs.TEXTES_ERREURS)) {
    assert.ok(!/\w'\w/.test(t), `${cle} : apostrophe droite`);
    assert.ok(t.length < 100 && t === t.trim() && t.endsWith('.'), cle);
    assert.ok(!/NOLIO_API_KEY|CTS_|Vercel|Supabase|migration|variable|clé|API|\/v1/i.test(t), `${cle} : un mot de l’infrastructure`);
    assert.ok(!erreurs.MESSAGES_TECHNIQUES.some(([motif]) => motif.test(t)), `${cle} se reconnaîtrait comme technique`);
    assert.equal(erreurs.messageDuCoach(t, true, () => assert.fail('la phrase simple ne se journalise pas')), t);
  }
  // Une phrase de plus au journal ne la change pas : « Nolio ne répond pas pour l’instant » est déjà le mot de la page (TEXTES_A_FAIRE.nolioMuet), avec « quelques minutes ».
  assert.equal(erreurs.TEXTES_ERREURS.nolio, 'Nolio ne répond pas pour l’instant : réessaie dans quelques minutes.');
  // Les motifs sont une liste fermée, dans l'ordre : Nolio, moteur, le reste.
  assert.deepEqual(erreurs.MESSAGES_TECHNIQUES.map(([, p]) => p), [erreurs.TEXTES_ERREURS.nolio, erreurs.TEXTES_ERREURS.moteur, erreurs.TEXTES_ERREURS.autre]);
  // Jamais le mot « variable » seul (« allure variable » est un mot du coach).
  assert.ok(!erreurs.MESSAGES_TECHNIQUES.some(([motif]) => motif.test('une allure variable sur terrain plat')));
});

test('soucisDuCoach : chaque souci dit comme ci-dessus, une phrase qui reviendrait deux fois n’est dite qu’une fois (9.x) ; sous la 8.x, tels quels', () => {
  const soucis = ['Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel.', 'Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel.', 'Léa a coupé l’accès de l’API à son compte Nolio.'];
  assert.deepEqual(erreurs.soucisDuCoach(soucis, false, () => {}), soucis);
  const journal = [];
  assert.deepEqual(erreurs.soucisDuCoach(soucis, true, (x) => journal.push(x)), [erreurs.TEXTES_ERREURS.nolio, 'Léa a coupé l’accès de l’API à son compte Nolio.']);
  assert.equal(journal.length, 2, 'les deux messages techniques sont au journal');
  assert.deepEqual(erreurs.soucisDuCoach([], true), []);
});

test('messageAuCoach lit la version du moteur lui-même (moteurEstV9, sans réponse : une 8.x) et rend le message d’avant sous la 8.x', async () => {
  const technique = 'Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel.';
  const e = sansCommentaires(source('lib/app/erreursDuCoach.ts'));
  assert.match(e, /export async function messageAuCoach\(message: string\): Promise<string> \{\s*return messageDuCoach\(message, await moteurEstV9\(\)\.catch\(\(\) => false\)\);/);
  assert.match(e, /return soucis\.length \? soucisDuCoach\(soucis, await moteurEstV9\(\)\.catch\(\(\) => false\)\) : soucis;/);
  // La version est gardée (moteurEnLigne.ts) : on la pose sans réseau, puis on lit.
  const journal = console.error;
  const lignes = [];
  console.error = (x) => lignes.push(String(x));
  try {
    oublierLaVersionDuMoteur();
    assert.equal(await moteurEstV9(async () => '8.474'), false);
    assert.equal(await erreurs.messageAuCoach(technique), technique);
    assert.deepEqual(await erreurs.soucisAuCoach([technique]), [technique]);
    oublierLaVersionDuMoteur();
    assert.equal(await moteurEstV9(async () => '9.0.0', Date.now() + 10 * 60_000), true);
    // `moteurEstV9()` relit la version gardée ; hors de sa validité elle se relirait : on garde sa lecture dans la fenêtre des 5 minutes.
    assert.equal(await erreurs.messageAuCoach('Choisis un lundi.'), 'Choisis un lundi.');
  } finally {
    console.error = journal;
    oublierLaVersionDuMoteur();
  }
});

test('où le coach reçoit le message après un geste : chaque site le passe par `messageAuCoach` / `soucisAuCoach`, la 8.x en garde le texte', () => {
  const c = sansCommentaires(source('lib/app/actionsCoaching.ts'));
  assert.ok(c.includes("import { messageAuCoach, soucisAuCoach } from './erreursDuCoach';"));
  // enregistrerValeurs et enregistrerTestVc : les soucis de Nolio (« Zones Nolio : … »).
  assert.equal((c.match(/const soucis = await soucisAuCoach\(/g) ?? []).length, 2);
  assert.ok(c.includes('const soucis = await soucisAuCoach(o ? await zonesVersNolio(o) : dernier ? [] : await zonesDeLaFicheVersNolio(athleteId));'));
  assert.ok(c.includes('const soucis = await soucisAuCoach(o ? await zonesVersNolio(o, { vc_ms, d_prime_m }) : dernier ? [] : await zonesDeLaFicheVersNolio(athleteId));'));
  // enregistrerProfil et enregistrerTestVc : les deux « la migration du … est-elle passée ? ».
  assert.ok(c.includes("message: await messageAuCoach('L’enregistrement n’a pas abouti : la migration du 19/10/2026 est-elle passée ?')"));
  assert.ok(c.includes("? await messageAuCoach('L’enregistrement n’a pas abouti : la migration du 07/11/2026 (test de vitesse critique du coach) est-elle passée ?')"));
  // envoyer et mettreAJour : ce que lève la chaîne (Nolio, le moteur).
  assert.ok(c.includes("message: await messageAuCoach(e instanceof Error ? e.message : 'L’envoi n’a pas abouti.')"));
  assert.ok(c.includes("message: await messageAuCoach(e instanceof Error ? e.message : 'La mise à jour n’a pas abouti.')"));
  assert.equal((c.match(/messageAuCoach\(/g) ?? []).length, 4);
  // Aucun de ces messages ne part sans passer par là : plus d'`e.message` brut dans un `message:` de ce fichier.
  assert.ok(!/message: e instanceof Error \? e\.message/.test(c));
  const w = sansCommentaires(source('lib/app/actionsEcriture.ts'));
  assert.ok(w.includes("import { messageAuCoach, soucisAuCoach } from './erreursDuCoach';"));
  for (const t of ['Le départ n’a pas abouti.', 'L’annulation n’a pas abouti.', 'La semaine n’est pas partie : réessaie dans un moment.', 'La semaine n’a pas été réécrite : réessaie dans un moment.', 'L’arrêt n’a pas abouti : réessaie dans un moment.']) {
    assert.ok(w.includes(`message: await messageAuCoach(e instanceof Error ? e.message : '${t}')`), t);
  }
  assert.ok(w.includes('const soucis = await soucisAuCoach(await arreterLaPreparation(planId));'));
  // Les gestes que l'athlète lit aussi gardent leurs messages (aucun texte nouveau pour lui) : la course de préparation, la trace, l'accord, la confirmation de charge.
  for (const fonction of ['enregistrerCourse', 'ajouterTraceObjectif', 'retirerCourse', 'donnerMonAccord', 'retirerMonAccord', 'confirmerMaCharge']) {
    const debut = w.indexOf(`function ${fonction}(`);
    assert.ok(debut > 0, fonction);
    const fin = w.indexOf('\nexport async function', debut + 10);
    assert.ok(!w.slice(debut, fin > 0 ? fin : undefined).includes('messageAuCoach'), `${fonction} : un geste de l’athlète aussi`);
  }
  // Les routes que le coach appelle d'un clic : « Ajouter un athlète » / « Nouvel objectif », et la simulation d'un achat (réservée au coach, la garde est plus haut).
  for (const f of ['app/app/coach/athletes/route.ts', 'app/plan/simuler/route.ts']) {
    const r = sansCommentaires(source(f));
    assert.ok(r.includes("import { messageAuCoach } from '@/lib/app/erreursDuCoach';"), f);
    assert.ok(r.includes("if (!cle) return NextResponse.json({ message: await messageAuCoach('Le code du coach (CTS_CLE_COACH) manque dans Vercel.') }, { status: 500 });"), f);
  }
  assert.ok(source('app/plan/simuler/route.ts').indexOf("message: 'La simulation est réservée au coach connecté.'") < source('app/plan/simuler/route.ts').indexOf('messageAuCoach('));
});

test('les messages du code que la table dit : ils sont bien écrits ainsi dans le source (la table ne s’écarte pas du code)', () => {
  const n = source('lib/app/nolio.ts');
  for (const m of ['Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel.', 'La variable NOLIO_API_KEY de Vercel ne contient pas une clé Nolio (elle commence par nolio_sk_) : recolle la clé, puis redéploie.',
    'return `Nolio a refusé ${quoi} (${r.statut}${erreur.code ? ` ${erreur.code}` : \'\'}).`;',
    'Ton équipe Nolio interdit l’écriture par l’API : autorise-la dans les options de l’équipe (API et MCP), puis recommence.', 'Nolio limite le nombre d’appels pour l’instant : réessaie dans quelques minutes.']) {
    assert.ok(n.includes(m), m);
  }
  assert.ok(source('lib/app/stockageV9.ts').includes("const MIGRATION = 'la migration du 24/11/2026 (état du moteur v1) est-elle passée ?';"));
  assert.ok(source(ECRIT).includes("throw new Error(`Moteur ${chemin} : ${r.status}${message ? ` — ${message}` : ''}`);"));
  assert.ok(source('lib/app/coaching.ts').includes('throw new Error(`Moteur /v1/nolio/seances : ${r.status}`);'));
});

test('ce que la règle ne touche pas, par choix : `refusNolio`, `ErreurNolio` et les `throw` gardent leur texte (le même part dans un courriel au développeur ou un compte rendu de passage)', () => {
  // nolio.ts n'importe ni ne lit la règle ; ecriture.ts, coaching.ts, stockageV9.ts non plus.
  for (const f of ['lib/app/nolio.ts', ECRIT, 'lib/app/coaching.ts', 'lib/app/stockageV9.ts', 'lib/app/passagesV9.ts', 'lib/app/dimanchesCoaches.ts']) {
    assert.ok(!/erreursDuCoach/.test(source(f)), `${f} garde ses messages`);
  }
  // Qui lit la règle : les gestes du coach et deux routes, et personne d'autre (ni une page, ni l'app de l'athlète).
  assert.deepEqual(grep("from '[^']*erreursDuCoach'", 'app', 'components', 'lib'), ['app/app/coach/athletes/route.ts', 'app/plan/simuler/route.ts', 'lib/app/actionsCoaching.ts', 'lib/app/actionsEcriture.ts']);
  // Les sources de messages techniques dans le code (hors commentaires), une liste fermée : un nouveau message de ce genre demande de choisir où il se dit autrement.
  const techniques = grep('NOLIO_API_KEY|CTS_CLE_COACH|la migration du|est-elle passée|dans Supabase', 'app', 'components', 'lib').filter((f) => !f.startsWith('lib/app/demonstration')
    && /NOLIO_API_KEY|CTS_CLE_COACH|la migration du|est-elle passée|dans Supabase/.test(sansCommentaires(source(f))));
  assert.deepEqual(techniques, [
    'app/app/coach/athlete/[id]/page.tsx', // page : `montrerLInfra` (étapes 1 et 5), la 8.x seule le lit
    'app/app/coach/athletes/route.ts', // TRAITÉ : messageAuCoach
    'app/app/coach/page.tsx', // page : `montrerLInfra`
    'app/app/coach/urgent/page.tsx', // page d'« Urgent » : n'existe plus sous la 9.x (menu, redirection de la page)
    'app/plan/simuler/route.ts', // TRAITÉ : messageAuCoach
    'components/app/SemaineQuiArrive.tsx', // composant de page : `montrerLInfra`
    'lib/app/actionsCoaching.ts', // TRAITÉ : messageAuCoach
    'lib/app/erreursDuCoach.ts', // la règle elle-même
    'lib/app/motsDuCoach.ts', // les mots d'avant (la 8.x) de « Demandes »
    'lib/app/nolio.ts', // LAISSÉ : la source de refusNolio et de cle()
    'lib/app/rangement.ts', // la variable passée en en-tête au moteur : aucun message
    'lib/app/stockageV9.ts', // LAISSÉ : levé dans la chaîne, dit au coach à la réception (« Réessayer », « Démarrer »)
  ].sort());
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// (iii) LE « RÉESSAYER » D'UNE ANCIENNE SAISON DE FOND
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('une saison de fond se reconnaît à ses paramètres (`fond`) comme `estFond` ; « Réessayer » ne se propose pas pour elle sous la 9.x, et se propose partout sous la 8.x', () => {
  assert.equal(saison.estUneSaisonDeFond({ fond: { saison: 2, debut: '2026-11-02' } }), true);
  assert.equal(saison.estUneSaisonDeFond({ champs: { format: 'trail' } }), false);
  assert.equal(saison.estUneSaisonDeFond(null), false);
  assert.equal(saison.estUneSaisonDeFond(undefined), false);
  assert.equal(saison.estUneSaisonDeFond({ fond: null }), false);
  // La même lecture que `estFond` (lib/app/fond.ts), sans en importer la chaîne.
  assert.ok(source('lib/app/fond.ts').includes('export const estFond = (parametres: unknown): boolean => Boolean((parametres as { fond?: unknown } | null)?.fond);'));
  assert.ok(source('lib/app/reessayerDeSaison.ts').includes('export const estUneSaisonDeFond = (parametres: unknown): boolean => Boolean((parametres as { fond?: unknown } | null)?.fond);'));
  assert.ok(!/^import /m.test(source('lib/app/reessayerDeSaison.ts')), 'fonctions pures : ni lecture ni import');
  for (const s of [true, false]) assert.equal(saison.reessayerPossible(false, s), true, 'la 8.x : toujours');
  assert.equal(saison.reessayerPossible(true, false), true);
  assert.equal(saison.reessayerPossible(true, true), false);
});

test('« Sa semaine qui arrive » : sous la 9.x, la semaine pas partie d’une saison de fond s’en va, les autres états et les autres plans restent ; sous la 8.x, toutes', () => {
  const s = (etat, fond, planId = 'p') => ({ etat, fond, planId });
  const toutes = [s('pas_partie', true, 'a'), s('pas_partie', false, 'b'), s('ecrite', true, 'c'), s('avant', true, 'd'), s('ecrite', false, 'e')];
  assert.deepEqual(saison.semainesSansSaisonPasPartie(toutes, true).map((x) => x.planId), ['b', 'c', 'd', 'e']);
  assert.deepEqual(saison.semainesSansSaisonPasPartie(toutes, false), toutes);
  assert.deepEqual(saison.semainesSansSaisonPasPartie([], true), []);
});

test('le point « semaine pas partie » : `vueDuCoach` le garde derrière `reessayerPossible(v9, …)` en reconnaissant la saison par `infosFond` et `parametres.fond` ; le point du dimanche soir de même', () => {
  const c = source('lib/app/espaceCoach.ts');
  assert.ok(c.includes("import { estUneSaisonDeFond, reessayerPossible } from './reessayerDeSaison';"));
  // `infosFond` : la trame que le moteur rend (`trames`), ses paramètres : `p.parametres.fond`.
  assert.ok(c.includes('const infosFond = (o && trames.get(o.plan_id)?.fond) || null;'));
  assert.ok(c.includes('const saisonDeFond = Boolean(infosFond) || estUneSaisonDeFond(p?.parametres);'));
  assert.match(c, /const pasPartie = Boolean\(o && avenir && ecrit && demarre && !aLaMain\.has\(o\.plan_id\) && o\.course_date >= lundi && !laisseesAuCoach\.has\(o\.plan_id\)\s*&& !semaines\.some\([^\n]*\n\s*&& \(premiereDeSaison \|\| semaines\.some\([^\n]*\n\s*&& reessayerPossible\(v9, saisonDeFond\)\);/);
  // `v9` est celui de la vue : lu avant la saison, une fois.
  assert.ok(c.indexOf("const v9 = await moteurEstV9();") < c.indexOf('const saisonDeFond'));
  // Le point `semaine` n'a qu'une source dans la vue ; l'autre est celle du dimanche soir (sans geste, qui promet « Réessayer » lundi), gardée de même.
  assert.equal((c.match(/genre: 'semaine'/g) ?? []).length, 1);
  const m = source('lib/app/mesAthletes.ts');
  assert.ok(m.includes("import { estUneSaisonDeFond, reessayerPossible } from './reessayerDeSaison';"));
  assert.ok(m.includes('&& a.objectif?.suivante?.partie !== true && reessayerPossible(v9, estUneSaisonDeFond(plan.parametres)))'));
  assert.ok(m.includes('dimanche.ecrites.filter(({ a: f, o, plan }) => f.id === a.id'));
  assert.equal((m.match(/genre: 'semaine'/g) ?? []).length, 1);
  // Le bilan du dimanche compte les semaines pas parties de la vue : la même source.
  assert.ok(m.includes("vue.aRegarder.filter((r) => r.genre === 'semaine').length"));
});

test('« Sa semaine qui arrive », sur la page de l’athlète : les semaines passent par `semainesSansSaisonPasPartie` avant tout (la revue, « À faire pour lui » et la carte lisent les mêmes) ; le bouton est celui d’avant', () => {
  assert.ok(page.includes("import { semainesSansSaisonPasPartie } from '@/lib/app/reessayerDeSaison';"));
  assert.ok(page.includes('const semaines = semainesSansSaisonPasPartie(await semainesQuiArrivent(ecrites, jour, apercu ?? null, v9), v9);'));
  const apres = page.slice(page.indexOf('const semaines = semainesSansSaisonPasPartie('));
  assert.ok(apres.indexOf('const retouchee = semaines.some(') > 0 && apres.indexOf('const partie = semaines.length > 0 && semaines.every(') > 0, 'la revue lit `semaines` filtrées');
  // Le composant ne change pas : « Réessayer » reste celui de la 8.x et des autres plans.
  const carte = source('components/app/SemaineQuiArrive.tsx');
  assert.ok(carte.includes('<ReessayerSemaine planId={s.planId} />'));
  assert.ok(!/reessayerDeSaison/.test(carte));
  // Pas de lecture de plus : le fichier est pur.
  assert.ok(source('lib/app/passagesV9.ts').includes('if ((o.parametres as { fond?: unknown }).fond) return null;'), 'ce que `contextePlan` fait d’un plan de fond : null, donc « Réessayer » échoue');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// (iv) LES LIENS D'ANCRE VERS « RÉGLAGES » REPLIÉ
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// Une fausse arborescence : chaque noeud a un nom de balise, un parent, et `open` pour un `details`.
const noeud = (tagName, parentElement = null, extra = {}) => ({ tagName, parentElement, ...(tagName === 'DETAILS' ? { open: false } : {}), ...extra });
const defilements = [];
const avecDefilement = (n) => ({ ...n, scrollIntoView: (o) => defilements.push(o) });

test('l’identifiant d’une ancre : « #son-nolio » ou encodé, vide sans ancre', () => {
  assert.equal(ancres.idDeLAncre('#son-nolio'), 'son-nolio');
  assert.equal(ancres.idDeLAncre('son-nolio'), 'son-nolio');
  assert.equal(ancres.idDeLAncre('#caf%C3%A9'), 'café');
  assert.equal(ancres.idDeLAncre('#%E0%A4%A'), '%E0%A4%A', 'un encodage cassé ne lève rien');
  assert.equal(ancres.idDeLAncre(''), '');
  assert.equal(ancres.idDeLAncre('#'), '');
});

test('ouvrirLesDetailsDe : ouvre le `details` qui contient l’élément et ses parents `details` ; rien d’autre ; dit combien il en a ouvert', () => {
  const reglages = noeud('DETAILS');
  const corps = noeud('DIV', reglages);
  const section = noeud('SECTION', corps);
  assert.equal(ancres.ouvrirLesDetailsDe(section), 1);
  assert.equal(reglages.open, true);
  // Déjà ouvert : rien à faire, rien de compté.
  assert.equal(ancres.ouvrirLesDetailsDe(section), 0);
  // Un `details` dans un `details` fermés : les deux s'ouvrent ; un frère reste fermé.
  const dehors = noeud('DETAILS');
  const dedans = noeud('DETAILS', noeud('DIV', dehors));
  const frere = noeud('DETAILS', noeud('DIV', dehors));
  const cible = noeud('P', noeud('DIV', dedans));
  assert.equal(ancres.ouvrirLesDetailsDe(cible), 2);
  assert.deepEqual([dehors.open, dedans.open, frere.open], [true, true, false]);
  // Un élément qui est un `details` lui-même s'ouvre (`#reglages`).
  const lui = noeud('DETAILS');
  assert.equal(ancres.ouvrirLesDetailsDe(lui), 1);
  assert.equal(lui.open, true);
  // Hors de tout `details` (le haut de la page), ou sans élément : rien.
  assert.equal(ancres.ouvrirLesDetailsDe(noeud('SECTION', noeud('MAIN'))), 0);
  assert.equal(ancres.ouvrirLesDetailsDe(null), 0);
  assert.equal(ancres.ouvrirLesDetailsDe(undefined), 0);
  // Le nom de balise se lit sans casse.
  const minuscules = noeud('details');
  assert.equal(ancres.ouvrirLesDetailsDe(noeud('div', minuscules)), 1);
});

// Un faux document et une fausse fenêtre : des écouteurs qu'on déclenche à la main.
function fauxDocument(noeuds) {
  const ecouteurs = {};
  return {
    ecouteurs,
    getElementById: (id) => noeuds[id] ?? null,
    addEventListener: (type, f, capture) => { (ecouteurs[type] ??= []).push([f, capture]); },
    removeEventListener: (type, f) => { ecouteurs[type] = (ecouteurs[type] ?? []).filter(([g]) => g !== f); },
    emettre: (type, evenement = {}) => (ecouteurs[type] ?? []).forEach(([f]) => f(evenement)),
  };
}
function fausseFenetre(hash, chemin = '/app/coach/athlete/a1') {
  const ecouteurs = {};
  const w = {
    ecouteurs,
    location: { hash, pathname: chemin, origin: 'https://cts.test', get href() { return `https://cts.test${chemin}${w.location.hash}`; } },
    addEventListener: (type, f) => { (ecouteurs[type] ??= []).push(f); },
    removeEventListener: (type, f) => { ecouteurs[type] = (ecouteurs[type] ?? []).filter((g) => g !== f); },
    emettre: (type) => (ecouteurs[type] ?? []).forEach((f) => f({})),
  };
  return w;
}
const clic = (href) => ({ target: { closest: () => ({ href }) } });

test('suivreLAncre : au chargement, ouvre « Réglages » pour l’ancre de l’adresse et fait défiler jusqu’à elle', () => {
  defilements.length = 0;
  const reglages = noeud('DETAILS');
  const nolio = avecDefilement(noeud('SECTION', noeud('DIV', reglages)));
  const doc = fauxDocument({ 'son-nolio': nolio });
  ancres.suivreLAncre(fausseFenetre('#son-nolio'), doc);
  assert.equal(reglages.open, true);
  assert.deepEqual(defilements, [{ block: 'start' }]);
});

test('suivreLAncre : à chaque changement d’adresse (`hashchange`, retour en arrière `popstate`), la nouvelle ancre ouvre ce qui la contient', () => {
  defilements.length = 0;
  const reglages = noeud('DETAILS');
  const semaine = avecDefilement(noeud('SECTION', noeud('DIV', reglages)));
  const doc = fauxDocument({ 'sa-semaine-passee': semaine });
  const fenetre = fausseFenetre('');
  ancres.suivreLAncre(fenetre, doc);
  assert.equal(reglages.open, false, 'sans ancre, rien ne bouge');
  fenetre.location.hash = '#sa-semaine-passee';
  fenetre.emettre('hashchange');
  assert.equal(reglages.open, true);
  assert.equal(defilements.length, 1);
  // Refermé à la main, puis « précédent » ramène la même ancre : il s'ouvre de nouveau.
  reglages.open = false;
  fenetre.emettre('popstate');
  assert.equal(reglages.open, true);
  assert.equal(defilements.length, 2);
  // Une ancre qui n'existe pas, ou en haut de la page : rien ne s'ouvre, rien ne défile.
  reglages.open = false;
  fenetre.location.hash = '#inconnue';
  fenetre.emettre('hashchange');
  assert.equal(reglages.open, false);
  assert.equal(defilements.length, 2);
});

test('suivreLAncre : un clic sur un lien de la même page avec une ancre ouvre d’avance (un `Link` de Next ne déclenche pas `hashchange`) ; sans défiler, la navigation le fait', () => {
  defilements.length = 0;
  const reglages = noeud('DETAILS');
  const courses = avecDefilement(noeud('SECTION', noeud('DIV', reglages)));
  const doc = fauxDocument({ 'courses-nolio': courses });
  const fenetre = fausseFenetre('');
  ancres.suivreLAncre(fenetre, doc);
  // Le clic est écouté pendant la capture : avant la navigation.
  assert.deepEqual((doc.ecouteurs.click ?? []).map(([, capture]) => capture), [true]);
  // Un lien d'une autre page : rien.
  doc.emettre('click', clic('https://cts.test/app/coach#courses-nolio'));
  assert.equal(reglages.open, false);
  // Un lien d'un autre site : rien.
  doc.emettre('click', clic('https://autre.test/app/coach/athlete/a1#courses-nolio'));
  assert.equal(reglages.open, false);
  // Un lien sans ancre, une cible qui n'est pas dans un lien : rien.
  doc.emettre('click', clic('/app/coach/athlete/a1'));
  doc.emettre('click', { target: { closest: () => null } });
  doc.emettre('click', { target: null });
  assert.equal(reglages.open, false);
  // Le lien de la même page, relatif (`#…`) ou complet (`/app/coach/athlete/a1#…`) : « Réglages » s'ouvre, sans défilement.
  doc.emettre('click', clic('#courses-nolio'));
  assert.equal(reglages.open, true);
  reglages.open = false;
  doc.emettre('click', clic('/app/coach/athlete/a1#courses-nolio'));
  assert.equal(reglages.open, true);
  assert.deepEqual(defilements, [], 'au clic, la navigation défile d’elle-même');
  // Une adresse illisible ne lève rien.
  doc.emettre('click', clic('http://[::1'));
});

test('suivreLAncre : l’ouverture qui existe déjà n’est pas touchée (un `details` déjà ouvert ne défile pas, un `details` fermé que rien ne vise reste fermé) ; l’arrêt retire les trois écouteurs', () => {
  defilements.length = 0;
  const ouvert = noeud('DETAILS', null, { open: true });
  const retirer = avecDefilement(noeud('SECTION', noeud('DIV', ouvert)));
  const autre = noeud('DETAILS');
  const doc = fauxDocument({ retirer });
  const fenetre = fausseFenetre('#retirer');
  const arreter = ancres.suivreLAncre(fenetre, doc);
  assert.equal(ouvert.open, true);
  assert.equal(autre.open, false);
  assert.deepEqual(defilements, [], 'déjà ouvert (Nolio pas associé, athlète plus dans l’équipe) : le navigateur défile lui-même');
  assert.deepEqual([Object.keys(fenetre.ecouteurs).sort(), (doc.ecouteurs.click ?? []).length], [['hashchange', 'popstate'], 1]);
  arreter();
  assert.deepEqual([(fenetre.ecouteurs.hashchange ?? []).length, (fenetre.ecouteurs.popstate ?? []).length, (doc.ecouteurs.click ?? []).length], [0, 0, 0]);
});

test('le composant : client, sans rien rendre, il suit l’ancre au chargement ; rendu sous la 9.x seulement, juste avant « Réglages », et l’`open` automatique de la page est resté', () => {
  const composant = source('components/app/OuvrirLeReglage.tsx');
  assert.ok(composant.startsWith("'use client';\n"));
  const code = sansCommentaires(composant);
  assert.deepEqual([...code.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['react', '@/lib/app/ancresDuReglage'], 'aucune dépendance de plus');
  assert.match(code, /export default function OuvrirLeReglage\(\) \{\s*useEffect\(\(\) => suivreLAncre\(window, document\), \[\]\);\s*return null;\s*\}/);
  // La page : un seul rendu, derrière `v9`, avant le `details` « Réglages » ; ni dans la branche 9.x du haut de page, ni dans la 8.x.
  assert.equal((page.match(/<OuvrirLeReglage \/>/g) ?? []).length, 1);
  assert.ok(page.includes("import OuvrirLeReglage from '@/components/app/OuvrirLeReglage';"));
  const i = page.indexOf('{v9 && <OuvrirLeReglage />}');
  assert.ok(i > 0 && i < page.indexOf('<details id="reglages"') && i > page.indexOf('{/* « Réglages », replié'));
  const i9 = page.indexOf('      {v9 ? (\n        <>\n');
  const i8 = page.indexOf('      ) : (\n        <>\n', i9);
  assert.ok(!page.slice(i9, i8).includes('OuvrirLeReglage'), 'pas dans la branche 9.x du haut de la page');
  assert.ok(!page.slice(i8, page.indexOf('{/* « Réglages », replié')).includes('OuvrirLeReglage'), 'pas dans la branche 8.x');
  // L'ouverture d'avant : « Réglages » s'ouvre de lui-même pour un Nolio à associer ou un athlète sorti de l'équipe, sous les deux moteurs.
  assert.ok(page.includes('<details id="reglages" open={reglagesOuverts}'));
  assert.ok(page.includes('const reglagesOuverts = !a.nolio_athlete_id || horsEquipe;'));
  assert.ok(page.includes('<details open={horsEquipe} className="text-[0.8125rem] text-[#5E5C78]">'));
  // Sous la 8.x, la page ne lit pas le composant : il ne se rend nulle part ailleurs.
  assert.deepEqual(grep("from '[^']*OuvrirLeReglage'", 'app', 'components', 'lib'), [ATHLETE]);
  assert.deepEqual(grep("from '[^']*ancresDuReglage'", 'app', 'components', 'lib'), ['components/app/OuvrirLeReglage.tsx']);
});

// La liste fermée des ancres : chaque lien du code qui mène à une ancre de la page de l'athlète, où elle est sous la 9.x (en haut, ou dans « Réglages »), et les ancres des autres pages.
const ANCRES_DE_LA_PAGE_ATHLETE = {
  'semaine-qui-arrive': 'haut', // SemaineQuiArrive.tsx : « Réessayer » du dimanche soir, la revue
  'son-profil': 'haut', // CarteCoureur.tsx : « Son profil › », la revue
  'a-faire': 'haut', // PointsPourLui.tsx : la revue (« Ses messages »)
  'son-entree': 'haut', // PointsPourLui.tsx (la ligne « accord ») ; CarteEntree.tsx dans « Réglages » quand l'entrée est faite (les deux s'excluent)
  'sa-semaine-passee': 'reglages', // la revue, quand il y a un réalisé
  'courses-nolio': 'reglages', // la revue, quand il y a des courses dans Nolio
  'son-nolio': 'reglages', // « Associer › » (entree.ts), la revue sans Nolio associé
  retirer: 'reglages', // « Retirer › » (espaceCoach.ts)
};
// Les ancres que le code lie, mais qui sont celles d'une autre page : l'objectif du coach (`#ajouter-course`, `#retrait`), l'app de l'athlète (son compte, son profil, son plan).
const ANCRES_DES_AUTRES_PAGES = ['ajouter-course', 'retrait', 'installer', 'profil-entrainement', 'badges', 'accord', 'jour-j'];

function liensEnAncre() {
  const trouvees = new Map();
  for (const f of grep('#[a-z]', 'app/app/coach', 'components/app', 'lib/app').filter((x) => !x.startsWith('lib/app/demonstration'))) {
    for (const m of sansCommentaires(source(f)).matchAll(/[}'"`]#([a-z][a-z0-9-]*)(?=[`'"\s)])/g)) trouvees.set(m[1], [...(trouvees.get(m[1]) ?? []), f]);
  }
  return trouvees;
}

test('la liste fermée des ancres : chaque lien du code mène à une ancre connue, et chaque ancre de la page de l’athlète existe comme `id` sous la 9.x', () => {
  const liens = liensEnAncre();
  const connues = new Set([...Object.keys(ANCRES_DE_LA_PAGE_ATHLETE), ...ANCRES_DES_AUTRES_PAGES]);
  // Un nouveau lien vers une ancre qui n'est pas dans la liste fait échouer l'essai : il faut dire de quelle page elle est.
  assert.deepEqual([...liens.keys()].filter((a) => !connues.has(a)).sort(), [], 'une ancre liée que la liste ne connaît pas');
  // Et aucune ancre de la liste n'est un reste : chacune est liée.
  for (const a of Object.keys(ANCRES_DE_LA_PAGE_ATHLETE)) assert.ok(liens.has(a), `#${a} n’est lié nulle part`);
  // Les ids que la page de l'athlète pose sous la 9.x : la page, ses composants du haut, la semaine qui arrive, la carte d'entrée.
  const ids = (texte) => [...sansCommentaires(texte).matchAll(/\bid=(?:"([a-z-]+)"|\{[^}]*'([a-z-]+)'[^}]*\})/g)].map((m) => m[1] ?? m[2]);
  const composants = ['PointsPourLui', 'CarteCoureur', 'ObjectifsAVerifier', 'CarteEntree', 'SemaineQuiArrive'].map((n) => source(`components/app/${n}.tsx`)).join('\n');
  const posees = new Set([...ids(page), ...ids(composants)]);
  for (const a of Object.keys(ANCRES_DE_LA_PAGE_ATHLETE)) assert.ok(posees.has(a), `#${a} : pas d’id correspondant sous la 9.x`);
});

test('chaque ancre de « Réglages » est posée dans le `details` « Réglages » (ou dans ce qu’il rend), chaque ancre du haut hors de lui ; le composant ouvre donc ce qu’il faut', () => {
  // « Réglages » : du `<details id="reglages"` à son `</details>` (le seul à six espaces), plus `sectionsEnPlus` que `{v9 && sectionsEnPlus}` y rend.
  const debut = page.indexOf('<details id="reglages"');
  const fin = page.indexOf('\n      </details>', debut);
  assert.ok(debut > 0 && fin > debut);
  const dedans = page.slice(debut, fin);
  const iPlus = page.indexOf('  const sectionsEnPlus = (');
  const plus = page.slice(iPlus, page.indexOf('  return (\n    <CadreCoach', iPlus));
  assert.ok(dedans.includes('{v9 && sectionsEnPlus}'));
  const idsDe = (texte) => new Set([...sansCommentaires(texte).matchAll(/\bid="([a-z-]+)"/g)].map((m) => m[1]));
  const dansReglages = new Set([...idsDe(dedans), ...idsDe(plus)]);
  // Hors de « Réglages » sous la 9.x : le haut de la page jusqu'à sa branche 8.x (qui n'est pas rendue sous la 9.x, et qui pose les mêmes ids que « Réglages » : jamais ensemble).
  const i9 = page.indexOf('      {v9 ? (\n        <>\n');
  const i8 = page.indexOf('      ) : (\n        <>\n', i9);
  const dehors = idsDe(page.slice(0, i8).replace(plus, ''));
  const hautDePage = new Set([...idsDe(source('components/app/PointsPourLui.tsx')), ...idsDe(source('components/app/CarteCoureur.tsx')), ...idsDe(source('components/app/SemaineQuiArrive.tsx')),
    ...[...sansCommentaires(source('components/app/PointsPourLui.tsx')).matchAll(/'(son-entree)'/g)].map((m) => m[1])]);
  for (const [a, ou] of Object.entries(ANCRES_DE_LA_PAGE_ATHLETE)) {
    if (ou === 'reglages') {
      assert.ok(dansReglages.has(a), `#${a} est dans « Réglages »`);
      assert.ok(!dehors.has(a), `#${a} n’est pas aussi hors de « Réglages » (page)`);
    } else {
      assert.ok(hautDePage.has(a), `#${a} est en haut de la page`);
    }
  }
  // Les sections de « Réglages » qui ne se rendent pas toujours le disent par leur condition : une ancre absente n'est jamais proposée par un lien (la revue le filtre).
  assert.ok(plus.includes('{(aUneSemaine || septJoursAffiches) && <section id="sa-semaine-passee"'));
  assert.ok(plus.includes('{coursesNolio.length > 0 && <section id="courses-nolio"'));
  assert.ok(page.includes("ancre: v9 && !a.nolio_athlete_id ? '#son-nolio' : '#courses-nolio',"), 'sans Nolio associé, la revue lie « Son compte Nolio » (une ancre qui existe)');
  // « son-entree » : la ligne « accord » du haut et la carte de « Réglages » ne sont jamais là ensemble (essai de la deuxième étape).
  assert.ok(dansReglages.has('son-entree') === false && plus.includes('entreeDansLesReglages(entree) && <CarteEntree entree={entree} plat />'));
});
