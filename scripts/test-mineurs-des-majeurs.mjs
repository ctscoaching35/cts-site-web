#!/usr/bin/env node
/**
 * UNE COURSE 2 DANS LA RÉCUPÉRATION DE LA COURSE 1 EST UN OBJECTIF MINEUR (décision 241 du coach, 25/11/2026 ; doctrine C3) : « dans la récupération » = sa date tombe avant le lundi de reprise que le site calcule après la
 * course 1 (lib/app/jonction.ts, debutApres). Sous la 9.x, elle ne se lance pas comme un majeur : elle part dans `courses_mineures` du plan de la course 1. Des cas fictifs, sans réseau ni base.
 *
 *   node --test scripts/test-mineurs-des-majeurs.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const M = await charge('mineursDesMajeurs');
const { debutApres } = await charge('jonction');
const moteur = await charge('moteurV9');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

const jour = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const C = (id, course_date, temps_h = 5, extra = {}) => ({ id, course_nom: `Course ${id}`, course_date, temps_h, format: 'TC', ...extra });
const UNE = C('a', '2027-03-14');
const REPRISE = debutApres(UNE); // le lundi de reprise après la course 1

test('dans la récupération : après la course 1 et avant son lundi de reprise ; le jour de la reprise est un majeur', () => {
  assert.equal(M.tombeDansLaRecuperation(jour(UNE.course_date, 1), UNE), true);
  assert.equal(M.tombeDansLaRecuperation(jour(REPRISE, -1), UNE), true);
  assert.equal(M.tombeDansLaRecuperation(REPRISE, UNE), false);
  assert.equal(M.tombeDansLaRecuperation(UNE.course_date, UNE), false, 'le même jour');
  assert.equal(M.tombeDansLaRecuperation(jour(UNE.course_date, -1), UNE), false, 'avant elle');
});

test('les courses classées dans l’ordre des dates : chacune majeure ou mineure du dernier majeur ; une mineure n’ouvre pas sa récupération ; les saisons de fond à part', () => {
  const deux = C('b', jour(UNE.course_date, 3), 1);
  const trois = C('c', jour(REPRISE, 2), 5);
  const quatre = C('d', jour(trois.course_date, 2), 3);
  const r = M.classerLesCourses([quatre, trois, deux, UNE, C('f', jour(UNE.course_date, 2), 4, { fond: true })]);
  assert.deepEqual(r.map((x) => [x.course.id, x.mineureDe?.id ?? null]), [['a', null], ['b', 'a'], ['c', null], ['d', 'c']]);
  // La course d'après une mineure se juge contre le majeur : si la mineure ouvrait sa récupération, `c` serait mineure.
  const longue = C('b', jour(UNE.course_date, 3), 30);
  assert.equal(M.majeurQuiCouvre('c', [UNE, longue, trois]), null);
  assert.equal(M.majeurQuiCouvre('b', [UNE, deux]).id, 'a');
  assert.equal(M.majeurQuiCouvre('a', [UNE, deux]), null);
  assert.equal(M.majeurQuiCouvre('inconnue', [UNE]), null);
});

test('les mineures d’un majeur : leur date, leur chrono visé (sans chrono, sans durée), leur nom ; la forme des courses de préparation du site, puis du contrat', () => {
  const deux = C('b', jour(UNE.course_date, 3), 1.5);
  const sans = C('e', jour(UNE.course_date, 4), 0);
  const m = M.mineursDuMajeur('a', [UNE, deux, sans, C('c', jour(REPRISE, 2))]);
  assert.deepEqual(m, [{ date: deux.course_date, temps_h: 1.5, nom: 'Course b' }, { date: sans.course_date, temps_h: null, nom: 'Course e' }]);
  assert.deepEqual(moteur.coursesMineuresDe(m), [{ date: deux.course_date, duree_h: 1.5, nom: 'Course b' }, { date: sans.course_date, nom: 'Course e' }]);
  assert.deepEqual(M.mineursDuMajeur('c', [UNE, deux, C('c', jour(REPRISE, 2))]), []);
});

test('la ligne dite sous la course', () => {
  assert.equal(M.TEXTE_DANS_LA_RECUPERATION('Trail du Mont'), 'Elle tombe dans ta récupération après Trail du Mont : je la prépare comme une course de préparation.');
});

test('sous la 9.x : les paramètres du plan de la course 1 portent ses mineures ; la course 2 ne se lance pas ; la 8.x ne change pas', () => {
  const p = source('lib/app/parametresPlanV9.ts');
  assert.match(p, /const dans = await mineursDeCePlan\(String\(data\.athlete_id\)\)\.then\(\(f\) => f\(o\.planId\), \(\) => \[\]\);/);
  assert.match(p, /if \(dans\.length\) parametres = \{ \.\.\.o\.parametres, courses_secondaires: \[\.\.\.\(\(o\.parametres\.courses_secondaires \?\? \[\]\) as unknown\[\]\), \.\.\.dans\] \};/);
  assert.match(p, /return parametresDuPlanV9\(\{ parametres,/);
  const e = source('lib/app/ecriture.ts');
  const d = e.slice(e.indexOf('export async function demarrerObjectif'), e.indexOf('const fini = ajouterJours(debutApres'));
  assert.match(d, /if \(o\.coache && \(await moteurEstV9\(\)\)\) \{\n\s+const couvre = majeurQuiCouvre\(o\.planId, \[\.\.\.autres, \{ id: o\.planId,/);
  assert.match(d, /if \(couvre\) throw new Error\(TEXTE_DANS_LA_RECUPERATION\(couvre\.course_nom\)\);/);
  // Une course gardée avec le plan et la même date : une seule mineure (coursesMineuresDe).
  assert.equal(moteur.coursesMineuresDe([{ date: '2027-03-17', temps_h: 2, nom: 'Gardée' }, { date: '2027-03-17', temps_h: 1, nom: 'Majeur' }]).length, 1);
});
