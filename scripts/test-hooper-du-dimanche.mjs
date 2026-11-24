#!/usr/bin/env node
/**
 * LE HOOPER DU DIMANCHE SOUS LE MOTEUR 9.x (décision 52 du coach, 20/11/2026 : sans Hooper, l'alerte fatigue ne part jamais ; lib/app/dimanchesCoaches.ts,
 * lib/app/hooperDuDimanche.ts) : « Ton point du dimanche » remplace « Ta semaine prochaine » du samedi, mais le Hooper reste posé chaque dimanche (à midi, avec lui, depuis la décision 211 ; 8 h sous la 8.x), pour le
 * dimanche qui vient, d'un coaché relié et d'un acheteur d'accord pour la lecture. Sous la 9.x le passage ne pose, ne garde ni ne retire que le Hooper ; sous la 8.x, rien
 * ne change. Nolio et la base sont de fausses pièces qui notent chaque appel. Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-hooper-du-dimanche.mjs
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const FAUX = {
  '/lib/app/nolio.ts': `
export const refusNolio = (r, quoi) => 'refus : ' + quoi;
export const listeNolio = async (chemin) => {
  if (chemin.startsWith('library/quiz_frames/')) return [{ id: 'qf_hooper', scope: 'nolio' }];
  if (chemin.startsWith('planned/quizzes/')) return structuredClone(globalThis.__quizzes);
  return [];
};
export const appelNolio = async (methode, chemin, corps) => {
  globalThis.__appels.push([methode, chemin, corps]);
  return methode === 'POST' ? { statut: 201, corps: { id: 'q_nouveau_' + (++globalThis.__n) } } : { statut: 204, corps: null };
};`,
  '/lib/app/coaching.ts': 'export const destinataire = async (usr) => ({ moi: false, usr });',
  '/lib/app/ecriture.ts': "export const QUESTIONNAIRE_SEMAINE = { name: 'Ta semaine prochaine', items: [{ question: 'Combien de jours ?', type: 'choice' }] };",
  '/lib/app/anciens.ts': 'export const estAncien = () => false; export const enAttenteDeProfil = () => false;',
  '/lib/app/questionnaireSamedi.ts': "export const QUESTION_OUVERTE = 'Une information à remonter à ton coach ?';",
  '/lib/app/supabase.ts': `
export const clientService = () => ({ from: (table) => {
  const chaine = new Proxy({}, { get: (_, k) => {
    if (k === 'then') return (ok) => ok({ data: globalThis.__base[table] ?? [], error: null });
    if (k === 'maybeSingle' || k === 'single') return async () => { const d = globalThis.__base[table]; return { data: Array.isArray(d) ? d[0] ?? null : d ?? null, error: null }; };
    if (k === 'update' || k === 'upsert') return (v) => { globalThis.__ecritures.push([k, table, v]); return chaine; };
    return () => chaine;
  } });
  return chaine;
} });`,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    let r;
    try {
      r = nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    const cle = Object.keys(FAUX).find((f) => r.url.endsWith(f));
    return cle ? { url: `data:text/javascript,${encodeURIComponent(FAUX[cle])}`, shortCircuit: true } : r;
  },
});
const aide = await import(pathToFileURL(`${RACINE}lib/app/hooperDuDimanche.ts`).href);
const dimanches = await import(pathToFileURL(`${RACINE}lib/app/dimanchesCoaches.ts`).href);

const AUJOURDHUI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const DIMANCHE = aide.dimancheApres(AUJOURDHUI);
const jour = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const SAMEDI = jour(DIMANCHE, -1);
const samedi = (id, extra = {}) => ({ id, name: 'Ta semaine prochaine', date_start: `${SAMEDI}T08:00:00`, ...extra });
const hooper = (id, date = DIMANCHE, extra = {}) => ({ id, name: 'Hooper', quiz_type: 'hooper', date_start: `${date}T08:00:00`, ...extra });
const pointDuDimanche = { id: 'q_point', name: 'Ton point du dimanche', date_start: `${DIMANCHE}T12:00:00` };

const situation = ({ quizzes = [], base = {} } = {}) => {
  globalThis.__quizzes = quizzes; globalThis.__appels = []; globalThis.__ecritures = []; globalThis.__n = 0; globalThis.__base = base;
};
const poses = () => globalThis.__appels.filter(([m]) => m === 'POST').map(([, , corps]) => corps);
const retires = () => globalThis.__appels.filter(([m]) => m === 'DELETE').map(([, chemin]) => chemin);

test('le dimanche qui vient : le premier dimanche strictement après le jour, et le jour de Paris d’un instant', () => {
  assert.equal(aide.dimancheApres('2026-11-24'), '2026-11-29'); // un mardi
  assert.equal(aide.dimancheApres('2026-11-28'), '2026-11-29'); // un samedi
  assert.equal(aide.dimancheApres('2026-11-29'), '2026-12-06'); // un dimanche : le suivant
  assert.equal(aide.jourDeParis('2026-11-28T23:30:00Z'), '2026-11-29');
});

test('sous la 8.x, rien ne change : le questionnaire du samedi et le Hooper sont posés ; un questionnaire du samedi en trop part', async () => {
  situation();
  const r = await dimanches.poserLeDimanche('usr_1', { coache: true, avecHooper: true });
  assert.deepEqual(poses().map((c) => c.name ?? 'Hooper'), ['Ta semaine prochaine', 'Hooper']);
  assert.equal(poses()[1].quiz_frame, 'qf_hooper');
  assert.equal(poses()[1].date_start, DIMANCHE);
  assert.equal(poses()[1].hour_start, '08:00');
  assert.deepEqual([r.semaine, r.hooper], ['q_nouveau_1', 'q_nouveau_2']);
  assert.deepEqual(retires(), []);
  situation({ quizzes: [samedi('q_8x'), samedi('q_double', { recurrence: { id: 'serie_1' } })] });
  const garde = await dimanches.poserLeDimanche('usr_1', { coache: true, avecHooper: true });
  assert.equal(garde.semaine, 'q_8x', 'celui qui est en place est gardé');
  assert.deepEqual(retires().map((c) => c.split('/')[2]), ['q_double'], 'l’autre part : comme avant');
});

test('sous la 9.x, le Hooper seul : posé le dimanche à midi (décision 211, avec le point du dimanche) pour le dimanche qui vient ; « Ta semaine prochaine » n’est ni posé ni retiré, « Ton point du dimanche » non plus', async () => {
  situation({ quizzes: [samedi('q_8x', { recurrence: { id: 'serie_1' } }), pointDuDimanche] });
  const r = await dimanches.poserLeDimanche('usr_1', { coache: true, avecHooper: true, seulementLeHooper: true });
  assert.equal(poses().length, 1);
  assert.deepEqual(poses()[0], { quiz_frame: 'qf_hooper', date_start: DIMANCHE, hour_start: '12:00', athletes: ['usr_1'] });
  assert.equal(aide.HEURE_DU_HOOPER_V9, '12:00', 'la même heure que « Ton point du dimanche »');
  assert.deepEqual([r.semaine, r.hooper], [null, 'q_nouveau_1']);
  assert.deepEqual(retires(), [], 'rien n’est retiré de Nolio : le questionnaire du samedi de la 8.x reste jusqu’à ce que le coach le retire');
});

test('sous la 9.x, un Hooper déjà posé pour ce dimanche est gardé ; un en trop (un autre dimanche, une série d’avant) part, comme sous la 8.x', async () => {
  situation({ quizzes: [hooper('q_h1'), hooper('q_h_plus_tard', jour(DIMANCHE, 7), { recurrence: { id: 'serie_h' } }), samedi('q_8x')] });
  const r = await dimanches.poserLeDimanche('usr_1', { coache: true, avecHooper: true, seulementLeHooper: true, garder: ['q_h1'] });
  assert.deepEqual(poses(), []);
  assert.equal(r.hooper, 'q_h1');
  assert.deepEqual(retires().map((c) => c.split('/')[2]), ['q_h_plus_tard']);
  assert.match(retires()[0], /recurrence_action=following/);
});

test('sous la 9.x, un acheteur sans accord de lecture : pas de Hooper posé, et celui d’un accord retiré part', async () => {
  situation({ quizzes: [hooper('q_h1')] });
  const r = await dimanches.poserLeDimanche('usr_1', { coache: false, avecHooper: false, seulementLeHooper: true });
  assert.deepEqual(poses(), []);
  assert.equal(r.hooper, null);
  assert.deepEqual(retires().map((c) => c.split('/')[2]), ['q_h1']);
});

// ─── Ce que la base garde ───────────────────────────────────────────────────────────────────────────

test('la fiche d’un coaché sous la 9.x : le Hooper noté ; le questionnaire du samedi que la 8.x a posé pour CE week-end reste noté, celui d’un week-end passé non', () => {
  const r = { dimanche: DIMANCHE, semaine: null, hooper: 'q_h' };
  const avant = { dimanche: DIMANCHE, semaine: 'q_8x', hooper: 'q_h_avant', jusqua: DIMANCHE, mot_le: '2026-11-20', mot_note: 'x' };
  assert.deepEqual(aide.suiteDeLaFiche(avant, r, true), { dimanche: DIMANCHE, jusqua: DIMANCHE, semaine: 'q_8x', hooper: 'q_h', mot_le: '2026-11-20', mot_note: 'x' });
  assert.equal(aide.suiteDeLaFiche({ ...avant, dimanche: jour(DIMANCHE, -7) }, r, true).semaine, null);
  assert.equal(aide.suiteDeLaFiche(null, r, true).semaine, null);
  // Sous la 8.x : ce que le passage a posé, comme avant.
  assert.deepEqual(aide.suiteDeLaFiche(avant, { dimanche: DIMANCHE, semaine: 'q_s', hooper: 'q_h' }, false), { dimanche: DIMANCHE, jusqua: DIMANCHE, semaine: 'q_s', hooper: 'q_h', mot_le: '2026-11-20', mot_note: 'x' });
  assert.equal(aide.suiteDeLaFiche({ jusqua: '2026-11-01' }, { dimanche: DIMANCHE, semaine: null, hooper: null }, false).jusqua, '2026-11-01');
});

test('le plan d’un acheteur : sous la 9.x, le Hooper et la série du samedi de la 8.x tant que son week-end est le même ; sous la 8.x, ce que le passage a posé', () => {
  const hier = new Date(Date.now() - 86_400_000).toISOString();
  const avant = { envoye_le: hier, seances: [{ jour_id: 'questionnaire:semaine', nolio_id: 'q_8x', genre: 'note' }, { jour_id: 'questionnaire:hooper', nolio_id: 'q_h_avant', genre: 'note' }] };
  const r = { dimanche: DIMANCHE, semaine: null, hooper: 'q_h' };
  assert.deepEqual(aide.posesDuPlan(r, avant, true), [{ jour_id: 'questionnaire:semaine', nolio_id: 'q_8x', genre: 'note' }, { jour_id: 'questionnaire:hooper', nolio_id: 'q_h', genre: 'note' }]);
  assert.deepEqual(aide.posesDuPlan(r, { ...avant, envoye_le: new Date(Date.now() - 9 * 86_400_000).toISOString() }, true), [{ jour_id: 'questionnaire:hooper', nolio_id: 'q_h', genre: 'note' }]);
  assert.deepEqual(aide.posesDuPlan(r, null, true), [{ jour_id: 'questionnaire:hooper', nolio_id: 'q_h', genre: 'note' }]);
  assert.deepEqual(aide.posesDuPlan({ dimanche: DIMANCHE, semaine: null, hooper: null }, null, true), []);
  assert.deepEqual(aide.posesDuPlan({ dimanche: DIMANCHE, semaine: 'q_s', hooper: 'q_h' }, avant, false),
    [{ jour_id: 'questionnaire:semaine', nolio_id: 'q_s', genre: 'note' }, { jour_id: 'questionnaire:hooper', nolio_id: 'q_h', genre: 'note' }]);
  assert.deepEqual(aide.posesDuPlan({ dimanche: DIMANCHE, semaine: null, hooper: 'q_h' }, avant, false), [{ jour_id: 'questionnaire:hooper', nolio_id: 'q_h', genre: 'note' }], 'sous la 8.x une série d’avant n’est pas gardée');
});

const FICHE = (questionnaires) => ({ id: 'f1', nom: 'Athlète fictif', mode: 'coaching', nolio_athlete_id: 'usr_f1', questionnaires });

test('le passage du soir sous la 9.x : le Hooper de chaque coaché et de chaque acheteur d’accord, noté en base ; sous la 8.x, les deux questionnaires comme avant', async () => {
  const acheteur = { id: 'p1', coach_id: 'c1', nolio_athlete_id: 'usr_b1', accord_lecture_le: '2026-11-01T00:00:00Z' };
  const base = { athletes_coaches: [FICHE({ dimanche: DIMANCHE, semaine: 'q_8x', hooper: null, mot_le: null, mot_note: null })], plans: [acheteur], coaching: [],
    nolio_envois: { envoye_le: new Date(Date.now() - 86_400_000).toISOString(), seances: [{ jour_id: 'questionnaire:semaine', nolio_id: 'q_8x_b', genre: 'note' }] } };

  situation({ base });
  const v1 = await dimanches.programmerLesDimanches(120_000, { seulementLeHooper: true });
  assert.equal(v1.length, 2, 'le coaché et l’acheteur');
  assert.ok(v1.every((c) => !c.erreur), JSON.stringify(v1));
  assert.deepEqual(poses().map((c) => c.quiz_frame), ['qf_hooper', 'qf_hooper'], 'un Hooper chacun, jamais un questionnaire du samedi');
  assert.deepEqual(retires(), []);
  const fiche = globalThis.__ecritures.find(([, table]) => table === 'athletes_coaches')[2];
  assert.deepEqual(fiche.questionnaires, { dimanche: DIMANCHE, jusqua: undefined, semaine: 'q_8x', hooper: 'q_nouveau_1', mot_le: null, mot_note: null });
  const plan = globalThis.__ecritures.find(([, table]) => table === 'nolio_envois')[2];
  assert.deepEqual(plan.seances.map((s) => [s.jour_id, s.nolio_id]), [['questionnaire:semaine', 'q_8x_b'], ['questionnaire:hooper', 'q_nouveau_2']]);

  situation({ base });
  const v8 = await dimanches.programmerLesDimanches();
  assert.equal(v8.length, 2);
  assert.deepEqual(poses().map((c) => c.name ?? 'Hooper'), ['Ta semaine prochaine', 'Hooper', 'Ta semaine prochaine', 'Hooper'], 'sous la 8.x : le questionnaire du samedi et le Hooper, pour chacun');
  assert.deepEqual(globalThis.__ecritures.find(([, table]) => table === 'athletes_coaches')[2].questionnaires.semaine, 'q_nouveau_1');
});
