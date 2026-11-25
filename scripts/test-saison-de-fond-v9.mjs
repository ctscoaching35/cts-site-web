#!/usr/bin/env node
/**
 * LES SAISONS DE FOND ENCORE EN COURS PASSENT AU MOTEUR v1 (C8 : au passage, tout coaché passe au nouveau moteur ; une saison de fond sans date devient `saison_de_fond: true` sans `date_course`). Des plans
 * fabriqués, sans réseau ni base.
 *
 *   node --test scripts/test-saison-de-fond-v9.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const MONDE = pathToFileURL(`${RACINE}scripts/_monde-app-gratuite.mjs`).href;
const REMPLACES = ['/lib/app/contexte.ts', '/lib/app/demandes.ts', '/lib/app/demonstrationPorte.ts', '/lib/app/nolio.ts', '/lib/app/supabase.ts'];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(next\/(headers|navigation|cache)|react)$/.test(specifier)) return { url: MONDE, shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    let r;
    try {
      r = nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    return REMPLACES.some((f) => r.url.endsWith(f)) ? { url: MONDE, shortCircuit: true } : r;
  },
});
const { parametresDuPlanV9 } = await import(pathToFileURL(`${RACINE}lib/app/passeUnPlanV9.ts`).href);
const { couvertV1, remplaceeParLaSuivante } = await import(pathToFileURL(`${RACINE}lib/app/saisonRemplacee.ts`).href);
const { unMot, attendLeCoach } = await import(pathToFileURL(`${RACINE}lib/app/unMot.ts`).href);
const { lireLesMots } = await import(pathToFileURL(`${RACINE}lib/app/motsDesCoaches.ts`).href);
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

// Une saison de la 8.x : ses réponses venaient d'une course de référence, avec les restes d'un autre objectif.
const SAISON = {
  fond: { saison: 2, debut: '2026-11-02' },
  champs: {
    format: 'TM', niveau: 'confirme', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3', volume_hebdo_actuel: '5h00',
    date_course: '2026-06-14', distance_km: '55', dplus_m: '3000', dmoins_m: '3000', temps_cible: '7h00', course_nom: 'Une course finie', gpx: 'x', entree: '2026-02-02',
    course_precedente: { date: '2026-01-10', duree_h: 3 },
  },
};
const envoi = (parametres, coache = true) => parametresDuPlanV9({ parametres, profil: { vc_ms: 3.8, fc_seuil1: 148 }, coache, accordLecture: true, premierLundi: '2026-11-02' }, { cote_min: '12', tapis: 'non' });

test('une saison de fond part sans date de course ni rien de la course de ses réponses, avec son entrée au début de la saison', () => {
  const p = envoi(SAISON);
  assert.equal(p.saison_de_fond, true);
  assert.equal(p.coaching, 'oui');
  assert.equal(p.entree, '2026-11-02', 'le début de la saison, pas l’entrée d’un autre objectif');
  for (const cle of ['date_course', 'distance_km', 'dplus_m', 'dmoins_m', 'temps_cible', 'course_nom', 'gpx', 'montees', 'course_precedente']) assert.ok(!(cle in p), cle);
  assert.deepEqual([p.format, p.freq_hebdo, p.jour_sl, p.volume_hebdo_actuel, p.cote_min, p.vc_ms], ['TM', '3', 'dimanche', '5h00', 12, 3.8]);
  // Un objectif, lui, ne change pas.
  const objectif = envoi({ champs: SAISON.champs });
  assert.ok(!('saison_de_fond' in objectif));
  assert.deepEqual([objectif.date_course, objectif.entree, objectif.distance_km], ['2026-06-14', '2026-02-02', '55']);
});

test('les passages ne sautent plus une saison : elle se prolonge à chaque semaine écrite, et une préparation qui prend la semaine l’arrête', () => {
  const p = source('lib/app/passagesV9.ts');
  assert.match(p, /await garderUneEcriture\(service, planId, ecrite, apres\);\n\s*if \(estUneSaisonDeFond\(o\.parametres\) && ecrite\.lundi\) await prolongerLaSaison\(planId, ecrite\.lundi\);/);
  assert.match(p, /const au = ajouterJours\(lundi, 27\);\n[^\n]*\.update\(\{ course_date: au \}\)\.eq\('id', planId\)\.lt\('course_date', au\);/, 'jamais reculée');
  assert.match(p, /semainePriseParUnObjectif\(o\.planId, lundi\);\n\s*if \(athlete\) await arreterLaSaison\(athlete, lundi\);/);
  // Avant toute écriture : le dimanche, le lundi et « Réessayer ».
  assert.equal((p.match(/await saisonPrise\(/g) ?? []).length, 3);
});

test('sans fin, une saison ne s’écrit plus quand la suivante du même coaché a commencé, ni pour un ancien athlète', () => {
  // Lundi visé : le 30 novembre 2026.
  assert.equal(remplaceeParLaSuivante('2026-08-31', ['2026-11-30'], '2026-11-30'), true, 'la suivante commence ce lundi');
  assert.equal(remplaceeParLaSuivante('2026-11-30', ['2026-08-31'], '2026-11-30'), false, 'la plus récente s’écrit');
  assert.equal(remplaceeParLaSuivante('2026-08-31', ['2026-12-07'], '2026-11-30'), false, 'la suivante n’a pas commencé');
  assert.equal(remplaceeParLaSuivante('2026-08-31', [], '2026-11-30'), false);
  assert.match(source('lib/app/fond.ts'), /if \(fiche && estAncien\(fiche\)\) return true;/);
  const p = source('lib/app/passagesV9.ts');
  assert.match(p, /if \(estUneSaisonDeFond\(o\.parametres\) && await \(await import\('\.\/fond'\)\)\.saisonEcartee\(planId, lundiVise\)\) return null;/);
});

const LUNDI = '2026-11-30';
const plan = (x) => ({ parametres: { champs: {} }, course_date: '2027-06-05', demarre_le: null, depart_prevu: null, ...x });

test('un coaché n’est jamais sans semaine : seule une saison, une préparation en route ou qui part cette semaine-là prend le lundi', () => {
  const couvert = (...plans) => couvertV1(plans, LUNDI);
  assert.equal(couvert(), false, 'sans objectif');
  assert.equal(couvert(plan({})), false, 'un objectif pas lancé : la saison court en attendant');
  assert.equal(couvert(plan({ demarre_le: '2026-10-05' })), true);
  assert.equal(couvert(plan({ demarre_le: '2026-08-03', course_date: '2026-11-29' })), false, 'sa dernière course est passée : la saison commence, par la récupération');
  assert.equal(couvert(plan({ depart_prevu: '2026-11-30' })), true);
  assert.equal(couvert(plan({ depart_prevu: '2027-01-04' })), false, 'il part plus tard : la saison fait le lien');
  assert.equal(couvert(plan({ parametres: { fond: { debut: '2026-11-02' } }, course_date: '2026-11-30' })), true);
  assert.equal(couvert(plan({ parametres: { fond: { debut: '2026-08-03' } }, course_date: '2026-11-29' })), false);
  assert.equal(couvert(plan({ parametres: null, demarre_le: '2026-10-05' })), false);
});

test('après une course, la saison porte la course d’avant : le moteur écrit sa récupération d’abord', () => {
  const p = envoi({ fond: { saison: 1, debut: LUNDI, course_precedente: { date: '2026-11-29', duree_h: 6 } }, champs: { jours_disponibles: ['mardi'], jour_sl: 'mardi', freq_hebdo: '1' } });
  assert.deepEqual([p.saison_de_fond, p.entree, p.course_precedente], [true, LUNDI, { date: '2026-11-29', duree_h: 6 }]);
});

test('la création sous la v1 : sa semaine habituelle d’abord, sans la trame de la 8.x, sans fin ; le soir et avant l’écriture du dimanche', () => {
  const f = source('lib/app/fond.ts');
  assert.match(f, /export async function saisonsDuV1\(budgetMs = 60_000\): Promise<Compte\[\]> \{\n\s*return \(await moteurEstV9\(\)\) \? creerLesSaisons\(budgetMs, true\) : \[\];/);
  assert.match(f, /if \(!\(champs\.jours_disponibles as unknown\[\] \| undefined\)\?\.length \|\| !champs\.jour_sl \|\| !champs\.freq_hebdo\) return null;/);
  assert.match(f, /const trame = v1 \? null : await moteur<[^\n]*\('\/v1\/trame', \{ parametres \}\);/);
  assert.match(f, /fin: ajouterJours\(lundi, 27\), tests_le: ''/);
  assert.match(f, /if \(v1 \? couvertV1\(siens, lundi\) : couvert\(siens, lundi\)\)/);
});

// Une fausse base : chaque table rend ses lignes, quels que soient les filtres.
const base = (tables) => ({ from: (t) => { const q = { then: (ok, ko) => Promise.resolve({ data: tables[t] ?? [] }).then(ok, ko) }; for (const m of ['select', 'eq', 'in', 'gte', 'not', 'order', 'lt']) q[m] = () => q; return q; } });
const SEMAINE = { jours_disponibles: ['mardi', 'jeudi'], jour_sl: 'jeudi', freq_hebdo: '2' };
const FICHE = { cote_min: '5', tapis: 'oui', critere_intensite: 'jamais', critere_denivele: 'jamais', ...SEMAINE };
const ligne = (objectif) => ({ id: 'a1', nom: 'A', points: [], a: { coache: true, aLaMain: false, nolio: true, accord: true, objectif } });
const enSaison = { plan_id: 's1', demarre: true, prevu: null, partie: true };
const mots = async ({ fiche = FICHE, plans, liens = [], objectif = enSaison }) =>
  (await lireLesMots(base({ athletes_coaches: [{ id: 'a1', profil: fiche, reperes_sources: null }], plans, coaching: liens }), 'c', [ligne(objectif)], '2026-11-25'))[0].un;
const SAISON_EN_BASE = { id: 's1', parametres: { fond: { debut: '2026-11-02' }, champs: {} }, course_date: '2026-12-20', demarre_le: '2026-11-02', depart_prevu: null };

test('« Mes athlètes » : en saison de fond, « Saison de fond » quand rien n’attend ; sa fiche incomplète se dit ; un objectif daté pas lancé attend toujours le coach', async () => {
  const seule = await mots({ plans: [SAISON_EN_BASE], liens: [{ plan_id: 's1', athlete_id: 'a1' }] });
  assert.deepEqual([seule.mot, attendLeCoach(seule)], ['Saison de fond', false]);
  const sansCote = await mots({ fiche: { ...FICHE, cote_min: undefined }, plans: [SAISON_EN_BASE], liens: [{ plan_id: 's1', athlete_id: 'a1' }] });
  assert.equal(sansCote.mot, 'Il manque : sa côte en minutes');
  const date = { id: 'o1', parametres: { champs: { ...SEMAINE, gpx: JSON.stringify({ montees: [] }), format: 'R10' } }, course_date: '2027-03-01', demarre_le: null, depart_prevu: null };
  const avecDate = await mots({ plans: [SAISON_EN_BASE, date], liens: [{ plan_id: 's1', athlete_id: 'a1' }, { plan_id: 'o1', athlete_id: 'a1' }] });
  assert.equal(avecDate.mot, 'À lancer');
  // Sans objectif ni saison encore : sa fiche complète le dit « Pas d’objectif » jusqu’au soir.
  assert.equal((await mots({ plans: [], objectif: null })).mot, 'Pas d’objectif');
});

test('une saison refusée par le moteur se dit « Semaine pas partie »', () => {
  const x = { id: 'a1', nolio: true, accord: true, aLaMain: false, objectif: null, manque: null, gesteDuManque: null, test: null, sansReponse: false, points: [{ genre: 'saison', niveau: 'bloque', href: '/x' }] };
  assert.equal(unMot(x).mot, 'Semaine pas partie');
});

test('l’app : la saison de la v1 n’a ni date de fin ni tests annoncés, ses graphiques s’arrêtent douze semaines devant, et la mise à jour de nuit garde son nom', () => {
  assert.ok(source('app/app/plan/page.tsx').includes('{plan.fond && !v9 && <BlocsDeLaSaison trame={d.trame} jour={jour} />}'));
  assert.ok(source('lib/app/tableauDuPlan.ts').includes('l.lundi <= ajouterJours(ctx.jour, 84)'));
  assert.match(source('lib/app/actualisation.ts'), /const saison = version\.startsWith\('9\.'\) \? \(p\.donnees as Plan \| null\)\?\.fond : undefined;/);
});
