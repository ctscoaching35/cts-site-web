#!/usr/bin/env node
/**
 * LA MONTAGNE DE L'ACCUEIL ET LES BLOCS DU COACHING (lot 2 de l'app, maquette validée « tout A » par le coach le
 * 12/11/2026) : lib/app/tableau.ts, monteeDuPlan (la charge vraiment faite sur toute la charge prévue jusqu'à la course,
 * le prévu d'aujourd'hui, dans les temps à 90 % du prévu), debutDeLObjectif (d'où part un coaché) et blocsDuPlan (jamais
 * un bloc avant le début de l'objectif, la récupération d'une course précédente en première étape). Les textes de la
 * version sobre (décision coach du 13/11/2026, « tout A ») : l'athlète ne lit que sa part réalisée, le coach l'écart au
 * prévu, en mots neutres. Une trame fictive, sans réseau ni base.
 *
 *   node --test scripts/test-montee.mjs
 */
import assert from 'node:assert/strict';
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
const { blocsDuPlan, calculDeLaMontee, debutDeLObjectif, ecartDeLaMontee, jaugeDuPlan, libelleDeLaMontee, monteeDuPlan, pourcentDeLaMontee,
  texteCourtDeLaMontee, texteDeLaMontee, DANS_LES_TEMPS } = await import('../lib/app/tableau.ts');
const { ajouterJours } = await import('../lib/app/plan.ts');

// Huit semaines à partir du lundi 4 janvier 2027 : deux de fondations, quatre de développement (une allégée), deux
// d'affûtage ; la course le samedi 27 février.
const LUNDI = '2027-01-04';
const CHARGES = [400, 450, 500, 300, 550, 600, 350, 200];
const BLOCS = ['Bloc fondations', 'Bloc fondations', 'Bloc développement', 'Bloc développement', 'Bloc développement',
  'Bloc développement', 'Affûtage', 'Affûtage'];
const trame = CHARGES.map((charge, i) => ({
  numero: `S${i + 1}`, type: i === 3 ? 'Assimilation' : i >= 6 ? 'Affûtage actif' : 'Charge', bloc: BLOCS[i],
  lundi: ajouterJours(LUNDI, 7 * i), dates: '', volume_h: charge / 100, charge, seances_cles: [], week_end_choc: false,
  sl_min: null, passee: false,
}));
const TOTAL = CHARGES.reduce((a, b) => a + b, 0);
const COURSE = '2027-02-27';
const plan = { course: { date: COURSE }, architecture: { tableau: [] } };
// La semaine faite : sa charge tenue (part de la prévue), ses minutes.
const faite = (i, part = 1) => ({
  numero: `S${i + 1}`, lundi: trame[i].lundi, type: trame[i].type, charge_prevue: CHARGES[i], charge_faite: Math.round(CHARGES[i] * part),
  charge_tenue: Math.round(CHARGES[i] * part), rpe_lu: true, seances_prevues: 5, seances_faites: 5, duree_prevue_min: CHARGES[i] * 0.6,
  duree_faite_min: Math.round(CHARGES[i] * 0.6 * part), sl_prevue_min: null, sl_faite_min: null, cles_prevues: 2, cles_reussies: 2,
  dplus_m: null, hooper: null,
});
const mardiDe = (i) => ajouterJours(trame[i].lundi, 1);

test('la montée ne redescend jamais, même une semaine sans rien de fait', () => {
  const parts = [1, 0.9, 0, 0.7, 1, 1, 1, 1];
  let avant = 0;
  for (let i = 2; i <= 8; i += 1) {
    const jour = i < 8 ? mardiDe(i) : ajouterJours(COURSE, 1);
    const m = monteeDuPlan(trame, parts.slice(0, i).map((p, k) => faite(k, p)), jour);
    assert.ok(m, `semaine ${i}`);
    assert.ok(m.fait >= avant, `semaine ${i} : ${m.fait} < ${avant}`);
    avant = m.fait;
  }
});

test('tout fait : 100 % le jour J ; le total est celui de toute la trame (les creux voulus compris)', () => {
  const m = monteeDuPlan(trame, CHARGES.map((_, i) => faite(i)), COURSE);
  assert.equal(m.fait, 1);
  assert.equal(m.mesure, 'charge');
  // Mi-parcours : la part de toute la charge, pas celle des semaines écoulées.
  const mi = monteeDuPlan(trame, [0, 1, 2, 3].map((i) => faite(i)), mardiDe(4));
  assert.equal(mi.fait, (400 + 450 + 500 + 300) / TOTAL);
  assert.equal(mi.prevu, mi.fait);
  assert.equal(mi.dansLesTemps, true);
});

