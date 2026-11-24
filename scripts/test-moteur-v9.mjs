#!/usr/bin/env node
/**
 * LE CONTRAT DU MOTEUR 9.0 CÔTÉ SITE (lib/app/moteurV9.ts ; CONTRAT_API_CTS.md, « MOTEUR v1 », 23/11/2026) : la version lue sur
 * `/v1/config`, le numéro de semaine, les `parametres` sans niveau (criteres, cote_min en minutes, tapis, lu, aisance, coaching, glucides en un
 * nombre), les corps des quatre appels, et la réponse de `/v1/semaine` vérifiée. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-moteur-v9.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
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
const m = await import(pathToFileURL(`${RACINE}lib/app/moteurV9.ts`).href);

test('version : une 9.x se reconnaît, une 8.x et le reste non', () => {
  for (const v of ['9.0', '9.1', '9', ' 9.0 ']) assert.equal(m.estMoteurV9(v), true, v);
  for (const v of ['8.474', '8.9', '19.0', '', null, undefined, 9, '90.1']) assert.equal(m.estMoteurV9(v), false, String(v));
});

test('numéro de semaine : le rang de la trame (1 à N), écrit « S9 », 9 ou « 9 »', () => {
  for (const [brut, n] of [['S9', 9], [9, 9], ['9', 9], ['S12', 12], [' S3 ', 3]]) assert.equal(m.numeroMoteur(brut), n, String(brut));
  for (const brut of ['S0', 0, -1, 1.5, 'x', '', null, undefined, 'S9b']) assert.equal(m.numeroMoteur(brut), null, String(brut));
});

const BASE = { nom: 'Essai', format: 'TM', date_course: '2027-03-14', distance_km: 42, dplus_m: 1800, temps_cible: '5h30', duree_mois: 4,
  niveau: 'intermediaire', habitude: 'regulier', terrain: 'vallonne', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche',
  freq_hebdo: 4, volume_hebdo_actuel: '5h', sortie_longue_actuelle: '2h' };

test('parametres : plus de niveau, d’habitude ni de terrain ; le reste passe tel quel, sans rien modifier', () => {
  const avant = JSON.stringify(BASE);
  const p = m.parametresV9(BASE);
  for (const k of ['niveau', 'habitude', 'terrain']) assert.ok(!(k in p), k);
  for (const k of ['nom', 'format', 'date_course', 'distance_km', 'dplus_m', 'temps_cible', 'duree_mois', 'jours_disponibles', 'jour_sl', 'freq_hebdo', 'volume_hebdo_actuel', 'sortie_longue_actuelle'])
    assert.deepEqual(p[k], BASE[k], k);
  assert.equal(JSON.stringify(BASE), avant, 'la base n’est pas modifiée');
  // Sans critère donné : aucune clé `criteres` (le moteur lit « jamais » et le dit), rien d’inventé.
  for (const k of ['criteres', 'cote_min', 'tapis', 'lu', 'aisance', 'montees', 'coaching', 'entree', 'course_precedente', 'glucides_cible']) assert.ok(!(k in p), k);
  // Le terrain d'avant n'est pas lu, mais sa tranche de côte passe en transition (voir plus bas) : ici « vallonne », la tranche par défaut.
  assert.equal(p.cote_max, '1m30');
});

test('parametres : les deux critères, de la fiche ou de l’intake à plat (le dénivelé devient la mécanique)', () => {
  assert.deepEqual(m.parametresV9(BASE, { criteres: { intensite: 'parfois', mecanique: 'regulier' } }).criteres, { intensite: 'parfois', mecanique: 'regulier' });
  const plat = m.parametresV9({ ...BASE, critere_intensite: 'regulier', critere_denivele: 'jamais' });
  assert.deepEqual(plat.criteres, { intensite: 'regulier', mecanique: 'jamais' });
  assert.ok(!('critere_intensite' in plat) && !('critere_denivele' in plat));
  assert.deepEqual(m.parametresV9(BASE, { criteres: { intensite: 'parfois' } }).criteres, { intensite: 'parfois' }, 'un seul : l’autre reste absent');
  assert.ok(!('criteres' in m.parametresV9(BASE, { criteres: { intensite: 'beaucoup' } })), 'une valeur inconnue ne part pas');
  assert.deepEqual(m.parametresV9({ ...BASE, critere_intensite: 'regulier' }, { criteres: { intensite: 'jamais' } }).criteres, { intensite: 'jamais' }, 'la fiche prime');
});

test('parametres : côte, tapis, ce que Nolio montre, aisance, montées', () => {
  const p = m.parametresV9(BASE, { cote_max: '5-10', tapis: 'non', lu: { volume_min: 300, sl_min: null }, aisance: 'descente', montees: 'longues' });
  assert.equal(p.cote_max, '5-10');
  assert.equal(p.tapis, 'non');
  assert.deepEqual(p.lu, { volume_min: 300 });
  assert.equal(p.aisance, 'descente');
  assert.equal(p.montees, 'longues');
  assert.ok(!('lu' in m.parametresV9(BASE, { lu: { volume_min: null, sl_min: null } })));
});

test('parametres : la côte part en minutes (cote_min), d’au moins 1 ; la réponse du site est lue à défaut', () => {
  for (const [donne, minutes] of [[12, 12], ['12', 12], ['12,5', 12.5], [1, 1], [0.5, 1], [0, 1], ['0,75', 1], [240, 240]]) {
    const p = m.parametresV9(BASE, { cote_min: donne });
    assert.strictEqual(p.cote_min, minutes, String(donne));
    assert.ok(!('cote_max' in p), `${donne} : cote_max n’est lu que sans cote_min`);
    assert.ok(!('terrain' in p));
  }
  // La réponse du questionnaire, dans la base du plan : un nombre, jamais la chaîne « 12 ».
  assert.strictEqual(m.parametresV9({ ...BASE, cote_min: '12' }).cote_min, 12);
  assert.ok(!('cote_min' in m.parametresV9({ ...BASE, cote_min: 'aucune' })), '« pas de côte » n’est plus une réponse : jamais 0');
  assert.strictEqual(m.parametresV9({ ...BASE, cote_min: '12' }, { cote_min: 4 }).cote_min, 4, 'la fiche prime');
  // Les minutes l'emportent sur la tranche.
  const les2 = m.parametresV9({ ...BASE, terrain: 'pentu' }, { cote_min: 3, cote_max: '10+' });
  assert.strictEqual(les2.cote_min, 3);
  assert.ok(!('cote_max' in les2));
});

test('parametres : sans minutes lues, la tranche (cote_max) : celle qu’on donne, sinon celle de l’ancien terrain ; sinon rien', () => {
  assert.equal(m.parametresV9(BASE, { cote_max: '5-10' }).cote_max, '5-10');
  for (const [terrain, tranche] of [['vallonne', '1m30'], ['intermediaire', '2-5'], ['pentu', '5-10'], ['tres_pentu', '10+']])
    assert.equal(m.parametresV9({ ...BASE, terrain }).cote_max, tranche, terrain);
  const sans = m.parametresV9({ ...BASE, terrain: undefined });
  assert.ok(!('cote_max' in sans) && !('cote_min' in sans), 'rien d’inventé');
  assert.ok(!('cote_max' in m.parametresV9({ ...BASE, terrain: 'plat' })), 'un terrain inconnu ne part pas');
  // Des minutes illisibles ne valent pas « 0 » : la tranche d'avant reste.
  const illisible = m.parametresV9({ ...BASE, terrain: 'pentu', cote_min: 'douze' });
  assert.ok(!('cote_min' in illisible));
  assert.equal(illisible.cote_max, '5-10');
});

test('parametres : un coaché entre à son lundi et porte la course qu’il vient de courir ; un acheteur non', () => {
  const entree = { coaching: true, entree: '2026-12-07', course_precedente: { date: '2026-11-29', duree_h: 4.5 } };
  const c = m.parametresV9(BASE, entree);
  assert.equal(c.coaching, 'oui');
  assert.equal(c.entree, '2026-12-07');
  assert.deepEqual(c.course_precedente, { date: '2026-11-29', duree_h: 4.5 });
  const a = m.parametresV9(BASE, { coaching: false, entree: '2026-12-07' });
  for (const k of ['coaching', 'entree', 'course_precedente']) assert.ok(!(k in a), k);
});

test('parametres : la cible de glucides part en un nombre (g/h), le milieu d’une fourchette', () => {
  assert.equal(m.parametresV9(BASE, { glucides: [45, 55] }).glucides_cible, 50);
  assert.equal(m.parametresV9(BASE, { glucides: [60, 75] }).glucides_cible, 68);
  assert.equal(m.parametresV9(BASE, { glucides: 70 }).glucides_cible, 70);
  // L'ancien paramètre du plan (une fourchette, 8.474) se lit aussi ; sa stratégie complète ne part plus.
  const ancien = m.parametresV9({ ...BASE, glucides_cible: [60, 70], strategie: { glucides_g_h: [60, 70] } });
  assert.equal(ancien.glucides_cible, 65);
  assert.ok(!('strategie' in ancien));
  for (const g of [null, undefined, 0, -3, [50], 'beaucoup', [0, 50]]) assert.equal(m.glucidesPourLeMoteur(g), null, String(g));
  assert.ok(!('glucides_cible' in m.parametresV9(BASE, { glucides: null })), 'sans cible : le moteur prend 60');
  assert.equal(m.parametresV9(BASE, { accord_lecture: false }).accord_lecture, false);
});

const semaine = (lundi) => ({ lundi, seances: [], hooper: [], activites_vues: 0 });

test('nolio : de la plus ancienne à la plus récente, treize semaines au plus', () => {
  const lundis = Array.from({ length: 15 }, (_, i) => new Date(Date.UTC(2026, 7, 31 + 7 * i)).toISOString().slice(0, 10));
  const lu = m.nolioPourLeMoteur([...lundis].reverse().map(semaine));
  assert.equal(lu.semaines.length, 13);
  assert.equal(lu.semaines[0].lundi, lundis[2]);
  assert.equal(lu.semaines.at(-1).lundi, lundis[14]);
  assert.deepEqual(m.nolioPourLeMoteur([]), { semaines: [] });
});

test('corps de /v1/semaine : numéro du moteur, état tel quel, et rien d’absent', () => {
  const etat = { version: '9.0', semaines: [{ numero: 8 }], derniere_reponse: null };
  const corps = m.corpsDeLaSemaine({ parametres: { format: 'TM' }, numero: 'S9', etat });
  assert.deepEqual(corps, { parametres: { format: 'TM' }, numero: 9, etat });
  assert.strictEqual(corps.etat, etat, 'l’état est rendu tel quel, sans copie ni tri');
  const complet = m.corpsDeLaSemaine({ parametres: {}, numero: 9, etat, nolio: { semaines: [] }, reponses: { version: 'normale', jours: ['mardi'] } });
  assert.deepEqual(Object.keys(complet), ['parametres', 'numero', 'etat', 'nolio', 'reponses']);
  // Sans lecture ni réponse ni état (la première semaine) : parametres et numero seulement.
  assert.deepEqual(m.corpsDeLaSemaine({ parametres: {}, numero: 1, etat: null, nolio: null, reponses: null }), { parametres: {}, numero: 1 });
  assert.throws(() => m.corpsDeLaSemaine({ parametres: {}, numero: 'dimanche' }), /illisible/);
});

test('corps de /v1/questionnaire : la semaine que le moteur écrira ; la version rendue se vérifie', () => {
  assert.deepEqual(m.corpsDuQuestionnaire({ parametres: { format: 'UT' }, numero: 'S10', etat: { version: '9.0' }, nolio: { semaines: [] } }),
    { parametres: { format: 'UT' }, numero: 10, etat: { version: '9.0' }, nolio: { semaines: [] } });
  assert.throws(() => m.corpsDuQuestionnaire({ parametres: {}, numero: null }), /illisible/);
  for (const v of ['normale', 'aucune_seance_vue', 'fatigue']) assert.equal(m.versionDuQuestionnaire({ version: v }), v);
  for (const r of [{ version: 'aucune_seance' }, { version: 'autre' }, {}, null, 'fatigue']) assert.equal(m.versionDuQuestionnaire(r), null);
});

test('corps de /v1/nolio/seances : la semaine rendue, et le profil seulement avec ses valeurs', () => {
  const s = { numero: 9, jours: [] };
  assert.deepEqual(m.corpsNolioSeances(s), { semaine: s });
  assert.deepEqual(m.corpsNolioSeances(s, {}), { semaine: s });
  assert.deepEqual(m.corpsNolioSeances(s, { vc_ms: 3.9, fc_seuil1: null, fc_seuil2: 168 }), { semaine: s, profil: { vc_ms: 3.9, fc_seuil2: 168 } });
});

test('réponse de /v1/semaine : lue seulement si elle est d’une 9.0', () => {
  const r = { semaine: { numero: 9, lundi: '2026-11-30', jours: [{ jour: 'mardi' }] }, note: ['Ta semaine…', 'Deuxième ligne.'], pourquoi: [{ n: 1 }], etat: { version: '9.0', semaines: [] }, branche: 5 };
  const lu = m.lireSortieV9(r);
  assert.equal(lu.semaine.numero, 9);
  assert.deepEqual(lu.note, ['Ta semaine…', 'Deuxième ligne.'], 'la note du moteur est une liste de lignes');
  assert.deepEqual(m.lireSortieV9({ ...r, note: 'un texte seul' }).note, ['un texte seul']);
  assert.equal(lu.branche, 5);
  assert.strictEqual(lu.etat, r.etat, 'l’état à garder est celui du moteur, tel quel');
  // Une réponse de 8.x (ses notes, son bilan, un état sans version 9) ne se lit pas comme une 9.0.
  assert.equal(m.lireSortieV9({ semaine: { jours: [] }, notes: [], bilan: 'x', journal: [], etat: { semaines: [] }, realise: null }), null);
  assert.equal(m.lireSortieV9({ ...r, etat: { version: '8.474' } }), null);
  for (const x of [null, undefined, 'x', {}, { ...r, semaine: null }, { ...r, semaine: { jours: 'non' } }, { ...r, etat: [] }]) assert.equal(m.lireSortieV9(x), null, JSON.stringify(x));
  assert.equal(m.lireSortieV9({ ...r, note: undefined, pourquoi: undefined, branche: undefined }).pourquoi.length, 0);
  assert.deepEqual(m.lireSortieV9({ ...r, note: undefined }).note, [], 'pas de note : aucune ligne');
});

test('branché seulement derrière la garde de version : seules les pièces de la chaîne du moteur v1 lisent son contrat, et les Nolio du moteur (coaching.ts, sous une 9.x)', () => {
  let lecteurs = [];
  try {
    lecteurs = execFileSync('grep', ['-rlE', 'from [\'"][^\'"]*moteurV9[\'"]|import\\([^)]*moteurV9', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    if (e.status !== 1) throw e;
  }
  // Seules les pièces de la même chaîne (préparées aussi, lues par personne) le lisent.
  const CHAINE = ['lib/app/nolioV9.ts', 'lib/app/etatMoteur.ts', 'lib/app/ecritureV9.ts', 'lib/app/stockageV9.ts', 'lib/app/passeUnPlanV9.ts', 'lib/app/passagesV9.ts',
    'lib/app/coaching.ts', 'lib/app/ecriture.ts'];
  assert.deepEqual(lecteurs.filter((f) => !CHAINE.includes(f)), []);
});
