#!/usr/bin/env node
/**
 * La réponse du samedi, lue (lot 0 du 16/11/2026, point 1 de la consigne App ; lib/app/questionnaireSamedi.ts), sans réseau ni
 * base : chaque question à part, tous les formats, l'ancien et le nouveau texte de la question du jour de sortie longue, le
 * questionnaire reconnu sans le texte exact, la plus récente de deux réponses, l'état de la lecture, « ses jours ». Des cas
 * fictifs.
 *
 *   node --test scripts/test-reponse-samedi.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Les imports du site n'ont pas d'extension (« ./plan ») : on la leur donne.
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
const q = await import('../lib/app/questionnaireSamedi.ts');

const NOUVEAU = 'Quel jour pour ta sortie longue (parmi les jours cochés) ?';
const ANCIEN = 'Quel jour pour ta sortie longue ?';
const items = (jours, sl, nb, texteSl = NOUVEAU) => [
  { question: 'Quels jours peux-tu courir la semaine prochaine ?', value: jours },
  { question: texteSl, value: sl },
  { question: 'Combien de séances veux-tu faire ?', value: nb },
];
const resultat = (date_start, its, plus = {}) => ({ id: `r-${date_start}`, name: 'Ta semaine prochaine', date_start, is_confirmed: true, items: its, ...plus });

test('le texte de la question du jour de sortie longue : le nouveau, validé le 16/11/2026', () => {
  assert.equal(q.QUESTION_SL, NOUVEAU);
  assert.equal(q.QUESTIONNAIRE_SEMAINE.items[1].question, NOUVEAU);
});

test('les jours : rangs, libellés, chaîne « 1,3,6 », abréviations', () => {
  assert.deepEqual(q.lireJours([1, 3, 6]), ['mardi', 'jeudi', 'dimanche']);
  assert.deepEqual(q.lireJours(['Mardi', 'Jeudi', 'Dimanche']), ['mardi', 'jeudi', 'dimanche']);
  assert.deepEqual(q.lireJours('1,3,6'), ['mardi', 'jeudi', 'dimanche']);
  assert.deepEqual(q.lireJours('1, 3, 6'), ['mardi', 'jeudi', 'dimanche']);
  assert.deepEqual(q.lireJours('[1, 3, 6]'), ['mardi', 'jeudi', 'dimanche']);
  assert.deepEqual(q.lireJours('Mardi, jeudi et samedi'), ['mardi', 'jeudi', 'samedi']);
  assert.deepEqual(q.lireJours(['mar', 'jeu.', 'DIM']), ['mardi', 'jeudi', 'dimanche']);
  assert.deepEqual(q.lireJours(['6', 0, '2']), ['lundi', 'mercredi', 'dimanche'], 'dans l’ordre de la semaine');
  assert.deepEqual(q.lireJours([1, 1, 3]), ['mardi', 'jeudi'], 'sans doublon');
});

test('les jours illisibles : null, jamais un jour perdu en silence', () => {
  assert.equal(q.lireJours(undefined), null);
  assert.equal(q.lireJours(null), null);
  assert.equal(q.lireJours([]), null);
  assert.equal(q.lireJours(''), null);
  assert.equal(q.lireJours([1, 9]), null);
  assert.equal(q.lireJours([1, 'blabla']), null);
  assert.equal(q.lireJours({ a: 1 }), null);
});

test('le jour de sortie longue : un rang, [rang], son libellé', () => {
  assert.equal(q.lireJourSl(6), 'dimanche');
  assert.equal(q.lireJourSl([6]), 'dimanche');
  assert.equal(q.lireJourSl('Dimanche'), 'dimanche');
  assert.equal(q.lireJourSl(['Samedi']), 'samedi');
  assert.equal(q.lireJourSl('5'), 'samedi');
  assert.equal(q.lireJourSl([1, 6]), null, 'deux jours : illisible');
  assert.equal(q.lireJourSl(null), null);
});

test('le nombre de séances : un nombre, « 4 », « 4 séances »', () => {
  assert.equal(q.lireNombre(4), 4);
  assert.equal(q.lireNombre('4'), 4);
  assert.equal(q.lireNombre('4 séances'), 4);
  assert.equal(q.lireNombre('3,6'), 4);
  assert.equal(q.lireNombre([5]), 5);
  assert.equal(q.lireNombre(0), null);
  assert.equal(q.lireNombre(-6), null);
  assert.equal(q.lireNombre('beaucoup'), null);
  assert.equal(q.lireNombre(undefined), null);
});

test('chaque question à part : des jours illisibles ne font plus perdre les deux autres', () => {
  const r = q.lireQuestionnaire(items('n’importe quoi', 6, '4 séances'));
  assert.deepEqual(r.questionnaire, { jours: null, jour_sl: 'dimanche', nb_seances: 4 });
  assert.deepEqual(r.illisibles, ['jours']);
  const t = q.lireQuestionnaire(items([1, 3], [6], 'x'));
  assert.deepEqual(t.questionnaire, { jours: ['mardi', 'jeudi'], jour_sl: 'dimanche', nb_seances: null });
  assert.deepEqual(t.illisibles, ['nb_seances']);
});

test('l’ancien et le nouveau texte de la question de la sortie longue se lisent', () => {
  assert.equal(q.lireQuestionnaire(items([1], 6, 3, ANCIEN)).questionnaire.jour_sl, 'dimanche');
  assert.equal(q.lireQuestionnaire(items([1], 6, 3, NOUVEAU)).questionnaire.jour_sl, 'dimanche');
  // sans « ? », avec des espaces en trop, en NFC ou NFD
  assert.equal(q.lireQuestionnaire(items([1], 5, 3, '  Quel jour pour ta sortie  longue ')).questionnaire.jour_sl, 'samedi');
  assert.equal(q.lireQuestionnaire(items([1], 5, 3, 'Quel jour pour ta sortie longue (parmi les jours cochés)')).questionnaire.jour_sl, 'samedi');
  assert.equal(q.lireQuestionnaire(items([1], 5, 3, NOUVEAU.normalize('NFD'))).questionnaire.jour_sl, 'samedi');
});

test('des questions sans le texte exact : par leur place', () => {
  const sans = [{ question: 'Q1', value: [0, 2] }, { question: 'Q2', value: 6 }, { question: 'Q3', value: 3 }];
  assert.deepEqual(q.lireQuestionnaire(sans).questionnaire, { jours: ['lundi', 'mercredi'], jour_sl: 'dimanche', nb_seances: 3 });
  // rangées par leur `order`
  const rangees = [{ question: 'Q3', order: 2, value: 3 }, { question: 'Q1', order: 0, value: [0] }, { question: 'Q2', order: 1, value: 4 }];
  assert.deepEqual(q.lireQuestionnaire(rangees).questionnaire, { jours: ['lundi'], jour_sl: 'vendredi', nb_seances: 3 });
  // une place qui porte le texte d'une autre question n'est pas prise pour la sienne
  const melangees = [{ question: 'Combien de séances veux-tu faire ?', value: 5 }, { question: 'Q2', value: 6 }];
  assert.equal(q.lireQuestionnaire(melangees).questionnaire.jours, null);
  assert.equal(q.lireQuestionnaire(melangees).questionnaire.nb_seances, 5);
});

test('le questionnaire est reconnu par son identifiant posé, son nom ou ses questions', () => {
  const autre = { id: 'x', name: 'Autre', date_start: '2026-11-14', is_confirmed: true, items: [{ question: 'Une autre', value: 1 }] };
  assert.equal(q.estLeQuestionnaire(autre), false);
  assert.equal(q.estLeQuestionnaire({ ...autre, quiz_planned: 'quiz_9' }, new Set(['quiz_9'])), true);
  assert.equal(q.estLeQuestionnaire({ ...autre, name: ' TA SEMAINE  prochaine ' }), true);
  assert.equal(q.estLeQuestionnaire({ ...autre, name: 'Renommé', items: items([1], 6, 3, ANCIEN) }), true);
});

test('la réponse de la semaine, lue : état « lue »', () => {
  const r = q.reponseDuSamedi([resultat('2026-11-14', items([1, 3, 6], 6, 4))], '2026-11-15');
  assert.equal(r.etat, 'lue');
  assert.deepEqual(r.questionnaire, { jours: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 4 });
  assert.equal(r.du, '2026-11-14');
});

test('deux réponses la même semaine : la plus récente, par sa date et son heure, jamais la première de la liste', () => {
  const tot = resultat('2026-11-14', items([0], 0, 2), { id: 'a', hour_start: '08:30:00' });
  const tard = resultat('2026-11-14', items([1, 3], 3, 3), { id: 'b', hour_start: '19:10:00' });
  const dimanche = resultat('2026-11-15', items([4], 4, 1), { id: 'c', hour_start: '07:00:00' });
  assert.deepEqual(q.reponseDuSamedi([tot, tard], '2026-11-15').questionnaire.jours, ['mardi', 'jeudi']);
  assert.deepEqual(q.reponseDuSamedi([tard, tot], '2026-11-15').questionnaire.jours, ['mardi', 'jeudi']);
  assert.deepEqual(q.reponseDuSamedi([tot, tard, dimanche], '2026-11-15').questionnaire.jours, ['vendredi']);
  // même instant : l'identifiant
  const m1 = resultat('2026-11-14', items([0], 0, 2), { id: 'm1' });
  const m2 = resultat('2026-11-14', items([1], 1, 2), { id: 'm2' });
  assert.deepEqual(q.reponseDuSamedi([m2, m1], '2026-11-15').questionnaire.jours, ['mardi']);
});

test('une réponse en partie illisible : « illisible », ses champs lus gardés, la question en cause', () => {
  const r = q.reponseDuSamedi([resultat('2026-11-14', items('???', 6, 4))], '2026-11-15');
  assert.equal(r.etat, 'illisible');
  assert.deepEqual(r.illisibles, ['jours']);
  assert.deepEqual(r.questionnaire, { jours: null, jour_sl: 'dimanche', nb_seances: 4 });
  const toute = q.reponseDuSamedi([resultat('2026-11-14', items(null, null, null))], '2026-11-15');
  assert.equal(toute.etat, 'illisible');
  assert.deepEqual(toute.illisibles, ['jours', 'jour_sl', 'nb_seances']);
});

test('aucune réponse : « absente » ; ouverte mais pas envoyée : « absente » et sa cause', () => {
  assert.deepEqual(q.reponseDuSamedi([], '2026-11-15'), { etat: 'absente' });
  const brouillon = resultat('2026-11-14', items([1], 1, 3), { is_confirmed: false });
  const r = q.reponseDuSamedi([brouillon], '2026-11-15');
  assert.equal(r.etat, 'absente');
  assert.equal(r.cause, 'non_envoyee');
  assert.equal(r.questionnaire, undefined, 'un brouillon n’est jamais lu');
});

test('sans réponse cette semaine : la dernière, ses jours, sa sortie longue ET son nombre de séances, avec sa date', () => {
  const avant = resultat('2026-11-07', items([1, 3, 5, 6], 6, 4));
  const r = q.reponseDuSamedi([avant], '2026-11-15');
  assert.equal(r.etat, 'absente');
  assert.equal(r.cause, 'ancienne');
  assert.equal(r.du, '2026-11-07');
  assert.deepEqual(r.questionnaire, { jours: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 4 });
  // plus ancienne que la déclaration de l'objectif : rien
  assert.deepEqual(q.reponseDuSamedi([avant], '2026-11-15', '2026-11-10'), { etat: 'absente' });
  // un brouillon cette semaine + une réponse d'avant : la cause dit le brouillon
  const b = resultat('2026-11-14', items([0], 0, 1), { is_confirmed: false });
  assert.equal(q.reponseDuSamedi([avant, b], '2026-11-15').cause, 'non_envoyee');
  // une réponse d'avant sans jours lisibles est sautée
  const abimee = resultat('2026-11-08', items('???', 6, 4));
  assert.equal(q.reponseDuSamedi([avant, abimee], '2026-11-15').du, '2026-11-07');
});

test('« ses jours » : mis à jour à chaque réponse lue, un champ illisible garde le dernier lu', () => {
  const lue = q.reponseDuSamedi([resultat('2026-11-14', items([1, 3], 3, 3))], '2026-11-15');
  const s1 = q.sesJoursApres(null, lue);
  assert.deepEqual(s1, { jours: ['mardi', 'jeudi'], jour_sl: 'jeudi', nb_seances: 3, du: '2026-11-14' });
  const partielle = q.reponseDuSamedi([resultat('2026-11-21', items('???', 6, 5))], '2026-11-22');
  assert.deepEqual(q.sesJoursApres(s1, partielle), { jours: ['mardi', 'jeudi'], jour_sl: 'dimanche', nb_seances: 5, du: '2026-11-21' });
  // un repli sur une réponse d'avant ne se garde pas, ni une réponse plus ancienne que la gardée
  const repli = q.reponseDuSamedi([resultat('2026-11-07', items([0], 0, 1))], '2026-11-15');
  assert.equal(q.sesJoursApres(s1, repli), s1);
  const ancienne = q.reponseDuSamedi([resultat('2026-11-10', items([0], 0, 1))], '2026-11-15');
  assert.equal(q.sesJoursApres(s1, ancienne).du, '2026-11-14');
  assert.equal(q.sesJoursApres(null, { etat: 'absente' }), null);
  assert.equal(q.sesJoursApres(s1, { etat: 'echec' }), s1);
});

test('« ses jours » sert de dernière réponse sans réponse lisible, jamais plus ancienne que la déclaration', () => {
  const s = { jours: ['mardi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 3, du: '2026-11-07' };
  const r = q.reponseDepuisSesJours(s);
  assert.equal(r.etat, 'absente');
  assert.equal(r.du, '2026-11-07');
  assert.deepEqual(r.questionnaire, { jours: ['mardi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 3 });
  assert.equal(q.reponseDepuisSesJours(s, '2026-11-10'), null);
  assert.equal(q.reponseDepuisSesJours(null), null);
});

test('« ses jours » en clair, pour le coach', () => {
  assert.equal(q.sesJoursEnClair({ jours: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 4, du: '2026-11-14' }),
    'mar, jeu, sam, dim ; sortie longue dim ; 4 séances — réponse du 14/11');
  assert.equal(q.sesJoursEnClair({ jours: null, jour_sl: null, nb_seances: 1, du: '2026-11-14' }), '1 séance — réponse du 14/11');
});
