#!/usr/bin/env node
/**
 * 240 CÔTÉ SITE (25/11/2026) : ce que le moteur v1 lit dans Nolio.
 *   1. Les ÉTAPES des séances prévues : la liste `planned/trainings/` de Nolio ne les rend pas, ou pas toujours ; chaque séance prévue qui part au moteur et n'a pas les siennes est relue en détail, à tous les passages
 *      (sans elles, la v1 ne relit pas les corrections que le coach fait depuis la barre de Nolio).
 *   2. AU PREMIER PASSAGE d'un coaché : les séances prévues des 4 semaines d'avant son entrée, dans le même format qu'aux passages suivants, sans `id`, sans jamais de `seances: []` pour une semaine vide.
 * Des séances fictives, sans réseau ni donnée d'athlète : Nolio est donné en faux.
 *
 *   node --test scripts/test-240-nolio.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const nolio = await charge('nolioV9');
const passes = await charge('passeUnPlanV9');
const etatMod = await charge('etatMoteur');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const COURSE = ['spt_trail', 'spt_route'];
const ETAPES = [{ kind: 'step', intensity: 'work', duration: { value: 10, unit: 'min' }, targets: [{ type: 'rpe', rpe: 6 }] }];
const P = (id, date, extra = {}) => ({ id, date_start: `${date}T07:00:00`, sport: 'spt_trail', name: `Séance ${id}`, duration: { value: 3600 }, ...extra });

test('une séance prévue part au moteur : dans une semaine lue, et de la course ou des nôtres ; la même règle que le rangement des semaines', () => {
  const lundis = ['2026-11-16', '2026-11-23'];
  const nos = new Map([['n1', 'S3-mardi']]);
  assert.equal(nolio.estEnvoyee(P('a', '2026-11-17'), lundis, nos, COURSE), true);
  assert.equal(nolio.estEnvoyee(P('a', '2026-11-29'), lundis, nos, COURSE), true, 'le dimanche de la dernière semaine lue');
  assert.equal(nolio.estEnvoyee(P('a', '2026-11-30'), lundis, nos, COURSE), false);
  assert.equal(nolio.estEnvoyee(P('a', '2026-11-15'), lundis, nos, COURSE), false);
  assert.equal(nolio.estEnvoyee(P('a', '2026-11-17', { sport: 'spt_natation' }), lundis, nos, COURSE), false);
  assert.equal(nolio.estEnvoyee(P('n1', '2026-11-17', { sport: 'spt_renfo' }), lundis, nos, COURSE), true, 'une des nôtres, quel que soit son sport');
});

const detail = (reponses, appels) => async (id) => { appels.push(id); return reponses[id] ?? { statut: 200, workout: ETAPES }; };
const sansPause = { pause: async () => {} };

test('les étapes : seules les séances envoyées sans étapes sont relues ; l’ordre reste, rien n’est modifié en place', async () => {
  const planifiees = [P('a', '2026-11-17'), P('b', '2026-11-18', { workout: ETAPES }), P('c', '2026-11-19', { workout: [] }), P('d', '2026-11-20', { workout: null }), P('hors', '2026-11-01'), P('natation', '2026-11-17', { sport: 'spt_natation' })];
  const avant = JSON.stringify(planifiees);
  const appels = [];
  const r = await nolio.completerLesEtapes(planifiees, (p) => nolio.estEnvoyee(p, ['2026-11-16'], new Map(), COURSE), detail({}, appels), sansPause);
  assert.deepEqual(appels.sort(), ['a', 'c', 'd'], 'une séance complète, hors fenêtre ou d’un autre sport n’est pas relue');
  assert.deepEqual(r.map((p) => p.id), ['a', 'b', 'c', 'd', 'hors', 'natation']);
  for (const id of ['a', 'b', 'c', 'd']) assert.deepEqual(r.find((p) => p.id === id).workout, ETAPES, id);
  assert.equal(r.find((p) => p.id === 'hors').workout, undefined);
  assert.equal(JSON.stringify(planifiees), avant);
});

test('les étapes : par groupes de trois avec la pause de la 8.x ; rien à relire, ni appel ni pause', async () => {
  const planifiees = Array.from({ length: 7 }, (_, i) => P(`s${i}`, '2026-11-17'));
  let pauses = 0;
  let enCours = 0;
  let maxEnCours = 0;
  const r = await nolio.completerLesEtapes(planifiees, () => true, async () => {
    enCours += 1; maxEnCours = Math.max(maxEnCours, enCours);
    await new Promise((ok) => setImmediate(ok));
    enCours -= 1;
    return { statut: 200, workout: ETAPES };
  }, { pause: async () => { pauses += 1; } });
  assert.equal(pauses, 3, 'trois groupes de trois au plus : 3, 3, 1');
  assert.equal(maxEnCours, 3, 'jamais plus de trois à la fois');
  assert.ok(r.every((p) => nolio.aSesEtapes(p)));
  let rien = 0;
  await nolio.completerLesEtapes([P('a', '2026-11-17', { workout: ETAPES })], () => true, async () => { rien += 1; return { statut: 200 }; }, { pause: async () => { rien += 1; } });
  assert.equal(rien, 0);
  assert.equal(await nolio.completerLesEtapes([], () => true, async () => ({ statut: 200 }), sansPause).then((x) => x.length), 0);
});

test('les étapes : un détail introuvable (retirée) garde la séance ; un refus ou une panne fait échouer la lecture entière', async () => {
  const planifiees = [P('a', '2026-11-17'), P('parti', '2026-11-18'), P('sansdetail', '2026-11-19')];
  const r = await nolio.completerLesEtapes(planifiees, () => true, detail({ parti: { statut: 404 }, sansdetail: { statut: 200 } }, []), sansPause);
  assert.deepEqual(r.map((p) => p.workout), [ETAPES, undefined, undefined]);
  for (const statut of [429, 500, 401]) await assert.rejects(nolio.completerLesEtapes(planifiees, () => true, detail({ parti: { statut } }, []), sansPause), /n’a pas pu être relue/, String(statut));
});

test('au premier passage : les 4 lundis d’avant le lundi à écrire', () => {
  assert.deepEqual(nolio.lundisDuDepart('2026-11-30'), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
  assert.deepEqual(nolio.lundisDuDepart('2027-01-04'), ['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'], 'à cheval sur l’année');
  assert.equal(nolio.SEMAINES_DU_DEPART, 4);
});

test('au premier passage : jamais `seances: []` pour une semaine vide ; sans aucune séance prévue, pas de `nolio`', () => {
  const s = (lundi, n) => ({ lundi, seances: Array.from({ length: n }, (_, i) => ({ date: lundi, titre: `t${i}` })), hooper: [], activites_vues: 0 });
  assert.deepEqual(nolio.vueDuDepart({ semaines: [s('a', 0), s('b', 2), s('c', 0), s('d', 1)] }).semaines.map((x) => x.lundi), ['b', 'd']);
  assert.equal(nolio.vueDuDepart({ semaines: [s('a', 0), s('b', 0)] }), null);
  assert.equal(nolio.vueDuDepart({ semaines: [] }), null);
});

test('au premier passage, le même format qu’aux passages suivants, sans `id` : titre, durée, étapes à plat, faite, durée faite, course ; RPE et ressenti avec l’accord seulement', () => {
  const lundis = nolio.lundisDuDepart('2026-11-30');
  const planifiees = [P('v8', '2026-11-24', { workout: ETAPES }), P('coach', '2026-11-17', { workout: ETAPES, name: 'Footing' })];
  const reelles = [{ id: 'r1', date_start: '2026-11-24T18:00:00', planned: 'v8', sport: 'spt_trail', duration: { value: 3300 }, debrief: { rpe: 6, feeling: 3 } }];
  const vue = (accordLecture) => nolio.vueDuDepart(nolio.nolioDepuisNolio({ lundis, planifiees, reelles, hooper: [], parNolio: new Map(), accordLecture, sportsDeCourse: COURSE, joursDeCourse: new Set() }));
  const avec = vue(true);
  assert.deepEqual(avec.semaines.map((s) => s.lundi), ['2026-11-16', '2026-11-23'], 'les semaines sans séance ne partent pas');
  const seance = avec.semaines[1].seances[0];
  assert.ok(!('id' in seance), 'un envoi de la 8.x n’a pas d’`id` : il serait pris pour un de la v1');
  assert.deepEqual([seance.titre, seance.duree_min, seance.etapes, seance.faite, seance.duree_faite_min, seance.rpe, seance.ressenti, seance.course],
    ['Séance v8', 60, [{ s: 600, rpe: 6, type: 'work' }], true, 55, 6, 3, false]);
  const sans = vue(false).semaines[1].seances[0];
  assert.deepEqual([sans.titre, sans.faite, sans.rpe, sans.ressenti], ['Séance v8', true, null, null], 'sans accord : les prévues se lisent, pas le RPE ni le ressenti');
});

// ─── Le passage ──────────────────────────────────────────────────────────────────────────────────

const fixture = (n) => JSON.parse(readFileSync(`${RACINE}scripts/fixtures/moteur-v9/${n}.json`, 'utf8'));
const TRAME = fixture('trame');
const SEMAINE = fixture('semaine-1');
const LUNDI = TRAME.reponse.semaines[0].lundi;

function contexte({ coache, nolioLu, etat = etatMod.ETAT_VIDE }) {
  const j = { nolio: [], corps: [] };
  const c = {
    planId: 'p1', coache, accordLecture: true, parametres: SEMAINE.requete.corps.parametres, etat, derniere: null,
    ports: { appeler: async (chemin, corps) => { j.corps.push([chemin, corps]); return structuredClone(chemin === '/v1/trame' ? TRAME.reponse : SEMAINE.reponse); } },
    lireLeDepart: async () => null, garderLu: async () => {},
    lireNolio: async (...a) => { j.nolio.push(a); return nolioLu; },
    lireLesReponses: async () => null, questionnaireDe: async () => null, envoyer: async () => {}, garderEcriture: async () => {},
  };
  return { c, j };
}
const corpsDeLaSemaine = (j) => j.corps.find(([chemin]) => chemin === '/v1/semaine')[1];

test('au premier passage d’un coaché, `/v1/semaine` reçoit ce que Nolio montre des semaines d’avant ; d’un acheteur, rien n’est lu', async () => {
  const lu = { semaines: [{ lundi: '2026-11-16', seances: [{ date: '2026-11-17', titre: 'Footing', duree_min: 60, etapes: [], faite: null, duree_faite_min: null, rpe: null, ressenti: null, course: false }], hooper: [], activites_vues: 0 }] };
  const a = contexte({ coache: true, nolioLu: lu });
  assert.deepEqual(await passes.ecrireLaSemaineDuLundi(a.c, LUNDI), { quoi: 'S1 écrite' });
  assert.deepEqual(a.j.nolio, [[LUNDI, false, true]], 'la lecture du départ : le troisième paramètre');
  assert.deepEqual(corpsDeLaSemaine(a.j).nolio, lu);
  const rien = contexte({ coache: true, nolioLu: null });
  await passes.ecrireLaSemaineDuLundi(rien.c, LUNDI);
  assert.ok(!('nolio' in corpsDeLaSemaine(rien.j)), 'aucune séance prévue : pas de clé `nolio`');
  const acheteur = contexte({ coache: false, nolioLu: lu });
  await passes.ecrireLaSemaineDuLundi(acheteur.c, LUNDI);
  assert.deepEqual(acheteur.j.nolio, []);
  assert.ok(!('nolio' in corpsDeLaSemaine(acheteur.j)));
});

test('le lecteur réel : au départ, les 4 lundis d’avant, sans `id`, les étapes relues en détail, les semaines vides écartées ; aux passages suivants, comme avant', () => {
  const p = sansCommentaires(source('lib/app/passagesV9.ts'));
  assert.match(p, /lireNolio: async \(lundi, avecLaSemaine, depart = false, sansEtapes = false\) => \{/);
  assert.match(p, /const lundis = depart \? lundisDuDepart\(lundi\) : lundisALire\(avecLaSemaine \? ajouterJours\(lundi, 7\) : lundi, premierLundi \?\? ajouterJours\(lundi, -91\)\);/);
  assert.match(p, /if \(!depart\) for \(const e of o\.envois\)/, 'sans `id` au départ : aucun envoi n’est rattaché');
  assert.match(p, /const detail = q \? `\?\$\{q\.slice\(1\)\}` : '';/);
  assert.match(p, /const completes = sansEtapes \? planifiees : await completerLesEtapes\(planifiees, \(p\) => estEnvoyee\(p, lundis, parNolio, SPORTS_COURSE\), async \(id\) => \{/);
  assert.match(p, /appelNolio\('GET', `planned\/trainings\/\$\{id\}\/\$\{detail\}`\)/);
  assert.match(p, /planifiees: completes, reelles, hooper, parNolio/);
  assert.match(p, /return depart \? vueDuDepart\(vu\) : vu;/);
  // La lecture qui échoue (une étape refusée comprise) donne toujours null : la clé `nolio` ne part pas.
  assert.match(p, /\} catch \(e\) \{\n\s+console\.error\(`Nolio de \$\{planId\} non lu pour le moteur :`/);
});

// ─── La vérification que le coach lance ──────────────────────────────────────────────────────────

test('la vérification de la liste de Nolio n’affiche que la structure : aucun titre, aucune date, aucune valeur de séance, et ne lit que son propre calendrier', () => {
  const s = source('scripts/verif-etapes-nolio.mjs');
  assert.match(s, /planned\/trainings\/\?date_from=\$\{jour\(-56\)\}&date_to=\$\{jour\(14\)\}&limit=100/);
  assert.ok(!/athlete=/.test(s), 'sans paramètre d’athlète : le calendrier du coach seul');
  assert.ok(!/method:\s*'(POST|PUT|PATCH|DELETE)'/i.test(s), 'rien n’est écrit dans Nolio');
  const affiche = s.split('\n').filter((l) => l.includes('console.log')).join('\n');
  assert.ok(!/\.name|titre|date_start|description|\.workout|s\.id|JSON\.stringify|\$\{s[.\[]/.test(affiche), 'aucun contenu de séance dans ce qui s’affiche');
  assert.ok(!/console\.(log|error|info)\(\s*(liste|d|seances|corps|r)\s*[,)]/.test(s), 'aucun objet affiché tel quel');
});

test('le point du dimanche ne relit aucun détail (240, confirmé par le moteur) ; le soir et le lundi, si', async () => {
  const q = fixture('questionnaire');
  const a = contexte({ coache: true, nolioLu: null });
  const derniere = { numero: 1, lundi: LUNDI, semaine: SEMAINE.reponse.semaine, reponsesLues: null, questionnaire: null };
  a.c.derniere = derniere;
  a.c.etat = { courant: SEMAINE.reponse.etat, ecrites: [{ numero: 1, etatAvant: null }] };
  a.c.poserLeQuiz = async () => 'pqz';
  a.c.garderLeQuestionnaire = async () => {};
  a.c.ports.appeler = async (chemin) => structuredClone(chemin === '/v1/trame' ? TRAME.reponse : q.reponse);
  const dimanche = new Date(Date.parse(`${LUNDI}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  await passes.poserLeQuestionnaireDuDimanche(a.c, dimanche).catch(() => {});
  assert.deepEqual(a.j.nolio.map((x) => x.slice(1)), [[false, false, true]], 'sans étapes');
  const p = sansCommentaires(source('lib/app/passeUnPlanV9.ts'));
  assert.ok(p.includes('c.coache ? await c.lireNolio(lundi, false, true) : null'), 'le départ : relu (les étapes aussi)');
  assert.ok(p.includes('const nolio = await c.lireNolio(lundi, true);'), 'le lundi : la semaine en cours, avec ses étapes');
  assert.ok(p.includes('derniere ? await c.lireNolio(lundiASuivre, false, false, true) : null'), 'le point du dimanche : sans étapes');
  assert.equal((p.match(/lireNolio\(lundi[A-Za-z]*, [^)]*\)/g) ?? []).length, 4, 'les quatre lectures, aucune de plus');
});
