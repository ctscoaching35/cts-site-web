#!/usr/bin/env node
/**
 * LA POLITIQUE DE CONFIDENTIALITÉ DIT LE GENRE DE LA SÉANCE GARDÉ AVEC LE SIGNAL (phrase validée par le coach le 26/11/2026 ; décision 272, lib/app/signauxGardes.ts).
 *
 *   node --test scripts/test-confidentialite-genre-de-seance.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const page = readFileSync(`${RACINE}app/confidentialite/page.tsx`, 'utf8').replace(/\s+/g, ' ');

test('le genre de la séance concernée est dit, et « jamais le contenu d’une séance » reste', () => {
  assert.ok(page.includes('(une séance manquée, un effort plus dur que prévu et le genre de la séance concernée, par exemple « Seuil 2 », de mauvaises sensations ou une fatigue qui monte, un commentaire à lire, le jour de ta dernière activité), jamais le contenu d’une séance ni le texte d’un commentaire, remplacés le soir suivant ;'));
  // Ce que la page dit est ce que la base garde : le genre seulement.
  assert.ok(readFileSync(`${RACINE}lib/app/signauxGardes.ts`, 'utf8').includes('({ genre, jour, detail, ...(type ? { type } : {}) })'));
});
