#!/usr/bin/env node
/**
 * Les doses lues, en clair, pour le coach (lib/app/journalEnClair.ts, dose ; l'aperçu du dimanche et le journal du
 * moteur), sans réseau ni base. Décision coach du 08/11/2026 : une pyramide ne s'affiche plus à la moyenne de ses blocs.
 *
 *   node --test scripts/test-journal.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Les imports du site n'ont pas d'extension (« ./plan ») : on la leur donne.
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
const { dose } = await import('../lib/app/journalEnClair.ts');

test('des blocs égaux : inchangé', () => {
  assert.equal(dose({ minutes: 36, reps: 3, bloc_min: 12 }), '3 × 12 min');
  assert.equal(dose({ minutes: 12, reps: 6, bloc_min: 2 }), '6 × 2 min');
  assert.equal(dose({ minutes: 15, reps: 5, bloc_min: 3 }), '5 × 3 min');
  assert.equal(dose({ minutes: 5, reps: 10, bloc_min: 0.5 }), '10 × 0.5 min');
  assert.equal(dose({ minutes: 32, reps: 4, bloc_min: 8 }), '4 × 8 min');
});

test('un seul bloc : sa durée', () => {
  assert.equal(dose({ minutes: 25, reps: 1, bloc_min: 25 }), '25 min');
  assert.equal(dose({ minutes: 24.6 }), '25 min');
});

test('des blocs inégaux : le total et ses répétitions, plus la moyenne', () => {
  // IT 4-3-2-2-1-1′ (le coaché route du 08/11/2026) : 13 min en 6 blocs, la moyenne 2,2 min.
  assert.equal(dose({ minutes: 13, reps: 6, bloc_min: 2.2 }), '13 min en 6 répétitions');
  // IT 1-1-2-2-3-2-2-1-1′ : 15 min en 9 blocs.
  assert.equal(dose({ minutes: 15, reps: 9, bloc_min: 1.7 }), '15 min en 9 répétitions');
  // 1-2-3-2-1′ : 9 min en 5, la moyenne 1,8 min.
  assert.equal(dose({ minutes: 9, reps: 5, bloc_min: 1.8 }), '9 min en 5 répétitions');
});
