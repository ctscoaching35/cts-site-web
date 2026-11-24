#!/usr/bin/env node
/**
 * LE GPX DU MOTEUR v1 (lib/app/gpxV9.ts, lib/app/traceV9.ts ; réponse du moteur v1 au site, 24/11/2026, règles 2 et 9, C1) : POST /v1/trace rend
 * `gpx: { montees: [{ dplus_m }], dplus_par_pente: { vallonne, cote_moderee, cote_raide } }` ; le site le garde avec les paramètres du plan (`champs.gpx`) et le renvoie à
 * chaque appel dans `parametres.gpx`, sous la 9.x seulement ; sans trace lue, rien ne part. L'échange est FICTIF (scripts/fixtures/moteur-v9/trace.json, écrit à la main
 * d'après la forme annoncée) : à refaire sur le moteur quand /v1/trace le rend. Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-gpx-v9.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href : specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const gpxMod = await charge('gpxV9');
const trace = await charge('traceV9');
const moteur = await charge('moteurV9');
const passes = await charge('passeUnPlanV9');
const { API_URL } = await import(pathToFileURL(`${RACINE}lib/plan.ts`).href);

const ECHANGE = JSON.parse(readFileSync(`${RACINE}scripts/fixtures/moteur-v9/trace.json`, 'utf8'));
const GPX = ECHANGE.reponse.gpx;

test('la forme du contrat est lue ; toute autre n’est jamais envoyée', () => {
  assert.deepEqual(gpxMod.lireGpx(GPX), GPX);
  assert.deepEqual(gpxMod.lireGpx({ montees: [], dplus_par_pente: { vallonne: 0, cote_moderee: 0, cote_raide: 0 } }), { montees: [], dplus_par_pente: { vallonne: 0, cote_moderee: 0, cote_raide: 0 } }, 'un parcours plat : aucune montée');
  const pente = GPX.dplus_par_pente;
  for (const mauvaise of [null, undefined, 'x', 3, {}, { montees: [] }, { dplus_par_pente: pente },
    { ...GPX, montees: 'beaucoup' }, { ...GPX, montees: [{ dplus_m: -5 }] }, { ...GPX, montees: [{ dplus_m: '420' }] }, { ...GPX, montees: [{}] }, { ...GPX, montees: [null] },
    { ...GPX, dplus_par_pente: { ...pente, cote_raide: undefined } }, { ...GPX, dplus_par_pente: { vallonne: 1, cote_moderee: 1 } }, { ...GPX, dplus_par_pente: { ...pente, vallonne: NaN } },
    { ...GPX, dplus_par_pente: { ...pente, vallonne: '640' } }, { ...GPX, dplus_par_pente: null }]) {
    assert.equal(gpxMod.lireGpx(mauvaise), null, JSON.stringify(mauvaise));
  }
  // Une clé de plus n'est pas gardée : seul ce que le contrat nomme part.
  assert.deepEqual(gpxMod.lireGpx({ ...GPX, secret: 1, montees: [{ dplus_m: 10, x: 1 }] }).montees, [{ dplus_m: 10 }]);
  assert.equal('secret' in gpxMod.lireGpx({ ...GPX, secret: 1 }), false);
});

test('la réponse de /v1/trace : le `gpx` est lu ; une trace illisible (un message sans `gpx`) ne donne rien', () => {
  assert.deepEqual(gpxMod.gpxDeLaTrace(ECHANGE.reponse), GPX);
  assert.equal(gpxMod.gpxDeLaTrace({ message: 'Ta trace ne s’est pas lue.' }), null);
  assert.equal(gpxMod.gpxDeLaTrace(null), null);
});

test('le lecteur de la trace : le fichier part en multipart sur /v1/trace, le `gpx` revient ; un échec ne bloque rien (null)', async () => {
  const appels = [];
  const faux = (reponse) => async (url, init) => { appels.push([url, init]); return reponse(); };
  const fichier = new Blob(['<gpx/>'], { type: 'application/gpx+xml' });
  const r = await trace.lireLaTraceV9(fichier, faux(() => ({ ok: true, json: async () => structuredClone(ECHANGE.reponse) })));
  assert.deepEqual(r, GPX);
  assert.equal(appels.length, 1);
  assert.equal(appels[0][0], `${API_URL}/${ECHANGE.requete.chemin.slice(1)}`);
  assert.equal(appels[0][1].method, 'POST');
  assert.ok(appels[0][1].body instanceof FormData);
  assert.equal(appels[0][1].body.get('gpx').name, ECHANGE.requete.corps.gpx);
  assert.equal(await trace.lireLaTraceV9(fichier, faux(() => ({ ok: false, json: async () => ECHANGE.reponse }))), null, 'le moteur refuse');
  assert.equal(await trace.lireLaTraceV9(fichier, faux(() => ({ ok: true, json: async () => ({ message: 'illisible' }) }))), null, 'trace illisible');
  assert.equal(await trace.lireLaTraceV9(fichier, faux(() => ({ ok: true, json: async () => ({ gpx: { montees: 'x' } }) }))), null, 'une autre forme');
  assert.equal(await trace.lireLaTraceV9(fichier, faux(() => ({ ok: true, json: async () => { throw new Error('pas du JSON'); } }))), null);
  assert.equal(await trace.lireLaTraceV9(fichier, async () => { throw new Error('réseau'); }), null, 'le moteur ne répond pas');
});

test('les paramètres du moteur v1 : le `gpx` gardé part tel quel ; sans lui, ou d’une autre forme, rien ne part', () => {
  const base = { format: 'TM', date_course: '2027-03-14' };
  assert.deepEqual(moteur.parametresV9({ ...base, gpx: GPX }).gpx, GPX);
  assert.deepEqual(moteur.parametresV9(base, { gpx: GPX }).gpx, GPX, 'celui qu’on donne');
  assert.ok(!('gpx' in moteur.parametresV9(base)));
  assert.ok(!('gpx' in moteur.parametresV9({ ...base, gpx: { montees: 'x' } })), 'une forme inconnue ne part pas');
  assert.ok(!('gpx' in moteur.parametresV9({ ...base, gpx: 'trace.gpx' })));
  const autre = { montees: [{ dplus_m: 1 }], dplus_par_pente: { vallonne: 1, cote_moderee: 1, cote_raide: 1 } };
  assert.deepEqual(moteur.parametresV9({ ...base, gpx: GPX }, { gpx: autre }).gpx, autre);
  // Les paramètres d'un plan : ses réponses gardées portent le `gpx`.
  const p = passes.parametresDuPlanV9({ parametres: { champs: { ...base, gpx: GPX } }, profil: {}, coache: true, accordLecture: true, premierLundi: '2026-11-30' }, null);
  assert.deepEqual(p.gpx, GPX);
});

test('garder la trace avec le plan : la nouvelle l’emporte, un objectif refait garde la sienne, sans trace les paramètres ne changent pas', () => {
  const sans = { champs: { format: 'TM' }, declaree_le: '2026-11-01' };
  assert.strictEqual(gpxMod.avecLeGpx(sans, null), sans, 'sous la 8.x, ou sans trace : les mêmes paramètres, pas une copie');
  assert.strictEqual(gpxMod.avecLeGpx(sans, null, { champs: {} }), sans);
  assert.strictEqual(gpxMod.avecLeGpx(sans, null, { champs: { gpx: { montees: 'x' } } }), sans, 'une forme inconnue d’avant n’est pas reprise');
  const avec = gpxMod.avecLeGpx(sans, GPX);
  assert.deepEqual(avec, { champs: { format: 'TM', gpx: GPX }, declaree_le: '2026-11-01' });
  assert.deepEqual(sans, { champs: { format: 'TM' }, declaree_le: '2026-11-01' }, 'rien n’est modifié en place');
  const refait = gpxMod.avecLeGpx({ champs: { format: 'TM', distance_km: 50 } }, null, { champs: { gpx: GPX } });
  assert.deepEqual(refait.champs, { format: 'TM', distance_km: 50, gpx: GPX });
  const autre = { montees: [], dplus_par_pente: { vallonne: 0, cote_moderee: 0, cote_raide: 0 } };
  assert.deepEqual(gpxMod.avecLeGpx({ champs: {} }, autre, { champs: { gpx: GPX } }).champs.gpx, autre);
});

test('seule la création de l’objectif d’un coaché lit la trace, derrière la garde du moteur ; sous la 8.x, la route ne fait rien de plus', () => {
  const route = readFileSync(`${RACINE}app/app/coach/athletes/route.ts`, 'utf8');
  assert.match(route, /fichierGpx instanceof File && fichierGpx\.size > 0 && \(await moteurEstV9\(\)\) \? await lireLaTraceV9\(fichierGpx\) : null/);
  assert.ok(route.indexOf('lireLaTraceV9(fichierGpx)') < route.indexOf('/v1/checkout'), 'lue avant le moteur de l’achat, une fois');
  assert.equal((route.match(/lireLaTraceV9\(/g) ?? []).length, 1);
  assert.match(route, /const parametres = avecLeGpx\(\{\n\s+\.\.\.anciensParametres, \.\.\.nouveaux,\n[^]*?\n\s+\.\.\.\(ancien\.demarre_le \? \{ declaree_le: anciensParametres\.declaree_le \} : \{\}\),\n\s+\}, gpxV9, anciensParametres\);/);
  assert.equal((route.match(/\}, gpxV9, anciensParametres\);/g) ?? []).length, 2, 'un objectif modifié, un plan acheté repris');
  assert.match(route, /parametres: avecLeGpx\(c2\.parametres, gpxV9\), coach_id/);
  // « Ajouter la trace » d'un objectif déjà écrit : « la préparation déjà écrite ne change pas, ni les paramètres » (actionsEcriture.ts) ; elle ne touche donc pas au `gpx`.
  const ajout = readFileSync(`${RACINE}lib/app/actionsEcriture.ts`, 'utf8');
  assert.ok(!/gpxV9|traceV9|avecLeGpx/.test(ajout));
  // Personne d'autre que cette route ne lit la trace du moteur v1.
  const lecteurs = execFileSync('grep', ['-rlE', `traceV9'|traceV9"`, 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  assert.deepEqual(lecteurs, ['app/app/coach/athletes/route.ts']);
});