test('le prévu à ce jour (pour le coach) : la charge prévue jusqu’à la semaine passée, sur le même total', () => {
  const m = monteeDuPlan(trame, [faite(0), faite(1), faite(2)], mardiDe(4));
  assert.equal(m.prevu, (400 + 450 + 500 + 300) / TOTAL);
  assert.equal(m.fait, (400 + 450 + 500) / TOTAL);
});

test('le seuil de 90 % du prévu : conforme au plan, ou en dessous du prévu', () => {
  assert.equal(DANS_LES_TEMPS, 0.9);
  const prevu = 400 + 450 + 500 + 300;
  // Une semaine tenue juste ce qu'il faut pour 90 % du prévu.
  const juste = (0.9 * prevu - (400 + 450 + 500)) / 300;
  const a = monteeDuPlan(trame, [faite(0), faite(1), faite(2), faite(3, juste)], mardiDe(4));
  assert.equal(a.dansLesTemps, true);
  const b = monteeDuPlan(trame, [faite(0), faite(1), faite(2), faite(3, juste - 0.05)], mardiDe(4));
  assert.equal(b.dansLesTemps, false);
  assert.ok(b.fait < 0.9 * b.prevu);
});

test('l’athlète : sa part réalisée, mot pour mot ; « de ton plan » pour un acheteur, « de ta préparation » pour un coaché', () => {
  const nb = '\u00a0';
  const charge = { fait: 0.62, prevu: 0.65, dansLesTemps: true, mesure: 'charge' };
  assert.equal(pourcentDeLaMontee(charge), `62${nb}%`);
  assert.equal(texteDeLaMontee(charge), 'de la charge de ton plan réalisée');
  assert.equal(texteDeLaMontee(charge, true), 'de la charge de ta préparation réalisée');
  assert.equal(libelleDeLaMontee(charge), `62${nb}% de la charge de ton plan réalisée`);
  assert.equal(libelleDeLaMontee(charge, true), `62${nb}% de la charge de ta préparation réalisée`);
  assert.equal(calculDeLaMontee(charge), `Chaque séance faite compte selon sa durée et son intensité. 100${nb}%, c’est toute la charge prévue jusqu’à ta course${nb}: ce chiffre ne fait que monter.`);
  // Sans charge dans la trame : le volume.
  const minutes = { fait: 0.41, prevu: 0.52, dansLesTemps: false, mesure: 'minutes' };
  assert.equal(texteDeLaMontee(minutes), 'du volume de ton plan réalisé');
  assert.equal(texteDeLaMontee(minutes, true), 'du volume de ta préparation réalisé');
  assert.equal(libelleDeLaMontee(minutes), `41${nb}% du volume de ton plan réalisé`);
  assert.equal(calculDeLaMontee(minutes), `Chaque séance faite compte pour sa durée. 100${nb}%, c’est tout le volume prévu jusqu’à ta course${nb}: ce chiffre ne fait que monter.`);
});

test('le coach : le réalisé, le prévu à ce jour et la pastille de l’écart, en mots neutres', () => {
  const nb = '\u00a0';
  assert.equal(texteCourtDeLaMontee({ fait: 0.62, prevu: 0.65, dansLesTemps: true, mesure: 'charge' }),
    `Charge réalisée 62${nb}% · prévue à ce jour 65${nb}%`);
  assert.equal(texteCourtDeLaMontee({ fait: 0.41, prevu: 0.52, dansLesTemps: false, mesure: 'minutes' }),
    `Volume réalisé 41${nb}% · prévu à ce jour 52${nb}%`);
  assert.equal(ecartDeLaMontee({ fait: 0.62, prevu: 0.65, dansLesTemps: true, mesure: 'charge' }), 'conforme au plan');
  assert.equal(ecartDeLaMontee({ fait: 0.41, prevu: 0.52, dansLesTemps: false, mesure: 'charge' }), 'en dessous du prévu');
});

test('aucun texte ne dit « prévu aujourd’hui », « retard », « gravi », « parcouru », « montée » ni « route »', () => {
  const cas = [true, false].flatMap((dansLesTemps) => ['charge', 'minutes'].map((mesure) => ({ fait: 0.3, prevu: 0.4, dansLesTemps, mesure })));
  const textes = cas.flatMap((m) => [texteDeLaMontee(m), texteDeLaMontee(m, true), libelleDeLaMontee(m), libelleDeLaMontee(m, true),
    calculDeLaMontee(m), texteCourtDeLaMontee(m), ecartDeLaMontee(m)]);
  for (const t of textes) assert.doesNotMatch(t, /prévu aujourd|retard|gravi|parcouru|montée|route/i, t);
  // L'athlète ne lit jamais le prévu.
  for (const m of cas) assert.doesNotMatch(`${libelleDeLaMontee(m)} ${calculDeLaMontee(m)}`, /40/);
});

