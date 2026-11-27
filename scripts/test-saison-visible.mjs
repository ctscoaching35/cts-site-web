#!/usr/bin/env node
/**
 * LA SAISON DE FOND SE VOIT (le coach, 27/11/2026 : « j’aimerai que ça soit précisé quand l’athlète est en saison de fond ») : à côté de son nom dans la liste quand un autre mot passe devant, et sous son nom sur sa page,
 * même quand un objectif la suit.
 *
 *   node --test scripts/test-saison-visible.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

test('la liste porte la saison de chaque coaché et la dit sans la répéter', () => {
  assert.ok(lire('lib/app/motsDesCoaches.ts').includes('return { id: l.id, nom: l.nom, un: unMot(entree), saison };'));
  assert.ok(lire('components/app/ListeSimple.tsx').includes("{l.saison && l.un.mot !== 'Saison de fond' && "));
});

test('sa page la dit sous son nom, avec l’objectif qui suit', () => {
  assert.ok(lire('app/app/coach/athlete/[id]/page.tsx').includes("[TEXTES_UN_MOT.saison, prochaineCourse].filter(Boolean).join(' · puis ')"));
});
