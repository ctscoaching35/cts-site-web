#!/usr/bin/env node
/**
 * CE QUE NOLIO MONTRE, POUR LE MOTEUR v1 (lib/app/nolioV9.ts ; CONTRAT_API_CTS.md, « MOTEUR v1 », entrée `nolio`) : les séances prévues et les
 * activités lues dans Nolio, rangées en semaines pour `POST /v1/semaine`. Quatre règles du moteur (moteur/adaptation.py) : une semaine présente
 * vaut « lue » (zéro séance = toutes supprimées par le coach), une séance du moteur porte son identifiant, seules les séances de course comptent
 * pour celles du coach, le RPE et le ressenti viennent de l'accord de lecture. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-nolio-v9.mjs
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
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
const n = await import(pathToFileURL(`${RACINE}lib/app/nolioV9.ts`).href);
const m = await import(pathToFileURL(`${RACINE}lib/app/moteurV9.ts`).href);

const SPORTS = ['Run', 'TrailRun', 'VirtualRun'];

test('étapes à plat : une répétition se déplie tour par tour, la rampe montante est du travail, la descendante de la récupération', () => {
  const workout = [
    { kind: 'step', intensity: 'warmup', duration: { value: 600 } },
    { kind: 'repeat', times: 3, steps: [
      { kind: 'step', intensity: 'work', duration: { value: 300 }, targets: [{ type: 'zone', zone: 3 }, { type: 'rpe', rpe: 7 }] },
      { kind: 'step', intensity: 'rest', duration: { value: 120 } },
    ] },
    { kind: 'step', intensity: 'ramp_up', duration: { value: 4, unit: 'minutes' } },
    { kind: 'step', intensity: 'ramp_down', duration: { value: 90 } },
    { kind: 'step', intensity: 'cooldown', duration: { value: 300 } },
  ];
  const e = n.aplatirLesEtapes(workout);
  assert.deepEqual(e.map((x) => x.type), ['warmup', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'cooldown']);
  assert.deepEqual(e.map((x) => x.s), [600, 300, 120, 300, 120, 300, 120, 240, 90, 300]);
  assert.equal(e[1].rpe, 7);
  assert.equal(e[2].rpe, null, 'pas de RPE cible : null, jamais inventé');
  assert.equal(n.aplatirLesEtapes(null).length, 0);
  assert.equal(n.aplatirLesEtapes([{ kind: 'repeat', times: 2, steps: [] }]).length, 0);
});

test('étapes à plat : une étape sans durée ou d’un rôle inconnu est écartée (le titre porte la dose)', () => {
  const e = n.aplatirLesEtapes([{ kind: 'step', intensity: 'work' }, { kind: 'step', intensity: 'work', duration: { value: 0 } },
    { kind: 'step', intensity: 'autre', duration: { value: 60 } }, { kind: 'step', intensity: 'work', duration: { value: 60 } }]);
  assert.deepEqual(e, [{ s: 60, rpe: null, type: 'work' }]);
});

const LUNDI = '2026-11-23';
const PLANIFIEES = [
  { id: 'p1', name: 'Seuil 1 route · 30 min — 2 × 15 min', date_start: '2026-11-24T08:00:00', sport: 'Run', duration: { value: 3600 },
    workout: [{ kind: 'step', intensity: 'work', duration: { value: 900 }, targets: [{ type: 'rpe', rpe: 5 }] }] },
  { id: 'p2', name: 'Sortie longue · 2 h', date_start: '2026-11-29T08:00:00', sport: 'TrailRun', duration: { value: 7200 }, workout: [] },
  { id: 'c1', name: 'Fractionné du coach', date_start: '2026-11-26T18:00:00', sport: 'Run', duration: { value: 2700 } },
  { id: 'x1', name: 'Gainage', date_start: '2026-11-25T07:00:00', sport: 'Strength', duration: { value: 1200 } },
];
const PAR_NOLIO = new Map([['p1', 'S9-mardi'], ['p2', 'S9-dimanche']]);
const REELLES = [
  { id: 'r1', date_start: '2026-11-24T08:05:00', planned: 'p1', sport: 'Run', duration: { value: 3500 }, debrief: { rpe: 5, feeling: 3 } },
  { id: 'r2', date_start: '2026-11-27T12:00:00', planned: null, sport: 'Bike', duration: { value: 3600 }, debrief: { rpe: 3, feeling: 4 } },
];
const lire = (extra = {}) => n.nolioDepuisNolio({ lundis: [LUNDI], planifiees: PLANIFIEES, reelles: REELLES, hooper: [
  { date_start: '2026-11-25T07:00:00', value: 14 }, { date_start: '2026-11-26T07:00:00', value: null }, { date_start: '2026-12-02T07:00:00', value: 9 }],
  parNolio: PAR_NOLIO, accordLecture: true, sportsDeCourse: SPORTS, ...extra });

test('une semaine : ses séances du moteur (avec leur identifiant) et celles du coach en course, jamais un renfo ni un autre sport', () => {
  const s = lire().semaines[0];
  assert.equal(s.lundi, LUNDI);
  assert.deepEqual(s.seances.map((x) => [x.id ?? null, x.titre]), [
    ['S9-mardi', 'Seuil 1 route · 30 min — 2 × 15 min'], ['S9-dimanche', 'Sortie longue · 2 h'], [null, 'Fractionné du coach']]);
  assert.deepEqual(s.seances[0].etapes, [{ s: 900, rpe: 5, type: 'work' }]);
  assert.ok(!('id' in s.seances[2]), 'une séance du coach n’a pas d’identifiant : le moteur la lit par sa date et son titre');
  assert.deepEqual(s.seances.map((x) => x.date), ['2026-11-24', '2026-11-29', '2026-11-26']);
});

test('faite : vrai quand une activité est reliée, sinon null ; jamais « false » (le site ne lit pas « pas faite ») ; durées en minutes', () => {
  const [mardi, dimanche, coach] = lire().semaines[0].seances;
  assert.equal(mardi.faite, true);
  assert.equal(mardi.duree_min, 60);
  assert.equal(mardi.duree_faite_min, 58);
  assert.equal(dimanche.faite, null);
  assert.equal(dimanche.duree_faite_min, null);
  assert.equal(dimanche.duree_min, 120);
  assert.equal(coach.faite, null);
  for (const x of lire().semaines[0].seances) assert.notEqual(x.faite, false);
});

test('le RPE, le ressenti et le Hooper viennent de l’accord de lecture ; la durée faite, sans', () => {
  const avec = lire().semaines[0];
  assert.equal(avec.seances[0].rpe, 5);
  assert.equal(avec.seances[0].ressenti, 3);
  assert.deepEqual(avec.hooper, [{ date: '2026-11-25', valeur: 14 }], 'une valeur nulle ou d’une autre semaine n’est pas gardée');
  const sans = lire({ accordLecture: false }).semaines[0];
  assert.equal(sans.seances[0].rpe, null);
  assert.equal(sans.seances[0].ressenti, null);
  assert.equal(sans.seances[0].duree_faite_min, 58);
  assert.deepEqual(sans.hooper, []);
});

test('activités vues : toutes celles de la semaine, reliées ou non, de tout sport', () => {
  assert.equal(lire().semaines[0].activites_vues, 2);
  assert.equal(n.nolioDepuisNolio({ lundis: ['2026-11-16'], planifiees: [], reelles: REELLES, parNolio: new Map(), accordLecture: true, sportsDeCourse: SPORTS }).semaines[0].activites_vues, 0);
});

test('une semaine lue sans séance reste présente, vide : c’est le moteur qui en conclut que le coach les a supprimées', () => {
  const v = n.nolioDepuisNolio({ lundis: ['2026-11-16', LUNDI], planifiees: PLANIFIEES, reelles: REELLES, parNolio: PAR_NOLIO, accordLecture: true, sportsDeCourse: SPORTS });
  assert.deepEqual(v.semaines.map((s) => s.lundi), ['2026-11-16', LUNDI], 'de la plus ancienne à la plus récente');
  assert.deepEqual(v.semaines[0], { lundi: '2026-11-16', seances: [], hooper: [], activites_vues: 0 });
});

test('le jour d’une course est marqué ; treize semaines au plus, les plus récentes', () => {
  const v = lire({ joursDeCourse: new Set(['2026-11-29']) }).semaines[0];
  assert.deepEqual(v.seances.map((s) => s.course), [false, true, false]);
  const lundis = Array.from({ length: 16 }, (_, i) => new Date(Date.parse('2026-08-03T12:00:00Z') + i * 7 * 86_400_000).toISOString().slice(0, 10));
  const treize = n.nolioDepuisNolio({ lundis, planifiees: [], reelles: [], parNolio: new Map(), accordLecture: true, sportsDeCourse: SPORTS });
  assert.equal(treize.semaines.length, 13);
  assert.equal(treize.semaines.at(-1).lundi, lundis.at(-1));
  assert.equal(treize.semaines[0].lundi, lundis[3]);
});

test('lundisALire : les semaines du plan avant celle qu’on écrit, treize au plus, la plus ancienne en premier', () => {
  assert.deepEqual(n.lundisALire('2026-12-07', '2026-11-23'), ['2026-11-23', '2026-11-30']);
  assert.deepEqual(n.lundisALire('2026-11-23', '2026-11-23'), [], 'la première semaine : rien à lire');
  assert.equal(n.lundisALire('2027-06-07', '2026-11-23').length, 13);
});

test('ce qui part est exactement ce que le contrat attend, sérialisable sans trou (aucun undefined)', () => {
  const corps = m.corpsDeLaSemaine({ parametres: { format: 'TM' }, numero: 'S10', etat: null, nolio: lire(), reponses: null });
  assert.deepEqual(Object.keys(corps), ['parametres', 'numero', 'nolio'], 'sans état ni réponse : ces clés n’existent pas');
  assert.deepEqual(JSON.parse(JSON.stringify(corps)), corps);
  assert.ok(!('nolio' in m.corpsDeLaSemaine({ parametres: {}, numero: 3, nolio: null })), 'une lecture manquée : la clé disparaît');
});
