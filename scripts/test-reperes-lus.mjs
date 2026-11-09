#!/usr/bin/env node
/**
 * Les repères entre l'app et Nolio, sans réseau ni base (lib/app/reperesLus.ts ; décision 10 du coach du 09/11/2026,
 * moteur 8.462 : « on ne prescrit pas avec une valeur qu'on n'a pas dans Nolio ») : la FC au seuil 1 reprise de Nolio
 * comme la VC et la FC au seuil 2 ; une valeur égale ne change ni la source ni la date ; le rattrapage de nuit pour toute
 * fiche qui a une valeur.
 *
 *   node --test scripts/test-reperes-lus.mjs
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
const { METRIQUES_LUES, aDesReperes, reprendreDeNolio } = await import('../lib/app/reperesLus.ts');

const m = (cle) => METRIQUES_LUES.find((x) => x.cle === cle);
const LIMITE = '2026-05-10';

test('la FC au seuil 1 se lit dans Nolio, comme la VC et la FC au seuil 2', () => {
  assert.deepEqual(METRIQUES_LUES.map((x) => x.cle), ['vc_ms', 'fc_seuil2', 'fc_seuil1']);
  assert.equal(m('fc_seuil1').item, 'mti_z68Hn6mEubaMh4i');
  assert.equal(m('fc_seuil1').valeur(158.4), 158);
  assert.equal(m('fc_seuil1').valeur(60), null);
  assert.equal(m('vc_ms').valeur(250), 4);
});

test("l'app n'a rien : la valeur de Nolio, quel que soit son âge", () => {
  assert.equal(reprendreDeNolio(m('fc_seuil1'), null, undefined, 158, '2025-01-01', LIMITE), true);
  assert.equal(reprendreDeNolio(m('fc_seuil1'), undefined, undefined, 158, '2026-11-01', LIMITE), true);
  assert.equal(reprendreDeNolio(m('fc_seuil1'), null, undefined, null, '2026-11-01', LIMITE), false);
});

test("l'app en a une : celle de Nolio la remplace plus récente, de moins de 6 mois et différente", () => {
  assert.equal(reprendreDeNolio(m('fc_seuil1'), 155, '2026-10-01', 158, '2026-11-01', LIMITE), true);
  assert.equal(reprendreDeNolio(m('fc_seuil1'), 155, '2026-11-02', 158, '2026-11-01', LIMITE), false);
  assert.equal(reprendreDeNolio(m('fc_seuil1'), 155, '2026-10-01', 158, '2026-04-01', LIMITE), false);
  assert.equal(reprendreDeNolio(m('fc_seuil1'), 155, undefined, 158, '2026-11-01', LIMITE), false);
  // La même valeur, que l'app a écrite elle-même plus tard que son test : ni la source ni la date ne bougent.
  assert.equal(reprendreDeNolio(m('fc_seuil1'), 158, '2026-10-01', 158, '2026-11-01', LIMITE), false);
  assert.equal(reprendreDeNolio(m('vc_ms'), 4.001, '2026-10-01', 4, '2026-11-01', LIMITE), false);
  assert.equal(reprendreDeNolio(m('vc_ms'), 3.9, '2026-10-01', 4, '2026-11-01', LIMITE), true);
});

test('le rattrapage de nuit : toute fiche qui a une valeur, la FC au seuil 1 seule comprise', () => {
  assert.equal(aDesReperes({ fc_seuil1: 158, vc_ms: null, fc_seuil2: null }), true);
  assert.equal(aDesReperes({ fc_seuil2: 172 }), true);
  assert.equal(aDesReperes({ vc_ms: 4 }), true);
  assert.equal(aDesReperes({ fc_seuil1: null, vc_ms: null, fc_seuil2: null }), false);
});
