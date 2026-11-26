#!/usr/bin/env node
/**
 * « MES ATHLÈTES » SOUS LA 9.x : le nom ouvre toujours la page de l'athlète, le mot ouvre son geste (défaut vu en ligne le 26/11/2026 : un mot qui menait à Nolio emportait toute la ligne, et la page de l'athlète ne s'ouvrait plus).
 * La liste est rendue pour de bon, avec des coachés inventés, sans réseau ni base.
 *
 *   node --test scripts/test-liste-un-mot.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// En vrai, pas en démonstration : la porte de la démonstration est fermée (le défaut ne se voyait que là).
process.env.NODE_ENV = 'production';
const RACINE = new URL('..', import.meta.url).pathname;
// `next/link` rendu comme ce qu'il pose dans la page : une ancre.
const LIEN = `data:text/javascript,${encodeURIComponent(`import React from '${import.meta.resolve('react')}'; export default ({ children, ...p }) => React.createElement('a', p, children);`)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/link') return { url: LIEN, shortCircuit: true };
    const cible = specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}`).href : specifier;
    try {
      return nextResolve(cible, context);
    } catch (e) {
      for (const bout of ['.ts', '.tsx']) {
        try { return nextResolve(`${cible}${bout}`, context); } catch { /* l'autre extension */ }
      }
      throw e;
    }
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx')) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});
const { default: ListeSimple } = await import(pathToFileURL(`${RACINE}components/app/ListeSimple.tsx`).href);

const NOLIO = 'https://www.nolio.io/calendar/?athlete=1';
const ligne = (id, nom, mot, href, plus = {}) => ({ id, nom, un: { mot, href, ton: 'warn', rang: 2, ...plus } });
// Les ancres d'une ligne : [adresse, texte, sort-elle ?].
const liens = (l) => [...renderToStaticMarkup(createElement(ListeSimple, { lignes: [l] })).matchAll(/<a ([^>]*)>(.*?)<\/a>/g)]
  .map(([, a, dedans]) => [/href="([^"]*)"/.exec(a)[1], dedans.replace(/<[^>]*>/g, ''), a.includes('target="_blank"')]);

test('un geste dans Nolio (« Signal à regarder », « Message à lire ») : le nom ouvre sa page, le mot seul sort vers Nolio', () => {
  for (const mot of ['Signal à regarder', 'Message à lire']) {
    assert.deepEqual(liens(ligne('a1', 'Camille Essai', mot, NOLIO, { externe: true })), [['/app/coach/athlete/a1', 'Camille Essai', false], [NOLIO, mot, true]]);
  }
});

test('un geste ailleurs dans le site (sa demande, un nouvel objectif) : le nom ouvre sa page, le mot ouvre le geste', () => {
  assert.deepEqual(liens(ligne('a2', 'Dominique Essai', 'Sa demande', '/app/coach/demandes/d1')), [['/app/coach/athlete/a2', 'Dominique Essai', false], ['/app/coach/demandes/d1', 'Sa demande', false]]);
  assert.deepEqual(liens(ligne('a3', 'Claude Essai', 'Pas d’objectif', '/app/coach/nouveau?athlete=a3')), [['/app/coach/athlete/a3', 'Claude Essai', false], ['/app/coach/nouveau?athlete=a3', 'Pas d’objectif', false]]);
});

test('un geste sur sa page : toute la ligne y mène, à l’ancre', () => {
  assert.deepEqual(liens(ligne('a4', 'Alix Essai', 'Lancer', '/app/coach/athlete/a4#lancer-sa-preparation')), [['/app/coach/athlete/a4#lancer-sa-preparation', 'Alix EssaiLancer›', false]]);
});
