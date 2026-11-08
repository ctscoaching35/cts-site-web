#!/usr/bin/env node
/**
 * L'e-mail de bienvenue d'un acheteur, sans réseau ni base (lib/app/emailBienvenue.ts, contenuBienvenue) : les deux
 * corrections des cas fictifs du 09/11/2026 (décisions coach du 08/11/2026, « A », textes validés le même jour).
 * - D4 : un acheteur déjà dans l'équipe Nolio par un plan précédent ne lit plus qu'une invitation va lui arriver ;
 * - D6 : un début à plus de deux semaines de l'achat dit quoi faire d'ici là, et le jour où l'app lui demandera si sa
 *   charge a changé.
 *
 *   node --test scripts/test-bienvenue.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Les imports du site : « @/lib/… » (l'alias de Next) et des chemins relatifs sans extension.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const s = specifier.startsWith('@/') ? pathToFileURL(path.join(RACINE, specifier.slice(2))).href : specifier;
    try {
      return nextResolve(s, context);
    } catch (e) {
      if ((s.startsWith('.') || s.startsWith('file:')) && !s.endsWith('.ts')) return nextResolve(`${s}.ts`, context);
      throw e;
    }
  },
});
const { contenuBienvenue } = await import('../lib/app/emailBienvenue.ts');

// Des plans fictifs : ce que l'e-mail en lit.
const plan = (debut, phrase, nom = 'Nadia Test') => ({
  athlete: { nom },
  course: { nom: '100 miles des Hauts', date_lettres: '30 mai 2027', date_debut_plan: debut },
  couverture: { debut: phrase },
});
const LIEN = 'https://www.cts-coaching.com/app';
const DEJA = 'Tes séances arrivent dans ton calendrier Nolio, comme pour ta préparation précédente ; ta première semaine s’y '
  + 'installe la veille de son début.';

test('D6 : un début lointain (34 jours) dit quoi faire d’ici là, et le jour où l’app le lui demandera', () => {
  const { texte } = contenuBienvenue(plan('2026-12-14', 'Ta préparation commence le 14 décembre 2026.'), LIEN,
    { adresse: 'nadia@example.invalid' }, '2026-11-10');
  assert.ok(texte.includes('Tout est prêt pour 100 miles des Hauts, le 30 mai 2027. Ta préparation commence le 14 décembre '
    + '2026. D’ici là, continue ce que tu cours en ce moment : ton app te demandera le 7 décembre si ça a changé.'), texte);
});

test('D6 : un début proche, ou entre 15 et 28 jours (l’app ne demande rien) : pas de phrase', () => {
  for (const debut of ['2026-11-16', '2026-11-30', '2026-12-07']) {
    const { texte } = contenuBienvenue(plan(debut, 'Ta préparation commence bientôt.'), LIEN,
      { adresse: 'nadia@example.invalid' }, '2026-11-10');
    assert.ok(!texte.includes('D’ici là'), `${debut} : ${texte}`);
  }
  // Un plan d'avant l'écriture semaine par semaine (sans Nolio) : rien non plus.
  const { texte } = contenuBienvenue(plan('2026-12-14', 'Ta préparation commence le 14 décembre 2026.'), LIEN, null, '2026-11-10');
  assert.ok(!texte.includes('D’ici là'), texte);
});

test('D4 : déjà dans l’équipe, pas d’invitation annoncée ; sinon, l’invitation comme avant', () => {
  const p = plan('2027-02-15', 'Ta préparation commence le 15 février 2027.', 'Antoine Test');
  const deja = contenuBienvenue(p, LIEN, { adresse: 'antoine@example.invalid', dejaDansLEquipe: true }, '2027-02-09').texte;
  assert.ok(deja.includes(DEJA), deja);
  assert.ok(!deja.includes('Nolio t’écrira') && !deja.includes('invitation à rejoindre'), deja);
  const nouveau = contenuBienvenue(p, LIEN, { adresse: 'antoine@example.invalid' }, '2027-02-09').texte;
  assert.ok(nouveau.includes('Nolio t’écrira à antoine@example.invalid') && !nouveau.includes(DEJA), nouveau);
});
