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
  assert.deepEqual(r.questionnaire, { jours: null, jour_sl: 'dimanche', nb_seances: 4, arret: null });
  assert.deepEqual(r.illisibles, ['jours']);
  const t = q.lireQuestionnaire(items([1, 3], [6], 'x'));
  assert.deepEqual(t.questionnaire, { jours: ['mardi', 'jeudi'], jour_sl: 'dimanche', nb_seances: null, arret: null });
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
  assert.deepEqual(q.lireQuestionnaire(sans).questionnaire, { jours: ['lundi', 'mercredi'], jour_sl: 'dimanche', nb_seances: 3, arret: null });
  // rangées par leur `order`
  const rangees = [{ question: 'Q3', order: 2, value: 3 }, { question: 'Q1', order: 0, value: [0] }, { question: 'Q2', order: 1, value: 4 }];
  assert.deepEqual(q.lireQuestionnaire(rangees).questionnaire, { jours: ['lundi'], jour_sl: 'vendredi', nb_seances: 3, arret: null });
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
  assert.deepEqual(r.questionnaire, { jours: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 4, arret: null });
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

test('une réponse en partie illisible : « partielle », ses champs lus gardés, la question en cause', () => {
  const r = q.reponseDuSamedi([resultat('2026-11-14', items('???', 6, 4))], '2026-11-15');
  assert.equal(r.etat, 'partielle');
  assert.deepEqual(r.illisibles, ['jours']);
  assert.deepEqual(r.questionnaire, { jours: null, jour_sl: 'dimanche', nb_seances: 4, arret: null });
  const toute = q.reponseDuSamedi([resultat('2026-11-14', items(null, null, null))], '2026-11-15');
  assert.equal(toute.etat, 'illisible');
  assert.deepEqual(toute.illisibles, ['jours', 'jour_sl', 'nb_seances']);
  // deux champs illisibles sur trois : encore « partielle » (un champ lu suffit) ; « illisible » seulement sans aucun champ lu
  const deux = q.reponseDuSamedi([resultat('2026-11-14', items('???', null, 4))], '2026-11-15');
  assert.equal(deux.etat, 'partielle');
  assert.deepEqual(deux.questionnaire, { jours: null, jour_sl: null, nb_seances: 4, arret: null });
  assert.equal(q.reponseDuSamedi([resultat('2026-11-14', items([1, 3], 3, 3))], '2026-11-15').etat, 'lue');
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
  assert.deepEqual(r.questionnaire, { jours: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 4, arret: null });
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
  assert.equal(partielle.etat, 'partielle');
  assert.equal(q.sesJoursApres(null, { etat: 'absente' }), null);
  assert.equal(q.sesJoursApres(s1, { etat: 'echec' }), s1);
});

