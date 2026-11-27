#!/usr/bin/env node
/**
 * UN ATHLÈTE RETIRÉ PAR LE COACH NE REVIENT PAS, même encore dans son équipe Nolio (27/11/2026 : « je retire un athlète car je ne le suis plus et il reste quand même dans l'app »). Le coach le rajoute : il revient.
 * Des athlètes inventés, sans réseau ni base.
 *
 *   node --test scripts/test-retirer-athlete.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const { rapprocherEquipe, retiree } = await import(`${RACINE}lib/app/anciens.ts`);
const equipe = [{ id: 'usr_moi', name: 'Coach (toi)' }, { id: 'usr_a', name: 'Alix Durand' }, { id: 'usr_b', name: 'Camille Bernard' }];
const fiche = (id, usr, plus = {}) => ({ id, coach_id: 'c1', nom: id, nolio_athlete_id: usr, ...plus });

test('encore dans l’équipe Nolio, un retiré n’est ni recréé ni ramené', () => {
  const r = rapprocherEquipe({ equipe, acheteurs: new Set(), coachId: 'c1', fiches: [
    fiche('f1', 'usr_a', { ancien_le: '2026-11-27', questionnaires: { retire: true } }), fiche('f2', 'usr_b')] });
  assert.deepEqual(r.creer, []);
  assert.deepEqual(r.revenus, []);
  assert.deepEqual(r.partis, []);
});

test('un ancien sorti puis revenu dans l’équipe revient comme avant', () => {
  const r = rapprocherEquipe({ equipe, acheteurs: new Set(), coachId: 'c1', fiches: [
    fiche('f1', 'usr_a', { ancien_le: '2026-11-01', questionnaires: { jusqua: '2026-11-01' } }), fiche('f2', 'usr_b')] });
  assert.deepEqual(r.revenus, ['f1']);
  assert.equal(retiree({ questionnaires: null }), false);
});

test('le geste garde la ligne après le retrait, pas pour le coach ; le rajouter la reprend', () => {
  const code = readFileSync(`${RACINE}lib/app/actionsCoaching.ts`, 'utf8');
  const geste = code.slice(code.indexOf('export async function retirerAthlete'), code.indexOf('async function reprendreSiRetiree'));
  assert.ok(geste.indexOf('await retirerFiche(') < geste.indexOf("questionnaires: { retire: true }"));
  assert.ok(geste.includes("usr !== (await moiNolio().catch(() => null))?.id"));
  assert.equal(code.split('await reprendreSiRetiree(coach.compteId, id)').length - 1, 2, 'les deux façons de le rajouter');
});
