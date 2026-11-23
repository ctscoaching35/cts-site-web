#!/usr/bin/env node
/**
 * Ce que la consigne App du 21/11/2026 classe « après le moteur », PRÉPARÉ et PAS BRANCHÉ (lib/app/prepareNouveauMoteur.ts) : la
 * récupération en semaines, la question montée ou descente, le questionnaire du dimanche en trois versions. Le test garde deux
 * choses : les textes de la consigne, mot pour mot, et le fait que rien ne les lit encore.
 *
 *   node --test scripts/test-prepare-nouveau-moteur.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const prepare = await import(`${RACINE}lib/app/prepareNouveauMoteur.ts`);

test('récupération en semaines : 1 sous 3 h, 2 de 3 h à 10 h et le marathon sur route, 3 au-delà', () => {
  const s = prepare.semainesRecuperation;
  assert.equal(s(0.8, 'R10'), 1);
  assert.equal(s(1.7, 'R21'), 1);
  assert.equal(s(2.9, 'TC'), 1);
  assert.equal(s(3, 'TM'), 2);
  assert.equal(s(5.5, 'TM'), 2);
  assert.equal(s(10, 'TL'), 2);
  assert.equal(s(10.1, 'TL'), 3);
  assert.equal(s(30, 'UT'), 3);
  assert.equal(s(2.8, 'R42'), 2, 'le marathon sur route : 2 semaines, même sous 3 h');
});

test('saison de fond : la question montée ou descente, deux réponses', () => {
  assert.equal(prepare.QUESTION_A_L_AISE, 'Te sens-tu moins à l’aise en montée ou en descente ?');
  assert.deepEqual(prepare.REPONSES_A_L_AISE.map(([k]) => k), ['montee', 'descente']);
});

test('questionnaire du dimanche : trois versions, les mots de la consigne', () => {
  assert.deepEqual(Object.keys(prepare.OUVERTURES_DIMANCHE), ['normale', 'aucune_seance', 'fatigue']);
  assert.equal(prepare.OUVERTURES_DIMANCHE.normale.texte, null);
  assert.equal(prepare.OUVERTURES_DIMANCHE.aucune_seance.texte,
    'On n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, dis-le-nous : depuis combien de temps et pourquoi.');
  assert.equal(prepare.OUVERTURES_DIMANCHE.fatigue.texte,
    'Cette semaine, ton ressenti, ton RPE ou ton Hooper sortent de tes habitudes. Veux-tu une semaine plus légère ?');
});

test('questionnaire du dimanche : les questions communes, leurs choix, les conditionnelles', () => {
  const q = Object.fromEntries(prepare.QUESTIONS_DIMANCHE.map((x) => [x.cle, x]));
  assert.equal(q.arret.question, 'As-tu arrêté de courir cette semaine ?');
  assert.deepEqual(q.arret.choix, ['Non', 'Quelques jours', 'Oui, toute la semaine']);
  assert.equal(q.arret_semaines.question, 'Depuis combien de semaines as-tu arrêté, en tout ?');
  assert.deepEqual(q.arret_semaines.choix, ['1', '2', '3', '4', 'Plus de 4']);
  assert.deepEqual(q.arret_pourquoi.choix, ['Blessure', 'Maladie', 'Autre']);
  assert.deepEqual(q.arret_semaines.condition, { cle: 'arret', sauf: ['Non'] });
  assert.equal(q.seance_cle.question, 'Une séance clé pas faite comme écrite ?');
  assert.equal(q.seance_cle.type, 'multiple_choices', 'plusieurs choix');
  assert.deepEqual(q.seance_cle.choix, ['Aucune', 'La 1re séance d’intensité', 'La 2e', 'La mécanique', 'La sortie longue']);
  assert.equal(q.jour_sl.choix.length, 7, 'le jour de la sortie longue parmi les sept jours');
  assert.equal(q.jours.choix.length, 7);
});

test('préparé, pas branché : aucun fichier du site ne lit prepareNouveauMoteur', () => {
  // grep sort en 1 quand il ne trouve rien : c'est le résultat attendu.
  let lecteurs = [];
  try {
    lecteurs = execFileSync('grep', ['-rl', 'prepareNouveauMoteur', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    if (e.status !== 1) throw e;
  }
  assert.deepEqual(lecteurs, []);
});
