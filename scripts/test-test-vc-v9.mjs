#!/usr/bin/env node
/**
 * LE TEST DE VITESSE CRITIQUE ENVOYÉ AU MOTEUR v1 (contrat, 217 et 248) : `d_prime_m` et `date_test_vc` partent ensemble, d'un coaché seulement, et seulement quand la VC vient d'un test à deux efforts (lu dans Nolio,
 * saisi par son coach ou par l'athlète). Une allure tapée par le coach ou une métrique reprise de Nolio : ni l'un ni l'autre. Des athlètes fictifs, sans réseau ni base.
 *
 *   node --test scripts/test-test-vc-v9.mjs
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
const { parametresDuPlanV9 } = await import(pathToFileURL(`${RACINE}lib/app/passeUnPlanV9.ts`).href);
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

const envoi = (x = {}) => parametresDuPlanV9({
  parametres: { champs: { date_course: '2027-05-02' } }, profil: { vc_ms: 3.7, fc_seuil1: 148 }, coache: true, accordLecture: true, premierLundi: '2027-01-04',
  reperesSources: { vc_ms: { le: '2026-09-12', source: 'test' } }, dPrime: 180, ...x,
}, null);
const duTest = (p) => [p.d_prime_m, p.date_test_vc];
const RIEN = [undefined, undefined];

test('un test à deux efforts : sa D′ et sa date partent, avec la vitesse critique', () => {
  for (const origine of ['test', 'test_coach', 'athlete']) {
    const p = envoi({ reperesSources: { vc_ms: { le: '2026-09-12T08:00:00Z', source: origine } } });
    assert.deepEqual([p.vc_ms, ...duTest(p)], [3.7, 180, '2026-09-12'], origine);
  }
});

test('une allure tapée par le coach ou une métrique de Nolio : ni la D′ d’avant ni une date ; la vitesse critique part', () => {
  for (const origine of ['coach', 'nolio', undefined, 'autre']) {
    const p = envoi({ reperesSources: { vc_ms: { le: '2026-09-12', source: origine } } });
    assert.deepEqual([p.vc_ms, ...duTest(p)], [3.7, ...RIEN], String(origine));
  }
  assert.deepEqual(duTest(envoi({ reperesSources: undefined })), RIEN);
  // La source d'un autre repère ne dit rien de la vitesse critique.
  assert.deepEqual(duTest(envoi({ reperesSources: { fc_seuil2: { le: '2026-09-12', source: 'test' } } })), RIEN);
});

test('ensemble ou pas du tout : sans D′, sans date lisible ou sans vitesse critique, rien des deux', () => {
  for (const x of [{ dPrime: null }, { dPrime: 0 }, { reperesSources: { vc_ms: { source: 'test' } } }, { reperesSources: { vc_ms: { le: 'hier', source: 'test' } } }, { profil: { fc_seuil1: 148 } }]) {
    assert.deepEqual(duTest(envoi(x)), RIEN, JSON.stringify(x));
  }
});

test('coachés seulement, et rien ne passe des réponses du questionnaire', () => {
  assert.deepEqual(duTest(envoi({ coache: false })), RIEN);
  const parametres = { champs: { date_course: '2027-05-02', d_prime_m: 250, date_test_vc: '2020-01-01' } };
  assert.deepEqual(duTest(envoi({ parametres, coache: false })), RIEN);
  assert.deepEqual(duTest(envoi({ parametres, reperesSources: { vc_ms: { le: '2026-09-12', source: 'coach' } } })), RIEN);
  assert.deepEqual(duTest(envoi({ parametres })), [180, '2026-09-12']);
});

test('les passages et l’alerte de la page d’un athlète donnent la fiche', () => {
  assert.match(source('lib/app/parametresPlanV9.ts'), /reperesSources: o\.reperesSources, dPrime: o\.dPrime/);
  assert.match(source('app/app/coach/athlete/[id]/page.tsx'), /reperesSources: a\.reperes_sources, dPrime: a\.d_prime_m,/);
  assert.match(source('lib/app/ecriture.ts'), /reperesSources: \(a\?\.reperes_sources \?\? \{\}\) as Objectif\['reperesSources'\], dPrime: \(a\?\.d_prime_m \?\? null\)/);
});
