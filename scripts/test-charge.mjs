#!/usr/bin/env node
/**
 * La charge du moment lue dans Nolio, sans réseau ni base (lib/app/charge.ts) : toujours les 4 dernières semaines
 * complètes, sans les jours de course, plus aucun recul après une course (décision coach du 07/11/2026, « A ») ; le
 * volume du moment (décision coach du 24/10/2026) inchangé.
 *
 *   node --test scripts/test-charge.mjs
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
const { fenetreDeCharge, semainesDeCharge, volumeDuMoment } = await import('../lib/app/charge.ts');

test('les 4 dernières semaines complètes, du lundi au dimanche, la fin au lundi de la semaine en cours', () => {
  assert.deepEqual(fenetreDeCharge('2026-11-07'), { debut: '2026-10-05', fin: '2026-11-02' }); // un samedi
  assert.deepEqual(fenetreDeCharge('2026-11-02'), { debut: '2026-10-05', fin: '2026-11-02' }); // un lundi
  assert.deepEqual(fenetreDeCharge('2026-11-08'), { debut: '2026-10-05', fin: '2026-11-02' }); // un dimanche
});

test('une course il y a 10 jours : les 4 dernières semaines complètes, sans le jour de course (avant : du 07/09 au 04/10)', () => {
  const aujourdhui = '2026-11-03';
  const course = '2026-10-24';
  const { debut, fin } = fenetreDeCharge(aujourdhui);
  assert.deepEqual({ debut, fin }, { debut: '2026-10-05', fin: '2026-11-02' });
  // Son bloc d'octobre : 3h30 par semaine, puis la semaine de la course (2h d'entraînement et 5h de course), puis 1h.
  const seances = [
    ...['2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'].map((date) => ({ date, min: 30 })), // avant la fenêtre
    ...['2026-10-06', '2026-10-08', '2026-10-11', '2026-10-13', '2026-10-15', '2026-10-18'].map((date) => ({ date, min: 70 })),
    { date: '2026-10-20', min: 60 }, { date: '2026-10-22', min: 60 }, { date: course, min: 300 },
    { date: '2026-10-29', min: 60 },
    { date: '2026-11-02', min: 45 }, // la semaine en cours : hors de la fenêtre
  ];
  const { recentes, parSemaine } = semainesDeCharge(debut, fin, seances, [course]);
  assert.deepEqual(parSemaine, [210, 210, 120, 60]);
  assert.ok(!recentes.some((r) => r.date === course), 'le jour de course ne compte pas');
  assert.ok(!recentes.some((r) => r.date < debut || r.date >= fin));
  assert.equal(Math.max(...recentes.map((r) => r.min)), 70, 'la plus longue sortie, sans la course');
  assert.equal(volumeDuMoment(parSemaine).retenu, 150);
});

test('le volume du moment : sa dernière semaine, bornée par la moyenne et la moyenne +30 %', () => {
  assert.deepEqual(volumeDuMoment([200, 200, 200, 220]), { retenu: 220, moyenne: 205, pourquoi: 'derniere' });
  assert.deepEqual(volumeDuMoment([200, 200, 200, 100]), { retenu: 175, moyenne: 175, pourquoi: 'moyenne' });
  const pic = volumeDuMoment([100, 100, 100, 400]);
  assert.equal(pic.pourquoi, 'plafond');
  assert.ok(Math.abs(pic.retenu - 175 * 1.3) < 1e-9);
});
