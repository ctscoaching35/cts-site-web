#!/usr/bin/env node
/**
 * LA CONFIGURATION DU MOTEUR 9 N'A PLUS `temps_max_par_format` NI `reperes_km_effort_h` (panne vue par le coach le 27/11/2026 : « Objectif principal » menait à « Cette page n’a pas pu s’afficher »). Le questionnaire
 * les lit sans planter. Une configuration inventée à la forme du moteur 9, sans réseau.
 *
 *   node --test scripts/test-config-moteur-9.mjs
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
const { reperesChrono, champsVides } = await import(`${RACINE}lib/plan.ts`);

test('les repères de chrono se disent sans les plafonds de temps, sans planter', () => {
  const c = { ...champsVides, format: 'TM', distance_km: '47', dplus_m: '1772' };
  const r = reperesChrono(c, { formats: [], durees_par_format: {}, semaines_par_formule: {} }, true);
  assert.equal(r.kmEffort, 65);
  assert.equal(r.bandes.length, 5);
  assert.equal(r.fin, null);
});

test('le questionnaire ne lit les plafonds que s’ils sont là', () => {
  const q = readFileSync(`${RACINE}components/plan/Questionnaire.tsx`, 'utf8');
  assert.ok(!/config\.temps_max_par_format\[c\.format\] !== undefined/.test(q));
  assert.ok(q.includes('config.temps_max_par_format?.[c.format] !== undefined'));
});
