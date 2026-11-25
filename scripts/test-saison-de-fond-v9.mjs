#!/usr/bin/env node
/**
 * LES SAISONS DE FOND ENCORE EN COURS PASSENT AU MOTEUR v1 (C8 : au passage, tout coaché passe au nouveau moteur ; une saison de fond sans date devient `saison_de_fond: true` sans `date_course`). Des plans
 * fabriqués, sans réseau ni base.
 *
 *   node --test scripts/test-saison-de-fond-v9.mjs
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
const { parametresDuPlanV9 } = await import(pathToFileURL(`${RACINE}lib/app/passeUnPlanV9.ts`).href);
const { remplaceeParLaSuivante } = await import(pathToFileURL(`${RACINE}lib/app/saisonRemplacee.ts`).href);
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

// Une saison de la 8.x : ses réponses venaient d'une course de référence, avec les restes d'un autre objectif.
const SAISON = {
  fond: { saison: 2, debut: '2026-11-02' },
  champs: {
    format: 'TM', niveau: 'confirme', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3', volume_hebdo_actuel: '5h00',
    date_course: '2026-06-14', distance_km: '55', dplus_m: '3000', dmoins_m: '3000', temps_cible: '7h00', course_nom: 'Une course finie', gpx: 'x', entree: '2026-02-02',
    course_precedente: { date: '2026-01-10', duree_h: 3 },
  },
};
const envoi = (parametres, coache = true) => parametresDuPlanV9({ parametres, profil: { vc_ms: 3.8, fc_seuil1: 148 }, coache, accordLecture: true, premierLundi: '2026-11-02' }, { cote_min: '12', tapis: 'non' });

test('une saison de fond part sans date de course ni rien de la course de ses réponses, avec son entrée au début de la saison', () => {
  const p = envoi(SAISON);
  assert.equal(p.saison_de_fond, true);
  assert.equal(p.coaching, 'oui');
  assert.equal(p.entree, '2026-11-02', 'le début de la saison, pas l’entrée d’un autre objectif');
  for (const cle of ['date_course', 'distance_km', 'dplus_m', 'dmoins_m', 'temps_cible', 'course_nom', 'gpx', 'montees', 'course_precedente']) assert.ok(!(cle in p), cle);
  assert.deepEqual([p.format, p.freq_hebdo, p.jour_sl, p.volume_hebdo_actuel, p.cote_min, p.vc_ms], ['TM', '3', 'dimanche', '5h00', 12, 3.8]);
  // Un objectif, lui, ne change pas.
  const objectif = envoi({ champs: SAISON.champs });
  assert.ok(!('saison_de_fond' in objectif));
  assert.deepEqual([objectif.date_course, objectif.entree, objectif.distance_km], ['2026-06-14', '2026-02-02', '55']);
});

test('les passages ne sautent plus une saison : elle se prolonge à chaque semaine écrite, et une préparation qui prend la semaine l’arrête', () => {
  const p = source('lib/app/passagesV9.ts');
  assert.match(p, /await garderUneEcriture\(service, planId, ecrite, apres\);\n\s*if \(estUneSaisonDeFond\(o\.parametres\) && ecrite\.lundi\) await prolongerLaSaison\(planId, ecrite\.lundi\);/);
  assert.match(p, /const au = ajouterJours\(lundi, 27\);\n[^\n]*\.update\(\{ course_date: au \}\)\.eq\('id', planId\)\.lt\('course_date', au\);/, 'jamais reculée');
  assert.match(p, /semainePriseParUnObjectif\(o\.planId, lundi\);\n\s*if \(athlete\) await arreterLaSaison\(athlete, lundi\);/);
  // Avant toute écriture : le dimanche, le lundi et « Réessayer ».
  assert.equal((p.match(/await saisonPrise\(/g) ?? []).length, 3);
});

test('sans fin, une saison ne s’écrit plus quand la suivante du même coaché a commencé, ni pour un ancien athlète', () => {
  // Lundi visé : le 30 novembre 2026.
  assert.equal(remplaceeParLaSuivante('2026-08-31', ['2026-11-30'], '2026-11-30'), true, 'la suivante commence ce lundi');
  assert.equal(remplaceeParLaSuivante('2026-11-30', ['2026-08-31'], '2026-11-30'), false, 'la plus récente s’écrit');
  assert.equal(remplaceeParLaSuivante('2026-08-31', ['2026-12-07'], '2026-11-30'), false, 'la suivante n’a pas commencé');
  assert.equal(remplaceeParLaSuivante('2026-08-31', [], '2026-11-30'), false);
  assert.match(source('lib/app/fond.ts'), /if \(fiche && estAncien\(fiche\)\) return true;/);
  const p = source('lib/app/passagesV9.ts');
  assert.match(p, /if \(estUneSaisonDeFond\(o\.parametres\) && await \(await import\('\.\/fond'\)\)\.saisonEcartee\(planId, lundiVise\)\) return null;/);
});
