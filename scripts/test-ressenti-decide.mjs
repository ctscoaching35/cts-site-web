#!/usr/bin/env node
/**
 * LE RESSENTI DÉCIDE (décision 272 du coach, 26/11/2026) : un RPE à +2 (+3 pour la sortie longue) avec un ressenti à 4 ou 5/5 n'est ni un signal ni une pastille ni « pas réussie » ; sinon la pastille orange dit la
 * séance, « Seuil 2 de mardi : RPE 7 pour 5 prévu ». Des athlètes inventés, sans réseau.
 *
 *   node --test scripts/test-ressenti-decide.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const cible = specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}`).href : specifier;
    try {
      return nextResolve(cible, context);
    } catch (e) {
      if (!/^(file:|\.)/.test(cible) || cible.endsWith('.ts')) throw e;
      return nextResolve(`${cible}.ts`, context);
    }
  },
});
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const { signaux, genreDeSeance } = await charge('signauxSuivi');
const { prevision } = await charge('prevision');
const { raisonDuNiveau } = await charge('espaceParAthlete');
const { realiseDeLaSemaineV9 } = await charge('realiseV9');

const SEUILS = { jours: 7, rpe_au_dessus: 2, rpe_au_dessus_sl: 3, sensations_max: 2, hooper_semaines: 3, hooper_ecart: 3 };
const prevue = (id, name, date, rpe) => ({ id, name, date_start: date, rpe, duration: { value: 3600 } });
const faite = (planned, date, rpe, feeling) => ({ id: `r_${planned}`, name: 'Course du matin', date_start: date, planned, duration: { value: 3600 }, debrief: { rpe, ...(feeling === undefined ? {} : { feeling }) } });
const lu = (prevues, faites) => signaux(prevues, faites, [], SEUILS, '2026-12-05').signaux.filter((s) => s.genre === 'plus_dur');
const MARDI = prevue('a', 'Seuil 2 côte · 20 min — 5 × 4 min', '2026-12-01', 5);

test('un RPE à +2 avec un ressenti à 4 ou 5 : rien ; à 3 ou moins, ou sans ressenti : le signal, avec le genre de la séance', () => {
  for (const feeling of [4, 5]) assert.deepEqual(lu([MARDI], [faite('a', '2026-12-01', 7, feeling)]), [], String(feeling));
  for (const feeling of [1, 3, undefined, null]) {
    const [s] = lu([MARDI], [faite('a', '2026-12-01', 7, feeling)]);
    assert.deepEqual([s.detail, s.type], ['RPE 7 pour 5 prévu', 'Seuil 2'], String(feeling));
  }
  assert.deepEqual(lu([MARDI], [faite('a', '2026-12-01', 6, 2)]), [], 'à +1 : rien');
  const longue = prevue('l', 'Sortie longue · 2 h — simple', '2026-12-04', 4);
  assert.deepEqual(lu([longue], [faite('l', '2026-12-04', 6)]), [], 'la sortie longue se juge à +3');
  assert.equal(lu([longue], [faite('l', '2026-12-04', 7, 3)])[0].type, 'Sortie longue');
  assert.deepEqual(lu([longue], [faite('l', '2026-12-04', 8, 4)]), []);
});

test('la pastille orange dit la séance, le jour et le RPE ; avec un bon ressenti, pas d’orange ni de signal de fatigue', () => {
  const suivi = (faites, prevues = [MARDI]) => signaux(prevues, faites, [], SEUILS, '2026-12-05');
  const p = prevision(suivi([faite('a', '2026-12-01', 7, 3)]), '2026-11-30');
  assert.equal(p.niveau, 'orange');
  assert.equal(raisonDuNiveau(p, 1, true), 'Orange · Seuil 2 de mardi : RPE 7 pour 5 prévu');
  assert.equal(prevision(suivi([faite('a', '2026-12-01', 7, 4)]), '2026-11-30').niveau, 'vert');
  // Deux séances : la plus récente, et l'autre comptée ; un signal d'avant, sans genre gardé, se dit « Séance ».
  const jeudi = prevue('b', 'Tempo vallonné · 20 min — x', '2026-12-03', 6);
  assert.equal(prevision(suivi([faite('a', '2026-12-01', 7), faite('b', '2026-12-03', 8)], [MARDI, jeudi]), '2026-11-30').pourquoi, 'Tempo de jeudi : RPE 8 pour 6 prévu, et 1 autre');
  const ancien = { prevues: 0, faites: 0, signaux: [{ genre: 'plus_dur', jour: '2026-12-01', seance: '', detail: 'RPE 8 pour 5 prévu' }], hooper: null };
  assert.equal(prevision(ancien, '2026-11-30').pourquoi, 'Séance de mardi : RPE 8 pour 5 prévu');
});

test('le titre ne se garde pas : seul le genre de la séance, et « Séance » quand il ne se reconnaît pas', () => {
  for (const [titre, genre] of [['Seuil 1 route · 40 min — blocs', 'Seuil 1'], ['VO2c 6×1′', 'VO2max'], ['Mécanique · 20 min — navette', 'Mécanique'], ['SL plaisir', 'Sortie longue'],
    ['Week-end choc — jour 1/2 (sortie longue)', 'Week-end choc'], ['EF 45′', 'Endurance'], ['Footing avec Camille au parc', 'Séance'], ['', 'Séance']]) assert.equal(genreDeSeance(titre), genre, titre);
  const garde = readFileSync(`${RACINE}lib/app/signauxGardes.ts`, 'utf8');
  assert.ok(garde.includes('signaux: suivi.signaux.map(({ genre, jour, detail, type }) => ({ genre, jour, detail, ...(type ? { type } : {}) })),'));
});

test('le résumé du réalisé : à +2 avec un bon ressenti, la séance clé reste réussie', () => {
  const reussies = (feeling) => realiseDeLaSemaineV9({ numero: 'S1', lundi: '2026-11-30', type: null, prevues: [MARDI], reelles: [faite('a', '2026-12-01', 7, feeling)],
    idDuMoteur: new Map([['a', 'S1-mardi']]), familleDe: new Map([['S1-mardi', 'seuil2']]), pasFaites: new Set(), hooper: null }).cles_reussies;
  assert.deepEqual([reussies(4), reussies(5), reussies(3), reussies(undefined)], [1, 1, 0, 0]);
});
