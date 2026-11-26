#!/usr/bin/env node
/**
 * UNE SÉRIE DU SAMEDI RETIRÉE DANS NOLIO PART D'ELLE-MÊME (demande du coach du 26/11/2026 ; lib/app/seriesDuSamediNolio.ts) : la base l'oublie, rien n'est écrit ni supprimé dans Nolio, une lecture qui échoue garde la ligne.
 * Nolio et la base sont de fausses pièces ; des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-series-retirees-nolio.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const piece = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const PIECES = {
  '/lib/app/nolio.ts': `export const moiNolio = async () => ({ id: 'usr_coach' });
export const listeNolio = async (chemin) => { globalThis.__lus.push(chemin); const r = globalThis.__nolio(chemin); if (r instanceof Error) throw r; return r; };`,
  '/lib/app/supabase.ts': 'export const clientService = () => globalThis.__base;',
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
const { lireLesSeriesEncoreEnPlace } = await import(pathToFileURL(`${RACINE}lib/app/seriesDuSamediNolio.ts`).href);

const AUJOURDHUI = '2026-11-26';
const fiche = (id, nom) => ({ id, coach_id: 'coach-1', nom, nolio_athlete_id: `usr_${id}`, ancien_le: null, questionnaires: { dimanche: '2026-11-29', semaine: `q_${id}`, hooper: `h_${id}`, mot_le: null } });
const SAMEDI = { id: 'x', name: 'Ta semaine prochaine', date_start: '2026-11-28' };
const HOOPER = { id: 'y', name: 'Hooper', date_start: '2026-11-29' };

// Quatre athlètes inventés : série retirée (a), toujours là (b), Nolio muet (c), et un acheteur dont la série est retirée.
function monde() {
  const tables = {
    athletes_coaches: [fiche('a', 'Alix Essai'), fiche('b', 'Claude Essai'), fiche('c', 'Dominique Essai')],
    nolio_envois: [{ plan_id: 'p1', coach_id: 'coach-1', semaine: 'questionnaires', envoye_le: '2026-11-25T20:00:00Z',
      seances: [{ jour_id: 'questionnaire:semaine', nolio_id: 'q_p1', genre: 'note' }, { jour_id: 'questionnaire:hooper', nolio_id: 'h_p1', genre: 'note' }] }],
    plans: [{ id: 'p1', nolio_athlete_id: 'usr_p1', parametres: { champs: { nom: 'Eden Essai' } } }],
  };
  const requete = (table) => {
    const filtres = [];
    let maj = null;
    const q = {};
    for (const m of ['select', 'not', 'in']) q[m] = () => q;
    q.eq = (colonne, valeur) => { filtres.push([colonne, valeur]); return q; };
    q.update = (valeurs) => { maj = valeurs; return q; };
    const lignes = () => tables[table].filter((l) => filtres.every(([c, v]) => l[c] === undefined || l[c] === v));
    const jouer = () => {
      if (maj) { for (const l of lignes()) Object.assign(l, structuredClone(maj)); return { error: null }; }
      return { data: structuredClone(lignes()), error: null };
    };
    q.maybeSingle = async () => ({ data: structuredClone(lignes()[0] ?? null), error: null });
    q.then = (oui, non) => Promise.resolve(jouer()).then(oui, non);
    return q;
  };
  globalThis.__base = { from: requete };
  globalThis.__lus = [];
  globalThis.__nolio = (chemin) => (chemin.includes('usr_b') ? [SAMEDI, HOOPER] : chemin.includes('usr_c') ? new Error('Nolio muet') : [HOOPER]);
  return tables;
}

test('une série retirée dans Nolio part de la liste et de la base ; les autres restent, le Hooper aussi', async () => {
  const tables = monde();
  const restent = await lireLesSeriesEncoreEnPlace('coach-1', AUJOURDHUI);
  assert.deepEqual(restent.map((s) => s.nom).sort(), ['Claude Essai', 'Dominique Essai'], 'toujours dans Nolio, ou Nolio muet');
  const [a, b, c] = tables.athletes_coaches;
  assert.deepEqual([a.questionnaires.semaine, a.questionnaires.hooper, a.questionnaires.dimanche], [null, 'h_a', '2026-11-29']);
  assert.deepEqual([b.questionnaires.semaine, c.questionnaires.semaine], ['q_b', 'q_c']);
  // L'acheteur : sa ligne du samedi part, celle du Hooper reste, la date de pose aussi.
  assert.deepEqual(tables.nolio_envois[0].seances.map((s) => s.jour_id), ['questionnaire:hooper']);
  assert.equal(tables.nolio_envois[0].envoye_le, '2026-11-25T20:00:00Z');
  // Lu du samedi au dimanche de son week-end, l'athlète nommé.
  assert.ok(globalThis.__lus.includes('planned/quizzes/?date_from=2026-11-28&date_to=2026-11-29&athlete=usr_a'));
});

test('une série oubliée n’est plus relue ; sans série, Nolio n’est pas appelé', async () => {
  const tables = monde();
  globalThis.__nolio = () => [];
  assert.deepEqual(await lireLesSeriesEncoreEnPlace('coach-1', AUJOURDHUI), []);
  assert.ok(tables.athletes_coaches.every((f) => f.questionnaires.semaine === null));
  globalThis.__lus = [];
  tables.athletes_coaches.forEach((f) => { f.questionnaires.semaine = null; });
  assert.deepEqual(await lireLesSeriesEncoreEnPlace('coach-1', AUJOURDHUI), []);
  assert.deepEqual(globalThis.__lus, []);
});

test('rien ne s’écrit ni ne se supprime dans Nolio ; « Mes athlètes » et l’écran des séries s’en servent sous la 9.x seulement', () => {
  const s = readFileSync(`${RACINE}lib/app/seriesDuSamediNolio.ts`, 'utf8');
  assert.ok(!/appelNolio|'DELETE'|'POST'|'PUT'/.test(s));
  assert.match(readFileSync(`${RACINE}lib/app/espaceCoachSimple.ts`, 'utf8'), /if \(!v9\) return 0;\n\s+try \{\n\s+return \(await lire\(coachId, aujourdhui\)\)/);
  assert.ok(readFileSync(`${RACINE}lib/app/espaceCoachSimple.ts`, 'utf8').includes('lire: typeof lireLesSeriesDuSamedi = lireLesSeriesEncoreEnPlace,'));
  assert.ok(readFileSync(`${RACINE}app/app/coach/series-du-samedi/page.tsx`, 'utf8').includes('await (enLigne ? lireLesSeriesEncoreEnPlace : lireLesSeriesDuSamedi)('));
});
