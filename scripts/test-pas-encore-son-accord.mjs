#!/usr/bin/env node
/**
 * « PAS ENCORE SON ACCORD » (décision 220 du coach, 24/11/2026, suite ; lib/app/erreursDuCoach.ts) : le coach enregistre des repères ou un test avant l'accord de lecture de l'athlète.
 * Sous la 9.x, la phrase dit ce qu'il fait, sans parler d'écran (plus de « Suivi », écran supprimé) ; sous la 8.x, mot pour mot celle d'avant. Texte pour le coach seul. Aucun réseau.
 *
 *   node --test scripts/test-pas-encore-son-accord.mjs
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
      return nextResolve(specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href : specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const e = await import(pathToFileURL(`${RACINE}lib/app/erreursDuCoach.ts`).href);
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

test('sous la 8.x, la phrase d’avant, mot pour mot ; sous la 9.x, ce que le coach fait, sans parler d’écran', () => {
  assert.equal(e.pasEncoreSonAccord(false), 'Pas encore son accord : associe-le à Nolio, envoie-lui le message d’accord, puis coche « Accord reçu » dans le Suivi quand il a répondu oui.');
  const v9 = e.pasEncoreSonAccord(true);
  assert.equal(v9, 'Pas encore son accord de lecture : associe-le à Nolio, envoie-lui le message d’accord, puis clique sur « Accord reçu » quand il a répondu oui.');
  assert.ok(!/Suivi|écran|page/i.test(v9), 'aucun écran cité');
  assert.ok(v9.includes('Accord reçu'), 'le bouton que le coach cherche');
  assert.ok(!/\w'\w/.test(v9) && v9.length < 160);
});

test('les deux gestes du coach (repères, test de vitesse critique) disent la phrase du moteur en ligne ; plus de phrase écrite en dur', () => {
  const a = source('lib/app/actionsCoaching.ts');
  assert.equal((a.match(/message: await pasEncoreSonAccordAuCoach\(\)/g) ?? []).length, 2);
  assert.ok(!a.includes('dans le Suivi quand il a répondu oui'), 'la phrase d’avant n’est plus qu’à un endroit (lib/app/erreursDuCoach.ts)');
  assert.match(a, /import \{ messageAuCoach, pasEncoreSonAccordAuCoach, profilEnregistre, soucisAuCoach \} from '\.\/erreursDuCoach';/);
  // La garde : la version se lit sur le moteur en ligne, une 8.x sans réponse lisible.
  assert.match(source('lib/app/erreursDuCoach.ts'), /pasEncoreSonAccord\(await moteurEstV9\(\)\.catch\(\(\) => false\)\)/);
});
