#!/usr/bin/env node
/**
 * L'OBJECTIF CONFRONTÉ À LA VITESSE CRITIQUE (C12 de la revue des huit plans, décision coach du 12/11/2026 ; moteur 8.462) :
 * lib/app/objectifVc.ts dit l'écart de plus de 5 % entre le chrono visé et celui que prédit la VC, sur la route seulement,
 * et propose une cible à mi-chemin ; le texte ne parle jamais d'échanger avec un coach. Sans réseau ni base.
 *
 *   node --test scripts/test-objectif-vc.mjs
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
const { ecartObjectifVc, texteEcartObjectifVc, heuresDuChrono, chronoEnClair } = await import('../lib/app/objectifVc.ts');

test('les chronos se lisent et s’écrivent', () => {
  assert.equal(heuresDuChrono('1h45'), 1.75);
  assert.equal(heuresDuChrono('3h'), 3);
  assert.equal(heuresDuChrono('55 min'), 55 / 60);
  assert.equal(heuresDuChrono('n’importe quoi'), null);
  assert.equal(chronoEnClair(1.6), '1 h 36');
  assert.equal(chronoEnClair(55 / 60), '55 min');
});

test('le semi de la revue : 1 h 45 visé, une VC de 4:16/km qui prédit 1 h 36, une cible proposée', () => {
  const e = ecartObjectifVc('R21', '1h45', 3.9);
  assert.ok(e && e.sens === 'prudent' && e.ecart > 0.05, JSON.stringify(e));
  assert.equal(chronoEnClair(e.predit_h), '1 h 37');
  const texte = texteEcartObjectifVc(e);
  assert.match(texte, /C’est toi qui choisis/);
  assert.doesNotMatch(texte, /coach/i);
});

test('sous 5 % d’écart, hors route ou sans VC : rien', () => {
  assert.equal(ecartObjectifVc('R42', '3h', 4.6), null);
  assert.equal(ecartObjectifVc('TM', '6h', 3.5), null);
  assert.equal(ecartObjectifVc('R10', '0h55', null), null);
});

test('un objectif trop ambitieux se dit aussi', () => {
  const e = ecartObjectifVc('R10', '0h40', 3.2);
  assert.ok(e && e.sens === 'ambitieux', JSON.stringify(e));
  assert.match(texteEcartObjectifVc(e), /plus rapide/);
});
