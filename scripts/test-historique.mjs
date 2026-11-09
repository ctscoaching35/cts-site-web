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
const { historiqueDejaRecu, historiqueParSemaine, niveauHabituel, SEMAINES_HISTORIQUE } = await import('../lib/app/charge.ts');
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

// ─── Le niveau habituel, lu au site pour la saison de fond (moteur 8.460, D3 ; décision 8 du coach du 09/11/2026) ───
const semaine = (i, volume_min, sl_min, course = false, course_min = 0) =>
  ({ lundi: ajouterJours(DEBUT, 7 * i), volume_min, sl_min, course, course_min });

test('le niveau habituel : la médiane de ses semaines normales, ni la course, ni sa récupération, ni une semaine allégée', () => {
  // Le cas du self-test du moteur (cts_bilan) : 3 semaines à 300, une allégée à 200, 3 à 310, la course, sa récupération,
  // 4 semaines à 305.
  const lues = [...[0, 1, 2].map((i) => semaine(i, 300, 100)), semaine(3, 200, 70), ...[4, 5, 6].map((i) => semaine(i, 310, 105)),
    semaine(7, 120, 60, true, 300), semaine(8, 150, 60), ...[9, 10, 11, 12].map((i) => semaine(i, 305, 110))];
  assert.deepEqual(niveauHabituel(lues), { volume_min: 305, sl_min: 105, semaines: 10 });
});

test('après une préparation : son volume et sa sortie longue des mêmes semaines (N9), jamais sa course', () => {
  // 8 semaines de préparation (6 h 30, sorties de 2 h 45), l'affûtage, la course de 5 h 30, 2 semaines de récupération.
  const lues = [...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => semaine(i, 390, 165)), semaine(8, 270, 120), semaine(9, 190, 80),
    semaine(10, 60, 30, true, 330), semaine(11, 105, 45), semaine(12, 165, 75)];
  const n = niveauHabituel(lues);
  assert.deepEqual(n, { volume_min: 390, sl_min: 165, semaines: 8 });
  assert.ok(n.sl_min <= n.volume_min, 'jamais une sortie longue au-dessus du volume');
});

test('pas assez de semaines normales : null (sa déclaration tient lieu de lui)', () => {
  assert.equal(niveauHabituel([]), null);
  assert.equal(niveauHabituel([semaine(0, 300, 100), semaine(1, 310, 110), semaine(2, 0, 0)]), null);
  assert.equal(niveauHabituel([semaine(0, 300, 100), semaine(1, 300, 100), semaine(2, 300, 100, true, 200)]), null);
});
