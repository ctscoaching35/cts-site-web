#!/usr/bin/env node
/**
 * « LES MOTS DE TA SEMAINE » (lot 2 de l'app, décision du coach du 12/11/2026) : lib/app/motsDeLaSemaine.ts choisit les
 * mots des séances affichées, dans l'ordre du coach, RPE dès qu'une famille est reconnue, jamais le Hooper. Les noms sont
 * de vrais noms : ceux de la barre en séances clés en main (cts_bibliotheque.catalogue() du moteur, en codes), ceux que le
 * moteur écrit (« code · mots »), et ceux d'avant les codes (lib/app/exemples/app.json, moteur 8.455). Sans réseau ni base.
 *
 *   node --test scripts/test-mots-de-la-semaine.mjs
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
const { motsDeLaSemaine } = await import('../lib/app/motsDeLaSemaine.ts');

const mots = (noms) => motsDeLaSemaine(noms).map((m) => m.mot);

test('une semaine de trail en codes : ses familles seulement, dans l’ordre, RPE en dernier, sans Seuil 2 ni Hooper', () => {
  assert.deepEqual(mots(['EF V', 'S1 3×10′/2′ R · Seuil 1, route', 'NAV 2×10′ DA', 'MYO 2×4 squats', 'SL D+']),
    ['EF', 'SL', 'Seuil 1', 'Navettes', 'Côtes et renfo', 'RPE']);
});

test('la VO2max n’est plus oubliée ; le Seuil 2 seulement quand il y en a', () => {
  assert.deepEqual(mots(['EF R', 'VO2c 2×10×30/30 R', 'SL R']), ['EF', 'SL', 'VO2max', 'RPE']);
  assert.deepEqual(mots(['S2c 5×3′/1′ R · Seuil 2 court, route', 'VO2l 6×2′/1′30 R', 'EF R']),
    ['EF', 'Seuil 2', 'VO2max', 'RPE']);
  assert.ok(!mots(['EF R', 'VO2c 12×1′/1′ R']).includes('Seuil 2'));
});

test('tempo, montée sur tapis, renfo, week-end choc ; « Renfo, endurance de force » ne fait pas venir l’EF', () => {
  assert.deepEqual(mots(['T 3×8′/2′ R', 'TAPIS 3×8′ 10-12 %', 'RF force A (freiner) 2/3 · Renfo, endurance de force',
    'WEC J1 · Week-end choc, jour 1 sur 2', 'WEC J2']), ['Tempo', 'Montée sur tapis', 'Renfo', 'Week-end choc', 'RPE']);
});

test('l’allure : le mot exact de la séance s’il n’y en a qu’une, « Allure de course » s’il y en a plusieurs', () => {
  assert.deepEqual(mots(['EF R', 'A10 8×1km/2′']), ['EF', 'Allure 10 km', 'RPE']);
  assert.deepEqual(mots(['AM 40′ prog', 'SL + 2×20′ AM']), ['SL', 'Allure marathon', 'RPE']);
  assert.deepEqual(mots(['AS 3×2km/2′ test', 'SL + 2×20′ AM']), ['SL', 'Allure de course', 'RPE']);
  assert.equal(motsDeLaSemaine(['AS 4×1km/1′'])[0].sens, 'l’allure de ta course, calculée sur ton chrono visé.');
});

test('une endurance ou une sortie longue qui porte un bloc : ses deux familles', () => {
  assert.deepEqual(mots(['EF + 10′ S1 R']), ['EF', 'Seuil 1', 'RPE']);
  assert.deepEqual(mots(['SL + 15′ S1']), ['SL', 'Seuil 1', 'RPE']);
});

test('les noms d’avant les codes (la démonstration, moteur 8.455), lus par leurs mots', () => {
  assert.deepEqual(mots(['EF plate', 'VO2 long · 10 min — IT 3-2-1-1-1-1′ et 4 × 30″ · vallonné', 'Navettes descentes actives',
    'EF + sprints en côte', 'Myocrossmax', 'SL spécifique mécanique']), ['EF', 'SL', 'VO2max', 'Navettes', 'Côtes et renfo', 'RPE']);
  // Le nom que le moteur écrit depuis le 12/11/2026, sans code, se lit aussi.
  assert.deepEqual(mots(['Côtes et renfo · 2 × 10 squats']), ['Côtes et renfo', 'RPE']);
  assert.deepEqual(mots(['Seuil 2 court · 15 min — 5 × 3 min', 'SL finie au Seuil 1', 'Sortie longue + allure semi']),
    ['SL', 'Seuil 1', 'Seuil 2', 'Allure semi', 'RPE']);
  // Le week-end choc sous ses deux écritures ; une EF « (avant le week-end choc) » n'en est pas un.
  assert.deepEqual(mots(['Back-to-back — Jour 1/2 (sortie longue)', 'EF plate (avant back-to-back)']), ['EF', 'Week-end choc', 'RPE']);
  assert.deepEqual(mots(['Week-end choc — jour 2/2 (sortie longue)']), ['Week-end choc', 'RPE']);
});

test('aucune séance reconnue : aucun mot, pas de bloc', () => {
  assert.deepEqual(motsDeLaSemaine([]), []);
  assert.deepEqual(motsDeLaSemaine(['SPR 8×10″ C', 'LIBRE', 'CT 10km', 'TEST VC 3′+12′', 'Compétition — OCC', null]), []);
});

test('les définitions validées, mot pour mot, et jamais le Hooper', () => {
  const tout = motsDeLaSemaine(['EF R', 'SL R', 'S1 3×10′/2′ R', 'T 20′ R', 'S2l 4×8′ C+', 'VO2c 12×1′/1′ R', 'A10 6×4′/2′',
    'NAV 30′', 'MYO 2×4 chaise', 'TAPIS 2×15′ 10-12 %', 'RF force B (pousser) 1/3', 'WEC J1']);
  assert.deepEqual(tout.map((m) => m.mot), ['EF', 'SL', 'Seuil 1', 'Tempo', 'Seuil 2', 'VO2max', 'Allure 10 km', 'Navettes',
    'Côtes et renfo', 'Montée sur tapis', 'Renfo', 'Week-end choc', 'RPE']);
  const sens = Object.fromEntries(tout.map((m) => [m.mot, m.sens]));
  assert.equal(sens['Côtes et renfo'], 'de la force en côte : des montées enchaînées avec des exercices de renforcement.');
  assert.equal(sens['Seuil 1'], 'RPE 4-5 : un effort soutenu mais confortable, tu tiens une phrase courte.');
  assert.equal(sens.Tempo, 'RPE 6 : entre tes deux seuils, quelques mots seulement.');
  assert.equal(sens.VO2max, 'RPE 8-9 : très dur, un ou deux mots, sur des répétitions de quelques minutes au plus.');
  assert.equal(sens['Montée sur tapis'], 'une montée sur tapis incliné, pour qui n’a pas de longue côte.');
  assert.equal(sens.Renfo, 'du renforcement musculaire, à faire chez toi.');
  assert.equal(sens['Week-end choc'], 'des sorties longues enchaînées, pour apprendre à courir fatigué.');
  assert.ok(!tout.some((m) => /Hooper/.test(m.mot)));
});