test('un coaché part du début de son objectif : ni les semaines d’avant ni leur charge', () => {
  const depuis = trame[2].lundi;
  // Des semaines d'avant lues quand même (un autre objectif, ou avant son départ) : elles ne comptent pas.
  const m = monteeDuPlan(trame, [faite(0), faite(1), faite(2), faite(3)], mardiDe(4), depuis);
  const total = TOTAL - 400 - 450;
  assert.equal(m.fait, (500 + 300) / total);
  assert.equal(m.prevu, (500 + 300) / total);
  // Ses deux premières semaines seulement : deux semaines lues, la montée part.
  assert.ok(monteeDuPlan(trame, [faite(2), faite(3)], mardiDe(4), depuis));
  assert.equal(monteeDuPlan(trame, [faite(0), faite(1), faite(2)], mardiDe(3), depuis), null);
});

test('avant deux semaines lues : pas de montée (la montagne reste neutre, sans message)', () => {
  assert.equal(monteeDuPlan(trame, [faite(0)], mardiDe(1)), null);
  assert.equal(jaugeDuPlan(trame, [faite(0)], mardiDe(1)).montee, null);
  assert.ok(jaugeDuPlan(trame, [faite(0), faite(1)], mardiDe(2)).montee);
});

test('une trame sans charge par semaine : des minutes des deux côtés', () => {
  const sansCharge = trame.map((l) => ({ ...l, charge: null }));
  const m = monteeDuPlan(sansCharge, [faite(0), faite(1)], mardiDe(2));
  assert.equal(m.mesure, 'minutes');
  const minutes = CHARGES.reduce((a, c) => a + c * 0.6, 0);
  assert.equal(m.fait, (400 * 0.6 + 450 * 0.6) / minutes);
  assert.equal(m.prevu, m.fait);
});

test('le début de l’objectif d’un coaché : son départ programmé, sinon sa première semaine écrite, sinon la semaine rejointe', () => {
  assert.equal(debutDeLObjectif({ depart_prevu: '2027-01-18', demarre_le: '2027-01-17T18:00:00Z', lundis: ['2027-01-25', '2027-01-18'] }), '2027-01-18');
  assert.equal(debutDeLObjectif({ demarre_le: '2027-01-17T18:00:00Z', lundis: ['2027-01-25', '2027-01-18', null] }), '2027-01-18');
  assert.equal(debutDeLObjectif({ lundis: [], rejoint: '2027-01-11' }), '2027-01-11');
  assert.equal(debutDeLObjectif({ lundis: [] }), null);
});

test('les blocs d’un coaché : jamais un bloc daté avant le début de son objectif ; le bloc en cours commence à son début', () => {
  const depuis = trame[3].lundi;
  const blocs = blocsDuPlan(trame, plan, mardiDe(4), depuis);
  assert.deepEqual(blocs.map((b) => b.nom), ['Bloc développement', 'Affûtage']);
  assert.ok(blocs.every((b) => b.du >= depuis));
  assert.equal(blocs[0].du, depuis);
  // Un acheteur : tous ses blocs, comme avant.
  assert.deepEqual(blocsDuPlan(trame, plan, mardiDe(4)).map((b) => b.nom), ['Bloc fondations', 'Bloc développement', 'Affûtage']);
  // Le bloc en cours, sous le chiffre de la montée (13/11/2026) : le même pour l'un et l'autre.
  assert.equal(blocsDuPlan(trame, plan, mardiDe(4)).find((b) => b.moment === 'encours')?.nom, 'Bloc développement');
  assert.equal(blocs.find((b) => b.moment === 'encours')?.nom, 'Bloc développement');
});

test('un objectif enchaîné : la récupération de la course précédente en première étape, puis ses blocs', () => {
  const depuis = trame[2].lundi;
  const course = ajouterJours(depuis, -9);
  const blocs = blocsDuPlan(trame, plan, ajouterJours(depuis, -3), depuis, { date: course, jusqua: ajouterJours(depuis, -1) });
  assert.equal(blocs[0].nom, 'Récupération de ta course');
  assert.equal(blocs[0].du, ajouterJours(course, 1));
  assert.equal(blocs[0].au, ajouterJours(depuis, -1));
  assert.equal(blocs[0].moment, 'encours');
  assert.equal(blocs[0].texte, 'Après ta course du 9 janvier : du facile, pour repartir frais.');
  assert.deepEqual(blocs.slice(1).map((b) => b.nom), ['Bloc développement', 'Affûtage']);
  assert.ok(blocs.slice(1).every((b) => b.du >= depuis && b.moment === 'avenir'));
});
