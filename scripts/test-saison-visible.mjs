#!/usr/bin/env node
/**
 * LA SAISON DE FOND SE VOIT (le coach, 27/11/2026 : « j’aimerai que ça soit précisé quand l’athlète est en saison de fond ») : à côté de son nom dans la liste quand un autre mot passe devant, et sous son nom sur sa page,
 * même quand un objectif la suit.
 *
 *   node --test scripts/test-saison-visible.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

test('la liste : à côté du nom la saison de fond ou la prochaine course ; au bout, ce qui attend, sinon « Rien à faire pour le moment » (27/11/2026)', () => {
  assert.ok(lire('lib/app/motsDesCoaches.ts').includes("tag: saison ? 'Saison de fond' : course, aLaMain: l.a.aLaMain"));
  const liste = lire('components/app/ListeSimple.tsx');
  assert.ok(liste.includes("const l: LigneDUnMot = attendLeCoach(ligne.un) ? ligne : { ...ligne, un: { ...ligne.un, mot: 'Rien à faire pour le moment'"));
  assert.ok(liste.includes('{l.tag && <span className={puce}>{l.tag}</span>}') && liste.includes('{l.aLaMain && <span className={puce}>à la main</span>}'));
});

test('sa page la dit sous son nom, avec l’objectif qui suit', () => {
  assert.ok(lire('app/app/coach/athlete/[id]/page.tsx').includes("[TEXTES_UN_MOT.saison, prochaineCourse].filter(Boolean).join(' · puis ')"));
});
