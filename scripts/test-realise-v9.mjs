#!/usr/bin/env node
/**
 * LE RÉALISÉ DES SEMAINES DU MOTEUR v1 (décisions du coach 198 et 199 ; doctrine A2, « Le résumé du réalisé ») : tiré de Nolio la nuit, pour les graphiques et la jauge. Des semaines fabriquées, sans réseau ni base.
 *
 *   node --test scripts/test-realise-v9.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const MONDE = pathToFileURL(`${RACINE}scripts/_monde-app-gratuite.mjs`).href;
const REMPLACES = ['/lib/app/contexte.ts', '/lib/app/demandes.ts', '/lib/app/demonstrationPorte.ts', '/lib/app/nolio.ts', '/lib/app/supabase.ts'];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(next\/(headers|navigation|cache)|react)$/.test(specifier)) return { url: MONDE, shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    let r;
    try {
      r = nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    return REMPLACES.some((f) => r.url.endsWith(f)) ? { url: MONDE, shortCircuit: true } : r;
  },
});
const { realiseDeLaSemaineV9, relier } = await import(pathToFileURL(`${RACINE}lib/app/realiseV9.ts`).href);
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

// La semaine du lundi 30 novembre 2026 : un Seuil 1 le mardi (60 min, RPE 6), une endurance le jeudi (50 min, RPE 3), une sortie longue le dimanche (150 min, RPE 4).
const prevue = (id, date, min, rpe) => ({ id, date_start: date, sport: '2', duration: { value: min * 60 }, rpe });
const PREVUES = [prevue('n-mar', '2026-12-01', 60, 6), prevue('n-jeu', '2026-12-03', 50, 3), prevue('n-dim', '2026-12-06', 150, 4)];
const ID = new Map([['n-mar', 'S3-mardi'], ['n-jeu', 'S3-jeudi'], ['n-dim', 'S3-dimanche']]);
const FAMILLE = new Map([['S3-mardi', 'seuil1'], ['S3-jeudi', 'endurance'], ['S3-dimanche', 'sl']]);
const faite = (id, planned, date, min, rpe, dplus) => ({
  id, planned, date_start: date, sport: '2', duration: { value: min * 60 }, ...(rpe === undefined ? {} : { debrief: { rpe } }), ...(dplus === undefined ? {} : { elevation_gain: { value: dplus } }),
});
const semaine = (reelles, plus = {}) => realiseDeLaSemaineV9({ numero: 'S3', lundi: '2026-11-30', type: 'Charge', prevues: PREVUES, reelles, idDuMoteur: ID, familleDe: FAMILLE, pasFaites: new Set(), hooper: 9, ...plus });

test('une semaine faite comme prévu : durées, charge, sortie longue, séances clés réussies, dénivelé, Hooper', () => {
  const r = semaine([faite('r1', 'n-mar', '2026-12-01', 60, 6, 200), faite('r2', 'n-jeu', '2026-12-03', 50, 3), faite('r3', 'n-dim', '2026-12-06', 155, 5, 900)]);
  assert.deepEqual(r, {
    numero: 'S3', lundi: '2026-11-30', type: 'Charge', charge_prevue: 1110, charge_faite: 1285, charge_tenue: 1110, rpe_lu: true, seances_prevues: 3, seances_faites: 3,
    duree_prevue_min: 260, duree_faite_min: 265, sl_prevue_min: 150, sl_faite_min: 155, cles_prevues: 2, cles_reussies: 2, dplus_m: 1100, hooper: 9, rpe_complet: true,
  });
});

test('une séance clé écourtée sous la moitié, trop dure (2 de plus, 3 pour la sortie longue) ou cochée « pas faite » : faite, pas réussie', () => {
  const seuil = (min, rpe) => semaine([faite('r1', 'n-mar', '2026-12-01', min, rpe)]).cles_reussies;
  assert.equal(seuil(30, 6), 1, 'la moitié tout juste : pas écourtée');
  assert.equal(seuil(29, 6), 0);
  assert.equal(seuil(60, 7), 1);
  assert.equal(seuil(60, 8), 0);
  const longue = (rpe) => semaine([faite('r3', 'n-dim', '2026-12-06', 150, rpe)]).cles_reussies;
  assert.equal(longue(6), 1);
  assert.equal(longue(7), 0);
  assert.equal(semaine([faite('r1', 'n-mar', '2026-12-01', 29, 9)]).seances_faites, 1, 'elle reste faite');
  assert.equal(semaine([faite('r1', 'n-mar', '2026-12-01', 60, 6)], { pasFaites: new Set(['S3-mardi']) }).cles_reussies, 0);
  // Sans RPE donné : pas trop dure ; la charge prend le RPE prévu, et le résumé le dit.
  const sans = semaine([faite('r1', 'n-mar', '2026-12-01', 60)]);
  assert.deepEqual([sans.cles_reussies, sans.charge_faite, sans.rpe_lu, sans.rpe_complet], [1, 360, false, false]);
  // Jamais au-delà de 10 : un RPE 10 sur une séance prévue à 9 est trop dur.
  const dure = realiseDeLaSemaineV9({ numero: 'S3', lundi: '2026-11-30', type: null, prevues: [prevue('n-mar', '2026-12-01', 40, 9)], reelles: [faite('r1', 'n-mar', '2026-12-01', 40, 10)],
    idDuMoteur: ID, familleDe: new Map([['S3-mardi', 'vo2max']]), pasFaites: new Set(), hooper: null });
  assert.equal(dure.cles_reussies, 0);
});

test('une activité reliée à rien : à la séance non faite la plus proche, en jour puis en durée, à 25 % près ; sinon elle s’ajoute', () => {
  assert.deepEqual([...relier(PREVUES, [faite('r1', null, '2026-12-02', 55, 6)]).keys()], ['n-mar'], 'à un jour de mardi comme de jeudi : la durée la plus proche (60 pour 55)');
  assert.deepEqual([...relier(PREVUES, [faite('r1', null, '2026-12-03', 55, 3)]).keys()], ['n-jeu']);
  assert.equal(relier(PREVUES, [faite('r1', null, '2026-12-01', 25, 6)]).size, 0, 'trop courte pour être reliée par le site');
  const r = semaine([faite('r1', null, '2026-12-01', 25, 6)]);
  assert.deepEqual([r.seances_faites, r.duree_faite_min, r.charge_faite, r.charge_tenue, r.cles_reussies], [1, 25, 150, 0, 0]);
  // Reliée par Nolio à une séance d'une autre semaine : elle ne se rattache pas ici.
  assert.equal(relier(PREVUES, [faite('r1', 'autre-semaine', '2026-12-01', 60, 6)]).size, 0);
});

test('Nolio fait foi : une séance retirée par le coach ne compte pas, une ajoutée compte sans être clé ; rien de fait ne donne aucune sortie longue faite', () => {
  const r = semaine([], { prevues: [PREVUES[0], prevue('n-coach', '2026-12-04', 40, 3)] });
  assert.deepEqual([r.seances_prevues, r.duree_prevue_min, r.cles_prevues, r.sl_prevue_min, r.sl_faite_min, r.seances_faites, r.charge_faite], [2, 100, 1, null, null, 0, 0]);
});

test('la nuit : sous la 9.x seulement, avec l’accord de lecture, les deux dernières semaines finies et envoyées ; la route la lance', () => {
  const s = source('lib/app/realiseDuV1.ts');
  assert.match(s, /if \(!\(await moteurEstV9\(\)\) \|\| !nolioConfigure\(\)\) return \[\];/);
  assert.match(s, /if \(!o\?\.nolioAthlete \|\| !o\.accordLecture\) continue;/);
  assert.match(s, /const voulus = \[ajouterJours\(lundi, -7\), ajouterJours\(lundi, -14\)\];/);
  assert.match(s, /if \(!voulus\.includes\(du\) \|\| !o\.envois\.some\(\(x\) => x\.semaine === l\.numero\)\) continue;/);
  assert.match(s, /\.update\(\{ realise \}\)\.eq\('plan_id', planId\)\.eq\('numero', l\.numero\)/);
  // Rien n'est écrit dans Nolio, rien ne part au moteur.
  assert.ok(!/appelNolio\('(POST|PUT|DELETE)'|moteur(<|\()/.test(s));
  assert.match(source('app/api/semaines/resumer/route.ts'), /await resumerLesSemainesDuV1\(120_000\)\.catch\(nonRefaits\)/);
});
