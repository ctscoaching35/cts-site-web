#!/usr/bin/env node
/**
 * Les doses lues, en clair, pour le coach (lib/app/journalEnClair.ts, dose ; l'aperçu du dimanche et le journal du
 * moteur), sans réseau ni base. Décision coach du 08/11/2026 : une pyramide ne s'affiche plus à la moyenne de ses blocs.
 *
 *   node --test scripts/test-journal.mjs
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
const { dose, enClair, nomsDesSeances } = await import('../lib/app/journalEnClair.ts');

test('des blocs égaux : inchangé', () => {
  assert.equal(dose({ minutes: 36, reps: 3, bloc_min: 12 }), '3 × 12 min');
  assert.equal(dose({ minutes: 12, reps: 6, bloc_min: 2 }), '6 × 2 min');
  assert.equal(dose({ minutes: 15, reps: 5, bloc_min: 3 }), '5 × 3 min');
  assert.equal(dose({ minutes: 5, reps: 10, bloc_min: 0.5 }), '10 × 0.5 min');
  assert.equal(dose({ minutes: 32, reps: 4, bloc_min: 8 }), '4 × 8 min');
});

test('un seul bloc : sa durée', () => {
  assert.equal(dose({ minutes: 25, reps: 1, bloc_min: 25 }), '25 min');
  assert.equal(dose({ minutes: 24.6 }), '25 min');
});

test('des blocs inégaux : le total et ses répétitions, plus la moyenne', () => {
  // IT 4-3-2-2-1-1′ (le coaché route du 08/11/2026) : 13 min en 6 blocs, la moyenne 2,2 min.
  assert.equal(dose({ minutes: 13, reps: 6, bloc_min: 2.2 }), '13 min en 6 répétitions');
  // IT 1-1-2-2-3-2-2-1-1′ : 15 min en 9 blocs.
  assert.equal(dose({ minutes: 15, reps: 9, bloc_min: 1.7 }), '15 min en 9 répétitions');
  // 1-2-3-2-1′ : 9 min en 5, la moyenne 1,8 min.
  assert.equal(dose({ minutes: 9, reps: 5, bloc_min: 1.8 }), '9 min en 5 répétitions');
});

// Le journal du moteur en clair (défaut relevé sur la maquette du 08/11/2026, R2) : le nom de la séance et son jour,
// jamais son identifiant brut.
test('R2 : le nom de la séance, pas « S13-mardi »', () => {
  const nomDe = nomsDesSeances([
    { jours: [{ id: 'S13-mardi', seance: 'Seuil 1 côte 5-15 % · 30 min — 6 × 5 min' }, { id: 'S13-dimanche', seance: 'SL vallonnée' }] },
    null, { jours: [] },
  ]);
  assert.deepEqual(enClair({ regle: 'R2', seance: 'S13-mardi', trop_dur: true, ecourtee: false }, undefined, null, nomDe),
    ['Séance Seuil 1 côte 5-15 % de mardi plus dure que prévu : sa marche est refaite, sous une autre forme.']);
  assert.deepEqual(enClair({ regle: 'R2', seance: 'S13-dimanche', trop_dur: false, ecourtee: true }, undefined, null, nomDe),
    ['Séance SL vallonnée de dimanche écourtée : sa marche est refaite, sous une autre forme.']);
  // Sans son nom (une semaine plus ancienne, sans le détail de ses séances) : son jour.
  assert.deepEqual(enClair({ regle: 'R2', seance: 'S9-jeudi', trop_dur: true, ecourtee: true }),
    ['Séance de jeudi plus dure que prévu et écourtée : sa marche est refaite, sous une autre forme.']);
  // Une séance allégée en cours de semaine (A8).
  assert.deepEqual(enClair({ regle: 'R2', seance: 'S9-jeudi', trop_dur: false, ecourtee: false, allegee: true }),
    ['Séance de jeudi allégée : sa marche est refaite, sous une autre forme.']);
  for (const t of enClair({ regle: 'R2', seance: 'S13-mardi', trop_dur: true }, undefined, null, nomDe)) assert.doesNotMatch(t, /S\d+-/);
});

// La pyramide à la moyenne ronde (2-3-5-3-2′ : 15 min en 5 blocs) : la dose lue ne porte que ses minutes, ses répétitions
// et la moyenne d'un bloc, comme 5 × 3 min ; elle ne se distingue pas sans la durée de chaque bloc (limite connue, dite
// au coach le 08/11/2026).
test('une pyramide à la moyenne ronde se lit encore comme des blocs égaux', () => {
  assert.equal(dose({ minutes: 15, reps: 5, bloc_min: 3 }), '5 × 3 min');
});

// La prudence (moteur 8.460, décision coach du 09/11/2026) : une famille qui refait sa marche (R1, R2, R8) ne monte pas sur
// la séance lue ; les autres familles, comme avant.
test('C1 et la prudence : la marche refaite, la séance lue ne la fait pas monter', () => {
  const lignes = enClair({ regle: 'C1', effet: 'marche reprise de la dernière séance faite', prudence: ['seuil1'],
    doses: { seuil1: { date: '2026-10-15', minutes: 30, reps: 3, bloc_min: 10, monte: true },
      seuil2: { date: '2026-10-13', minutes: 20, reps: 4, bloc_min: 5, monte: true } } });
  assert.equal(lignes.length, 2);
  assert.match(lignes[0], /^Seuil 1 : sa marche se refait cette semaine ; la séance du .* \(3 × 10 min\) ne la fait pas monter\.$/);
  assert.match(lignes[1], /^Seuil 2 : la marche part de la séance du .* la suivante monte d’une marche\.$/);
});

// L'allure de course, sa propre famille (moteur 8.460, N10, doctrine D2) : sa dose lue se dit quand la semaine a une séance
// d'allure, pas sinon (la règle des autres qualités, retour coach du 01/11/2026).
test('C1 et l’allure : sa dose se dit seulement avec une séance d’allure dans la semaine', () => {
  const entree = { regle: 'C1', effet: 'marche reprise de la dernière séance faite',
    doses: { allure: { date: '2026-12-01', minutes: 24, reps: 3, bloc_min: 8, monte: true } } };
  assert.deepEqual(enClair(entree, ['Seuil 2 route · 32 min — 4 × 8 min', 'Sortie longue']), []);
  const lignes = enClair(entree, ['Allure semi — 3 × 3 km, récup courue', 'Sortie longue']);
  assert.equal(lignes.length, 1);
  assert.match(lignes[0], /^Allure : la marche part de la séance du .* \(3 × 8 min\) ; la suivante monte d’une marche\.$/);
});

// Moteur 8.468 (décisions du coach du 16/11/2026) : ce qui n'est pas lu n'est pas manqué. Une séance sans activité reliée est
// « non lue » (NONLU) ; rien de lu de la semaine passée, une semaine standard (STANDARD) ; sept jours sans séance lue chez qui ne
// synchronise pas d'habitude, aucun arrêt conclu (SYNCHRO). Jamais « manquée », jamais le code de la règle, jamais « il ».
test('NONLU, STANDARD et SYNCHRO en clair', () => {
  const noms = nomsDesSeances([{ jours: [{ id: 'S13-mercredi', seance: 'Seuil 2 court vallonné · 15 min — 5 × 3 min' }] }]);
  const [nonLue] = enClair({ regle: 'NONLU', famille: 'seuil2', seance: 'S13-mercredi', effet: 'séance non lue : la même marche, ni hausse ni baisse' }, undefined, null, noms);
  assert.match(nonLue, /^Séance .+ de mercredi non lue dans Nolio : sa marche tient, ni hausse ni baisse\.$/);
  assert.doesNotMatch(nonLue, /S13-|manqu/);
  assert.equal(enClair({ regle: 'NONLU', famille: 'mecanique', seance: 'S13-jeudi' })[0], 'Séance Mécanique de jeudi non lue dans Nolio : sa marche tient, ni hausse ni baisse.');
  assert.equal(enClair({ regle: 'NONLU', famille: 'sl', marche_min: 105, effet: 'sortie longue non lue : la même marche' })[0],
    'Sortie longue non lue dans Nolio : la même marche (105 min), ni hausse ni baisse.');
  assert.equal(enClair({ regle: 'STANDARD', effet: 'rien de lu de la semaine passée' })[0],
    'Rien de lu de sa semaine passée (ni séance, ni réponse, ni Hooper) : semaine de maintien, la même marche, le volume de son niveau habituel.');
  const [synchro] = enClair({ regle: 'SYNCHRO', effet: 'pas d’arrêt conclu', jours: 9, depuis: '2026-11-06', part_lue: 0.4 });
  assert.equal(synchro, '9 jours sans séance lue depuis le 06/11 : pas d’arrêt conclu, ses séances ne remontent pas d’habitude (40 % de séances lues sur ses 4 dernières semaines normales).');
  assert.match(enClair({ regle: 'SYNCHRO', jours: 7, depuis: '2026-11-08' })[0], /\(moins de 75 % de séances lues/);
  for (const ligne of [nonLue, synchro]) assert.doesNotMatch(ligne, /\bil\b|NONLU|SYNCHRO/);
});
