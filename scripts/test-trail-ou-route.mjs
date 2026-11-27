#!/usr/bin/env node
/**
 * TRAIL OU ROUTE (27/11/2026 : « l’athlète prépare un trail et ça me propose la route […] il faut que je puisse choisir ») : une course nommée « trail » n'est pas devinée sur route, et le coach choisit sur la page
 * de création. Des courses inventées.
 *
 *   node --test scripts/test-trail-ou-route.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const { formatRouteDe } = await import(`${RACINE}lib/app/route.ts`);
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

test('une course nommée « trail » n’est pas devinée sur route, même sans D+ ; les autres comme avant', () => {
  assert.equal(formatRouteDe(21, null, 'Trail'), null);
  assert.equal(formatRouteDe(21, 0, 'TRAIL des collines'), null);
  assert.equal(formatRouteDe(21, null, 'Semi de la ville'), 'R21');
  assert.equal(formatRouteDe(10, 0), 'R10');
});

test('le choix du coach l’emporte, et le questionnaire repart avec lui', () => {
  const page = lire('app/app/coach/nouveau/page.tsx');
  assert.ok(page.includes("const route = r.discipline !== 'trail' && (r.discipline === 'route' ||"));
  assert.ok(page.includes("{(['trail', 'route'] as const).map((d) => ("));
  assert.ok(page.includes('<Questionnaire key={`${discipline}:'));
});
