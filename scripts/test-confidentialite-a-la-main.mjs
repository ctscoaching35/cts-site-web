#!/usr/bin/env node
/**
 * LA POLITIQUE DE CONFIDENTIALITÉ DIT LE POINT DU DIMANCHE D'UN COACHÉ À LA MAIN (phrase validée par le coach le 26/11/2026, à la place de « sauf séances préparées à la main », sous la 9.x).
 *
 *   node --test scripts/test-confidentialite-a-la-main.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const page = lire('app/confidentialite/page.tsx').replace(/\s+/g, ' ');

test('sous la 9.x, la phrase validée à la place de « sauf séances préparées à la main » ; sous la 8.x, la page d’avant', () => {
  assert.ok(page.includes("{v9 ? 'chaque dimanche, ' : 'chaque dimanche, sauf séances préparées à la main, '}tes séances de la semaine suivante sont préparées d’après ta semaine écoulée, avec les mêmes lectures. Nous la suivons et la corrigeons dans Nolio."));
  assert.ok(page.includes("{v9 ? ' Si tes séances sont préparées à la main, « Ton point du dimanche » t’est posé aussi ; nous lisons tes réponses dans Nolio sans les garder.' : ''}"));
});

test('et c’est ce que fait le site : à la main, aucune réponse n’est écrite dans la base', () => {
  const lecture = lire('lib/app/lectureDuPoint.ts');
  assert.ok(!/\.(insert|upsert|update)\(/.test(lecture), 'la lecture du point n’écrit rien');
  const aLaMain = lire('lib/app/pointALaMain.ts');
  assert.ok(!/reponses|semaines_ecrites/.test(aLaMain.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/reponsesAuPoint/g, '')), 'seuls le questionnaire posé et le jour du rappel sont gardés');
});
