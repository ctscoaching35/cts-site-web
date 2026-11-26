#!/usr/bin/env node
/**
 * LA DESCRIPTION DU BANDEAU À LA RÉÉCRITURE (26/11/2026) : la modification d'un cycle dans Nolio ne l'envoyait pas, l'ancienne restait. Des bandeaux inventés, sans réseau.
 *
 *   node --test scripts/test-bandeau-description.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const { corpsPatch } = await import(pathToFileURL(`${RACINE}lib/app/trameNolio.ts`).href);
const BANDEAU = { name: 'Semaine allégée', date_start: '2026-12-07', date_end: '2026-12-13', color: '#123456', athletes: ['usr_x'], description: 'J-12 · semaine allégée : le volume baisse.\nOn <récupère> & on repart.' };

test('la description du bandeau part avec la réécriture, en HTML (Nolio refuse le texte en clair sur un bandeau qui en a déjà une)', () => {
  assert.deepEqual(corpsPatch(BANDEAU, 'cycle'), { name: 'Semaine allégée', date_start: '2026-12-07', date_end: '2026-12-13', color: '#123456',
    description_html: '<p>J-12 · semaine allégée : le volume baisse.<br>On &lt;récupère&gt; &amp; on repart.</p>' });
});

test('sans description (une reprise, une course, une saison de fond), rien n’est envoyé à sa place', () => {
  for (const description of [undefined, '', '   ', null]) assert.deepEqual(Object.keys(corpsPatch({ ...BANDEAU, description }, 'cycle')), ['name', 'date_start', 'date_end', 'color']);
});

test('une séance et une note se réécrivent comme avant ; les trois réécritures passent par là', () => {
  assert.deepEqual(corpsPatch({ name: 'n', date_start: 'd', description: 'x' }, 'note'), { name: 'n', date_start: 'd', note_type: null, color: null, description: 'x' });
  assert.equal(corpsPatch({ name: 's', description: 'x' }, 'seance').description, 'x');
  const c = readFileSync(`${RACINE}lib/app/coaching.ts`, 'utf8');
  assert.equal((c.match(/'PATCH', [^\n]*corpsPatch\(/g) ?? []).length, 3);
  assert.ok(!c.includes('function corpsPatch'), 'une seule');
});
