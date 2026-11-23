#!/usr/bin/env node
/**
 * Ce que la consigne App du 21/11/2026 classe « après le moteur », PRÉPARÉ et PAS BRANCHÉ (lib/app/prepareNouveauMoteur.ts) : la
 * récupération en semaines et la question montée ou descente (le questionnaire du dimanche est dans lib/app/dimancheV9.ts, testé par
 * scripts/test-dimanche-v9.mjs). Le test garde deux choses : les textes de la consigne, mot pour mot, et le fait que rien ne les lit
 * encore.
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

test('phrase de l’acheteur : son plan s’adapte à ses réponses du dimanche, sans l’inviter à écrire au coach', () => {
  assert.match(prepare.PHRASE_ACHETEUR_DIMANCHE, /s’adapte à ce que tu réponds chaque dimanche/);
  assert.ok(!/coach/i.test(prepare.PHRASE_ACHETEUR_DIMANCHE));
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
