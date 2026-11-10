#!/usr/bin/env node
/**
 * Les décisions du coach du 10/11/2026 côté site : (19) la ligne du Seuil 2 de « Tes zones », son texte validé ; (20) l'app
 * de l'athlète ne dit plus « Ajustée d'après ta semaine passée… ». Les composants (.tsx) se lisent comme du texte : sans
 * rendu, sans réseau ni base.
 *
 *   node --test scripts/test-decisions-10-11.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');

test('19 : « Tes zones », sous la ligne du Seuil 2, le texte validé du coach', () => {
  const zones = lire('components/app/ZonesEtStyle.tsx');
  const note = zones.match(/export const NOTE_SEUIL2 = '([^']*)'\s*\+\s*'([^']*)';/);
  assert.ok(note, 'NOTE_SEUIL2 est définie');
  assert.equal(`${note[1]}${note[2]}`,
    'En relief, ta FC guide les blocs longs, de 6 à 15 min. Sur les fractions courtes, elle n’a pas le temps de monter : cours-les au ressenti, RPE 7.');
  assert.match(zones, /estSeuil2\(nom\) && \(/, 'la note est sous la ligne du Seuil 2');
  assert.match(zones, /export const estSeuil2 = \(nom: string\) => \/seuil 2\/i\.test\(nom\)/);
});

test('20 : l\'app de l\'athlète ne dit plus « Ajustée d’après ta semaine passée… »', () => {
  for (const chemin of ['components/app/TableauDeBord.tsx', 'components/app/AccueilAthlete.tsx']) {
    const source = lire(chemin);
    assert.doesNotMatch(source, /\n\s*Ajustée d’après ta semaine passée/, `${chemin} : la phrase n'est plus rendue`);
    assert.doesNotMatch(source, /ajustee=\{|ajustementDeLaSemaine\(/, `${chemin} : la semaine ajustée n'est plus lue`);
  }
});
