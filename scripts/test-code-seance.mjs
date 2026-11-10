#!/usr/bin/env node
/**
 * LE CODE EN TÊTE DU NOM (la barre en séances clés en main, moteur 8.461 ; décision 12 du coach du 09/11/2026, « tout A ») :
 * lib/app/codeSeance.ts lit le code comme une grammaire (« S2c 5×3′/1′ R », « SL + 2×15′ EC »), lib/app/classement.ts en
 * tire la famille — « le contenu décide, le code tranche quand le contenu hésite » — et les noms de l'ancienne barre restent
 * reconnus. Sans réseau ni base ; la même grammaire côté moteur (cts_codes.py) est comparée à celle-ci par
 * tests_barre_cles_en_main.py, sur les 440 modèles.
 *
 *   node --test scripts/test-code-seance.mjs
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
const { lireCode, motsDuNom, nomCourt } = await import('../lib/app/codeSeance.ts');
const { classerSeanceNommee } = await import('../lib/app/classement.ts');

const rpe = (n) => ({ type: 'rpe', rpe: n });
const zone = (z, stream = 'heartrate') => ({ type: 'zone', zone: z, stream });
const pas = (intensity, min, targets) => ({ kind: 'step', intensity, duration: { value: min * 60, unit: 's' }, targets });
const rep = (times, steps) => ({ kind: 'repeat', times, steps });
const echauf = pas('warmup', 15, [zone(2), rpe(3)]);
const retour = pas('cooldown', 10, [zone(2), rpe(3)]);
const PROFIL = { vc_ms: 4, fc_seuil1: 150, fc_seuil2: 170 };

test('la grammaire : famille, structure, terrain ; la famille de la continuité', () => {
  for (const [nom, famille, lue, terrain, structure] of [
    ['S2c 5×3′/1′ R', 'S2c', 'seuil2', 'R', '5×3′/1′'],
    ['S2c 5×3′/1′ R · Seuil 2 court, route', 'S2c', 'seuil2', 'R', '5×3′/1′'],
    ['S1 UD 3×10′ C', 'S1', 'seuil1', 'C', 'UD 3×10′'],
    ['S2l 4×6′ C+', 'S2l', 'seuil2', 'C+', '4×6′'],
    ['T 3×10′/3′ V', 'T', 'tempo', 'V', '3×10′/3′'],
    ['VO2c 2×10×30/30 R', 'VO2c', 'vo2max', 'R', '2×10×30/30'],
    ['VO2l 3×1-2×2-3-2×2-3×1′ V', 'VO2l', 'vo2max', 'V', '3×1-2×2-3-2×2-3×1′'],
    ['SPR 2×6×15″ C', 'SPR', 'sprint', 'C', '2×6×15″'],
    ['AM 3×3km/1km', 'AM', 'allure', null, '3×3km/1km'],
    ['A10 6×1km/2′ vite', 'A10', 'allure', null, '6×1km/2′ vite'],
    ['AS 6×(1+1km)', 'AS', 'allure', null, '6×(1+1km)'],
    ['EF + 10′ S1', 'EF', 'seuil1', null, '+ 10′ S1'],
    ['EF + 7 SC V', 'EF', null, 'V', '+ 7 SC'],
    ['SL + 2×15′ EC', 'SL', null, null, '+ 2×15′ EC'],
    ['WEC J1 · Week-end choc, jour 1 sur 2', 'WEC', null, null, 'J1'],
    ['NAV 2×10′ DA', 'NAV', 'mecanique', null, '2×10′ DA'],
    ['MYO 2×10 squats', 'MYO', 'mecanique', null, '2×10 squats'],
    ['TAPIS 3×8′ marche 15 %', 'TAPIS', 'mecanique', null, '3×8′ marche 15 %'],
    ['RF force A (freiner) 2/3 · Renfo, endurance de force', 'RF', null, null, 'force A (freiner) 2/3'],
    ['TEST VC 3′+12′ · Test de vitesse critique', 'TEST', null, null, 'VC 3′+12′'],
    ['VELO EF', 'VÉLO', null, null, 'EF'],
    ['SL D+ Bauges', 'SL', null, null, 'D+ Bauges'],
  ]) {
    const lu = lireCode(nom);
    assert.ok(lu, nom);
    assert.deepEqual([lu.famille, lu.lue, lu.terrain, lu.structure], [famille, lue, terrain, structure], nom);
  }
});

test('les noms sans code : l’ancienne barre, le moteur d’avant, les séances du coach', () => {
  for (const nom of ['Seuil 2 court route · 15 min — 5 × 3 min', 'EF plate', 'EF vallonnée + sprints en côte', 'SL plaisir',
    'SL up & down', 'EF → Seuil 1 progressif · 25 min — 5 + 5 min au Seuil 1', 'Test de vitesse critique · 3 et 12 min',
    'Week-end choc — jour 1/2 (sortie longue) · 2h30', 'S1 au RPE', 'Sortie longue', 'Trail des Bauges', '']) {
    assert.equal(lireCode(nom), null, nom);
  }
});

test('l’app de l’athlète n’affiche que les mots ; une phrase prend les mots, ou la tête d’un nom d’avant', () => {
  assert.equal(motsDuNom('S2c 5×3′/1′ R · Seuil 2 court, route'), 'Seuil 2 court, route');
  assert.equal(motsDuNom('Seuil 2 court route · 15 min — 5 × 3 min'), 'Seuil 2 court route · 15 min — 5 × 3 min');
  assert.equal(motsDuNom('EF plate'), 'EF plate');
  assert.equal(nomCourt('S1 3×10′/2′ V · Seuil 1, vallonné'), 'Seuil 1, vallonné');
  assert.equal(nomCourt('Seuil 1 côte 5-15 % · 30 min — 6 × 5 min'), 'Seuil 1 côte 5-15 %');
});

test('le code tranche quand le contenu hésite (la maquette du 09/11)', () => {
  // Des montées à RPE 5 sans autre cible : le contenu dit mécanique, le code Seuil 1 ; la dose, les montées seules.
  const montees = [echauf, rep(6, [pas('ramp_up', 5, [zone(2), rpe(5)]), pas('ramp_down', 2, [rpe(3)])]), retour];
  assert.deepEqual(classerSeanceNommee('S1 6×5′ C', montees, PROFIL), { famille: 'seuil1', minutes: 30, reps: 6, bloc_min: 5 });
  // Une sortie longue avec des blocs à RPE 5 : une sortie longue, jamais une qualité de la semaine.
  const sl = [pas('work', 70, [zone(2), rpe(3)]), rep(2, [pas('work', 15, [rpe(5)]), pas('cooldown', 5, [rpe(3)])]),
    pas('cooldown', 40, [zone(2), rpe(3)])];
  assert.equal(classerSeanceNommee('SL + 2×15′ EC', sl, PROFIL), null);
  assert.equal(classerSeanceNommee('SL + 2×15′ EC · Sortie longue, à l’effort de ta course', sl, PROFIL), null);
  // L'allure marathon au RPE 6 : le contenu dit Tempo, le code allure.
  const am = [echauf, rep(3, [{ kind: 'step', intensity: 'work', distance: { value: 3000, unit: 'm' }, targets: [rpe(6)] },
    { kind: 'step', intensity: 'cooldown', distance: { value: 1000, unit: 'm' }, targets: [rpe(3)] }]), retour];
  assert.equal(classerSeanceNommee('AM 3×3km/1km · Allure marathon', am, PROFIL)?.famille, 'allure');
  // Des navettes en blocs de descentes actives à RPE 5 : de la mécanique, pas un Seuil 1.
  const nav = [echauf, pas('work', 10, [rpe(3)]), pas('work', 10, [rpe(5)]), pas('work', 5, [rpe(3)]), pas('work', 10, [rpe(5)]),
    retour];
  assert.equal(classerSeanceNommee('NAV 2×10′ DA', nav, PROFIL)?.famille, 'mecanique');
  // Un test à fond : jamais une séance de VO2max ou de sprint de la semaine.
  assert.equal(classerSeanceNommee('TEST VC 3′+12′', [echauf, pas('work', 3, [rpe(10)]), pas('work', 12, [rpe(10)]), retour], PROFIL), null);
});

test('le chiffre du nom changé par le coach : le code reste, la dose vient du contenu', () => {
  const s2 = (n) => [echauf, rep(n, [pas('work', 3, [zone(4, 'pace'), rpe(7)]), pas('cooldown', 1, [rpe(2)])]), retour];
  assert.deepEqual(classerSeanceNommee('S2c 6×3′/1′ R', s2(6), PROFIL), { famille: 'seuil2', minutes: 18, reps: 6, bloc_min: 3 });
  // Le nom dit 5 × 3′, la séance en porte 6 : la dose est celle de la séance (Nolio fait foi).
  assert.equal(classerSeanceNommee('S2c 5×3′/1′ R', s2(6), PROFIL)?.minutes, 18);
});

test('une EF à fin courte reste une EF ; les noms de l’ancienne barre gardent leur famille', () => {
  const ef = [pas('work', 30, [zone(2), rpe(3)]), rep(7, [pas('ramp_up', 10 / 60, [rpe(9)]), pas('ramp_down', 2, [rpe(3)])])];
  assert.equal(classerSeanceNommee('EF + 7 SC V · Endurance, sprints en côte', ef, PROFIL), null);
  const s2 = [echauf, rep(5, [pas('work', 3, [rpe(7)]), pas('cooldown', 1, [rpe(2)])]), retour];
  assert.equal(classerSeanceNommee('Seuil 2 court route · 15 min — 5 × 3 min', s2, PROFIL)?.famille, 'seuil2');
  assert.equal(classerSeanceNommee('Tempo · 30 min — 3 × 10 min · vallonné', s2, PROFIL)?.famille, 'tempo');
  assert.equal(classerSeanceNommee('Navettes continues', [pas('work', 30, [rpe(3)])], PROFIL), null);
});

test('les lecteurs de noms et l’app : les mots pour l’athlète, la famille, la tête d’une phrase', async () => {
  const { nomPourLAthlete } = await import('../lib/app/nomsSeances.ts');
  const { familleDuNom } = await import('../lib/app/semaineDansNolio.ts');
  const { enClair, nomsDesSeances } = await import('../lib/app/journalEnClair.ts');
  assert.equal(nomPourLAthlete('WEC J1 · Week-end choc, jour 1 sur 2'), 'Week-end choc, jour 1 sur 2');
  assert.equal(nomPourLAthlete('Back-to-back — Jour 1/2 (sortie longue) · 2h30'), 'Week-end choc — jour 1/2 (sortie longue) · 2h30');
  for (const [nom, f] of [['S2c 5×3′/1′ R · Seuil 2 court, route', 'seuil2'], ['SL R · Sortie longue, route', 'sl'],
    ['WEC J2 · Week-end choc, jour 2 sur 2', 'sl'], ['EF V · Endurance, vallonné', 'ef'], ['NAV 30′ · Navettes continues', 'mecanique'],
    ['RF spé montée 2/3 · Renfo, spé montée', 'renfo'], ['Seuil 2 court route · 15 min — 5 × 3 min', 'seuil2']]) {
    assert.equal(familleDuNom(nom), f, nom);
  }
  // R2 : les mots de la séance, pas son code.
  const nomDe = nomsDesSeances([{ jours: [{ id: 'S13-mardi', seance: 'S1 6×5′ C · Seuil 1, en côte' }] }]);
  assert.deepEqual(enClair({ regle: 'R2', seance: 'S13-mardi', trop_dur: true, ecourtee: false }, undefined, null, nomDe),
    ['Séance Seuil 1, en côte de mardi plus dure que prévu : sa marche est refaite, sous une autre forme.']);
  // C1 : la famille d'une séance codée de la semaine, et la VO2max sous son nom d'avant (« VO2 long … »).
  const c1 = (f) => ({ regle: 'C1', effet: 'marche', doses: { [f]: { date: '2026-12-01', minutes: 15, reps: 5, bloc_min: 3, monte: true } } });
  assert.equal(enClair(c1('seuil2'), ['S2c 5×3′/1′ R · Seuil 2 court, route']).length, 1);
  assert.equal(enClair(c1('vo2max'), ['VO2 long · 15 min — 5 × 3′']).length, 1);
  assert.equal(enClair(c1('vo2max'), ['S2c 5×3′/1′ R · Seuil 2 court, route']).length, 0);
});
