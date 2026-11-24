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
// La base est une fausse pièce qui note ce qu'on lui demande : le plan lu (globalThis.__ligne), ses lectures et ses écritures (globalThis.__bd).
const FAUX = {
  '/lib/app/supabase.ts': `
export const clientService = () => ({ from: (table) => { const f = { table }; const ch = { select: () => ch, update: (v) => { f.update = v; return ch; }, eq: (k, x) => { f[k] = x; return ch; },
  single: async () => { globalThis.__bd.push(['lecture', f]); return globalThis.__ligne === undefined ? { data: null, error: { message: 'absent' } } : { data: structuredClone(globalThis.__ligne), error: null }; },
  then: (ok) => { globalThis.__bd.push(['ecriture', f]); ok({ error: globalThis.__refus ? { message: 'refusé' } : null }); } }; return ch; } });`,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    let r;
    try {
      r = nextResolve(specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href : specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    const cle = Object.keys(FAUX).find((f) => r.url.endsWith(f));
    return cle ? { url: `data:text/javascript,${encodeURIComponent(FAUX[cle])}`, shortCircuit: true } : r;
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

test('la création ou la refonte de l’objectif d’un coaché lit la trace, derrière la garde du moteur ; sous la 8.x, la route ne fait rien de plus', () => {
  const route = readFileSync(`${RACINE}app/app/coach/athletes/route.ts`, 'utf8');
  assert.match(route, /fichierGpx instanceof File && fichierGpx\.size > 0 && \(await moteurEstV9\(\)\) \? await lireLaTraceV9\(fichierGpx\) : null/);
  assert.ok(route.indexOf('lireLaTraceV9(fichierGpx)') < route.indexOf('/v1/checkout'), 'lue avant le moteur de l’achat, une fois');
  assert.equal((route.match(/lireLaTraceV9\(/g) ?? []).length, 1);
  assert.match(route, /const parametres = avecLeGpx\(\{\n\s+\.\.\.anciensParametres, \.\.\.nouveaux,\n[^]*?\n\s+\.\.\.\(ancien\.demarre_le \? \{ declaree_le: anciensParametres\.declaree_le \} : \{\}\),\n\s+\}, gpxV9, anciensParametres\);/);
  assert.equal((route.match(/\}, gpxV9, anciensParametres\);/g) ?? []).length, 2, 'un objectif modifié, un plan acheté repris');
  assert.match(route, /parametres: avecLeGpx\(c2\.parametres, gpxV9\), coach_id/);
  // Personne d'autre que cette route et « Ajouter la trace » ne lit la trace du moteur v1.
  const lecteurs = execFileSync('grep', ['-rlE', `traceV9'|traceV9"`, 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  assert.deepEqual(lecteurs, ['app/app/coach/athletes/route.ts', 'lib/app/actionsEcriture.ts']);
});

test('« Ajouter la trace » d’un objectif déjà écrit : sous la 9.x la trace passe aussi par /v1/trace et son profil s’ajoute aux paramètres ; sous la 8.x, rien de plus', () => {
  const e = readFileSync(`${RACINE}lib/app/actionsEcriture.ts`, 'utf8');
  const geste = e.slice(e.indexOf('export async function ajouterTraceObjectif'), e.indexOf('// Retirer une course de préparation à venir'));
  const bloc = /if \(await moteurEstV9\(\)\) \{\n\s+const profil = await lireLaTraceV9\(gpx\);\n\s+if \(!profil \|\| !\(await garderLeGpxDuPlan\(planId, profil\)\)\) console\.error\([^\n]*\);\n\s+\}\n\s+revalidatePath\('\/app\/plan\/course'\);/;
  assert.match(geste, bloc, 'derrière la garde du moteur, une fois la fiche refaite et la trace rangée');
  assert.equal((geste.match(/lireLaTraceV9\(/g) ?? []).length, 1);
  // Ce que la 8.x faisait reste, dans le même ordre, avant le bloc : la fiche du moteur, les données du plan, la trace rangée.
  const iBloc = geste.search(bloc);
  for (const avant of ['/v1/fiche-course', 'update({ donnees: maj })', "upload(`objectifs/${planId}.gpx`"]) assert.ok(geste.indexOf(avant) > 0 && geste.indexOf(avant) < iBloc, avant);
  // Les paramètres du plan ne sont écrits nulle part ailleurs dans ce geste : seul le profil s'ajoute, par garderLeGpxDuPlan.
  assert.ok(!/update\(\{ parametres|parametres:/.test(geste.replace(/\/\/[^\n]*/g, '').replace(/JSON\.stringify\(\{ parametres: o\.parametres,/, '')), 'ni paramètres ni trame réécrits ici');
});

test('le profil s’ajoute aux paramètres d’un plan écrit : relu avant, rien d’autre ne change, la trame gardée repart de zéro', async () => {
  const parametres = { schema: 1, champs: { format: 'TM', date_course: '2027-03-14', lu: { volume_min: 300 }, entree: '2026-11-23' }, declaree_le: '2026-11-02', courses_secondaires: [{ date: '2027-01-10' }] };
  globalThis.__bd = []; globalThis.__refus = false; globalThis.__ligne = { parametres };
  assert.equal(await trace.garderLeGpxDuPlan('plan_1', GPX), true);
  const [lecture, ecriture] = globalThis.__bd;
  assert.deepEqual([lecture[0], lecture[1].table, lecture[1].id], ['lecture', 'plans', 'plan_1']);
  assert.deepEqual([ecriture[0], ecriture[1].table, ecriture[1].id], ['ecriture', 'plans', 'plan_1']);
  const { parametres: garde, trame, ...reste } = ecriture[1].update;
  assert.deepEqual(reste, {}, 'seuls les paramètres et la trame s’écrivent');
  assert.equal(trame, null);
  assert.deepEqual(garde, { ...parametres, champs: { ...parametres.champs, gpx: GPX } }, 'tout le reste est comme avant, le profil de plus');
  // Une trace refaite remplace le profil d'avant.
  const autre = { montees: [{ dplus_m: 90 }], dplus_par_pente: { vallonne: 1, cote_moderee: 2, cote_raide: 3 } };
  globalThis.__bd = []; globalThis.__ligne = { parametres: garde };
  assert.equal(await trace.garderLeGpxDuPlan('plan_1', autre), true);
  assert.deepEqual(globalThis.__bd[1][1].update.parametres.champs.gpx, autre);
  // Un plan sans paramètres, ou une base qui refuse : rien n'est dit gardé.
  globalThis.__bd = []; globalThis.__ligne = { parametres: null };
  assert.equal(await trace.garderLeGpxDuPlan('plan_1', GPX), false);
  globalThis.__ligne = undefined;
  assert.equal(await trace.garderLeGpxDuPlan('plan_1', GPX), false);
  assert.deepEqual(globalThis.__bd.map(([quoi]) => quoi), ['lecture', 'lecture'], 'aucune écriture');
  globalThis.__bd = []; globalThis.__ligne = { parametres }; globalThis.__refus = true;
  assert.equal(await trace.garderLeGpxDuPlan('plan_1', GPX), false);
});
