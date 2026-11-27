#!/usr/bin/env node
/**
 * LE COACH CORRIGE LE NOM D'UN ATHLÈTE (27/11/2026 : des fiches arrivent le nom de famille d'abord, la liste se classe par prénom). Athlètes inventés, base en mémoire, sans réseau.
 *
 *   node --test scripts/test-corriger-nom.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

test('le geste : réservé au coach, sur sa fiche seulement, le nom nettoyé ; vide, rien ; rien vers Nolio', () => {
  const code = lire('lib/app/actionsCoaching.ts');
  const geste = code.slice(code.indexOf('export async function renommerAthlete'), code.indexOf('export async function associerNolio'));
  assert.ok(geste.includes('const coach = await coachConnecte();') && geste.includes('if (!coach || !nom) return;'));
  assert.ok(geste.includes(".update({ nom }).eq('id', athleteId).eq('coach_id', coach.compteId)"));
  assert.ok(geste.includes("replace(/\\s+/g, ' ').trim().slice(0, 80)"));
  assert.ok(!/appelNolio|listeNolio/.test(geste));
});

test('sur la fiche de l’athlète, sous son nom', () => {
  const page = lire('app/app/coach/athlete/[id]/page.tsx');
  assert.ok(page.indexOf('{a.nom}</h1>') < page.indexOf('renommerAthlete.bind(null, a.id)'));
  assert.ok(page.includes('Corriger son nom') && page.includes('Écris le prénom d’abord : la liste se classe par prénom. Rien ne change dans Nolio.'));
});

test('la liste classe par ce qui est écrit : un nom remis prénom d’abord retrouve sa place', async () => {
  const classer = (noms) => [...noms].sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
  assert.ok(lire('lib/app/espaceParAthlete.ts').includes("x.nom.localeCompare(y.nom, 'fr', { sensitivity: 'base' })"));
  assert.deepEqual(classer(['Zoé Abel', 'Bernard Camille', 'Alix Durand']), ['Alix Durand', 'Bernard Camille', 'Zoé Abel']);
  assert.deepEqual(classer(['Zoé Abel', 'Camille Bernard', 'Alix Durand']), ['Alix Durand', 'Camille Bernard', 'Zoé Abel']);
});
