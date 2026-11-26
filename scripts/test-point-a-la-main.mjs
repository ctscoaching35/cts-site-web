#!/usr/bin/env node
/**
 * LE POINT DU DIMANCHE D'UN COACHÉ PROGRAMMÉ À LA MAIN (demande du coach du 26/11/2026 ; lib/app/pointALaMain.ts) : le même questionnaire et le même rappel de 19 h, ses signaux du soir avec son accord, ses réponses sur sa
 * page ; rien n'est écrit pour lui, pas de rappel de séance. Des athlètes inventés ; Nolio et la base sont de fausses pièces.
 *
 *   node --test scripts/test-point-a-la-main.mjs
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const piece = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const PIECES = {
  '/lib/app/supabase.ts': 'export const clientService = () => globalThis.__base;',
  '/lib/app/coaching.ts': 'export const destinataire = async (usr) => ({ moi: false, usr });',
  '/lib/app/nolio.ts': `
export const refusNolio = (r, quoi) => 'refus : ' + quoi;
export const listeNolio = async (chemin) => { const usr = /athlete=(usr_\\w+)/.exec(chemin)?.[1]; return structuredClone(globalThis.__resultats[usr] ?? []); };
export const appelNolio = async (methode, chemin, corps) => { globalThis.__appels.push([methode, chemin, corps]); return { statut: 201, corps: { id: 'pqz_' + corps.athletes?.[0] } }; };`,
  '/lib/app/suivi.ts': 'export const seuilsSuivi = async () => ({}); export const relireEtGarder = async (coach, usr) => { globalThis.__signaux.push(usr); };',
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const cible = specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}`).href : specifier;
    let r;
    try {
      r = nextResolve(cible, context);
    } catch (e) {
      if (!/^(file:|\.)/.test(cible) || cible.endsWith('.ts')) throw e;
      r = nextResolve(`${cible}.ts`, context);
    }
    const remplace = Object.keys(PIECES).find((f) => r.url.endsWith(f));
    return remplace ? { url: piece(PIECES[remplace]), shortCircuit: true } : r;
  },
});
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const m = await charge('pointALaMain');
const { lireSonPoint } = await charge('lectureDuPoint');
const { suiteDeLaFiche } = await charge('hooperDuDimanche');
const { texteDuRappelV9 } = await charge('rappelDimancheV9');

const DIMANCHE = '2026-11-29';
const fiche = (id, plus = {}) => ({ id, coach_id: 'c1', nolio_athlete_id: `usr_${id}`, programmation: 'main', mode: 'coaching', questionnaires: { hooper: `h_${id}` }, ...plus });

function monde({ accords = ['usr_a'], resultats = {} } = {}) {
  const fiches = [fiche('a'), fiche('b'), fiche('auto', { programmation: 'auto' }), fiche('plan', { mode: 'plan' }), fiche('attente', { en_attente_profil: true }), fiche('ancien', { ancien_le: '2026-11-01' })];
  const requete = (table) => {
    const filtres = [];
    let maj = null;
    const q = {};
    for (const x of ['select', 'not']) q[x] = () => q;
    q.eq = (c, v) => { filtres.push([c, v]); return q; };
    q.update = (v) => { maj = v; return q; };
    const lignes = () => (table === 'nolio_accords' ? accords.map((u) => ({ coach_id: 'c1', nolio_athlete_id: u, accord_le: '2026-11-01' })) : fiches).filter((l) => filtres.every(([c, v]) => l[c] === v));
    const jouer = () => { if (maj) { for (const l of lignes()) Object.assign(l, structuredClone(maj)); return { error: null }; } return { data: structuredClone(lignes()), error: null }; };
    q.maybeSingle = async () => ({ data: structuredClone(lignes()[0] ?? null), error: null });
    q.then = (oui, non) => Promise.resolve(jouer()).then(oui, non);
    return q;
  };
  Object.assign(globalThis, { __base: { from: requete }, __appels: [], __resultats: resultats, __signaux: [] });
  return fiches;
}
const poses = (chemin) => globalThis.__appels.filter(([, c]) => c === chemin).map(([, , corps]) => corps);

test('le dimanche matin : le même point, pour ceux à la main seulement ; la cause d’un arrêt avec l’accord seulement ; posé une fois', async () => {
  const fiches = monde();
  await m.poserLesPointsALaMain(DIMANCHE);
  const quiz = poses('planned/quizzes/');
  assert.deepEqual(quiz.map((q) => [q.athletes[0], q.name, q.date_start, q.hour_start]), [['usr_a', 'Ton point du dimanche', DIMANCHE, '12:00'], ['usr_b', 'Ton point du dimanche', DIMANCHE, '12:00']]);
  const questions = (q) => q.items.map((i) => i.question).join('|');
  assert.ok(/arrêt/i.test(questions(quiz[0])) && /cause|Pourquoi/i.test(questions(quiz[0])));
  assert.equal(quiz[0].items.length, quiz[1].items.length + 1, 'sans accord, la cause ne se pose pas');
  assert.ok(!/séances? clés?|pas faite/i.test(questions(quiz[0])), 'rien n’est écrit pour lui : pas de question de séance clé');
  assert.deepEqual(fiches[0].questionnaires.point, { jour: DIMANCHE, nolio_id: 'pqz_usr_a' });
  assert.equal(fiches[0].questionnaires.hooper, 'h_a', 'le reste de la fiche reste');
  await m.poserLesPointsALaMain(DIMANCHE);
  assert.equal(poses('planned/quizzes/').length, 2, 'une fois');
});

test('le texte du point : à la main, sans « dimanche soir » (choix « B » du coach) ; en automatique, il reste', async () => {
  monde();
  await m.poserLesPointsALaMain(DIMANCHE);
  const description = poses('planned/quizzes/')[0].description;
  assert.ok(description.endsWith('Une minute, d’ici dimanche 21 h : je prépare tes séances de la semaine prochaine à partir de tes réponses.'));
  assert.ok(!description.includes('dimanche soir'));
  const { questionnaireDuDimanche } = await charge('dimancheV9');
  assert.ok(questionnaireDuDimanche({ version: 'normale', coache: true }).description.includes('je prépare tes séances de la semaine prochaine dimanche soir à partir de tes réponses.'));
});

test('à 19 h : le même rappel à qui n’a pas répondu, une fois ; jamais de rappel de séance', async () => {
  monde({ resultats: { usr_a: [{ id: 'r', name: 'Ton point du dimanche', quiz_planned: 'pqz_usr_a', date_start: DIMANCHE }] } });
  await m.poserLesPointsALaMain(DIMANCHE);
  await m.rappelerLesALaMain(DIMANCHE, '19:00');
  await m.rappelerLesALaMain(DIMANCHE, '19:10');
  assert.deepEqual(poses('planned/messages/'), [{ description: texteDuRappelV9(true), date_start: DIMANCHE, hour_start: '19:00', show_to_the_athlete: false, athletes: ['usr_b'] }]);
});

test('chaque soir, ses signaux avec son accord seulement', async () => {
  monde();
  await m.signauxDesALaMain(40_000, DIMANCHE);
  assert.deepEqual(globalThis.__signaux, ['usr_a']);
});

test('sa page : sa dernière réponse, l’arrêt, ses jours ; la cause avec l’accord seulement ; un mot signalé, jamais recopié', async () => {
  const { questionnaireDuDimanche } = await charge('dimancheV9');
  const { QUESTION_OUVERTE } = await charge('questionnaireSamedi');
  const q = questionnaireDuDimanche({ version: 'normale', coache: true, accord: true }).items;
  const repondu = q.map((i) => ({ question: i.question, value: /arrêter|arrêté/i.test(i.question) && i.choices?.choices.includes('Quelques jours') ? 'Quelques jours'
    : i.choices?.choices.includes('Blessure') ? 'Blessure' : i.question === QUESTION_OUVERTE ? 'Mon genou tire un peu' : i.type === 'number' ? 3 : i.type === 'multiple_choices' ? ['Mardi', 'Jeudi'] : i.choices?.choices.includes('Jeudi') ? 'Jeudi' : null }));
  monde({ resultats: { usr_a: [{ id: 'r', name: 'Ton point du dimanche', quiz_planned: 'pqz_usr_a', date_start: `${DIMANCHE}T15:00:00`, items: repondu }] } });
  const lu = await lireSonPoint('usr_a', true, 'pqz_usr_a', DIMANCHE);
  assert.deepEqual([lu.date, lu.reponses.arret, lu.reponses.cause, lu.reponses.nb_seances, lu.reponses.jour_sl, lu.mot], [DIMANCHE, 'quelques_jours', 'blessure', 3, 'jeudi', true]);
  assert.ok(!JSON.stringify(lu).includes('genou'), 'le texte du mot se lit dans Nolio');
  assert.equal((await lireSonPoint('usr_a', false, 'pqz_usr_a', DIMANCHE)).reponses.cause, undefined);
  assert.equal(await lireSonPoint('usr_z', true, null, DIMANCHE), null);
});

test('le passage du Hooper garde le point posé et le rappel', () => {
  const avant = { dimanche: DIMANCHE, point: { jour: DIMANCHE, nolio_id: 'pqz' }, rappel: DIMANCHE };
  const apres = suiteDeLaFiche(avant, { dimanche: '2026-12-06', semaine: null, hooper: 'h2' }, true);
  assert.deepEqual([apres.point, apres.rappel, apres.hooper], [avant.point, DIMANCHE, 'h2']);
});