test('« ses jours » sert de dernière réponse sans réponse lisible, jamais plus ancienne que la déclaration', () => {
  const s = { jours: ['mardi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 3, du: '2026-11-07' };
  const r = q.reponseDepuisSesJours(s);
  assert.equal(r.etat, 'absente');
  assert.equal(r.du, '2026-11-07');
  assert.deepEqual(r.questionnaire, { jours: ['mardi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 3, arret: null });
  assert.equal(q.reponseDepuisSesJours(s, '2026-11-10'), null);
  assert.equal(q.reponseDepuisSesJours(null), null);
});

test('« ses jours » en clair, pour le coach', () => {
  assert.equal(q.sesJoursEnClair({ jours: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 4, du: '2026-11-14' }),
    'mar, jeu, sam, dim ; sortie longue dim ; 4 séances — réponse du 14/11');
  assert.equal(q.sesJoursEnClair({ jours: null, jour_sl: null, nb_seances: 1, du: '2026-11-14' }), '1 séance — réponse du 14/11');
});

// ─── L'arrêt (moteur 8.469, décision du coach du 16/11/2026) ──────────────────────────────────────────────────────

const ARRET = 'Cette semaine, as-tu dû arrêter de courir ?';
const avecArret = (jours, sl, nb, arret) => [...items(jours, sl, nb), { question: ARRET, value: arret }];

test('la question d’arrêt : la quatrième du questionnaire, à choix unique, obligatoire, ses trois réponses dans l’ordre', () => {
  const it = q.QUESTIONNAIRE_SEMAINE.items;
  assert.equal(it.length, 4);
  assert.equal(it[3].question, ARRET);
  assert.equal(q.QUESTION_ARRET, ARRET);
  assert.equal(it[3].type, 'unique_choice');
  assert.equal(it[3].is_mandatory, true);
  assert.deepEqual(it[3].choices.choices, ['Non', 'Oui, quelques jours', 'Oui, toute la semaine']);
});

test('l’arrêt : un rang, [rang], le rang écrit, le libellé, l’identifiant du moteur ; le reste est illisible', () => {
  assert.equal(q.lireArret(0), 'non');
  assert.equal(q.lireArret(1), 'quelques_jours');
  assert.equal(q.lireArret(2), 'semaine');
  assert.equal(q.lireArret([1]), 'quelques_jours');
  assert.equal(q.lireArret('2'), 'semaine');
  assert.equal(q.lireArret('Non'), 'non');
  assert.equal(q.lireArret(' non. '), 'non');
  assert.equal(q.lireArret('Oui, quelques jours'), 'quelques_jours');
  assert.equal(q.lireArret('oui, quelques jours'.normalize('NFD')), 'quelques_jours');
  assert.equal(q.lireArret('Oui, toute la semaine'), 'semaine');
  assert.equal(q.lireArret('quelques_jours'), 'quelques_jours');
  assert.equal(q.lireArret('semaine'), 'semaine');
  for (const v of [3, -1, 1.5, 'oui', 'peut-être', '', null, undefined, [0, 1], [], {}, true]) assert.equal(q.lireArret(v), null, String(v));
});

test('un questionnaire qui a la question : l’arrêt est lu avec les trois autres, la réponse est « lue »', () => {
  for (const [v, attendu] of [[0, 'non'], [1, 'quelques_jours'], ['Oui, toute la semaine', 'semaine']]) {
    const r = q.reponseDuSamedi([resultat('2026-11-14', avecArret([1, 3], 3, 3, v))], '2026-11-15');
    assert.equal(r.etat, 'lue');
    assert.equal(r.questionnaire.arret, attendu);
    assert.equal(r.illisibles, undefined);
  }
});

test('un questionnaire posé AVANT la question : sa réponse sans arrêt reste « lue », arret à null', () => {
  const r = q.reponseDuSamedi([resultat('2026-11-14', items([1, 3], 3, 3))], '2026-11-15');
  assert.equal(r.etat, 'lue');
  assert.equal(r.questionnaire.arret, null);
  assert.equal(r.illisibles, undefined);
  // un questionnaire de coaché d'avant : la question ouverte est la quatrième, elle n'est jamais lue comme l'arrêt
  const ouverte = [...items([1, 3], 3, 3), { question: 'Une information à remonter à ton coach ?', value: 'non' }];
  const c = q.reponseDuSamedi([resultat('2026-11-14', ouverte)], '2026-11-15');
  assert.equal(c.etat, 'lue');
  assert.equal(c.questionnaire.arret, null);
  // même sans le texte de ses questions (par la place) : la quatrième vide ou ouverte ne rend rien illisible
  const sansTextes = [{ question: 'Q1', value: [1] }, { question: 'Q2', value: 1 }, { question: 'Q3', value: 3 }, { question: 'Q4', value: 'Tout va bien, merci' }];
  const p = q.reponseDuSamedi([resultat('2026-11-14', sansTextes, { quiz_planned: 'quiz_1' })], '2026-11-15', '', new Set(['quiz_1']));
  assert.equal(p.etat, 'lue');
  assert.equal(p.questionnaire.arret, null);
});

test('l’arrêt par sa place, sans le texte de la question, quand sa valeur se lit', () => {
  const sans = [{ question: 'Q1', value: [1] }, { question: 'Q2', value: 1 }, { question: 'Q3', value: 3 }, { question: 'Q4', value: 1 }];
  assert.equal(q.lireQuestionnaire(sans).questionnaire.arret, 'quelques_jours');
  const rangees = [{ question: 'Q4', order: 3, value: 2 }, { question: 'Q1', order: 0, value: [1] }, { question: 'Q2', order: 1, value: 1 }, { question: 'Q3', order: 2, value: 3 }];
  assert.equal(q.lireQuestionnaire(rangees).questionnaire.arret, 'semaine');
});

test('une réponse d’arrêt illisible compte comme les autres champs : « partielle » si d’autres champs sont lus', () => {
  const r = q.reponseDuSamedi([resultat('2026-11-14', avecArret([1, 3], 3, 3, 'peut-être'))], '2026-11-15');
  assert.equal(r.etat, 'partielle');
  assert.deepEqual(r.illisibles, ['arret']);
  assert.deepEqual(r.questionnaire, { jours: ['mardi', 'jeudi'], jour_sl: 'jeudi', nb_seances: 3, arret: null });
  // tout illisible, arrêt compris : « illisible »
  const toute = q.reponseDuSamedi([resultat('2026-11-14', avecArret(null, null, null, 'x'))], '2026-11-15');
  assert.equal(toute.etat, 'illisible');
  assert.deepEqual(toute.illisibles, ['jours', 'jour_sl', 'nb_seances', 'arret']);
  // l'arrêt seul lu, les trois autres ouverts mais illisibles : « partielle »
  const seul = q.reponseDuSamedi([resultat('2026-11-14', avecArret(null, null, null, 1))], '2026-11-15');
  assert.equal(seul.etat, 'partielle');
  assert.deepEqual(seul.illisibles, ['jours', 'jour_sl', 'nb_seances']);
  assert.equal(seul.questionnaire.arret, 'quelques_jours');
});

test('une réponse qui ne porte que l’arrêt est « lue » (le contrat du moteur le dit)', () => {
  const r = q.reponseDuSamedi([resultat('2026-11-14', [{ question: ARRET, value: 2 }])], '2026-11-15');
  assert.equal(r.etat, 'lue');
  assert.deepEqual(r.questionnaire, { jours: null, jour_sl: null, nb_seances: null, arret: 'semaine' });
  assert.equal(r.illisibles, undefined);
});

test('l’arrêt n’est jamais repris d’une réponse plus ancienne, ni gardé dans « ses jours »', () => {
  // sans réponse cette semaine : la dernière réponse (d'avant) donne ses jours, JAMAIS son arrêt
  const avant = resultat('2026-11-07', avecArret([1, 3, 6], 6, 4, 2));
  const r = q.reponseDuSamedi([avant], '2026-11-15');
  assert.equal(r.etat, 'absente');
  assert.equal(r.questionnaire.arret, null);
  assert.deepEqual(r.questionnaire.jours, ['mardi', 'jeudi', 'dimanche']);
  // une réponse de la semaine qui n'a pas l'arrêt (ancien questionnaire) : null, pas celui d'avant
  const sans = q.reponseDuSamedi([avant, resultat('2026-11-14', items([0], 0, 2))], '2026-11-15');
  assert.equal(sans.questionnaire.arret, null);
  // « ses jours » ne porte pas l'arrêt, ni à l'écriture ni à la relecture
  const lue = q.reponseDuSamedi([resultat('2026-11-14', avecArret([1, 3], 3, 3, 1))], '2026-11-15');
  const s = q.sesJoursApres(null, lue);
  assert.deepEqual(s, { jours: ['mardi', 'jeudi'], jour_sl: 'jeudi', nb_seances: 3, du: '2026-11-14' });
  assert.equal('arret' in s, false);
  const relue = q.reponseDepuisSesJours({ ...s, arret: 'semaine' });
  assert.equal(relue.questionnaire.arret, null);
  // une réponse qui ne porte que l'arrêt ne change pas « ses jours »
  const seul = q.reponseDuSamedi([resultat('2026-11-21', [{ question: ARRET, value: 2 }])], '2026-11-22');
  assert.deepEqual(q.sesJoursApres(s, seul), { ...s, du: '2026-11-21' });
});

test('l’arrêt part au moteur dans retours.questionnaire : le champ est toujours là (null quand illisible ou absent)', () => {
  const lue = q.lireQuestionnaire(avecArret([1], 1, 3, 'semaine')).questionnaire;
  assert.deepEqual(Object.keys(lue).sort(), ['arret', 'jour_sl', 'jours', 'nb_seances']);
  assert.equal(JSON.parse(JSON.stringify(q.lireQuestionnaire(items([1], 1, 3)).questionnaire)).arret, null);
});
