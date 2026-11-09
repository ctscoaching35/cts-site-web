#!/usr/bin/env node
/**
 * LE TERRAIN DANS LE NOM (moteur 8.460, décisions coach du 08/11/2026 au soir, « A », et du 09/11/2026) : la barre et le
 * moteur nomment « Seuil 1 vallonné · 24 min — progressif 12 + 12 min », « Seuil 2 court vallonné · 15 min — 5 × 3 min »,
 * « Tempo vallonné · 30 min — 3 × 10 min », « VO2 long vallonné · 9 min — 1-2-3-2-1′ », et à plat « Seuil 2 court plat ·
 * 15 min — 5 × 3 min » ; la découverte du Seuil 1, « Seuil 1 vallonné · 15 min — 3 × 5 min ». Les séances déjà dans Nolio
 * et les semaines gardées portent le nom d'avant (« Seuil 1 · 24 min — … », « Tempo · … · vallonné », « Seuil 1 découverte ·
 * … ») : lib/app/barreFamilles.ts (régénéré par scripts/familles-barre.mjs depuis le moteur) reconnaît les deux, dans la
 * même famille. Sans réseau ni base.
 *
 *   node --test scripts/test-noms-terrain.mjs
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
const { FAMILLES_DE_LA_BARRE } = await import('../lib/app/barreFamilles.ts');
const { nomNormal } = await import('../lib/app/classement.ts');

const famille = (nom) => FAMILLES_DE_LA_BARRE[nomNormal(nom)];

test('le nouveau nom et celui d’avant, dans la même famille', () => {
  for (const [nouveau, avant, f] of [
    ['Seuil 1 vallonné · 24 min — progressif 12 + 12 min', 'Seuil 1 · 24 min — progressif 12 + 12 min', 'seuil1'],
    ['Seuil 1 vallonné · 30 min — 3 × 10 min', 'Seuil 1 · 30 min — 3 × 10 min', 'seuil1'],
    ['Seuil 2 court vallonné · 15 min — 5 × 3 min', 'Seuil 2 court · 15 min — 5 × 3 min', 'seuil2'],
    ['Seuil 2 long vallonné · 21 min — pyramide 3-4-7-4-3 min', 'Seuil 2 long · 21 min — pyramide 3-4-7-4-3 min', 'seuil2'],
  ]) {
    assert.equal(famille(nouveau), f, nouveau);
    assert.equal(famille(avant), f, avant);
  }
  // Le nom d'avant le 03/11 (sans « court » ni « long ») reste lu, lui aussi.
  assert.equal(famille('Seuil 2 · 15 min — 5 × 3 min'), 'seuil2');
});

test('chaque Seuil 1 et Seuil 2 vallonné de la barre a son nom d’avant, et rien d’autre ne change', () => {
  // 73 le 08/11, et la découverte du Seuil 1 renommée le 09/11 (son nom d'avant : « Seuil 1 découverte · … »).
  const vallonnes = Object.keys(FAMILLES_DE_LA_BARRE).filter((n) => /^Seuil (?:1|2 court|2 long) vallonné · /.test(n)
    && n !== 'Seuil 1 vallonné · 15 min — 3 × 5 min');
  assert.equal(vallonnes.length, 73);
  for (const n of vallonnes) {
    const avant = n.replace(/^(Seuil 1|Seuil 2 court|Seuil 2 long) vallonné · /, '$1 · ');
    assert.equal(famille(avant), famille(n), avant);
  }
});

test('les décisions du 09/11 : le Tempo et la VO2max en tête, le plat, la découverte, et leurs noms d’avant', () => {
  for (const [nouveau, avant, f] of [
    ['Tempo vallonné · 30 min — 3 × 10 min', 'Tempo · 30 min — 3 × 10 min · vallonné', 'tempo'],
    ['VO2 long vallonné · 9 min — 1-2-3-2-1′', 'VO2 long · 9 min — 1-2-3-2-1′ · vallonné', 'vo2max'],
    ['VO2 court vallonné · 10 min — 2 × 10 × 30″/30″', 'VO2 court · 10 min — 2 × 10 × 30″/30″ · vallonné', 'vo2max'],
    ['Seuil 1 vallonné · 15 min — 3 × 5 min', 'Seuil 1 découverte · 15 min — 3 × 5 min', 'seuil1'],
  ]) {
    assert.equal(famille(nouveau), f, nouveau);
    assert.equal(famille(avant), f, avant);
  }
  const tempo = Object.keys(FAMILLES_DE_LA_BARRE).filter((n) => /^Tempo vallonné · /.test(n));
  const vo2 = Object.keys(FAMILLES_DE_LA_BARRE).filter((n) => /^VO2 (?:court|long) vallonné · /.test(n));
  assert.deepEqual([tempo.length, vo2.length], [12, 19]);
  for (const n of [...tempo, ...vo2]) {
    const avant = n.replace(/^(Tempo|VO2 court|VO2 long) vallonné · (.*)$/, '$1 · $2 · vallonné');
    assert.equal(famille(avant), famille(n), avant);
  }
  // Le Seuil 1 et le Seuil 2 du trail à plat : leur sous-dossier « Plat ».
  for (const [n, f] of [['Seuil 2 court plat · 15 min — 5 × 3 min', 'seuil2'], ['Seuil 2 long plat · 21 min — pyramide 3-4-7-4-3 min', 'seuil2'],
    ['Seuil 1 plat · 30 min — 3 × 10 min', 'seuil1'], ['Seuil 1 plat · 15 min — 3 × 5 min', 'seuil1']]) {
    assert.equal(famille(n), f, n);
  }
});
