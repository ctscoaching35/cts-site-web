#!/usr/bin/env node
/**
 * L'ARRÊT DIT AU POINT DU DIMANCHE (pilote du Moteur, 26/11/2026 ; lib/app/lectureDuPoint.ts) : sous la 9.x, il alerte de nouveau le coach, en automatique comme à la main, d'après les réponses et non le journal de la 8.x ;
 * sur la page de l'athlète et dans « Mes athlètes ». Des athlètes inventés ; la base et Nolio sont de fausses pièces.
 *
 *   node --test scripts/test-arret-du-point.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const piece = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const PIECES = {
  '/lib/app/coaching.ts': 'export const destinataire = async (usr) => ({ moi: false, usr });',
  '/lib/app/nolio.ts': "export const listeNolio = async (chemin) => { globalThis.__lus.push(chemin); const usr = /athlete=(usr_\\w+)/.exec(chemin)?.[1]; if (usr === 'usr_muet') throw new Error('Nolio muet'); return structuredClone(globalThis.__resultats[usr] ?? []); };",
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
const { arretDesSemaines, arretsDitsAuPoint, pointDArret } = await charge('lectureDuPoint');
const { unMot } = await charge('unMot');
const { questionnaireDuDimanche } = await charge('dimancheV9');

const AUJOURDHUI = '2026-12-02'; // un mercredi
const semaine = (lundi, arret, semaines_arret) => ({ lundi, reponses: arret ? { version: 'normale', arret, ...(semaines_arret ? { semaines_arret } : {}) } : null });

test('en automatique : la réponse la plus récente décide ; un arrêt dit alerte, « non » ou une vieille réponse non', () => {
  assert.deepEqual(arretDesSemaines([semaine('2026-11-30', 'semaine', 2)], AUJOURDHUI), { jour: '2026-11-29', arret: 'semaine', semaines: 2 });
  assert.deepEqual(arretDesSemaines([semaine('2026-11-30', 'quelques_jours')], AUJOURDHUI), { jour: '2026-11-29', arret: 'quelques_jours' });
  assert.equal(arretDesSemaines([semaine('2026-11-23', 'semaine'), semaine('2026-11-30', 'non')], AUJOURDHUI), null, 'reparti');
  assert.equal(arretDesSemaines([semaine('2026-11-23', 'semaine')], AUJOURDHUI), null, 'plus de 7 jours');
  assert.equal(arretDesSemaines([semaine('2026-11-30', null)], AUJOURDHUI), null);
});

test('le point de santé : « Arrêt signalé » dans la liste, la page à son point, une clé par réponse', () => {
  const p = pointDArret({ id: 'a1', nom: 'Camille Essai' }, { jour: '2026-11-29', arret: 'semaine', semaines: 5 });
  assert.deepEqual([p.niveau, p.genre, p.cle, p.href, p.detail], ['sante', 'arret', 'arret:point:a1:2026-11-29', '/app/coach/athlete/a1#point-du-dimanche', 'Toute la semaine, depuis plus de 4 semaines']);
  const mot = unMot({ id: 'a1', nolio: true, accord: false, aLaMain: true, points: [p], objectif: null, manque: null, gesteDuManque: null, test: null, sansReponse: false });
  assert.deepEqual([mot.mot, mot.href, mot.rang], ['Arrêt signalé', p.href, 0], 'avant « À la main » et l’accord');
});

test('tous les coachés : automatique d’après la base, à la main lus dans Nolio (posés ces 7 jours) ; une lecture muette ne casse rien', async () => {
  const arretQuestion = questionnaireDuDimanche({ version: 'normale', coache: true }).items.find((i) => i.choices?.choices.includes('Oui, toute la semaine')).question;
  const reponse = (usr, valeur) => ({ id: `r_${usr}`, name: 'Ton point du dimanche', quiz_planned: `pqz_${usr}`, date_start: '2026-11-29', items: [{ question: arretQuestion, value: valeur }] });
  const tables = {
    coaching: [{ plan_id: 'p1', athlete_id: 'auto' }, { plan_id: 'p2', athlete_id: 'reparti' }],
    semaines_ecrites: [{ plan_id: 'p1', moteur: '9.0', lundi: '2026-11-30', reponses_lues: { version: 'normale', arret: 'quelques_jours' } }, { plan_id: 'p2', moteur: '9.0', lundi: '2026-11-30', reponses_lues: { version: 'normale', arret: 'non' } }],
    athletes_coaches: [{ id: 'main', questionnaires: { point: { jour: '2026-11-29', nolio_id: 'pqz_usr_main' } } }, { id: 'muet', questionnaires: { point: { jour: '2026-11-29', nolio_id: 'x' } } },
      { id: 'jamais', questionnaires: { hooper: 'h' } }, { id: 'vieux', questionnaires: { point: { jour: '2026-11-15', nolio_id: 'y' } } }],
  };
  const requete = (table) => {
    const filtres = [];
    const q = { select: () => q, eq: (c, v) => { filtres.push((l) => l[c] === v); return q; }, in: (c, v) => { filtres.push((l) => v.includes(l[c])); return q; } };
    q.then = (oui, non) => Promise.resolve({ data: tables[table].filter((l) => filtres.every((f) => f(l))), error: null }).then(oui, non);
    return q;
  };
  Object.assign(globalThis, { __lus: [], __resultats: { usr_main: [reponse('usr_main', 'Oui, toute la semaine')] } });
  const a = (id, plus = {}) => ({ id, usr: `usr_${id}`, coache: true, aLaMain: false, accord: true, ...plus });
  const arrets = await arretsDitsAuPoint({ from: requete }, [a('auto'), a('reparti'), a('main', { aLaMain: true }), a('muet', { aLaMain: true }), a('jamais', { aLaMain: true }), a('vieux', { aLaMain: true }),
    a('plan', { coache: false })], AUJOURDHUI);
  assert.deepEqual([...arrets].map(([id, d]) => [id, d.arret]).sort(), [['auto', 'quelques_jours'], ['main', 'semaine']]);
  assert.deepEqual(globalThis.__lus.map((c) => /athlete=(usr_\w+)/.exec(c)[1]).sort(), ['usr_main', 'usr_muet'], 'seuls les points posés ces jours-ci sont lus');
});

test('« Mes athlètes » le prend avant tout autre point, sous la 9.x seulement', () => {
  const m = readFileSync(`${RACINE}lib/app/mesAthletes.ts`, 'utf8');
  assert.ok(m.includes('const arrets = v9 ? await arretsDitsAuPoint(clientService(), vue.athletes, jour).catch(() => new Map()) : new Map();'));
  assert.ok(m.includes('const sante = [...(arret ? [pointDArret(a, arret)] : []),'));
});
