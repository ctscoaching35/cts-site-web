#!/usr/bin/env node
/**
 * DEUX SUITES DE LA DÉCISION 211 ET LA 213 (24/11/2026), toutes sous le moteur v1 seulement ; sous la 8.x, rien ne change :
 *   - « d'ici dimanche 21 h » à la place de « d'ici dimanche 18 h » (début du point du dimanche, « Pour bien démarrer », confirmation de charge, courriel de rappel) ; sur la
 *     page d'un plan, pour le coach, « Sa semaine part … vers 21 h » ;
 *   - une semaine n'est « pas partie » qu'après le passage de 22 h, heure de Paris (lib/app/semainesDuDimanche.ts, apresLePassage), et plus dès 18 h ;
 *   - 213 : le bouton « Annuler les ajustements » n'est plus affiché sous la 9.x (le coach corrige la semaine dans Nolio, le moteur repart de sa correction).
 * Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-heures-dites-et-annuler.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const FAUX = {
  '/lib/app/coaching.ts': 'export const athletesCoaches = async () => [];',
  '/lib/app/anciens.ts': 'export const estAncien = () => false;',
  '/lib/app/jonction.ts': 'export const heuresDuTemps = () => 0; export const recuperationFinie = () => false;',
  '/lib/app/supabase.ts': 'export const clientService = () => ({});',
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    let r;
    try {
      r = nextResolve(specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href : specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    const cle = Object.keys(FAUX).find((f) => r.url.endsWith(f));
    return cle ? { url: `data:text/javascript,${encodeURIComponent(FAUX[cle])}`, shortCircuit: true } : r;
  },
});
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const mots = await import(pathToFileURL(`${RACINE}lib/app/motsDuQuestionnaire.ts`).href);
const dimanche = await import(pathToFileURL(`${RACINE}lib/app/dimancheV9.ts`).href);
const semaines = await import(pathToFileURL(`${RACINE}lib/app/semainesDuDimanche.ts`).href);
const courriel = await import(pathToFileURL(`${RACINE}lib/app/emailBienvenue.ts`).href);

// ─── « d'ici dimanche 21 h » sous la 9.x ────────────────────────────────────────────────────────────

test('le point du dimanche dit « d’ici dimanche 21 h », pour le coaché et pour l’acheteur, dans toutes ses versions ; le questionnaire du samedi de la 8.x garde 18 h', () => {
  assert.match(dimanche.DESCRIPTION_DE_BASE, /^Une minute, d’ici dimanche 21 h :/);
  assert.match(dimanche.DESCRIPTION_DE_BASE_COACHE, /^Une minute, d’ici dimanche 21 h :/);
  for (const version of dimanche.VERSIONS_DIMANCHE) {
    for (const coache of [true, false]) {
      const d = dimanche.questionnaireDuDimanche({ version, coache, cles: [], premiere: version === 'normale' }).description;
      assert.ok(d.includes('d’ici dimanche 21 h') && !d.includes('18 h'), `${version}, coaché ${coache}`);
    }
  }
  assert.match(source('lib/app/questionnaireSamedi.ts'), /Une minute, d’ici dimanche 18 h : tes séances de la semaine prochaine s’écrivent dimanche soir/);
});

test('« Pour bien démarrer » : 21 h sous la 9.x (les deux voix), 18 h sous la 8.x, mot pour mot comme avant', () => {
  for (const coache of [true, false]) assert.ok(mots.motsDuQuestionnaire('pourBienDemarrer', true, coache).includes('réponds d’ici dimanche 21 h,'), String(coache));
  assert.match(mots.motsDuQuestionnaire('pourBienDemarrer', false), /réponds d’ici dimanche 18 h, ta semaine suivante s’écrit dimanche soir/);
  assert.ok(!mots.motsDuQuestionnaire('pourBienDemarrer', false, true).includes('21 h'));
});

test('la confirmation de charge et son courriel de rappel : 21 h sous la 9.x, 18 h sinon ; la page d’un plan dit « Sa semaine part … vers 21 h » au coach', () => {
  const carte = source('components/app/ConfirmationCharge.tsx');
  assert.match(carte, /heureLimite = '18 h'/, '18 h par défaut : la 8.x ne change pas');
  assert.match(carte, /Réponds d’ici \{dimanche\}, \{heureLimite\} :/);
  assert.match(source('components/app/AccueilAthlete.tsx'), /heureLimite=\{v9 \? '21 h' : '18 h'\}/);
  const avant = courriel.contenuRappelConfirmation('Alex Fictif', 'https://exemple.test/app', { volume_hebdo_actuel: '4h', sortie_longue_actuelle: '1h30' });
  assert.ok(avant.texte.includes('d’ici dimanche 18 h : « Oui »'), 'sans heure donnée, comme avant');
  const v1 = courriel.contenuRappelConfirmation('Alex Fictif', 'https://exemple.test/app', { volume_hebdo_actuel: '4h', sortie_longue_actuelle: '1h30' }, '21 h');
  assert.ok(v1.texte.includes('d’ici dimanche 21 h : « Oui »') && !v1.texte.includes('18 h') && v1.html.includes('d’ici dimanche 21 h'));
  assert.match(source('lib/app/confirmation.ts'), /\(await moteurEstV9\(\)\) \? '21 h' : '18 h'\);/);
  const page = source('app/app/coach/plan/[id]/page.tsx');
  assert.match(page, /\{v9 \? 'Sa semaine part' : 'S’écrit'\} le \{dateLongue\(ajouterJours\(prochaine\.lundi, -1\), true\)\}, vers \{v9 \? '21' : '18'\} h/);
});

// ─── « pas partie » après le passage de 22 h (heure de Paris) ────────────────────────────────────────

test('sous la 9.x, après le passage : le dimanche à Paris dès 22 h, l’hiver comme l’été ; sous la 8.x, dès 17 h UTC comme avant', () => {
  const apres = (iso, v9) => semaines.apresLePassage(new Date(iso), v9);
  // Hiver (Paris = UTC + 1) : dimanche 06/12/2026.
  assert.equal(apres('2026-12-06T20:59:00Z', true), false, '21 h 59 à Paris : pas encore');
  assert.equal(apres('2026-12-06T21:00:00Z', true), true, '22 h à Paris');
  assert.equal(apres('2026-12-06T18:00:00Z', true), false, '19 h à Paris : l’ancien « dès 18 h » ne marque plus rien');
  // Été (Paris = UTC + 2) : dimanche 06/06/2027.
  assert.equal(apres('2027-06-06T19:59:00Z', true), false, '21 h 59 à Paris');
  assert.equal(apres('2027-06-06T20:00:00Z', true), true, '22 h à Paris');
  // Les autres jours : jamais ; minuit passé, c'est lundi à Paris.
  assert.equal(apres('2026-12-05T21:30:00Z', true), false, 'un samedi soir');
  assert.equal(apres('2026-12-06T23:30:00Z', true), false, 'lundi 00 h 30 à Paris');
  // La 8.x : 17 h UTC, le dimanche, comme avant (le deuxième argument absent est faux).
  assert.equal(apres('2026-12-06T16:59:00Z', false), false);
  assert.equal(apres('2026-12-06T17:00:00Z', false), true);
  assert.equal(semaines.apresLePassage(new Date('2026-12-06T17:00:00Z')), true, 'sans le moteur dit : la 8.x');
  assert.equal(semaines.apresLePassage(new Date('2027-06-06T17:30:00Z')), true);
  assert.equal(semaines.HEURE_PASSAGE_UTC, 17);
});

test('la semaine passée de « Mes athlètes » suit le même passage : sous la 9.x, celle qui finit ce soir seulement dès 22 h de Paris', () => {
  const passee = (iso, v9) => semaines.lundiDeLaSemainePassee(new Date(iso), v9);
  assert.equal(passee('2026-12-06T20:00:00Z', true), '2026-11-23', '21 h à Paris : la semaine d’avant');
  assert.equal(passee('2026-12-06T21:00:00Z', true), '2026-11-30', '22 h à Paris : celle qui finit ce soir');
  assert.equal(passee('2026-12-06T20:00:00Z', false), '2026-11-30', 'sous la 8.x, dès 17 h UTC');
  assert.equal(passee('2026-12-02T10:00:00Z', true), '2026-11-23', 'un mercredi : la semaine finie');
});

test('chaque lecteur du « passage » donne le moteur à apresLePassage ; rien ne le lit sans lui', () => {
  assert.match(source('lib/app/espaceCoach.ts'), /const v9 = await moteurEstV9\(\);\n\s+const ceSoir = apresLePassage\(undefined, v9\);/);
  assert.match(source('lib/app/espaceCoach.ts'), /lundiDeLaSemainePassee\(undefined, v9\)/);
  const m = source('lib/app/mesAthletes.ts');
  assert.equal((m.match(/apresLePassage\(undefined, v9\)/g) ?? []).length, 3, 'le bilan, la vue et le bilan visible');
  assert.ok(!/apresLePassage\(\)/.test(m), 'aucun appel sans le moteur');
  assert.match(source('lib/app/semaineQuiArrive.ts'), /lundiMontre\(jour, apresLePassage\(undefined, v9\)\)/);
  const page = source('app/app/coach/athlete/[id]/page.tsx');
  assert.match(page, /semainesQuiArrivent\(ecrites, jour, apercu \?\? null, v9\)/);
  assert.match(page, /lundiMontre\(jour, apresLePassage\(undefined, v9\)\)/);
  assert.ok(!/apresLePassage\(\)/.test(source('lib/app/espaceCoach.ts')));
});

// ─── 213 : « Annuler » n'est plus affiché sous la 9.x ────────────────────────────────────────────────

test('213 : le bouton « Annuler les ajustements » n’est affiché que sous la 8.x ; il n’y a pas d’autre endroit où il se montre', async () => {
  const page = source('app/app/coach/plan/[id]/page.tsx');
  assert.match(page, /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/);
  assert.match(page, /\{!v9 && ajuste && w\.numero === ecritesTriees\.find\(\(x\) => \/\^S\\d\+\$\/\.test\(String\(x\.numero\)\)\)\?\.numero && <AnnulerSemaine planId=\{id\} numero=\{w\.numero\} \/>\}/);
  const { execFileSync } = await import('node:child_process');
  const lecteurs = execFileSync('grep', ['-rlE', '<AnnulerSemaine', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(lecteurs, ['app/app/coach/plan/[id]/page.tsx']);
  // Le bouton lui-même, sa route serveur et leurs mots sont ceux d'avant (la 8.x les garde).
  assert.match(source('components/app/GestesEcriture.tsx'), /'Annuler les ajustements'/);
  assert.match(source('lib/app/actionsEcriture.ts'), /await annulerAjustements\(planId, numero\);/);
  // Le garde-fou serveur ne dit plus « pas encore » : le coach corrige dans Nolio, le moteur repart de sa correction.
  const e = source('lib/app/ecriture.ts');
  assert.match(e, /throw new Error\('« Annuler » n’existe pas sous le moteur v1 : le coach corrige la semaine dans Nolio avec sa barre, et le moteur repart de sa correction\.'\);/);
  assert.ok(!/« Annuler » n’existe pas encore/.test(e));
});
