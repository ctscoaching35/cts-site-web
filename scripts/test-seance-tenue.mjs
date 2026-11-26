#!/usr/bin/env node
/**
 * CE QUE LE MOTEUR 9.1 LIT DES SÉANCES FAITES (261 et 262 du coach, 26/11/2026) : la réponse à « Séance tenue ? » part en `tenue` (à l'essai sur « (toi) » seulement tant que CTS_SEANCE_TENUE n'est pas « oui »),
 * et une activité de course que Nolio n'a reliée à rien est reliée à la séance prévue la plus proche, sans quoi elle compterait manquée. Sous le 9.0, rien ne change. Des séances inventées, sans réseau.
 *
 *   node --test scripts/test-seance-tenue.mjs
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
const { tenueDeLaSeance, seanceTenueActive } = await charge('seanceTenue');
const { nolioDepuisNolio } = await charge('nolioV9');
const { realiseDeLaSemaineV9 } = await charge('realiseV9');
const { estAuMoins91 } = await charge('versionDuMoteur');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

const QUESTION = 'Séance tenue ? (une récup raccourcie compte comme entièrement)';
const q = (value, plus = {}) => [{ question: 'Une douleur ?', value: 'Non' }, { question: QUESTION, value, ...plus }];

test('« Séance tenue ? » : le libellé ou son rang ; sans la question ou sans réponse lisible, rien (le moteur prend « entièrement »)', () => {
  assert.equal(tenueDeLaSeance(q('Entièrement')), 'entierement');
  assert.equal(tenueDeLaSeance(q('Partiellement')), 'partiellement');
  assert.equal(tenueDeLaSeance(q('Pas du tout')), 'pas_du_tout');
  assert.equal(tenueDeLaSeance(q(1)), 'partiellement');
  assert.equal(tenueDeLaSeance(q([2])), 'pas_du_tout');
  assert.equal(tenueDeLaSeance(q(0, { choices: { choices: ['Pas du tout', 'Entièrement'] } })), 'pas_du_tout', 'le rang se lit dans les choix de la question');
  assert.equal(tenueDeLaSeance([{ question: 'seance tenue', value: 'PARTIELLEMENT' }]), 'partiellement', 'sans accents ni majuscules');
  for (const vide of [null, undefined, [], q(null), q(''), q('à peu près'), q(7), [{ question: 'Une douleur ?', value: 'Partiellement' }]]) assert.equal(tenueDeLaSeance(vide), null, JSON.stringify(vide));
});

test('pas avant l’essai : sans CTS_SEANCE_TENUE, seul « (toi) » est lu', () => {
  assert.equal(seanceTenueActive({}), false);
  assert.equal(seanceTenueActive({ CTS_SEANCE_TENUE: ' Oui ' }), true);
  assert.match(source('lib/app/passagesV9.ts'), /relierSansLien: await moteurAuMoins91\(\), lireTenue: !q \|\| seanceTenueActive\(\) \}\);/);
  assert.match(source('lib/app/realiseDuV1.ts'), /lireTenue: d\.moi \|\| seanceTenueActive\(\) \}\);/);
});

const prevue = (id, date, min = 60) => ({ id, date_start: date, sport: 'course', duration: { value: min * 60 }, name: id });
const faite = (planned, date, min, debrief, sport = 'course') => ({ id: `r_${date}_${min}`, planned, date_start: date, sport, duration: { value: min * 60 }, debrief });
const vue = (reelles, plus = {}) => nolioDepuisNolio({ lundis: ['2026-11-30'], planifiees: [prevue('mar', '2026-12-01'), prevue('jeu', '2026-12-03', 40)], reelles,
  parNolio: new Map([['mar', 'S3-mardi'], ['jeu', 'S3-jeudi']]), accordLecture: true, sportsDeCourse: ['course'], ...plus }).semaines[0].seances;

test('`tenue` part sur la séance faite, avec l’accord de lecture, et seulement quand on la lit ; sinon la charge est celle d’avant', () => {
  const reelles = [faite('mar', '2026-12-01', 60, { rpe: 6, questions: q('Partiellement') }), faite('jeu', '2026-12-03', 40, { rpe: 3 })];
  assert.deepEqual(vue(reelles, { lireTenue: true }).map((s) => s.tenue), ['partiellement', undefined]);
  assert.ok(vue(reelles, { lireTenue: true }).every((s, i) => i === 0 || !('tenue' in s)));
  assert.ok(vue(reelles).every((s) => !('tenue' in s)), 'à l’essai : rien ne part');
  assert.ok(vue(reelles, { lireTenue: true, accordLecture: false }).every((s) => !('tenue' in s)));
});

test('sous le 9.1, une activité saisie à la main est reliée à sa séance ; un vélo ne l’est pas ; sous le 9.0, rien ne change', () => {
  const main = faite(null, '2026-12-02', 55, { rpe: 5 });
  assert.deepEqual(vue([main]).map((s) => s.faite), [null, null], 'sous le 9.0 : le lien de Nolio seul');
  assert.deepEqual(vue([main], { relierSansLien: true }).map((s) => [s.faite, s.duree_faite_min]), [[true, 55], [null, null]]);
  assert.deepEqual(vue([faite(null, '2026-12-01', 60, undefined, 'velo')], { relierSansLien: true }).map((s) => s.faite), [null, null]);
  assert.deepEqual(vue([faite('mar', '2026-12-01', 20, undefined, 'velo')], { relierSansLien: true }).map((s) => s.faite), [true, null], 'le lien de Nolio vaut toujours');
});

test('le résumé du réalisé : une séance clé tenue en partie n’est pas réussie, quand la réponse se lit', () => {
  const semaine = (lireTenue) => realiseDeLaSemaineV9({ numero: 'S3', lundi: '2026-11-30', type: 'Charge', prevues: [prevue('mar', '2026-12-01')],
    reelles: [faite('mar', '2026-12-01', 60, { questions: q('Partiellement') })], idDuMoteur: new Map([['mar', 'S3-mardi']]), familleDe: new Map([['S3-mardi', 'seuil1']]), pasFaites: new Set(), hooper: null, lireTenue });
  assert.deepEqual([semaine(true).cles_reussies, semaine(false).cles_reussies, semaine(true).seances_faites], [0, 1, 1]);
});

test('la 9.1 et après se reconnaît ; la 9.0.1 non', () => {
  for (const v of ['9.1', '9.1.0', '9.12', '10.0']) assert.equal(estAuMoins91(v), true, v);
  for (const v of ['9.0', '9.0.1', '9', '8.474', '', null, undefined, 91]) assert.equal(estAuMoins91(v), false, String(v));
});
