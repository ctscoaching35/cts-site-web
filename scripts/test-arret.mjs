#!/usr/bin/env node
/**
 * L'arrêt d'avant le plan (moteur 8.460, défaut vu par le coach le 08/11/2026), côté site, sans réseau ni base
 * (lib/app/derniereCourse.ts) : la date de la dernière course que le site transmet au moteur (`retours.derniere_course`),
 * et « rien n'est lu » quand une première semaine ne porte qu'elle.
 *
 *   node --test scripts/test-arret.mjs
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
const { derniereCourse, rienDeLu, JOURS_DERNIERE_COURSE } = await import('../lib/app/derniereCourse.ts');

const COURSE = 'spt_kNYHjuEzDJRiYCX';
const TRAIL = 'spt_YprHS7jgV5vdsz0';
const SPORTS = [COURSE, TRAIL, 'spt_MN7QZspJBLkSzwy'];
const VELO = 'spt_velo';

test('le cas du coach : ses deux courses d’avant le plan, puis rien', () => {
  const lues = [
    { date_start: '2026-10-27T18:30:00+01:00', sport: COURSE },
    { date_start: '2026-10-31T10:05:00+01:00', sport: TRAIL },
    { date_start: '2026-11-04T19:00:00+01:00', sport: VELO }, // un autre sport : pas une course
  ];
  assert.equal(derniereCourse(lues, SPORTS, '2026-11-08'), '2026-10-31');
});

test('rien couru, ou rien de lisible : pas de date (le moteur ne déduit aucun arrêt)', () => {
  assert.equal(derniereCourse([], SPORTS, '2026-11-08'), null);
  assert.equal(derniereCourse([{ date_start: '2026-11-03', sport: VELO }], SPORTS, '2026-11-08'), null);
  assert.equal(derniereCourse([{ date_start: 'pas une date', sport: COURSE }], SPORTS, '2026-11-08'), null);
});

test('une course après le jour de la lecture ne compte pas', () => {
  assert.equal(derniereCourse([{ date_start: '2026-11-02', sport: COURSE }, { date_start: '2026-11-09T08:00:00Z', sport: COURSE }],
    SPORTS, '2026-11-08'), '2026-11-02');
});

test('le départ relit 90 jours', () => {
  assert.equal(JOURS_DERNIERE_COURSE, 90);
});

test('« rien n’est lu » : sans retours, ou une première semaine qui ne porte que la dernière course', () => {
  assert.equal(rienDeLu(null), true);
  assert.equal(rienDeLu({ seances: [], hooper: [], derniere_course: '2026-10-31' }), true);
  assert.equal(rienDeLu(undefined), false); // pas d’aperçu calculé : comme avant
  assert.equal(rienDeLu({ seances: [], hooper: [], questionnaire: { jours: ['lundi'], jour_sl: null, nb_seances: 3 } }), false);
  assert.equal(rienDeLu({ seances: [], hooper: [], nolio: { prevues: {}, ajoutees: [] }, derniere_course: '2026-10-31' }), false);
});
