#!/usr/bin/env node
/**
 * LES SÉRIES DU SAMEDI À RETIRER DE NOLIO (entrée 198 du coach, 24/11/2026 ; lib/app/seriesDuSamedi.ts) : la liste se construit par la base du site
 * seule, une ligne par athlète, avec le week-end de sa série ; le site ne lit pas Nolio et n'y retire rien. Des cas fictifs, sans réseau ni base.
 *
 *   node --test scripts/test-series-du-samedi.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const { seriesARetirer, TEXTES_SERIES } = await import(`${RACINE}lib/app/seriesDuSamedi.ts`);
const source = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');

const AUJOURDHUI = '2026-11-28'; // un samedi
const fiche = (id, nom, dimanche, plus = {}) => ({ id, nom, nolio_athlete_id: `usr_${id}`, ancien_le: null, questionnaires: { dimanche, semaine: `q_${id}`, hooper: `h_${id}` }, ...plus });
const envoi = (plan, envoyeLe, seances) => ({ plan_id: plan, envoye_le: envoyeLe, seances: seances ?? [{ jour_id: 'questionnaire:semaine', nolio_id: `q_${plan}`, genre: 'note' }, { jour_id: 'questionnaire:hooper', nolio_id: `h_${plan}`, genre: 'note' }] });

test('un coaché : son week-end, le samedi et le dimanche, par la base seule', () => {
  const l = seriesARetirer({ fiches: [fiche('c1', 'Camille Test', '2026-11-29')], envois: [], plans: [], aujourdhui: AUJOURDHUI });
  assert.equal(l.length, 1);
  assert.deepEqual([l[0].nom, l[0].samedi, l[0].dimanche, l[0].athleteId, l[0].usr], ['Camille Test', '2026-11-28', '2026-11-29', 'c1', 'usr_c1']);
});

test('rien à retirer : un week-end passé, un athlète sorti de l’équipe, un Hooper seul, une date illisible', () => {
  const l = seriesARetirer({ aujourdhui: AUJOURDHUI, envois: [], plans: [], fiches: [
    fiche('c1', 'Passé', '2026-11-22'), fiche('c2', 'Sorti', '2026-11-29', { ancien_le: '2026-11-10' }),
    { id: 'c3', nom: 'Hooper seul', questionnaires: { dimanche: '2026-11-29', semaine: null, hooper: 'h' } },
    fiche('c4', 'Date', 'bientôt'), { id: 'c5', nom: 'Sans série', questionnaires: null },
  ] });
  assert.deepEqual(l, []);
});

test('le dimanche même est encore à venir : la série se retire jusqu’à la fin du week-end', () => {
  assert.equal(seriesARetirer({ fiches: [fiche('c1', 'A', '2026-11-29')], envois: [], plans: [], aujourdhui: '2026-11-29' }).length, 1);
  assert.equal(seriesARetirer({ fiches: [fiche('c1', 'A', '2026-11-29')], envois: [], plans: [], aujourdhui: '2026-11-30' }).length, 0);
});

test('un acheteur : le dimanche qui suit le jour où la série a été posée, à l’heure de Paris', () => {
  const plans = [{ id: 'p1', nolio_athlete_id: 'usr_p1', parametres: { champs: { nom: 'Alex Fictif' } } }, { id: 'p2', nolio_athlete_id: 'usr_p2', parametres: null }];
  const l = seriesARetirer({ aujourdhui: AUJOURDHUI, plans, fiches: [], envois: [
    envoi('p1', '2026-11-26T22:15:00Z'),            // jeudi soir : le dimanche 29
    envoi('p2', '2026-11-28T23:30:00Z'),            // samedi 23 h 30 UTC, dimanche 0 h 30 à Paris : le dimanche d'après, le 6/12
  ] });
  assert.deepEqual(l.map((x) => [x.nom, x.samedi, x.dimanche, x.planId]), [['Alex Fictif', '2026-11-28', '2026-11-29', 'p1'], ['Acheteur d’un plan', '2026-12-05', '2026-12-06', 'p2']]);
  // Un envoi sans la ligne du questionnaire du samedi (le Hooper seul, ou rien) ne donne rien.
  assert.deepEqual(seriesARetirer({ aujourdhui: AUJOURDHUI, plans, fiches: [], envois: [
    envoi('p1', '2026-11-26T22:15:00Z', [{ jour_id: 'questionnaire:hooper', nolio_id: 'h', genre: 'note' }]), envoi('p2', '2026-11-26T22:15:00Z', []), envoi('p3', null)] }), []);
});

test('un athlète une seule fois (sa fiche d’abord), puis le plus proche en tête et par nom', () => {
  const plans = [{ id: 'p1', nolio_athlete_id: 'usr_c1', parametres: { champs: { nom: 'Même athlète' } } }, { id: 'p9', nolio_athlete_id: 'usr_p9', parametres: { champs: { nom: 'Zoé' } } }];
  const l = seriesARetirer({ aujourdhui: AUJOURDHUI, plans, fiches: [fiche('c1', 'Camille', '2026-11-29'), fiche('c2', 'Alice', '2026-12-06')],
    envois: [envoi('p1', '2026-11-26T22:00:00Z'), envoi('p9', '2026-11-26T22:00:00Z')] });
  assert.deepEqual(l.map((x) => x.nom), ['Camille', 'Zoé', 'Alice']);
});

test('l’écran lit la base du site seule et ne retire rien dans Nolio ; il n’est lié que sous le moteur 9.0', () => {
  for (const chemin of ['lib/app/seriesDuSamedi.ts', 'app/app/coach/series-du-samedi/page.tsx']) {
    const s = source(chemin);
    assert.ok(!/listeNolio|appelNolio|'DELETE'|\bfetch\(/.test(s), `${chemin} ne lit ni n'écrit dans Nolio`);
  }
  const urgent = source('app/app/coach/urgent/page.tsx');
  assert.ok(urgent.indexOf('if (!(await moteurEstV9())) return 0;') > -1 && urgent.indexOf('moteurEstV9()') < urgent.indexOf('lireLesSeriesDuSamedi(coach'), 'la carte de « Urgent » ne se lit que sous la 9.x');
  // Rien d'autre ne lit le module.
  const lecteurs = ['app/app/coach/series-du-samedi/page.tsx', 'app/app/coach/urgent/page.tsx'];
  for (const chemin of ['app/app/coach/page.tsx', 'lib/app/ecriture.ts', 'lib/app/passagesV9.ts', 'app/api/relance/envoyer/route.ts']) assert.ok(!source(chemin).includes('seriesDuSamedi'), chemin);
  for (const chemin of lecteurs) assert.ok(source(chemin).includes('seriesDuSamedi'), chemin);
});

test('les textes de l’écran : rien des règles internes, ni le moteur ni les noms retirés', () => {
  const tout = [TEXTES_SERIES.titre, TEXTES_SERIES.sousTitre, ...TEXTES_SERIES.marche, TEXTES_SERIES.vide, TEXTES_SERIES.pasEncore, TEXTES_SERIES.carte(2)].join(' ');
  assert.ok(tout.includes('« Ta semaine prochaine »') && tout.includes('« Ton point du dimanche »'));
  assert.equal(TEXTES_SERIES.carte(1), '1 série du samedi à retirer dans Nolio');
  assert.equal(TEXTES_SERIES.carte(3), '3 séries du samedi à retirer dans Nolio');
});
