#!/usr/bin/env node
/**
 * LA POLITIQUE DE CONFIDENTIALITÉ DIT « SÉANCE TENUE ? » (phrases validées par le coach le 26/11/2026) : au coaché et à l'acheteur d'accord pour la lecture, sous la 9.x.
 *
 *   node --test scripts/test-confidentialite-seance-tenue.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const page = readFileSync(`${RACINE}app/confidentialite/page.tsx`, 'utf8').replace(/\s+/g, ' ');
const PHRASE = "{v9 ? ' ta réponse à « Séance tenue ? » après chaque séance,' : ''}";

test('le coaché et l’acheteur la lisent à sa place, parmi ce qui est consulté', () => {
  assert.ok(page.includes(`avec ton effort ressenti, tes sensations,${PHRASE}{' '} tes commentaires et ton questionnaire Hooper ;`), 'coaché');
  assert.ok(page.includes(`ressenti (RPE), ton ressenti,${PHRASE} ton Hooper (fatigue, sommeil, stress, courbatures)`), 'acheteur, avec son accord de lecture');
  assert.equal(page.split(PHRASE).length - 1, 2, 'nulle part ailleurs');
});
