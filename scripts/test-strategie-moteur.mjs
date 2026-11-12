#!/usr/bin/env node
/**
 * SA STRATÉGIE DE COURSE POUR LE MOTEUR (décision coach du 12/11/2026, « Q2 A ») : lib/app/strategieMoteur.ts. Les
 * glucides par heure (glucides_cible) comme avant, et ses quatre repères à côté (parametres.strategie) : les fourchettes
 * lues dans les cartes, le sodium par litre bu tiré de sa sueur et de la chaleur par la règle même du calculateur (lue
 * dans public/calculateur-nutrition.html), la carte Sodium « Rien », une carte illisible, sans stratégie ; ni son poids,
 * ni une stratégie passée qui repartirait ou se garderait. Sans réseau ni base.
 *
 *   node --test scripts/test-strategie-moteur.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const { fourchetteDe, glucidesDeLaStrategie, parametresAvecLaStrategie, sansLaStrategie, sodiumParLitre, strategiePourLeMoteur } =
  await import('../lib/app/strategieMoteur.ts');

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');

// La stratégie de démonstration de lib/app/strategie.ts (STRATEGIE_EXEMPLE), lue dans le fichier : il parle à la base.
const EXEMPLE = new Function(`return ${/export const STRATEGIE_EXEMPLE: Strategie = (\{[\s\S]*?\n\});/.exec(lire('lib/app/strategie.ts'))[1]}`)();

// La règle du sodium par litre bu du calculateur, telle qu'il la calcule (ses deux lignes, et sa forte chaleur).
const CALCULATEUR = lire('public/calculateur-nutrition.html');
const regleDuCalculateur = new Function('D', 'sueur', 'conditions', [
  `var chaud = ${/var chaud = ([^,]+),/.exec(CALCULATEUR)[1]};`,
  `var parL = ${/var parL = ([^;]+);/.exec(CALCULATEUR)[1]};`,
  /\n\s*(if \([^)]*\) parL = [^;]+;)/.exec(CALCULATEUR)[1],
  'return parL;',
].join('\n'));

// Une stratégie comme le calculateur la garde : ses espaces fines avant l'unité.
const N = ' ';
const strategie = (cartes, entrees = {}) => ({
  entrees: { heures: '5', minutes: '30', poids: '70', conditions: 'tempere', niveau: 'int', intestin: 'oui', sueur: 'moderee', ...entrees },
  cartes: [
    { nom: 'Glucides', valeur: `65 à 75${N}g`, sous: 'par heure' },
    { nom: 'Boisson', valeur: `500 à 700${N}mL`, sous: 'par heure, à ta soif' },
    { nom: 'Sodium', valeur: `300 à 420${N}mg`, sous: 'par heure' },
    { nom: 'Caféine', valeur: `175 à 200${N}mg`, sous: `au départ, puis 70 à 140${N}mg à 2${N}h${N}45` },
  ].map((c) => ({ ...c, ...(cartes[c.nom] ?? {}) })),
});

test('les fourchettes des cartes : « 45 à 55 g », « 70 g », « 500-700 mL », dans leurs bornes', () => {
  assert.deepEqual(fourchetteDe('45 à 55 g', 20, 130), [45, 55]);
  assert.deepEqual(fourchetteDe(`45 à 55${N}g`, 20, 130), [45, 55]);
  assert.deepEqual(fourchetteDe('70 g', 20, 130), [70, 70]);
  assert.deepEqual(fourchetteDe('500-700 mL', 200, 1200), [500, 700]);
  assert.deepEqual(fourchetteDe('60–75 g/h', 20, 130), [60, 75]);
  assert.equal(fourchetteDe('Rien', 20, 130), null);
  assert.equal(fourchetteDe('—', 10, 400), null);
  assert.equal(fourchetteDe('10 g', 20, 130), null);
  assert.equal(fourchetteDe('150 g', 20, 130), null);
  assert.equal(fourchetteDe('70 à 50 g', 20, 130), null);
});

test('les glucides gardent leur lecture d’avant (glucides_cible)', () => {
  assert.deepEqual(glucidesDeLaStrategie(EXEMPLE), [45, 55]);
  assert.equal(glucidesDeLaStrategie(null), null);
  assert.equal(glucidesDeLaStrategie(undefined), null);
  assert.equal(glucidesDeLaStrategie(strategie({ Glucides: { valeur: 'Rien' } })), null);
});

test('la stratégie de démonstration, telle que le moteur la reçoit', () => {
  const p = parametresAvecLaStrategie({ schema: 1 }, EXEMPLE);
  assert.deepEqual(p, {
    schema: 1,
    glucides_cible: [45, 55],
    strategie: {
      glucides_g_h: [45, 55], boisson_ml_h: [500, 700], sodium_mg_l: null, cafeine_mg: [170, 200],
      cafeine_moment: 'une heure avant', sueur: 'moderee', conditions: 'tempere', intestin: 'cours',
    },
  });
  assert.ok(!JSON.stringify(p).includes('poids') && !JSON.stringify(p).includes('68'), 'ni son poids');
});

test('le sodium par litre bu est la règle du calculateur, sur toutes ses réponses', () => {
  for (const D of [1, 2, 2.25, 3, 3.25, 4, 5.5, 8, 12, 30]) {
    for (const sueur of ['faible', 'moderee', 'elevee', null]) {
      for (const conditions of ['frais', 'tempere', 'chaud', 'humide']) {
        assert.deepEqual(sodiumParLitre(D, sueur, conditions), regleDuCalculateur(D, sueur, conditions), `${D} h, ${sueur}, ${conditions}`);
      }
    }
  }
  // Ce que l'étude en retenait : peu 500, moyenne 500 à 700, salée 700 à 800, jusqu'à 800 par forte chaleur.
  assert.deepEqual(sodiumParLitre(5.5, 'faible', 'tempere'), [500, 500]);
  assert.deepEqual(sodiumParLitre(5.5, 'moderee', 'tempere'), [500, 700]);
  assert.deepEqual(sodiumParLitre(5.5, 'elevee', 'tempere'), [700, 800]);
  assert.deepEqual(sodiumParLitre(5.5, 'faible', 'chaud'), [500, 800]);
  assert.deepEqual(sodiumParLitre(5.5, 'moderee', 'humide'), [500, 800]);
  assert.deepEqual(sodiumParLitre(5.5, 'elevee', 'humide'), [700, 800]);
  assert.deepEqual(sodiumParLitre(2.5, 'elevee', 'chaud'), [500, 700]);
});

test('le sodium de sa stratégie : par litre bu selon sa sueur et la chaleur, pas les mg par heure de la carte', () => {
  assert.deepEqual(strategiePourLeMoteur(strategie({})).sodium_mg_l, [500, 700]);
  assert.deepEqual(strategiePourLeMoteur(strategie({}, { sueur: 'elevee' })).sodium_mg_l, [700, 800]);
  assert.deepEqual(strategiePourLeMoteur(strategie({}, { sueur: 'faible', conditions: 'humide' })).sodium_mg_l, [500, 800]);
  // Une course de moins de 3 h par forte chaleur : la boisson salée, quelle que soit sa sueur.
  assert.deepEqual(strategiePourLeMoteur(strategie({}, { heures: '2', minutes: '30', sueur: 'faible', conditions: 'chaud' })).sodium_mg_l, [500, 700]);
});

test('la carte Sodium « Rien » : rien de systématique, null', () => {
  const s = strategiePourLeMoteur(strategie({ Sodium: { valeur: 'Rien', sous: `de systématique sous 3${N}h` } }));
  assert.equal(s.sodium_mg_l, null);
  assert.deepEqual(s.glucides_g_h, [65, 75]);
});

test('une carte illisible donne null pour elle seule ; les glucides illisibles, pas de stratégie du tout', () => {
  const s = strategiePourLeMoteur(strategie({ Caféine: { valeur: '—', sous: 'indique ton poids' }, Boisson: { valeur: 'à ta soif' }, Sodium: { valeur: 'beaucoup' } }));
  assert.deepEqual(s, {
    glucides_g_h: [65, 75], boisson_ml_h: null, sodium_mg_l: null, cafeine_mg: null, cafeine_moment: null,
    sueur: 'moderee', conditions: 'tempere', intestin: 'oui',
  });
  assert.equal(strategiePourLeMoteur(strategie({ Glucides: { valeur: 'Rien' } })), null);
  assert.equal(strategiePourLeMoteur(strategie({ Glucides: { valeur: '200 g' } })), null);
});

test('la caféine et son moment : la prise de départ, le « sous » de sa carte', () => {
  const s = strategiePourLeMoteur(strategie({}));
  assert.deepEqual(s.cafeine_mg, [175, 200]);
  assert.equal(s.cafeine_moment, `au départ, puis 70 à 140${N}mg à 2${N}h${N}45`);
  assert.deepEqual(strategiePourLeMoteur(strategie({ Caféine: { valeur: `200${N}mg`, sous: 'une heure avant' } })).cafeine_mg, [200, 200]);
});

test('ses réponses manquantes : celles que le calculateur coche d’avance', () => {
  const s = strategiePourLeMoteur(strategie({}, { sueur: undefined, conditions: undefined, intestin: undefined }));
  assert.deepEqual([s.sueur, s.conditions, s.intestin], ['moderee', 'tempere', 'non']);
});

test('sans stratégie : les paramètres de toujours, sans glucides_cible ni strategie', () => {
  const p = { schema: 1, champs: { freq_hebdo: '4' } };
  assert.equal(strategiePourLeMoteur(null), null);
  assert.equal(parametresAvecLaStrategie(p, null), p);
  assert.equal(parametresAvecLaStrategie(p, strategie({ Glucides: { valeur: 'Rien' } })), p);
});

test("une stratégie passée ne repart pas, ni ne se garde quand le moteur rend ses paramètres", () => {
  const passee = { schema: 1, glucides_cible: [60, 70], strategie: { glucides_g_h: [60, 70] } };
  // Sans stratégie aujourd'hui : glucides_cible comme avant (rien n'y touche), la stratégie passée retirée.
  assert.deepEqual(parametresAvecLaStrategie(passee, null), { schema: 1, glucides_cible: [60, 70] });
  assert.deepEqual(parametresAvecLaStrategie(passee, EXEMPLE).strategie.glucides_g_h, [45, 55]);
  assert.deepEqual(parametresAvecLaStrategie(passee, EXEMPLE).glucides_cible, [45, 55]);
  assert.deepEqual(sansLaStrategie(passee), { schema: 1, glucides_cible: [60, 70] });
  const sans = { schema: 1 };
  assert.equal(sansLaStrategie(sans), sans);
});
