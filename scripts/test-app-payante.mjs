#!/usr/bin/env node
/**
 * LA REFONTE DE L'APP PAYANTE, étapes (a) et (b) (décisions du coach du 16/11/2026) : les deux jeux d'onglets et leur ordre,
 * l'onglet allumé (Plan sur ses deux adresses, Courses sur la fiche de course, Profil sur les tests), où mène l'onglet Courses
 * d'un acheteur ou d'un coaché, l'en-tête unique (plus de « CTS COACHING » dans l'app de l'athlète), le sélecteur
 * « Ta préparation / Tes données » et les piliers qui passent de l'accueil à « Tes données ». Cas fictifs, sans réseau ni base.
 *
 *   node --test scripts/test-app-payante.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const lire = (c) => readFileSync(`${RACINE}${c}`, 'utf8');
const { ORDRE_GRATUIT, ORDRE_PAYANT, TITRE_ONGLET, ordreDesOnglets, ongletAllume, estDansPlan } =
  await import(new URL('../lib/app/ongletsApp.ts', import.meta.url).href);

const titres = (ordre) => ordre.map((c) => TITRE_ONGLET[c]);

test('les onglets : l’ordre du gratuit (Courses avant Profil) et celui de l’acheteur ou du coaché (Plan en deuxième)', () => {
  assert.deepEqual(titres(ordreDesOnglets(true)), ['Accueil', 'Courses', 'Profil', 'Bibliothèque']);
  assert.deepEqual(titres(ordreDesOnglets(false)), ['Accueil', 'Plan', 'Courses', 'Profil', 'Bibliothèque']);
  assert.deepEqual(ORDRE_GRATUIT, ['accueil', 'courses', 'profil', 'bibliotheque']);
  assert.equal(ORDRE_PAYANT.length, 5);
  for (const t of [...titres(ORDRE_GRATUIT), ...titres(ORDRE_PAYANT)]) assert.ok(!['Données', 'Compte'].includes(t));
});

test('l’onglet Plan est allumé sur « Ta préparation » et sur « Tes données », pas sur la fiche de course ni sur les tests', () => {
  assert.ok(ongletAllume('plan', '/app/plan', false));
  assert.ok(ongletAllume('plan', '/app/donnees', false));
  assert.ok(estDansPlan('/app/plan'));
  assert.ok(!ongletAllume('plan', '/app/plan/course', false));
  assert.ok(!ongletAllume('plan', '/app/plan/zones', false));
  assert.ok(!ongletAllume('accueil', '/app/plan', false), 'Accueil n’est plus allumé sur Ta préparation');
  assert.ok(ongletAllume('accueil', '/app', false));
  assert.ok(ongletAllume('accueil', '/app/objectif/nouveau', false));
});

test('un seul onglet allumé à la fois, pour chaque adresse de l’app payante', () => {
  const adresses = ['/app', '/app/plan', '/app/donnees', '/app/plan/course', '/app/plan/zones', '/app/courses', '/app/profil', '/app/bibliotheque',
    '/app/bibliotheque/recuperation', '/app/objectif/nouveau', '/app/calculateurs/calculateur-nutrition'];
  for (const a of adresses) assert.equal(ORDRE_PAYANT.filter((c) => ongletAllume(c, a, false)).length, 1, a);
  assert.ok(ongletAllume('courses', '/app/plan/course', false));
  assert.ok(ongletAllume('courses', '/app/courses/abc', false));
  assert.ok(ongletAllume('profil', '/app/plan/zones', false));
});

test('un calculateur ouvert depuis une fiche de course allume Accueil, depuis la bibliothèque, Bibliothèque (C5)', () => {
  assert.ok(ongletAllume('accueil', '/app/calculateurs/x', false, true));
  assert.ok(ongletAllume('bibliotheque', '/app/calculateurs/x', false, false));
});

test('le gratuit garde ses règles : Accueil seulement sur /app, les autres par leur début d’adresse', () => {
  assert.ok(ongletAllume('accueil', '/app', true));
  assert.ok(!ongletAllume('accueil', '/app/courses', true));
  assert.ok(ongletAllume('courses', '/app/courses/abc', true));
  assert.ok(ongletAllume('profil', '/app/profil', true));
});

test('l’onglet Courses d’un acheteur ou d’un coaché mène toujours à /app/courses (plus de lien provisoire)', () => {
  const barre = lire('components/app/BarreOnglets.tsx');
  assert.doesNotMatch(barre, /coursesHref/);
  assert.match(barre, /CHEMIN_ONGLET\[cle\]/);
  assert.doesNotMatch(lire('app/app/layout.tsx'), /hrefOngletCourses|coursesHref/);
});

test('l’en-tête est unique : « City to Summit », jamais « CTS COACHING », dans l’app de l’athlète ; le compte par les initiales', () => {
  const marque = lire('components/app/EnTeteMarque.tsx');
  assert.match(marque, /CITY TO SUMMIT/);
  for (const f of ['EnTeteApp', 'EnTeteGratuit', 'EnTeteSimple']) {
    const src = lire(`components/app/${f}.tsx`);
    assert.doesNotMatch(src, /CTS COACHING/, f);
    assert.match(src, /EnTeteMarque/, f);
  }
  assert.match(lire('components/app/EnTeteApp.tsx'), /PastilleCompte href=\{lien\('\/app\/compte', ctx\)\}/);
  assert.match(marque, /aria-label="Ton compte"/);
  // L'espace coach n'a pas bougé.
  assert.match(lire('components/app/EnTeteCoach.tsx'), /CTS COACHING/);
});

test('la barre d’onglets n’a plus « Données » ni « Compte » ; elle suit l’ordre de lib/app/ongletsApp', () => {
  const barre = lire('components/app/BarreOnglets.tsx');
  assert.match(barre, /ordreDesOnglets\(gratuit\)/);
  assert.doesNotMatch(barre, /titre: 'Données'|titre: 'Compte'/);
  assert.match(lire('app/app/layout.tsx'), /<BarreOnglets gratuit=\{gratuit\} \/>/);
});

test('le sélecteur « Ta préparation / Tes données » est sur les deux écrans, et les piliers passent de l’accueil à Tes données', () => {
  const sel = lire('components/app/SelecteurPlan.tsx');
  assert.match(sel, /Ta préparation/);
  assert.match(sel, /Tes données/);
  assert.match(sel, /\/app\/plan/);
  assert.match(sel, /\/app\/donnees/);
  assert.match(lire('app/app/plan/page.tsx'), /<SelecteurPlan actif="preparation"/);
  const donnees = lire('app/app/donnees/page.tsx');
  assert.match(donnees, /<SelecteurPlan actif="donnees"/);
  assert.match(donnees, /<Piliers jauge=/);
  assert.doesNotMatch(lire('components/app/AccueilAthlete.tsx'), /<Piliers /);
});

test('Ta préparation : la montagne puis Ta semaine puis les blocs ; l’acheteur n’y lit aucune invitation à écrire au coach', () => {
  const plan = lire('app/app/plan/page.tsx');
  const i = (s) => plan.indexOf(s);
  assert.ok(i('<CarteMontagne') > 0 && i('<CarteMontagne') < i('<SemainesDuPlan') && i('<SemainesDuPlan') < i('Ta préparation, bloc par bloc'));
  for (const f of ['components/app/SelecteurPlan.tsx', 'components/app/EnTeteMarque.tsx', 'lib/app/ongletsApp.ts']) {
    assert.doesNotMatch(lire(f), /écris[- ]\w+ à ton coach|contacte ton coach|échange avec ton coach/i, f);
  }
});
