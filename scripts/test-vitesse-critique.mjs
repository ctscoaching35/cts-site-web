#!/usr/bin/env node
/**
 * Le calcul de la vitesse critique, sans réseau ni base (décisions coach du 07/11/2026) : la saisie du coach accepte
 * n'importe quel test qui se calcule, avec une ligne d'avertissement hors des bornes habituelles
 * (lib/app/zones.ts, vitesseCritiqueCoach) ; la saisie de l'athlète et la lecture automatique gardent leurs bornes
 * (vitesseCritique) ; la lecture des tours (lib/app/tests.ts) ne dépend pas de l'ordre des efforts — le test se court le
 * 3 min d'abord depuis le 07/11/2026.
 *
 *   node --test scripts/test-vitesse-critique.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Les imports du site n'ont pas d'extension (« ./zones ») : on la leur donne.
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
const { allure, vitesseCritique, vitesseCritiqueCoach } = await import('../lib/app/zones.ts');
const { vcDuTest } = await import('../lib/app/tests.ts');

const douze = (m) => ({ duree_s: 720, distance_m: m });
const trois = (m) => ({ duree_s: 180, distance_m: m });

test('le cas du 07/11 : 12 min = 3600 m, 3 min = 922 m, enregistré avec un avertissement', () => {
  const r = vitesseCritiqueCoach(douze(3600), trois(922));
  assert.ok(!('erreur' in r));
  assert.ok(Math.abs(r.vc_ms - 4.959) < 0.001, String(r.vc_ms));
  assert.equal(allure(r.vc_ms), '3:22');
  assert.equal(Math.round(r.d_prime_m), 29);
  assert.equal(r.avertissement,
    'Le 3 min ne semble pas couru à fond : la vitesse critique peut être un peu haute et le profil « plutôt endurant » exagéré.');
  // L'athlète et la lecture automatique : toujours refusé.
  assert.ok('erreur' in vitesseCritique(douze(3600), trois(922)));
});

test('un test dans les bornes : le même calcul que vitesseCritique, sans avertissement', () => {
  const r = vitesseCritiqueCoach(trois(1000), douze(3150));
  const ref = vitesseCritique(douze(3150), trois(1000));
  assert.ok(!('erreur' in r) && !('erreur' in ref));
  assert.equal(r.vc_ms, ref.vc_ms);
  assert.equal(r.d_prime_m, ref.d_prime_m);
  assert.equal(r.avertissement, null);
});

test('refusé seulement ce qui ne se calcule pas', () => {
  assert.ok('erreur' in vitesseCritiqueCoach(douze(3600), { duree_s: 720, distance_m: 3000 }), 'deux durées égales');
  assert.ok('erreur' in vitesseCritiqueCoach(douze(3600), trois(900)), 'le court à la vitesse du long (D′ = 0)');
  assert.ok('erreur' in vitesseCritiqueCoach(douze(3600), trois(850)), 'le court plus lent que le long');
  assert.ok('erreur' in vitesseCritiqueCoach(douze(900), trois(1000)), 'le long moins loin que le court (VC négative)');
  assert.ok('erreur' in vitesseCritiqueCoach({ duree_s: 0, distance_m: 3000 }, trois(900)), 'une durée nulle');
  assert.ok('erreur' in vitesseCritiqueCoach(douze(Number.NaN), trois(900)), 'une distance illisible');
});

test('hors des bornes, enregistré avec la ligne qui convient', () => {
  const avert = (a, b) => {
    const r = vitesseCritiqueCoach(a, b);
    assert.ok(!('erreur' in r), JSON.stringify(r));
    return r.avertissement;
  };
  assert.match(avert(douze(3600), trois(910)), /^Le 3 min ne semble pas couru à fond/); // D′ de 13 m
  assert.match(avert(douze(2600), trois(1300)), /^Le 12 min ne semble pas couru à fond : la vitesse critique peut être un peu basse/); // D′ > 600
  assert.match(avert({ duree_s: 960, distance_m: 4000 }, trois(1000)), /^Les durées sortent du protocole/); // 16 min
  assert.match(avert({ duree_s: 400, distance_m: 1700 }, trois(950)), /^Les durées sortent du protocole/); // moins de 5 min d'écart
  assert.match(avert(douze(1500), trois(500)), /^La vitesse critique sort des valeurs habituelles/); // 1,85 m/s
  assert.match(avert({ duree_s: 600, distance_m: 3000 }, { duree_s: 240, distance_m: 1220 }), /^L’effort court ne semble pas couru à fond/);
});

test('la lecture des tours ne dépend pas de l’ordre : le 3 min d’abord, puis le 12 min', () => {
  const tour = (duration, distance) => ({ distance, duration, start_index: null, end_index: null });
  const echauffement = [tour(960, 2600), tour(20, 90), tour(40, 100), tour(20, 90), tour(40, 100)];
  const avant = vcDuTest([...echauffement, tour(720, 3150), tour(1800, 3000), tour(180, 1000), tour(600, 1600)], null);
  const apres = vcDuTest([...echauffement, tour(180, 1000), tour(1800, 3000), tour(720, 3150), tour(600, 1600)], null);
  assert.ok(!('erreur' in apres), JSON.stringify(apres));
  assert.deepEqual(apres, avant);
  assert.equal(apres.source, 'tours');
  assert.ok(Math.abs(apres.vc_ms - 2150 / 540) < 1e-9);
});
