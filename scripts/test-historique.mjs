#!/usr/bin/env node
/**
 * L'historique des 13 semaines d'avant, lu dans Nolio, pour le niveau habituel du moteur (lib/app/charge.ts ; décision 8
 * du coach du 09/11/2026 : « le niveau habituel se lit dans Nolio sur ses semaines d'entraînement normales des 3 derniers
 * mois ; sans historique, sa déclaration »), sans réseau ni base : les semaines complètes du lundi au dimanche, la plus
 * ancienne d'abord, sans les jours de course dans le volume ni dans la plus longue sortie ; il ne part qu'une fois.
 * Cas fictifs.
 *
 *   node --test scripts/test-historique.mjs
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
const { historiqueDejaRecu, historiqueParSemaine, SEMAINES_HISTORIQUE } = await import('../lib/app/charge.ts');
const { ajouterJours } = await import('../lib/app/plan.ts');

// La semaine qui s'écrit commence le lundi 16/11/2026 : l'historique va du lundi 17/08 (91 jours avant) au dimanche 15/11.
const LUNDI = '2026-11-16';
const DEBUT = ajouterJours(LUNDI, -7 * SEMAINES_HISTORIQUE);

test('13 semaines complètes, la plus ancienne d’abord, chacune à son lundi', () => {
  assert.equal(SEMAINES_HISTORIQUE, 13);
  assert.equal(DEBUT, '2026-08-17');
  const semaines = historiqueParSemaine(DEBUT, [], []);
  assert.equal(semaines.length, 13);
  assert.equal(semaines[0].lundi, '2026-08-17');
  assert.equal(semaines[1].lundi, '2026-08-24');
  assert.equal(semaines[12].lundi, '2026-11-09', 'la dernière : la semaine d’avant celle qui s’écrit');
  for (const [i, s] of semaines.entries()) {
    assert.equal(s.lundi, ajouterJours(DEBUT, 7 * i));
    assert.equal(new Date(`${s.lundi}T12:00:00Z`).getUTCDay(), 1, `${s.lundi} est un lundi`);
  }
  assert.equal(historiqueParSemaine(DEBUT, [], [], 4).length, 4, 'n semaines quand on le demande');
});

test('une semaine d’entraînement : le volume, la plus longue sortie, en minutes entières', () => {
  const seances = [
    { date: '2026-09-07', min: 45.4 }, { date: '2026-09-09', min: 50.3 }, { date: '2026-09-11', min: 40 },
    { date: '2026-09-13', min: 95.6 }, // la sortie longue du dimanche
  ];
  const s = historiqueParSemaine(DEBUT, seances, []).find((x) => x.lundi === '2026-09-07');
  assert.deepEqual(s, { lundi: '2026-09-07', volume_min: 231, sl_min: 96, course: false, course_min: 0 });
});

test('un jour de course : hors du volume et de la plus longue sortie, la semaine marquée avec la course', () => {
  const course = '2026-10-18'; // un trail le dimanche
  const seances = [
    { date: '2026-10-13', min: 40 }, { date: '2026-10-15', min: 35 },
    { date: course, min: 50 }, // l'échauffement du jour de course : il ne compte pas non plus
    { date: course, min: 312.7 }, // la course elle-même
    { date: '2026-10-21', min: 30 }, // la récupération, la semaine d'après
  ];
  const semaines = historiqueParSemaine(DEBUT, seances, [course]);
  const deLaCourse = semaines.find((x) => x.lundi === '2026-10-12');
  assert.deepEqual(deLaCourse, { lundi: '2026-10-12', volume_min: 75, sl_min: 40, course: true, course_min: 313 });
  const dApres = semaines.find((x) => x.lundi === '2026-10-19');
  assert.deepEqual(dApres, { lundi: '2026-10-19', volume_min: 30, sl_min: 30, course: false, course_min: 0 });
  // Une course prévue et non courue (rien ce jour-là) : la semaine reste marquée, sans durée de course.
  const sansActivite = historiqueParSemaine(DEBUT, [{ date: '2026-08-18', min: 60 }], ['2026-08-23'])[0];
  assert.deepEqual(sansActivite, { lundi: '2026-08-17', volume_min: 60, sl_min: 60, course: true, course_min: 0 });
});

test('une semaine vide : tout à 0 (malade, en vacances, ou pas encore dans Nolio)', () => {
  const seances = [{ date: '2026-09-01', min: 60 }, { date: '2026-09-15', min: 60 }];
  const vide = historiqueParSemaine(DEBUT, seances, []).find((x) => x.lundi === '2026-09-07');
  assert.deepEqual(vide, { lundi: '2026-09-07', volume_min: 0, sl_min: 0, course: false, course_min: 0 });
  assert.ok(historiqueParSemaine(DEBUT, [], []).every((s) => s.volume_min === 0 && s.sl_min === 0 && !s.course && s.course_min === 0),
    'rien couru : 13 semaines à 0');
});

test('les bornes : le dimanche dans sa semaine, la veille du début et le lundi qui s’écrit dehors', () => {
  const seances = [
    { date: '2026-08-16', min: 200 }, // la veille du début : hors de l'historique
    { date: DEBUT, min: 30 }, // le premier lundi : dedans
    { date: '2026-08-23', min: 70 }, // le dimanche de la première semaine : dans la première semaine
    { date: '2026-08-24', min: 20 }, // le lundi d'après : dans la deuxième
    { date: '2026-11-15', min: 80 }, // la veille de `LUNDI`, un dimanche : dans la dernière semaine
    { date: LUNDI, min: 150 }, // la semaine qui s'écrit : hors de l'historique
  ];
  const semaines = historiqueParSemaine(DEBUT, seances, [LUNDI]);
  assert.deepEqual(semaines[0], { lundi: '2026-08-17', volume_min: 100, sl_min: 70, course: false, course_min: 0 });
  assert.deepEqual(semaines[1], { lundi: '2026-08-24', volume_min: 20, sl_min: 20, course: false, course_min: 0 });
  assert.deepEqual(semaines[12], { lundi: '2026-11-09', volume_min: 80, sl_min: 80, course: false, course_min: 0 });
  assert.equal(semaines.reduce((a, s) => a + s.volume_min, 0), 200, 'ni la veille du début ni le lundi qui s’écrit');
  assert.ok(!semaines.some((s) => s.course), 'une course le lundi qui s’écrit ne marque aucune semaine de l’historique');
});

test('déjà reçu : seulement quand le moteur a posé sa marque dans son état', () => {
  assert.equal(historiqueDejaRecu(null), false, 'pas d’état : un objectif qui part');
  assert.equal(historiqueDejaRecu(undefined), false);
  assert.equal(historiqueDejaRecu({}), false, 'un objectif déjà en cours, d’avant la marque : il part une fois');
  assert.equal(historiqueDejaRecu({ niveau_habituel: null }), false);
  assert.equal(historiqueDejaRecu({ niveau_habituel: { volume_min: 240 } }), false, 'un niveau sans la marque : pas reçu');
  assert.equal(historiqueDejaRecu({ niveau_habituel: { historique: false } }), false);
  assert.equal(historiqueDejaRecu({ niveau_habituel: { historique: 'oui' } }), false, 'seulement true');
  assert.equal(historiqueDejaRecu({ niveau_habituel: { historique: true } }), true);
  assert.equal(historiqueDejaRecu({ niveau_habituel: { historique: true, volume_min: 240, sl_min: 100 } }), true);
});
