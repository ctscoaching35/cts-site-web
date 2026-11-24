#!/usr/bin/env node
/**
 * « SAISIR LE RÉSULTAT DE SON TEST » (décision du coach du 25/11/2026) : la v1 écrit des tests dans ses semaines (`famille: "test"` : vitesse critique, FC au seuil 2, parole) et le site ne les relit plus dans
 * Nolio sous la 9.x. Le lundi qui suit une semaine où elle en a écrit un, « À faire pour lui » le dit, avec le geste qui existe ; le point tombe dès que le repère est saisi (par le coach ou par l'athlète).
 * Les semaines sont à la forme du contrat de `POST /v1/semaine` (`jours: [ { jour, date, seance, renfo } ]`). Des cas fictifs, sans réseau ni donnée d'athlète.
 *
 *   node --test scripts/test-tests-a-saisir.mjs
 */
import assert from 'node:assert/strict';
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
const charge = (f) => import(pathToFileURL(`${RACINE}${f}`).href);
const T = await charge('lib/app/testsASaisir.ts');
const simple = await charge('lib/app/pageAthleteSimple.ts');
const stockage = await charge('lib/app/stockageV9.ts');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// Une semaine écrite par la v1 : son lundi, ses jours, et une séance de test un jour donné.
const SEMAINE = (lundi, tests = {}) => ({
  lundi,
  jours: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((jour, i) => ({
    jour, date: new Date(Date.parse(`${lundi}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
    seance: tests[jour] ? { id: `S3-${jour}`, famille: 'test', forme: tests[jour], titre: 'Test' } : { id: `S3-${jour}`, famille: 'endurance', forme: 'EF', titre: 'EF' }, renfo: null,
  })),
});
const LUNDI = '2026-12-07'; // la semaine du test
const MARDI = '2026-12-08';
const SUIVANT = '2026-12-14';

test('les tests d’une semaine écrite : ceux de la v1, avec leur jour ; une séance d’une autre famille, un test inconnu, une semaine illisible : rien', () => {
  assert.deepEqual(T.testsDeLaSemaine(SEMAINE(LUNDI, { mardi: 'vitesse critique', samedi: 'parole' })),
    [{ forme: 'vitesse critique', jour: MARDI, lundi: LUNDI }, { forme: 'parole', jour: '2026-12-12', lundi: LUNDI }]);
  assert.deepEqual(T.testsDeLaSemaine(SEMAINE(LUNDI)), []);
  assert.deepEqual(T.testsDeLaSemaine(SEMAINE(LUNDI, { mardi: 'autre test' })), []);
  assert.deepEqual(T.testsDeLaSemaine(SEMAINE(LUNDI, { mardi: 'toString' })), [], 'un nom hérité n’est pas un test');
  for (const mal of [{ lundi: null, jours: [] }, { lundi: 'x', jours: [] }, { lundi: LUNDI, jours: 'oui' }, { lundi: LUNDI, jours: [null, 3, { seance: null }, {}] }]) assert.deepEqual(T.testsDeLaSemaine(mal), []);
  // Sans date de jour, le lundi de la semaine.
  assert.deepEqual(T.testsDeLaSemaine({ lundi: LUNDI, jours: [{ seance: { famille: 'test', forme: 'FC au seuil 2' } }] }), [{ forme: 'FC au seuil 2', jour: LUNDI, lundi: LUNDI }]);
});

test('le point vient le lundi qui suit la semaine du test, pas avant ; il tombe quand le repère est saisi le jour du test ou après', () => {
  const semaines = [SEMAINE(LUNDI, { mardi: 'vitesse critique' })];
  const vue = (aujourdhui, sources) => T.testsASaisir({ semaines, sources, aujourdhui });
  assert.deepEqual(vue('2026-12-09', {}), [], 'pendant la semaine du test');
  assert.deepEqual(vue('2026-12-13', {}), [], 'le dimanche de cette semaine');
  assert.deepEqual(vue(SUIVANT, {}), [{ mot: 'vitesse critique', geste: 'test_vc', jour: MARDI }], 'le lundi qui suit');
  assert.deepEqual(vue('2026-12-20', undefined).length, 1, 'il reste tant que rien n’est saisi');
  // Saisi : par le coach (test du jour, source « test_coach ») ou par l'athlète (le jour de sa saisie) — le même jour que le test ou après.
  for (const le of [MARDI, '2026-12-10', SUIVANT]) assert.deepEqual(vue('2026-12-20', { vc_ms: { le } }), [], le);
  // Un repère d'avant le test ne le clôt pas ; le repère d'un autre test non plus.
  assert.equal(vue('2026-12-20', { vc_ms: { le: '2026-11-20' } }).length, 1);
  assert.equal(vue('2026-12-20', { fc_seuil2: { le: '2026-12-10' }, fc_seuil1: { le: '2026-12-10' } }).length, 1);
  assert.equal(vue('2026-12-20', { vc_ms: {} }).length, 1, 'une source sans date ne clôt rien');
});

test('la fréquence cardiaque : les deux tests (FC au seuil 2, parole) ne font qu’un point ; saisir un repère ne clôt que le sien ; la vitesse critique d’abord', () => {
  const semaines = [SEMAINE(LUNDI, { mardi: 'FC au seuil 2', jeudi: 'parole', samedi: 'vitesse critique' })];
  const vue = (sources) => T.testsASaisir({ semaines, sources, aujourdhui: SUIVANT });
  assert.deepEqual(vue({}).map((t) => [t.mot, t.geste]), [['vitesse critique', 'test_vc'], ['fréquence cardiaque', 'reperes']]);
  assert.deepEqual(vue({ vc_ms: { le: '2026-12-12' } }).map((t) => t.mot), ['fréquence cardiaque']);
  assert.deepEqual(vue({ fc_seuil2: { le: '2026-12-10' } }).map((t) => t.mot), ['vitesse critique', 'fréquence cardiaque'], 'la parole attend encore sa FC au seuil 1');
  assert.deepEqual(vue({ fc_seuil2: { le: '2026-12-10' }, fc_seuil1: { le: '2026-12-10' } }).map((t) => t.mot), ['vitesse critique']);
  assert.equal(vue({}).find((t) => t.geste === 'reperes').jour, '2026-12-10', 'le test le plus récent');
});

test('un test vieux de plus de huit semaines n’est plus rappelé ; un test plus récent efface l’ancien ; plusieurs semaines, un seul point par mot', () => {
  const ancien = SEMAINE('2026-10-05', { mardi: 'vitesse critique' });
  assert.deepEqual(T.testsASaisir({ semaines: [ancien], aujourdhui: '2026-12-14' }), []);
  assert.equal(T.testsASaisir({ semaines: [ancien], aujourdhui: '2026-11-30' }).length, 1, 'dans les huit semaines');
  const deux = [ancien, SEMAINE('2026-11-23', { jeudi: 'vitesse critique' })];
  assert.deepEqual(T.testsASaisir({ semaines: deux, aujourdhui: '2026-11-30' }), [{ mot: 'vitesse critique', geste: 'test_vc', jour: '2026-11-26' }]);
  // Une saisie entre les deux clôt l'ancien test, pas le plus récent.
  assert.equal(T.testsASaisir({ semaines: deux, sources: { vc_ms: { le: '2026-11-10' } }, aujourdhui: '2026-11-30' }).length, 1);
  assert.deepEqual(T.testsASaisir({ semaines: deux, sources: { vc_ms: { le: '2026-11-27' } }, aujourdhui: '2026-11-30' }), []);
  assert.deepEqual(T.testsASaisir({ semaines: [], aujourdhui: SUIVANT }), []);
});

test('la phrase et le geste : « Saisir le résultat de son test de … », les mots de la carte de coureur', () => {
  assert.equal(T.TEXTES_TESTS.saisir('vitesse critique'), 'Saisir le résultat de son test de vitesse critique');
  assert.equal(T.TEXTES_TESTS.saisir('fréquence cardiaque'), 'Saisir le résultat de son test de fréquence cardiaque');
  assert.deepEqual(T.ANCRE_DU_GESTE, { test_vc: '#geste-test-vc', reperes: '#geste-reperes' });
  assert.equal(simple.TEXTES_PAGE_ATHLETE.saisirTest, 'Saisir son test de vitesse critique');
  assert.equal(simple.TEXTES_PAGE_ATHLETE.modifierReperes, 'Modifier ses repères');
  assert.ok(!/\w'\w/.test(T.TEXTES_TESTS.saisir('x')));
});

test('dans « À faire pour lui » : après ses points et l’alerte, avant les étapes de son entrée ; le bouton est celui de la carte ; les adresses sont celles de ses formulaires', () => {
  const entree = { etapes: [{ cle: 'depart', fait: false, action: { texte: 'Démarrer', href: '/x' } }] };
  const test = { cle: 'vitesse critique:2026-12-08', texte: T.TEXTES_TESTS.saisir('vitesse critique'), geste: 'test_vc', href: T.ANCRE_DU_GESTE.test_vc };
  const alerte = { planId: 'p', nom: 'N', phrases: ['x'], href: '/y' };
  assert.deepEqual(simple.aFairePourLui([], entree, false, [alerte], [test]).map((l) => l.type), ['alerte', 'test', 'entree']);
  assert.deepEqual(simple.aFairePourLui([], entree, false).map((l) => l.type), ['entree'], 'sans test, comme avant');
  const c = sansCommentaires(source('components/app/PointsPourLui.tsx'));
  assert.match(c, /l\.type === 'test' \? \(/);
  assert.match(c, /<a href=\{l\.test\.href\} className=\{geste\}>\{l\.test\.geste === 'test_vc' \? t\.saisirTest : t\.modifierReperes\}<\/a>/);
  const carte = sansCommentaires(source('components/app/CarteCoureur.tsx'));
  assert.ok(carte.includes('id="geste-test-vc"') && carte.includes('id="geste-reperes"'), 'le formulaire porte l’adresse du lien');
  assert.ok(carte.includes("m.cle === 'test_vc' ? 'geste-test-vc' : 'geste-reperes'"), 'au bandeau aussi');
});

test('la page : sous la 9.x seulement, les semaines récentes de la v1 sont lues (une migration pas passée ne casse rien) et rangées dans « À faire pour lui »', () => {
  const page = sansCommentaires(source('app/app/coach/athlete/[id]/page.tsx'));
  assert.match(page, /const semainesDeLaV1 = v9 \? await lireLesSemainesRecentes\(service, a\.objectifs\.map\(\(o\) => o\.plan_id\), new Date\(Date\.now\(\) - 70 \* 86_400_000\)\.toISOString\(\)\)\.catch\(\(\) => \[\]\) : \[\];/);
  assert.match(page, /const testsAFaire: LigneTest\[\] = v9 \? testsASaisir\(\{ semaines: semainesDeLaV1, sources: a\.reperes_sources, aujourdhui: jour \}\)/);
  assert.match(page, /aFairePourLui\(points, entree, manqueCoureur\.some\(\(m\) => m\.cle === 'profil'\), alertes, testsAFaire\)/);
  assert.ok(page.indexOf('const testsAFaire') < page.indexOf('const lignesAFaire = v9'));
});

test('la lecture des semaines récentes : leur lundi et leurs jours seulement, pour ces plans, écrites par la v1 depuis la date donnée', async () => {
  const appels = [];
  const faux = (rep) => ({ from: (t) => { appels.push(['from', t]); const q = { select: (s) => { appels.push(['select', s]); return q; }, in: (c, v) => { appels.push(['in', c, v]); return q; },
    eq: (c, v) => { appels.push(['eq', c, v]); return q; }, gte: (c, v) => { appels.push(['gte', c, v]); return Promise.resolve(rep); } }; return q; } });
  const jours = [{ jour: 'mardi' }];
  const r = await stockage.lireLesSemainesRecentes(faux({ data: [
    { plan_id: 'p1', numero: 'S10', lundi: '2026-12-07', jours }, { plan_id: 'p1', numero: 'S9', lundi: '2026-11-30', jours: [] }, { plan_id: 'p1', numero: 'pas-un-rang', lundi: null, jours: [] }, { plan_id: 'p2', numero: 'S2', lundi: 3, jours }],
  error: null }), ['p1', 'p2'], '2026-10-05T00:00:00.000Z');
  assert.deepEqual(r, [{ planId: 'p1', numero: 10, lundi: '2026-12-07', jours }, { planId: 'p1', numero: 9, lundi: '2026-11-30', jours: [] }, { planId: 'p2', numero: 2, lundi: null, jours }]);
  assert.deepEqual(appels.find((a) => a[0] === 'from'), ['from', 'semaines_ecrites']);
  assert.ok(appels.find((a) => a[0] === 'select')[1].includes('lundi:donnees->>lundi') && appels.find((a) => a[0] === 'select')[1].includes('jours:donnees->jours'), 'rien d’autre de la semaine');
  assert.deepEqual(appels.find((a) => a[0] === 'in'), ['in', 'plan_id', ['p1', 'p2']]);
  assert.deepEqual(appels.find((a) => a[0] === 'eq'), ['eq', 'moteur', '9.0']);
  assert.deepEqual(appels.find((a) => a[0] === 'gte'), ['gte', 'ecrite_le', '2026-10-05T00:00:00.000Z']);
  assert.deepEqual(await stockage.lireLesSemainesRecentes(faux({ data: [], error: null }), [], 'x'), [], 'sans plan, aucune lecture');
  await assert.rejects(stockage.lireLesSemainesRecentes(faux({ data: null, error: { message: 'colonne absente' } }), ['p1'], 'x'), /colonne absente/);
});
