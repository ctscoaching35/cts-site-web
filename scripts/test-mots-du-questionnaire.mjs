#!/usr/bin/env node
/**
 * LES MOTS DU QUESTIONNAIRE DE LA SEMAINE, DITS À L'ATHLÈTE (entrées 198 et 199 du coach, 24/11/2026 ; lib/app/motsDuQuestionnaire.ts) : sous la 8.x, « Ta semaine
 * prochaine » le samedi ; sous le moteur 9.0, « Ton point du dimanche » le dimanche vers midi. Chaque écran choisit par `moteurEstV9()`, côté serveur ; les textes
 * fixes (achat, FAQ) ne disent ni le jour ni le nom. Des cas fictifs, sans réseau ni base.
 *
 *   node --test scripts/test-mots-du-questionnaire.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const { motsDuQuestionnaire, TOUS_LES_TEXTES } = await import(`${RACINE}lib/app/motsDuQuestionnaire.ts`);
const { lireCode, motsDuNom } = await import(`${RACINE}lib/app/codeSeance.ts`);
const source = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');
// Sans ses commentaires : ce que l'écran dit, pas ce que le code explique.
const sansCommentaires = (chemin) => source(chemin).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
const CLES = Object.keys(TOUS_LES_TEXTES);

test('sous la 8.x, les textes d’avant (samedi, « Ta semaine prochaine ») ; sous la 9.0, « ton point du dimanche », sans samedi', () => {
  assert.equal(CLES.length, 9);
  for (const cle of CLES) {
    const avant = motsDuQuestionnaire(cle, false);
    const v9 = motsDuQuestionnaire(cle, true);
    assert.notEqual(avant, v9, cle);
    assert.ok(/samedi/i.test(avant), `${cle} : l'ancien texte dit le samedi`);
    assert.ok(/point du dimanche/i.test(v9), `${cle} : « ton point du dimanche »`);
    assert.ok(!/samedi|semaine prochaine »/i.test(v9), `${cle} : plus de samedi ni de « Ta semaine prochaine »`);
    // Les règles internes ne se disent pas à l'athlète.
    assert.ok(!/une fois par semaine|séance à plat/i.test(v9 + avant), cle);
  }
});

test('« Pour bien démarrer » sous la 9.0 : le dimanche vers midi, à répondre d’ici dimanche 18 h, la semaine s’écrit dimanche soir (comme la description du questionnaire)', () => {
  const t = motsDuQuestionnaire('pourBienDemarrer', true);
  assert.ok(t.includes('Chaque dimanche vers midi') && t.includes('« Ton point du dimanche »') && t.includes('dimanche 18 h') && t.includes('dimanche soir'));
  assert.equal(motsDuQuestionnaire('pourBienDemarrer', false), 'Chaque samedi à 8 h, le questionnaire « Ta semaine prochaine » t’attend dans Nolio : réponds d’ici dimanche 18 h, ta semaine suivante s’écrit dimanche soir d’après tes réponses.');
});

test('la vie privée dit ce que « Ton point du dimanche » lit : l’arrêt et sa cause, les séances clés pas faites, les jours, le nombre, la sortie longue', () => {
  const t = motsDuQuestionnaire('confidentialite', true);
  for (const mot of ['arrêt', 'sa cause', 'séances clés', 'tes jours', 'ton nombre de séances', 'sortie longue']) assert.ok(t.includes(mot), mot);
});

test('chaque écran choisit par moteurEstV9() côté serveur, et ne garde plus l’ancien texte en dur', () => {
  const pages = ['app/app/profil/page.tsx', 'app/app/compte/page.tsx', 'app/confidentialite/page.tsx', 'components/app/AccueilAthlete.tsx', 'app/app/coach/nouveau/page.tsx',
    'app/app/coach/athlete/[id]/page.tsx', 'app/app/objectif/nouveau/page.tsx'];
  for (const p of pages) assert.ok(source(p).includes('moteurEstV9().catch(() => false)'), `${p} choisit la version`);
  for (const p of ['app/app/profil/page.tsx', 'app/app/compte/page.tsx', 'app/confidentialite/page.tsx', 'components/app/ProfilAthlete.tsx', 'components/app/PourBienDemarrer.tsx', 'components/app/AccueilAthlete.tsx']) {
    assert.ok(!/questionnaire du samedi|Ta semaine prochaine|le samedi, un court/.test(sansCommentaires(p)), `${p} ne dit plus le samedi en dur`);
  }
  // Les composants du navigateur reçoivent le choix, ils ne le font pas.
  for (const p of ['components/app/ProfilAthlete.tsx', 'components/app/PourBienDemarrer.tsx']) {
    assert.ok(source(p).includes('pointDuDimanche') && !source(p).includes('moteurEstV9'), p);
  }
  for (const p of ['app/app/coach/nouveau/page.tsx', 'app/app/coach/athlete/[id]/page.tsx', 'app/app/objectif/nouveau/page.tsx']) assert.ok(source(p).includes('pointDuDimanche={v9}'), p);
});

test('les textes fixes de l’achat et de la FAQ ne disent ni le jour ni le nom : « chaque semaine », vrai sous les deux moteurs', () => {
  const plan = source('lib/plan.ts');
  assert.ok(plan.includes('Chaque semaine, un court questionnaire dans Nolio te permet de changer tes jours de la semaine suivante.'));
  const contenu = source('lib/content.ts');
  assert.ok(contenu.includes('Chaque semaine, le questionnaire de Nolio te demande tes jours disponibles de la semaine qui vient'));
  assert.ok(contenu.includes('Chaque semaine, Nolio te demande tes jours disponibles de la semaine qui vient ; le dimanche soir,'));
  assert.ok(source('lib/app/emailBienvenue.ts').includes('Chaque semaine, Nolio te pose quelques questions sur ta semaine à venir'));
  for (const t of ['lib/plan.ts', 'lib/content.ts', 'lib/app/emailBienvenue.ts']) assert.ok(!/Chaque samedi|point du dimanche/.test(sansCommentaires(t)), t);
});

test('le rappel du dimanche sous le moteur 9.0 (décision 206) : celui de la 8.x garde sa chaîne, la 9.x a la sienne (essayé dans test-rappel-v9.mjs)', () => {
  const route = source('app/api/ecriture/rappel/route.ts');
  assert.ok(route.includes('selonLeMoteur') && /avant: \(\) => rappelerLeDimanche\(240_000\)/.test(route) && /v1: \(\) => rappelDuDimancheV9\(240_000\)/.test(route));
});

test('le code TAPIS se dit « Séance sur tapis » (entrée 197), ses mots de la famille mécanique inchangés', () => {
  assert.equal(lireCode('TAPIS 3×8′ marche 15 %').mots, 'Séance sur tapis');
  assert.equal(lireCode('TAPIS 3×8′ marche 15 %').lue, 'mecanique');
  assert.equal(lireCode('NAV 2×10′ DA').mots, 'Navettes');
  assert.equal(motsDuNom('TAPIS 3×8′ marche 15 % · Séance sur tapis, 3 × 8 min'), 'Séance sur tapis, 3 × 8 min');
});
