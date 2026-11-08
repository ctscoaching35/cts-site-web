#!/usr/bin/env node
/**
 * « Chiffres », la comptabilité des plans (lib/app/comptabilite.ts ; maquette validée par le coach le 08/11/2026, Q11 à
 * Q13) : les ventes par mois à Paris, le total de l'année, la période choisie, les montants en euros. Sans réseau ni base,
 * sur des ventes fabriquées.
 *
 *   node --test scripts/test-comptabilite.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

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
const { euros, moisDe, moisPrecedent, nomDuMois, parMois, periodeDe, total, ventesDe } = await import('../lib/app/comptabilite.ts');

const vente = (payeLe, centimes, extra = {}) => ({ id: payeLe, payeLe, centimes, nom: 'X', course: 'C', formule: 4, statut: 'actif', arretee: false, ...extra });
const VENTES = [
  vente('2026-08-12T10:00:00.000Z', 3900),
  vente('2026-10-20T08:00:00.000Z', 4900),
  // Le 1er novembre à 0 h 30 à Paris (le 31 octobre à 23 h 30 en UTC) : une vente de novembre.
  vente('2026-10-31T23:30:00.000Z', 5900),
  vente('2026-11-02T09:30:00.000Z', 4900),
  vente('2025-12-30T12:00:00.000Z', 5900),
];

test('le mois d’une vente, à Paris', () => {
  assert.equal(moisDe('2026-10-31T23:30:00.000Z'), '2026-11');
  assert.equal(moisDe('2026-10-31T21:30:00.000Z'), '2026-10');
  assert.equal(moisDe('2026-03-31T22:30:00.000Z'), '2026-04');
  assert.equal(moisPrecedent('2026-01'), '2025-12');
  assert.equal(moisPrecedent('2026-11'), '2026-10');
});

test('par mois : du mois en cours au plus ancien mois vendu de l’année, les mois vides compris', () => {
  assert.deepEqual(parMois(VENTES, '2026-11'), [
    { mois: '2026-11', ventes: 2, centimes: 10800 },
    { mois: '2026-10', ventes: 1, centimes: 4900 },
    { mois: '2026-09', ventes: 0, centimes: 0 },
    { mois: '2026-08', ventes: 1, centimes: 3900 },
  ]);
  // Trois mois au moins, même sans vente (ceux de l'année d'avant compris en début d'année).
  assert.deepEqual(parMois([], '2026-02').map((m) => m.mois), ['2026-02', '2026-01', '2025-12']);
  assert.equal(parMois(VENTES, '2026-01').length, 3);
  // Douze au plus.
  assert.equal(parMois([vente('2026-01-05T10:00:00.000Z', 100)], '2026-12').length, 12);
});

test('le total d’une période : un mois, ou l’année', () => {
  assert.deepEqual(total(ventesDe(VENTES, '2026-11')), { ventes: 2, centimes: 10800 });
  assert.deepEqual(total(ventesDe(VENTES, '2026')), { ventes: 4, centimes: 19600 });
  assert.deepEqual(total(ventesDe(VENTES, '2025')), { ventes: 1, centimes: 5900 });
  assert.deepEqual(total([]), { ventes: 0, centimes: 0 });
});

test('la période choisie', () => {
  assert.equal(periodeDe(undefined, '2026-11'), '2026-11');
  assert.equal(periodeDe('2026-10', '2026-11'), '2026-10');
  assert.equal(periodeDe('annee', '2026-11'), '2026');
  // Un mois à venir, ou une saisie illisible : le mois en cours.
  assert.equal(periodeDe('2026-12', '2026-11'), '2026-11');
  assert.equal(periodeDe('n’importe quoi', '2026-11'), '2026-11');
});

test('les montants et les mois en clair', () => {
  assert.equal(euros(4900), '49 €');
  assert.equal(euros(0), '0 €');
  assert.equal(euros(123450).replace(/\s/g, ' '), '1 234,50 €');
  assert.equal(nomDuMois('2026-11'), 'Novembre 2026');
  assert.equal(nomDuMois('2026-10', false), 'Octobre');
});
