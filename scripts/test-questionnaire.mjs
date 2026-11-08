#!/usr/bin/env node
/**
 * Le questionnaire d'achat plus court (P4, P5 ; décisions coach du 07/11/2026, « tout A »), sans réseau : les repères de
 * chrono en liste (lib/plan.ts, reperesChrono), le même calcul et les mêmes bornes plafonnées qu'avant, et la note sous
 * les séances par semaine (plancherSeances), qui ne dit plus que ce qui s'applique. Des cas fictifs ; la configuration
 * reprend les seuils de /v1/config du moteur (cts_intake.config_formulaire).
 *
 *   node --test scripts/test-questionnaire.mjs
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
const { champsVides, plancherSeances, reperesChrono } = await import('../lib/plan.ts');

const CONFIG = {
  temps_max_par_format: { TC: 7, TM: 15, TL: 24, UT: 70, R10: 2, R21: 3.5, R42: 7 },
  freq_min_par_format: { TC: 3, TM: 3, TL: 3, UT: 4, R10: 3, R21: 3, R42: 3 },
  freq_min_km_effort_seuil: 100,
  freq_min_au_dela_du_seuil: 4,
  freq_max_par_niveau: { debutant: 4, intermediaire: 7, confirme: 7 },
};
const course = (format, distance_km, dplus_m, niveau = 'intermediaire') => ({ ...champsVides, format, distance_km, dplus_m, niveau });

test('repères : 50 km et 2 500 m D+ en Trail Marathon, 75 km-effort et les quatre bornes', () => {
  assert.deepEqual(reperesChrono(course('TM', '50', '2500'), CONFIG), {
    kmEffort: 75,
    bandes: [
      { nom: 'Élite', temps: 'moins de 6h20' },
      { nom: 'Rapide', temps: '6h20 à 7h40' },
      { nom: 'Intermédiaire', temps: '7h40 à 8h55' },
      { nom: 'Prudent', temps: '8h55 à 9h55' },
      { nom: 'Proche des barrières', temps: 'plus de 9h55' },
    ],
    fin: null,
  });
  // La même structure pour le coach : sans plafond dépassé, pas de fin.
  assert.equal(reperesChrono(course('TM', '50', '2500'), CONFIG, true).fin, null);
});

test('repères : au-delà du plafond du format, « plus de 7h » et la fin de l’acheteur ou du coach', () => {
  // 29 km et 2 500 m D+ en Trail Court : 54 km-effort, la borne des 85 % au-delà de 7 h.
  const r = reperesChrono(course('TC', '29', '2500'), CONFIG);
  assert.equal(r.kmEffort, 54);
  assert.deepEqual(r.bandes.map((b) => b.temps), ['moins de 4h30', '4h30 à 5h25', '5h25 à 6h15', '6h15 à 7h', 'plus de 7h']);
  assert.equal(r.fin, 'Au-delà de 7h, c’est hors du plafond de ce plan : un coaching individualisé est plus adapté.');
  assert.equal(reperesChrono(course('TC', '29', '2500'), CONFIG, true).fin,
    'Au-delà de 7h, c’est hors du plafond de ce plan. Le moteur ne construit pas ce cas : à préparer toi-même, hors du parcours automatique.');
  // Plus loin au-delà : les bandes qui commencent après le plafond deviennent « plus de 7h », comme avant ; une borne
  // qui s'affiche au plafond (7h00) aussi : plus de « 5h50 à 7h00 » ni de « 7h00 à 7h » (le défaut du 07/11/2026).
  assert.deepEqual(reperesChrono(course('TC', '29', '4000'), CONFIG).bandes.map((b) => b.temps),
    ['moins de 5h50', '5h50 à 7h', 'plus de 7h', 'plus de 7h', 'plus de 7h']);
  // Toutes les bornes, sur une grille de Trails Courts plafonnés : jamais « à » entre deux valeurs qui se confondent, ni
  // de « 7h00 ».
  for (const km of ['20', '25', '29', '33']) {
    for (const dplus of ['1500', '2500', '3200', '4000', '5000']) {
      for (const t of reperesChrono(course('TC', km, dplus), CONFIG).bandes.map((b) => b.temps)) {
        assert.ok(!t.includes('7h00'), `${km} km, ${dplus} m : ${t}`);
        const m = /^(\S+) à (\S+)$/.exec(t);
        assert.ok(!m || m[1] !== m[2], `${km} km, ${dplus} m : ${t}`);
      }
    }
  }
});

test('repères : rien sans format ni distance', () => {
  assert.equal(reperesChrono(course('', '50', '2500'), CONFIG), null);
  assert.equal(reperesChrono(course('TM', '', '2500'), CONFIG), null);
});

test('séances : l’ultra, son minimum de 4 dit par son format, avant le km-effort qu’il a toujours', () => {
  const p = plancherSeances(course('UT', '120', '6000'), CONFIG);
  assert.deepEqual(p, { min: 4, max: 7, note: 'Au moins 4 séances par semaine pour un ultra.' });
});

test('séances : 100 km-effort et plus, le minimum dit par la taille de la course', () => {
  // 90 km et 1 500 m D+ en Trail Long : 105 km-effort.
  assert.deepEqual(plancherSeances(course('TL', '90', '1500'), CONFIG),
    { min: 4, max: 7, note: 'Au moins 4 séances par semaine pour une course de cette taille (100 km-effort et plus).' });
  // Le seuil compris : 100 km-effort tout juste.
  assert.equal(plancherSeances(course('TM', '60', '4000'), CONFIG).min, 4);
});

test('séances : le débutant, son plafond seul, ou après le minimum', () => {
  assert.deepEqual(plancherSeances(course('TC', '20', '500', 'debutant'), CONFIG), { min: 3, max: 4, note: '4 au plus en débutant.' });
  assert.equal(plancherSeances(course('TM', '55', '4500', 'debutant'), CONFIG).note,
    'Au moins 4 séances par semaine pour une course de cette taille (100 km-effort et plus). 4 au plus en débutant.');
});

test('séances : le minimum de 3 seul, pas de note', () => {
  assert.deepEqual(plancherSeances(course('TM', '50', '2500'), CONFIG), { min: 3, max: 7, note: '' });
  assert.deepEqual(plancherSeances(course('R42', '42.195', '0', 'confirme'), CONFIG), { min: 3, max: 7, note: '' });
  assert.deepEqual(plancherSeances(course('', '', ''), CONFIG), { min: 3, max: 7, note: '' });
});

test('séances : les seuils se lisent dans la configuration', () => {
  const autre = { ...CONFIG, freq_min_km_effort_seuil: 80, freq_min_au_dela_du_seuil: 5 };
  assert.equal(plancherSeances(course('TL', '70', '1500'), autre).note,
    'Au moins 5 séances par semaine pour une course de cette taille (80 km-effort et plus).');
});
