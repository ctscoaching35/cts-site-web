#!/usr/bin/env node
/**
 * « Ta préparation », semaine par semaine, sans réseau ni base (lib/app/tableau.ts ; décision coach du 07/11/2026) : les
 * semaines faites, la semaine en cours et la suivante détaillées, celles d'après résumées, leur volume à la demi-heure
 * près (« environ 8 h », « environ 8 h 30 »).
 *
 *   node --test scripts/test-semaines.mjs
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
const { detailDeLaSemaine, environ, ligneTroisJours } = await import('../lib/app/tableau.ts');

test('le volume d’une semaine résumée, à la demi-heure près', () => {
  assert.equal(environ(480), 'environ 8 h');
  assert.equal(environ(494), 'environ 8 h'); // 8h14
  assert.equal(environ(495), 'environ 8 h 30'); // 8h15 : la demi-heure la plus proche
  assert.equal(environ(504), 'environ 8 h 30'); // 8,4 h (la semaine 15 de L4)
  assert.equal(environ(524), 'environ 8 h 30'); // 8h44
  assert.equal(environ(525), 'environ 9 h'); // 8h45
  assert.equal(environ(85), 'environ 1 h 30'); // 1,42 h (une semaine d’affûtage)
  assert.equal(environ(40), 'environ 30 min');
  assert.equal(environ(5), 'environ 30 min'); // jamais « environ 0 h »
  assert.equal(environ(0), null);
  assert.equal(environ(Number.NaN), null);
});

test('un mercredi : les semaines faites, celle en cours, la suivante détaillée, au-delà résumées', () => {
  const mercredi = '2027-03-10'; // la semaine du lundi 8 mars
  assert.equal(detailDeLaSemaine('2027-03-01', mercredi), 'faite');
  assert.equal(detailDeLaSemaine('2027-03-08', mercredi), 'encours');
  assert.equal(detailDeLaSemaine('2027-03-15', mercredi), 'suivante');
  assert.equal(detailDeLaSemaine('2027-03-22', mercredi), 'resumee');
  assert.equal(detailDeLaSemaine('2027-03-29', mercredi), 'resumee');
});

test('le lundi et le dimanche : la semaine suivante reste celle d’après la semaine en cours', () => {
  const lundi = '2027-03-08';
  assert.equal(detailDeLaSemaine('2027-03-08', lundi), 'encours');
  assert.equal(detailDeLaSemaine('2027-03-15', lundi), 'suivante');
  assert.equal(detailDeLaSemaine('2027-03-22', lundi), 'resumee');
  const dimanche = '2027-03-14'; // le soir, la semaine du 15 s’écrit
  assert.equal(detailDeLaSemaine('2027-03-01', dimanche), 'faite');
  assert.equal(detailDeLaSemaine('2027-03-08', dimanche), 'encours');
  assert.equal(detailDeLaSemaine('2027-03-15', dimanche), 'suivante');
  assert.equal(detailDeLaSemaine('2027-03-22', dimanche), 'resumee');
});

test('avant le départ : la première semaine détaillée si elle commence lundi prochain, résumée sinon', () => {
  assert.equal(detailDeLaSemaine('2026-12-21', '2026-12-17'), 'suivante');
  assert.equal(detailDeLaSemaine('2026-12-28', '2026-12-17'), 'resumee');
  assert.equal(detailDeLaSemaine('2026-12-21', '2026-12-03'), 'resumee');
});

// D3 (cas fictifs du 09/11/2026, décision coach du 08/11/2026, « A ») : le week-end choc de trois jours dit d'avance.
const sl = (jour) => ({ jour, seance: 'Week-end choc', famille: 'sl' });
test('le week-end choc de trois jours : une ligne qui dit le vendredi à poser', () => {
  // Nadia, 100 miles : sa semaine 19, du lundi 19 avril 2027.
  assert.equal(ligneTroisJours({ lundi: '2027-04-19', seances_cles: [sl('Vendredi'), sl('Samedi'), sl('Dimanche')] }),
    'Ton week-end choc dure trois jours, du vendredi 23 au dimanche 25 avril : pose ta journée de vendredi.');
  // À cheval sur deux mois ; le premier du mois.
  assert.equal(ligneTroisJours({ lundi: '2027-04-26', seances_cles: [sl('Vendredi'), sl('Samedi'), sl('Dimanche')] }),
    'Ton week-end choc dure trois jours, du vendredi 30 avril au dimanche 2 mai : pose ta journée de vendredi.');
  assert.equal(ligneTroisJours({ lundi: '2027-09-27', seances_cles: [sl('Vendredi'), sl('Samedi'), sl('Dimanche')] }),
    'Ton week-end choc dure trois jours, du vendredi 1er au dimanche 3 octobre : pose ta journée de vendredi.');
});

test('le week-end choc de deux jours, une semaine ordinaire : pas de ligne', () => {
  assert.equal(ligneTroisJours({ lundi: '2027-04-19', seances_cles: [sl('Samedi'), sl('Dimanche')] }), null);
  assert.equal(ligneTroisJours({ lundi: '2027-04-19', seances_cles: [sl('Dimanche'), { jour: 'Mardi', seance: 'Seuil 2', famille: 'qualite' }] }), null);
  assert.equal(ligneTroisJours({ lundi: '2027-04-19', seances_cles: [] }), null);
});

test('les noms des semaines côté coach : « Semaine allégée », « Semaine de reprise » (décisions coach du 08/11/2026)', async () => {
  const { typeCoteCoach, SEMAINE_DE_REPRISE } = await import('../lib/app/nomsSeances.ts');
  assert.equal(typeCoteCoach('Assimilation'), 'Semaine allégée');
  assert.equal(typeCoteCoach('Assimilation', true), 'Semaine de reprise');
  assert.equal(SEMAINE_DE_REPRISE, 'Semaine de reprise');
  // Les autres types restent tels quels (la décision ne touche que « Assimilation »).
  assert.equal(typeCoteCoach('Charge'), 'Charge');
  assert.equal(typeCoteCoach('Affûtage actif'), 'Affûtage actif');
});
