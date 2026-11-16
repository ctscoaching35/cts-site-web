#!/usr/bin/env node
/**
 * Le compteur des retouches du coach dans Nolio (lib/app/retouchesCompte.ts : compterLaSemaine, la
 * part sans retouche et la cible), sans réseau ni base. Décisions du coach du 16/11/2026 : une séance déplacée est une
 * retouche (Nolio change sa révision : une modifiée, comptée aussi parmi les déplacées) ; la cible, au plus 15 % de semaines retouchées ; la semaine en cours à côté des 4 semaines finies.
 *
 *   node --test scripts/test-retouches.mjs
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
const { compterLaSemaine, partDe, cibleTenue, CIBLE_RETOUCHEES } = await import('../lib/app/retouchesCompte.ts');

const semaine = { jours: [
  { id: 'S5-mardi', famille: 'qualite', seance: 'Seuil 2 court vallonné', duree: '0h44', date_iso: '2026-11-17' },
  { id: 'S5-jeudi', famille: 'ef', seance: 'EF plate', duree: '0h45', date_iso: '2026-11-19' },
  { id: 'S5-samedi', famille: 'sl', seance: 'Sortie longue', duree: '1h45', date_iso: '2026-11-21' },
] };
const envoyees = [
  { jour_id: 'S5-mardi', nolio_id: 1, revision: 'a' },
  { jour_id: 'S5-jeudi', nolio_id: 2, revision: 'b' },
  { jour_id: 'S5-samedi', nolio_id: 3, revision: 'c' },
];
const dansNolio = (lignes) => new Map(lignes.map((x) => [String(x.id), x]));

test('une semaine intacte : rien de modifié, déplacé ni supprimé', () => {
  const f = compterLaSemaine(semaine, envoyees, dansNolio([
    { id: '1', date_start: '2026-11-17', revision: 'a' }, { id: '2', date_start: '2026-11-19T00:00:00', revision: 'b' },
    { id: '3', date_start: '2026-11-21', revision: 'c' }]));
  for (const c of Object.values(f)) assert.deepEqual([c.modifiees, c.deplacees, c.supprimees], [0, 0, 0]);
  assert.equal(partDe([{ familles: f, ajoutees: 0 }]).intactes, 1);
});

test('une séance déplacée : Nolio change sa révision, une modifiée, et comptée parmi les déplacées (décision du coach du 16/11/2026)', () => {
  const f = compterLaSemaine(semaine, envoyees, dansNolio([
    { id: '1', date_start: '2026-11-18', revision: 'a2' }, { id: '2', date_start: '2026-11-19', revision: 'b' },
    { id: '3', date_start: '2026-11-21', revision: 'c' }]));
  assert.deepEqual([f.seuil2.modifiees, f.seuil2.deplacees], [1, 1]);
  assert.deepEqual([f.ef.modifiees, f.ef.deplacees], [0, 0]);
  const p = partDe([{ familles: f, ajoutees: 0 }]);
  assert.deepEqual([p.intactes, p.semaines], [0, 1], 'la semaine n’est plus intacte');
});

test('modifiée le même jour : pas déplacée ; une révision inchangée : rien ; supprimée : en supprimée', () => {
  const f = compterLaSemaine(semaine, envoyees, dansNolio([
    { id: '1', date_start: '2026-11-17', revision: 'a2', duration: { value: 30 * 60 } }, { id: '3', date_start: '2026-11-22', revision: 'c' }]));
  assert.deepEqual([f.seuil2.modifiees, f.seuil2.deplacees], [1, 0]);
  assert.deepEqual([f.sl.modifiees, f.sl.deplacees], [0, 0], 'sans révision changée, rien ne se compte');
  assert.equal(f.ef.supprimees, 1);
});

test('les comptes d’avant le 16/11 (sans deplacees) se lisent encore', () => {
  const ancien = { ef: { envoyees: 3, modifiees: 0, supprimees: 0, min_avant: 0, min_apres: 0 } };
  assert.deepEqual(partDe([{ familles: ancien, ajoutees: 0 }]), { intactes: 1, semaines: 1, part: 1 });
});

test('la cible : au plus 15 % de semaines retouchées', () => {
  assert.equal(CIBLE_RETOUCHEES, 0.15);
  assert.equal(cibleTenue({ intactes: 17, semaines: 20, part: 0.85 }), true);
  assert.equal(cibleTenue({ intactes: 16, semaines: 20, part: 0.8 }), false);
  assert.equal(cibleTenue({ intactes: 0, semaines: 0, part: null }), null);
});
