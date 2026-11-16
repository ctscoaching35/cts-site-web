#!/usr/bin/env node
/**
 * Relier une activité à sa séance (lib/app/relier.ts ; Q1 du 04/11/2026, et la décision du coach du 16/11/2026, lot 0) : les règles
 * d'avant (le même nom, le même jour) d'abord ; sinon la séance prévue non faite la plus proche de la même semaine, en jour puis
 * en durée, à ±25 % de sa durée. Les jours de course n'en relient aucune. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-relier.mjs
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
const { relierAuxPrevues, TOLERANCE_DUREE } = await import('../lib/app/relier.ts');

const SPORTS = ['RUN', 'TRAIL'];
const min = (m) => ({ value: m * 60 });
// Semaine du lundi 09/11/2026 au dimanche 15/11/2026.
const prevue = (id, jour, minutes, name = null) => ({ id, date_start: `2026-11-${jour}`, sport: 'RUN', name, duration: min(minutes) });
const reel = (jour, minutes, extra = {}) => ({ date_start: `2026-11-${jour}`, sport: 'RUN', duration: min(minutes), ...extra });
const lien = (r) => r.map((x) => x.planned ?? null);

test('la tolérance est de ±25 %', () => assert.equal(TOLERANCE_DUREE, 0.25));

test('le même jour : relie, comme avant, quelle que soit la durée', () => {
  const r = relierAuxPrevues([reel('10', 20)], [prevue('p1', '10', 60)], SPORTS);
  assert.deepEqual(lien(r), ['p1']);
});

test('le même nom, un autre jour : relie, comme avant, quelle que soit la durée', () => {
  const r = relierAuxPrevues([reel('13', 20, { name: 'Seuil 1' })], [prevue('p1', '10', 60, 'seuil 1')], SPORTS);
  assert.deepEqual(lien(r), ['p1']);
});

test('un autre jour, à ±25 % de la durée prévue : relie à la séance non faite de la semaine', () => {
  // prévue mardi 60 min ; courue jeudi 70 min (+17 %)
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 70)], [prevue('p1', '10', 60)], SPORTS)), ['p1']);
  // 75 min : +25 %, la borne est incluse ; 45 min : −25 %
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 75)], [prevue('p1', '10', 60)], SPORTS)), ['p1']);
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 45)], [prevue('p1', '10', 60)], SPORTS)), ['p1']);
});

test('un autre jour, hors de ±25 % : ne relie pas (une sortie en plus)', () => {
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 76)], [prevue('p1', '10', 60)], SPORTS)), [null]);
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 44)], [prevue('p1', '10', 60)], SPORTS)), [null]);
});

test('une durée inconnue, d’un côté ou de l’autre, ne relie rien', () => {
  assert.deepEqual(lien(relierAuxPrevues([{ date_start: '2026-11-12', sport: 'RUN' }], [prevue('p1', '10', 60)], SPORTS)), [null]);
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 60)], [{ id: 'p1', date_start: '2026-11-10', sport: 'RUN' }], SPORTS)), [null]);
});

test('une autre semaine ne relie pas', () => {
  // prévue le dimanche 08/11 (semaine d'avant), courue le lundi 09/11 à la même durée
  assert.deepEqual(lien(relierAuxPrevues([reel('09', 60)], [prevue('p1', '08', 60)], SPORTS)), [null]);
});

test('la plus proche en jour d’abord, puis en durée', () => {
  const prevues = [prevue('mardi', '10', 60), prevue('samedi', '14', 90)];
  // courue jeudi 12 : 2 jours du mardi, 2 du samedi ; 85 min est plus proche de 90 que de 60 (et 60 est hors tolérance)
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 85)], prevues, SPORTS)), ['samedi']);
  // courue mercredi 11 à 70 : le mardi est à 1 jour, le samedi à 3 (et sa durée est hors tolérance de toute façon)
  assert.deepEqual(lien(relierAuxPrevues([reel('11', 70)], prevues, SPORTS)), ['mardi']);
  // deux séances à ±25 % : la plus proche en jour l'emporte sur la plus proche en durée
  const deux = [prevue('lundi', '09', 60), prevue('samedi', '14', 66)];
  assert.deepEqual(lien(relierAuxPrevues([reel('10', 66)], deux, SPORTS)), ['lundi']);
});

test('à jours égaux, la durée la plus proche', () => {
  const prevues = [prevue('mardi', '10', 60), prevue('jeudi', '12', 80)];
  assert.deepEqual(lien(relierAuxPrevues([reel('11', 78)], prevues, SPORTS)), ['jeudi']);
});

test('les règles d’avant passent en premier, sur toutes les activités', () => {
  // Une sortie de lundi (50 min) pourrait prendre la séance de mardi (50 min) par la durée ; mais celle de mardi (même jour)
  // la prend par le jour : la séance du mardi va à l'activité du mardi, celle du lundi reste une sortie en plus.
  const prevues = [prevue('mardi', '10', 50)];
  const r = relierAuxPrevues([reel('09', 50), reel('10', 50)], prevues, SPORTS);
  assert.deepEqual(lien(r), [null, 'mardi']);
});

test('une séance déjà faite (reliée par Nolio) ou déjà prise ne se relie pas deux fois', () => {
  const prevues = [prevue('p1', '10', 60)];
  const faite = reel('10', 60, { planned: 'p1' });
  assert.deepEqual(lien(relierAuxPrevues([faite, reel('12', 60)], prevues, SPORTS)), ['p1', null]);
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 60), reel('13', 62)], prevues, SPORTS)), ['p1', null]);
});

test('les jours de course n’en relient aucune, ni ne sont reliés', () => {
  const jours = new Set(['2026-11-14']);
  assert.deepEqual(lien(relierAuxPrevues([reel('14', 60)], [prevue('p1', '12', 60)], SPORTS, jours)), [null]);
  assert.deepEqual(lien(relierAuxPrevues([reel('12', 60)], [prevue('course', '14', 60)], SPORTS, jours)), [null]);
});

test('une activité qui n’est pas de course ne relie rien', () => {
  assert.deepEqual(lien(relierAuxPrevues([{ ...reel('12', 60), sport: 'BIKE' }], [prevue('p1', '10', 60)], SPORTS)), [null]);
});

test('la deuxième règle ne relie jamais à une séance d’un jour pas encore couru', () => {
  // lue jusqu'au mercredi 11 : une activité du mardi à 60 min ne prend pas la séance du vendredi
  assert.deepEqual(lien(relierAuxPrevues([reel('09', 60)], [prevue('p1', '13', 60)], SPORTS, new Set(), '2026-11-11')), [null]);
  assert.deepEqual(lien(relierAuxPrevues([reel('09', 60)], [prevue('p1', '13', 60)], SPORTS)), ['p1']);
});
