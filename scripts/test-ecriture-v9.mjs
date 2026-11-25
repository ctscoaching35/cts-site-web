#!/usr/bin/env node
/**
 * LA CHAÎNE D'ÉCRITURE DU SITE SUR LE MOTEUR v1 (lib/app/ecritureV9.ts, etatMoteur.ts, stockageV9.ts ; CONTRAT_API_CTS.md, « MOTEUR v1 ») :
 * la trame et le numéro, l'état gardé par plan, l'écriture et la réécriture d'une semaine, le questionnaire du dimanche, la réponse tardive,
 * la décision du lundi, Nolio et le stockage. Les échanges sont ceux du moteur RÉEL, enregistrés en local pour un athlète fictif
 * (scripts/fixtures/moteur-v9/, scripts/enregistrer-moteur-v9.py) : le faux moteur ne répond que si le site envoie EXACTEMENT le corps enregistré.
 * Aucun appel à l'API en ligne, à Nolio ni à la base ; aucune donnée d'athlète.
 *
 *   node --test scripts/test-ecriture-v9.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const chaine = await charge('ecritureV9');
const etatMod = await charge('etatMoteur');
const stockage = await charge('stockageV9');
const moteur = await charge('moteurV9');

const fixture = (nom) => JSON.parse(readFileSync(`${RACINE}scripts/fixtures/moteur-v9/${nom}.json`, 'utf8'));
const F = Object.fromEntries(['trame', 'semaine-1', 'semaine-2', 'semaine-2-reecrite', 'semaine-2-reecrite-le-lundi', 'questionnaire', 'questionnaire-aucune-seance-vue', 'reponse-tardive', 'nolio-seances']
  .map((n) => [n, fixture(n)]));
const PARAMETRES = F['semaine-1'].requete.corps.parametres;
const LUNDI_1 = F.trame.reponse.semaines[0].lundi;
const LUNDI_2 = F.trame.reponse.semaines[1].lundi;
const LUNDI_3 = F.trame.reponse.semaines[2].lundi;

// Le faux moteur : il ne répond que si le corps envoyé est celui du moteur réel enregistré (même chemin, même corps).
function moteurRejoue(...echanges) {
  const appels = [];
  const ports = {
    appelsChemins: appels,
    appeler: async (chemin, corps) => {
      appels.push(chemin);
      const trouve = echanges.find((e) => e.requete.chemin === chemin && JSON.stringify(e.requete.corps) === JSON.stringify(corps));
      if (!trouve) throw new Error(`Aucun échange enregistré pour ${chemin} avec ce corps : ${JSON.stringify(corps).slice(0, 300)}`);
      return structuredClone(trouve.reponse);
    },
  };
  return ports;
}
const TRAME = F.trame;
const apresSemaine1 = () => etatMod.apresUneEcriture(etatMod.ETAT_VIDE, 1, null, F['semaine-1'].reponse.etat);
const apresSemaine2 = () => etatMod.apresUneEcriture(apresSemaine1(), 2, F['semaine-1'].reponse.etat, F['semaine-2'].reponse.etat);
const NOLIO_1 = F['semaine-2'].requete.corps.nolio;
const REPONSES = F['semaine-2'].requete.corps.reponses;

// ─── La note, la trame, le numéro ───────────────────────────────────────────────────────────────────

test('la note du moteur est une LISTE de lignes (3 à 5 au plus, elle peut être vide) : lue comme telle, jamais perdue', () => {
  assert.ok(Array.isArray(F['semaine-1'].reponse.note), 'le moteur réel rend une liste');
  assert.deepEqual(moteur.lireNote(['a', ' b ', '', 3, null]), ['a', 'b']);
  assert.deepEqual(moteur.lireNote('une seule ligne'), ['une seule ligne']);
  assert.deepEqual(moteur.lireNote(undefined), []);
  assert.equal(moteur.noteEnTexte(['a', 'b']), 'a\nb');
  assert.deepEqual(moteur.lireSortieV9(F['semaine-1'].reponse).note, F['semaine-1'].reponse.note);
});

test('la trame : le numéro est le rang de la semaine ; une trame d’une 8.x ou aux numéros qui ne sont pas des rangs n’est pas lue', () => {
  const t = moteur.lireTrame(TRAME.reponse);
  assert.equal(t.semaines[0].numero, 1);
  assert.equal(moteur.numeroDeLaSemaine(t, LUNDI_2), 2);
  assert.equal(moteur.numeroDeLaSemaine(t, '2030-01-07'), null);
  assert.equal(moteur.lireTrame({ ...TRAME.reponse, version_moteur: '8.474' }), null);
  assert.equal(moteur.lireTrame({ ...TRAME.reponse, semaines: TRAME.reponse.semaines.map((s, i) => ({ ...s, numero: i + 2 })) }), null);
  assert.equal(moteur.lireTrame({ semaines: [], version_moteur: '9.0' }), null);
  assert.equal(moteur.lireTrame({ ...TRAME.reponse, semaines: [{ numero: 1, lundi: 'lundi' }] }), null);
});

// ─── L'état gardé par plan ──────────────────────────────────────────────────────────────────────────

test('l’état : première écriture sans état, suivante avec le dernier état rendu, réécriture avec l’état d’AVANT la semaine', () => {
  const E = etatMod;
  assert.deepEqual(E.etatPourEcrire(E.ETAT_VIDE, 1), { etat: null, reecrite: false });
  const s1 = apresSemaine1();
  assert.deepEqual(E.etatPourEcrire(s1, 2), { etat: F['semaine-1'].reponse.etat, reecrite: false });
  const s2 = apresSemaine2();
  assert.deepEqual(E.etatPourEcrire(s2, 2), { etat: F['semaine-1'].reponse.etat, reecrite: true }, 'l’état d’avant la semaine 2, celui de la semaine 1');
  assert.deepEqual(E.etatPourEcrire(s1, 1), { etat: null, reecrite: true }, 'la première se réécrit sans état');
});

test('l’état : seule la dernière semaine écrite se réécrit ; une semaine plus ancienne jamais écrite est refusée', () => {
  const s2 = apresSemaine2();
  assert.throws(() => etatMod.etatPourEcrire(s2, 1), /n'est pas la dernière écrite/);
  assert.throws(() => etatMod.etatPourEcrire({ courant: s2.courant, ecrites: [{ numero: 3, etatAvant: s2.courant }] }, 2), /précède la dernière écrite/);
  // Un plan d'un coaché qui entre à la semaine 5 : rien d'écrit avant, la 5 s'écrit.
  assert.deepEqual(etatMod.etatPourEcrire(etatMod.ETAT_VIDE, 5), { etat: null, reecrite: false });
});

test('l’état d’une 8.x n’est jamais rendu au moteur v1 : le plan repart sans état', () => {
  const huit = { courant: { semaines: [{ numero: 3 }], sl_reelles: { x: 90 } }, ecrites: [] };
  assert.deepEqual(etatMod.etatPourEcrire(huit, 4), { etat: null, reecrite: false });
  const avecHuitAvant = { courant: F['semaine-1'].reponse.etat, ecrites: [{ numero: 2, etatAvant: { semaines: [] } }] };
  assert.equal(etatMod.etatPourEcrire(avecHuitAvant, 2).etat, null);
});

test('l’état après une écriture : le nouvel état, la semaine gardée avec l’état qui a servi ; une réécriture remplace sa ligne', () => {
  const s1 = apresSemaine1();
  assert.deepEqual(s1.ecrites, [{ numero: 1, etatAvant: null }]);
  const s2 = apresSemaine2();
  assert.deepEqual(s2.ecrites.map((w) => w.numero), [1, 2]);
  assert.strictEqual(s2.courant, F['semaine-2'].reponse.etat);
  const refaite = etatMod.apresUneEcriture(s2, 2, F['semaine-1'].reponse.etat, F['semaine-2-reecrite'].reponse.etat);
  assert.deepEqual(refaite.ecrites.map((w) => w.numero), [1, 2]);
  assert.strictEqual(refaite.courant, F['semaine-2-reecrite'].reponse.etat);
  // Une réponse tardive ne touche qu'à l'état du plan.
  const t = etatMod.apresUneReponseTardive(s2, F['reponse-tardive'].reponse.etat);
  assert.deepEqual(t.ecrites, s2.ecrites);
  assert.strictEqual(t.courant, F['reponse-tardive'].reponse.etat);
});

// ─── Écrire, réécrire ───────────────────────────────────────────────────────────────────────────────

test('écrire la première semaine : la trame donne le numéro, aucun état, ni nolio, ni réponses ; le moteur réel répond', async () => {
  const ports = moteurRejoue(TRAME, F['semaine-1']);
  const e = await chaine.ecrireLaSemaine(ports, { parametres: PARAMETRES, lundi: LUNDI_1, etat: etatMod.ETAT_VIDE });
  assert.deepEqual(ports.appelsChemins, ['/v1/trame', '/v1/semaine']);
  assert.equal(e.numero, 1);
  assert.equal(e.reecrite, false);
  assert.equal(e.etatUtilise, null);
  assert.deepEqual(e.note, F['semaine-1'].reponse.note);
  assert.equal(e.semaine.numero, 1);
  assert.equal(e.semaine.lundi, LUNDI_1);
  assert.ok(e.pourquoi.length >= 7);
  assert.equal(e.etatRendu.version, '9.0');
  assert.deepEqual(chaine.etatApresEcriture(etatMod.ETAT_VIDE, e).ecrites, [{ numero: 1, etatAvant: null }]);
});

test('écrire la deuxième : l’état rendu tel quel, ce que Nolio montre, la réponse du dimanche', async () => {
  const ports = moteurRejoue(TRAME, F['semaine-2']);
  const e = await chaine.ecrireLaSemaine(ports, { parametres: PARAMETRES, lundi: LUNDI_2, etat: apresSemaine1(), nolio: NOLIO_1, reponses: REPONSES });
  assert.equal(e.numero, 2);
  assert.equal(e.reecrite, false);
  assert.deepEqual(e.etatUtilise, F['semaine-1'].reponse.etat);
  assert.equal(e.etatRendu.semaines.length, 2);
  assert.equal(e.semaine.nombre, 4);
});

test('réécrire : une nouvelle réponse avant la première séance, le MÊME numéro avec l’état d’AVANT cette semaine ; le moteur remplace la semaine', async () => {
  const reponsesB = F['semaine-2-reecrite'].requete.corps.reponses;
  const ports = moteurRejoue(TRAME, F['semaine-2-reecrite']);
  const e = await chaine.ecrireLaSemaine(ports, { parametres: PARAMETRES, lundi: LUNDI_2, etat: apresSemaine2(), nolio: NOLIO_1, reponses: reponsesB });
  assert.equal(e.numero, 2);
  assert.equal(e.reecrite, true);
  assert.deepEqual(e.etatUtilise, F['semaine-1'].reponse.etat, 'l’état d’avant la semaine 2');
  assert.equal(e.semaine.nombre, 3, 'la nouvelle réponse (3 séances) est écrite');
  assert.equal(e.etatRendu.semaines.length, 2, 'la semaine est remplacée, pas ajoutée');
  const apres = chaine.etatApresEcriture(apresSemaine2(), e);
  assert.deepEqual(apres.ecrites.map((w) => w.numero), [1, 2]);
  assert.deepEqual(apres.ecrites[1].etatAvant, F['semaine-1'].reponse.etat);
});

test('nolio lu : envoyé ; nolio manqué (null) : la clé ne part pas ; une réponse absente : la semaine prévue', async () => {
  const sans = moteurRejoue(TRAME, { requete: { chemin: '/v1/semaine', corps: { parametres: PARAMETRES, numero: 2, etat: F['semaine-1'].reponse.etat } }, reponse: F['semaine-2'].reponse });
  const e = await chaine.ecrireLaSemaine(sans, { parametres: PARAMETRES, lundi: LUNDI_2, etat: apresSemaine1(), nolio: null, reponses: null });
  assert.equal(e.numero, 2, 'sans clé nolio ni reponses : exactement ce corps');
});

test('le moteur répond pour une autre semaine, ou d’une 8.x, ou de travers : rien n’est rangé', async () => {
  const autre = structuredClone(F['semaine-1']);
  autre.reponse.semaine.numero = 7;
  await assert.rejects(chaine.ecrireLaSemaine(moteurRejoue(TRAME, autre), { parametres: PARAMETRES, lundi: LUNDI_1, etat: etatMod.ETAT_VIDE }), /n'est pas celle demandée/);
  const huit = structuredClone(F['semaine-1']);
  huit.reponse.etat = { semaines: [] };
  await assert.rejects(chaine.ecrireLaSemaine(moteurRejoue(TRAME, huit), { parametres: PARAMETRES, lundi: LUNDI_1, etat: etatMod.ETAT_VIDE }), chaine.ReponseIllisible);
  await assert.rejects(chaine.ecrireLaSemaine(moteurRejoue(TRAME, F['semaine-1']), { parametres: PARAMETRES, lundi: '2030-01-07', etat: etatMod.ETAT_VIDE }), /ne commence aucune semaine/);
  const mauvaiseTrame = structuredClone(TRAME);
  mauvaiseTrame.reponse.version_moteur = '8.474';
  await assert.rejects(chaine.ecrireLaSemaine(moteurRejoue(mauvaiseTrame), { parametres: PARAMETRES, lundi: LUNDI_1, etat: etatMod.ETAT_VIDE }), chaine.ReponseIllisible);
});

// ─── Le dimanche matin ──────────────────────────────────────────────────────────────────────────────

const NOLIO_2 = F.questionnaire.requete.corps.nolio;

test('le dimanche matin : le moteur choisit la version d’après ce que Nolio montre, le questionnaire sort avec les séances clés de la semaine écrite', async () => {
  const ports = moteurRejoue(TRAME, F.questionnaire);
  const q = await chaine.preparerLeQuestionnaire(ports, { parametres: PARAMETRES, lundiASuivre: LUNDI_3, etat: apresSemaine2(), nolio: NOLIO_2,
    derniere: F['semaine-2'].reponse.semaine, accord: true });
  assert.equal(q.version, 'normale');
  assert.ok(q.cles.length >= 1 && q.cles.every((c) => /^S2-/.test(c.id)), 'les séances clés de la semaine 2, par leur identifiant');
  assert.equal(q.quiz.items.length, 7, 'avec l’accord de lecture : arrêt, semaines d’arrêt, cause, séance clé, jours, nombre, sortie longue');
  // Décision 209 : sans l'accord, la cause (donnée de santé) n'est pas posée ; le reste du questionnaire est le même.
  const sans = await chaine.preparerLeQuestionnaire(moteurRejoue(TRAME, F.questionnaire), { parametres: PARAMETRES, lundiASuivre: LUNDI_3, etat: apresSemaine2(), nolio: NOLIO_2,
    derniere: F['semaine-2'].reponse.semaine });
  assert.equal(sans.quiz.items.length, 6);
  assert.ok(!sans.quiz.items.some((i) => i.question === 'Si tu as arrêté toute la semaine : pourquoi ?'));
  assert.deepEqual(sans.quiz.items.filter((i) => i.question !== 'Si tu as arrêté toute la semaine : pourquoi ?'), q.quiz.items.filter((i) => i.question !== 'Si tu as arrêté toute la semaine : pourquoi ?'));
  assert.equal(q.quiz.name, 'Ton point du dimanche');
  assert.ok(q.quiz.items.some((i) => i.question.startsWith('Une séance clé pas faite')));
});

test('aucune séance vue : la version vient du moteur, son ouverture aussi', async () => {
  const ports = moteurRejoue(TRAME, F['questionnaire-aucune-seance-vue']);
  const q = await chaine.preparerLeQuestionnaire(ports, { parametres: PARAMETRES, lundiASuivre: LUNDI_3, etat: apresSemaine2(),
    nolio: F['questionnaire-aucune-seance-vue'].requete.corps.nolio, derniere: F['semaine-2'].reponse.semaine });
  assert.equal(q.version, 'aucune_seance_vue');
  assert.ok(q.quiz.description.length > 0);
});

test('le dimanche d’avant la première semaine : pas d’appel au moteur, seulement les jours, le nombre et la sortie longue', async () => {
  const ports = moteurRejoue(TRAME);
  const q = await chaine.preparerLeQuestionnaire(ports, { parametres: PARAMETRES, lundiASuivre: LUNDI_1, etat: etatMod.ETAT_VIDE, derniere: null });
  assert.deepEqual(ports.appelsChemins, ['/v1/trame'], 'jamais /v1/questionnaire sans semaine écoulée');
  assert.equal(q.version, 'normale');
  assert.equal(q.quiz.items.length, 3);
  assert.deepEqual(q.cles, []);
});

test('une version que le moteur n’a pas dite n’est pas devinée', async () => {
  const mauvais = structuredClone(F.questionnaire);
  mauvais.reponse = { version: 'sportive' };
  await assert.rejects(chaine.preparerLeQuestionnaire(moteurRejoue(TRAME, mauvais), { parametres: PARAMETRES, lundiASuivre: LUNDI_3, etat: apresSemaine2(), nolio: NOLIO_2,
    derniere: F['semaine-2'].reponse.semaine }), chaine.ReponseIllisible);
});

// ─── Une réponse après une séance faite ─────────────────────────────────────────────────────────────

test('réponse tardive : le moteur garde l’arrêt et la séance clé pas faite, la semaine n’est pas réécrite, l’état rendu est gardé', async () => {
  const reponses = F['reponse-tardive'].requete.corps.reponses;
  const ports = moteurRejoue(TRAME, F['reponse-tardive']);
  const r = await chaine.repondreEnRetard(ports, { parametres: PARAMETRES, lundi: LUNDI_2, etat: apresSemaine2(), nolio: NOLIO_2, reponses });
  assert.deepEqual(r.note, F['reponse-tardive'].reponse.note);
  assert.ok(r.note.length >= 1);
  assert.strictEqual(r.etat.courant.adaptation.en_cours, true);
  assert.deepEqual(r.etat.ecrites, apresSemaine2().ecrites, 'les semaines gardées ne bougent pas');
  assert.ok(!ports.appelsChemins.includes('/v1/semaine'), 'jamais d’écriture');
});

test('réponse tardive : une semaine que le moteur n’a pas écrite, ou une réponse qui dirait avoir réécrit, est refusée', async () => {
  const reponses = F['reponse-tardive'].requete.corps.reponses;
  await assert.rejects(chaine.repondreEnRetard(moteurRejoue(TRAME), { parametres: PARAMETRES, lundi: LUNDI_3, etat: apresSemaine2(), reponses }), /n'a pas été écrite par le moteur v1/);
  await assert.rejects(chaine.repondreEnRetard(moteurRejoue(TRAME), { parametres: PARAMETRES, lundi: LUNDI_2, etat: etatMod.ETAT_VIDE, reponses }), /n'a pas été écrite/);
  const reecrit = structuredClone(F['reponse-tardive']);
  reecrit.reponse.semaine_reecrite = true;
  await assert.rejects(chaine.repondreEnRetard(moteurRejoue(TRAME, reecrit), { parametres: PARAMETRES, lundi: LUNDI_2, etat: apresSemaine2(), nolio: NOLIO_2, reponses }), chaine.ReponseIllisible);
});

// ─── Le lundi ───────────────────────────────────────────────────────────────────────────────────────

const unePasseDuLundi = (e) => chaine.suiteDeLaReponse(e.ports, { parametres: PARAMETRES, lundi: LUNDI_2, etat: apresSemaine2(), nolio: NOLIO_1, reponses: REPONSES, reponseNouvelle: true, ...e });

test('lundi, une réponse nouvelle avant la première séance : la semaine se réécrit (même numéro, état d’avant)', async () => {
  // Nolio montre la semaine 2 posée par le moteur, aucune séance faite ; une nouvelle réponse est arrivée.
  const { nolio, reponses } = F['semaine-2-reecrite-le-lundi'].requete.corps;
  const r = await unePasseDuLundi({ ports: moteurRejoue(TRAME, F['semaine-2-reecrite-le-lundi']), nolio, reponses });
  assert.equal(r.action, 'reecrire');
  assert.equal(r.ecrite.reecrite, true);
  assert.equal(r.ecrite.numero, 2);
  assert.deepEqual(r.ecrite.etatUtilise, F['semaine-1'].reponse.etat);
  assert.equal(r.etat.ecrites.length, 2);
  assert.strictEqual(r.etat.courant, r.ecrite.etatRendu);
});

test('lundi, après une séance faite : la réponse tardive ; rien de nouveau ou Nolio illisible : rien, et aucun appel au moteur', async () => {
  const faite = { semaines: [...NOLIO_1.semaines, { lundi: LUNDI_2, seances: [{ id: 'S2-mardi', faite: true, duree_faite_min: 50 }], hooper: [], activites_vues: 1 }] };
  const reponses = F['reponse-tardive'].requete.corps.reponses;
  const tardive = await unePasseDuLundi({ ports: moteurRejoue(TRAME, { ...F['reponse-tardive'], requete: { chemin: '/v1/reponse-tardive', corps: { ...F['reponse-tardive'].requete.corps, nolio: faite } } }), nolio: faite, reponses });
  assert.equal(tardive.action, 'reponse_tardive');
  assert.ok(tardive.note.length >= 1);
  for (const cas of [{ reponseNouvelle: false }, { nolio: null }, { reponses: null }]) {
    const ports = moteurRejoue();
    const r = await unePasseDuLundi({ ports, nolio: faite, reponses, ...cas });
    assert.equal(r.action, 'rien');
    assert.deepEqual(ports.appelsChemins, [], JSON.stringify(Object.keys(cas)));
  }
});

// ─── Nolio ──────────────────────────────────────────────────────────────────────────────────────────

test('Nolio : les séances et le bandeau viennent du moteur, prêts pour l’API ; la course n’a pas de séance', async () => {
  const profil = F['nolio-seances'].requete.corps.profil;
  const r = await chaine.seancesPourNolio(moteurRejoue(F['nolio-seances']), F['semaine-2'].reponse.semaine, profil);
  assert.equal(r.seances.length, F['nolio-seances'].reponse.seances.length);
  assert.ok(r.seances.every((s) => /^S2-/.test(s.id) && s.nolio));
  assert.ok(r.cycle.name);
  await assert.rejects(chaine.seancesPourNolio({ appeler: async () => ({ seances: 'non' }) }, F['semaine-2'].reponse.semaine), chaine.ReponseIllisible);
});

function nolioFictif({ erreurA = null, bandeauDeja = false } = {}) {
  const j = { creations: [], gardes: [], notes: [] };
  j.port = {
    creer: async (id, corps, genre) => {
      j.creations.push([genre, id]);
      if (id === erreurA) return { jour_id: id, nolio_id: null, erreur: `Nolio refuse ${id}` };
      if (genre === 'cycle' && bandeauDeja) return { jour_id: id, nolio_id: null, deja: true };
      return { jour_id: id, nolio_id: `n-${id}` };
    },
    poserLaNote: async (...a) => { j.notes.push(a); },
    garder: async (e) => { j.gardes.push(e.map((x) => x.jour_id)); },
  };
  return j;
}
const SEANCES = F['nolio-seances'].reponse;

test('Nolio : le bandeau d’abord, puis chaque séance, puis la note du lundi ; chaque création est gardée au fil de l’eau', async () => {
  const j = nolioFictif();
  const r = await chaine.envoyerLaSemaine(j.port, { numero: 2, lundi: LUNDI_2, seances: SEANCES, note: ['Première ligne.', 'Deuxième.'] });
  assert.deepEqual(j.creations[0], ['cycle', 'semaine']);
  assert.deepEqual(j.creations.slice(1), SEANCES.seances.filter((s) => s.nolio).map((s) => ['seance', s.id]));
  assert.deepEqual(j.notes, [['S2:bilan', LUNDI_2, 'Ta semaine', 'Première ligne.\nDeuxième.']]);
  assert.equal(r.seances, SEANCES.seances.length);
  assert.equal(r.bandeau, true);
  assert.equal(j.gardes.length >= SEANCES.seances.length + 1, true, 'gardé à chaque création');
  assert.deepEqual(j.gardes.at(-1), ['semaine', ...SEANCES.seances.map((s) => s.id)]);
});

test('Nolio : une note vide ne se pose pas ; un bandeau déjà posé est gardé ; la course (nolio null) n’a pas de séance', async () => {
  const j = nolioFictif({ bandeauDeja: true });
  const seances = { cycle: SEANCES.cycle, seances: [...SEANCES.seances, { id: 'S2-dimanche-course', famille: 'course', nolio: null }] };
  const r = await chaine.envoyerLaSemaine(j.port, { numero: 2, lundi: LUNDI_2, seances, note: [] });
  assert.equal(j.notes.length, 0);
  assert.equal(r.note, false);
  assert.equal(r.bandeau, false);
  assert.ok(!j.creations.some(([, id]) => id === 'S2-dimanche-course'));
  assert.ok(!j.gardes.some((g) => g.includes('semaine')), 'le bandeau déjà là n’est pas à garder');
});

test('Nolio : une erreur arrête, après avoir gardé ce qui était déjà créé (la reprise ne le double pas)', async () => {
  const troisieme = SEANCES.seances[2].id;
  const j = nolioFictif({ erreurA: troisieme });
  await assert.rejects(chaine.envoyerLaSemaine(j.port, { numero: 2, lundi: LUNDI_2, seances: SEANCES, note: ['x'] }), new RegExp(`Nolio refuse ${troisieme}`));
  assert.deepEqual(j.gardes.at(-1), ['semaine', SEANCES.seances[0].id, SEANCES.seances[1].id]);
  assert.equal(j.notes.length, 0, 'pas de note sans les séances');
});

// ─── Le stockage ────────────────────────────────────────────────────────────────────────────────────

// Une base minimale en mémoire : select / eq / maybeSingle, upsert, update ; chaque appel est noté dans l'ordre.
function baseFictive({ plans = [{ id: 'p1', etat_moteur: null }], semaines = [], erreurSur = null } = {}) {
  const tables = { plans, semaines_ecrites: semaines };
  const journal = [];
  const client = {
    journal,
    from(table) {
      const filtres = [];
      let operation = 'select';
      let valeurs;
      const executer = () => {
        const lignes = tables[table].filter((l) => filtres.every(([c, v]) => l[c] === v));
        journal.push([operation, table]);
        if (erreurSur === `${operation}:${table}`) return { data: null, error: { message: 'colonne inconnue' } };
        if (operation === 'update') { for (const l of lignes) Object.assign(l, valeurs); return { data: null, error: null }; }
        if (operation === 'upsert') {
          const i = tables[table].findIndex((l) => l.plan_id === valeurs.plan_id && l.numero === valeurs.numero);
          if (i >= 0) Object.assign(tables[table][i], valeurs); else tables[table].push({ ...valeurs });
          return { data: null, error: null };
        }
        return { data: lignes, error: null };
      };
      const b = {
        select: () => b, eq: (c, v) => { filtres.push([c, v]); return b; },
        update: (v) => { operation = 'update'; valeurs = v; return b; }, upsert: (v) => { operation = 'upsert'; valeurs = v; return b; },
        maybeSingle: async () => { const r = executer(); return { data: r.data?.[0] ?? null, error: r.error }; },
        then: (ok, ko) => Promise.resolve(executer()).then(ok, ko),
      };
      return b;
    },
  };
  return { client, tables, journal };
}

test('stockage : l’état du plan et les semaines de la 9.x se lisent ; les lignes de la 8.x (sans « moteur ») sont ignorées', async () => {
  const e1 = F['semaine-1'].reponse.etat;
  const { client } = baseFictive({ plans: [{ id: 'p1', etat_moteur: F['semaine-2'].reponse.etat }], semaines: [
    { plan_id: 'p1', numero: 'S1', moteur: '9.0', etat_avant_moteur: null }, { plan_id: 'p1', numero: 'S2', moteur: '9.0', etat_avant_moteur: e1 },
    { plan_id: 'p1', numero: 'S7', moteur: null, etat_avant_moteur: null }, { plan_id: 'p2', numero: 'S1', moteur: '9.0', etat_avant_moteur: null }] });
  const e = await stockage.lireEtatDuPlan(client, 'p1');
  assert.deepEqual(e.ecrites, [{ numero: 1, etatAvant: null }, { numero: 2, etatAvant: e1 }]);
  assert.deepEqual(e.courant, F['semaine-2'].reponse.etat);
  const vide = await stockage.lireEtatDuPlan(baseFictive({ plans: [] }).client, 'inconnu');
  assert.deepEqual(vide, etatMod.ETAT_VIDE);
  // L'état d'une 8.x laissé dans la colonne de la 9.x n'est pas lu.
  const huit = await stockage.lireEtatDuPlan(baseFictive({ plans: [{ id: 'p1', etat_moteur: { semaines: [] } }] }).client, 'p1');
  assert.equal(huit.courant, null);
});

test('stockage : une écriture garde la semaine (avec son état d’avant) PUIS l’état du plan, sans toucher aux colonnes de la 8.x', async () => {
  const { client, tables, journal } = baseFictive();
  const ports = moteurRejoue(TRAME, F['semaine-1']);
  const ecrite = await chaine.ecrireLaSemaine(ports, { parametres: PARAMETRES, lundi: LUNDI_1, etat: etatMod.ETAT_VIDE });
  await stockage.garderUneEcriture(client, 'p1', ecrite, chaine.etatApresEcriture(etatMod.ETAT_VIDE, ecrite));
  assert.deepEqual(journal, [['upsert', 'semaines_ecrites'], ['update', 'plans']], 'la semaine d’abord, l’état ensuite');
  const ligne = tables.semaines_ecrites[0];
  assert.equal(ligne.numero, 'S1');
  assert.equal(ligne.moteur, '9.0');
  assert.equal(ligne.etat_avant_moteur, null);
  assert.deepEqual(ligne.donnees, ecrite.semaine);
  assert.equal(ligne.bilan, ecrite.note.join('\n') || null);
  assert.equal(ligne.branche, ecrite.branche);
  assert.deepEqual(Object.keys(ligne).filter((k) => ['etat_avant', 'revue', 'realise'].includes(k)), [], 'jamais les colonnes de la 8.x');
  assert.deepEqual(tables.plans[0].etat_moteur, ecrite.etatRendu);
  assert.ok(!('etat_ecriture' in tables.plans[0]));
  // Le tour d'après relit ce qui a été gardé et réécrit la même semaine avec le bon état.
  const relu = await stockage.lireEtatDuPlan(client, 'p1');
  assert.deepEqual(etatMod.etatPourEcrire(relu, 1), { etat: null, reecrite: true });
});

test('stockage : la deuxième semaine, puis sa réécriture, gardent l’état d’avant de la semaine', async () => {
  const { client, tables } = baseFictive();
  let etat = etatMod.ETAT_VIDE;
  for (const [lundi, echanges, nolio, reponses] of [
    [LUNDI_1, [TRAME, F['semaine-1']], null, null], [LUNDI_2, [TRAME, F['semaine-2']], NOLIO_1, REPONSES],
    [LUNDI_2, [TRAME, F['semaine-2-reecrite']], NOLIO_1, F['semaine-2-reecrite'].requete.corps.reponses]]) {
    const e = await chaine.ecrireLaSemaine(moteurRejoue(...echanges), { parametres: PARAMETRES, lundi, etat, nolio, reponses });
    etat = chaine.etatApresEcriture(etat, e);
    await stockage.garderUneEcriture(client, 'p1', e, etat);
  }
  assert.equal(tables.semaines_ecrites.length, 2, 'la réécriture remplace la ligne de la semaine 2');
  const relu = await stockage.lireEtatDuPlan(client, 'p1');
  assert.deepEqual(relu.ecrites.map((w) => w.numero), [1, 2]);
  assert.deepEqual(relu.ecrites[1].etatAvant, F['semaine-1'].reponse.etat);
  assert.deepEqual(relu.courant, F['semaine-2-reecrite'].reponse.etat);
});

test('stockage : le questionnaire posé se garde avec la semaine et se relit ; une erreur dit de vérifier la migration', async () => {
  const { client } = baseFictive({ semaines: [{ plan_id: 'p1', numero: 'S2', moteur: '9.0', etat_avant_moteur: null }] });
  assert.equal(await stockage.lireLeQuestionnairePose(client, 'p1', 2), null);
  const q = { version: 'normale', cles: [{ id: 'S2-mardi', jour: 'mardi', famille: 'seuil1', libelle: 'Mardi · Seuil 1' }], nolio_id: 'pqz_1', pose_le: '2026-12-06T10:00:00Z' };
  await stockage.garderLeQuestionnairePose(client, 'p1', 2, q);
  assert.deepEqual(await stockage.lireLeQuestionnairePose(client, 'p1', 2), q);
  const casse = baseFictive({ erreurSur: 'select:plans' });
  await assert.rejects(stockage.lireEtatDuPlan(casse.client, 'p1'), /la migration du 24\/11\/2026 \(état du moteur v1\) est-elle passée \?/);
});

test('la migration écrite crée les colonnes que le stockage lit et écrit, et n’en touche aucune de la 8.x', () => {
  const sql = readFileSync(`${RACINE}supabase/migrations/20261124120000_etat_du_moteur_v1.sql`, 'utf8');
  for (const col of ['plans add column if not exists etat_moteur jsonb', 'semaines_ecrites add column if not exists moteur text', 'semaines_ecrites add column if not exists etat_avant_moteur jsonb',
    'semaines_ecrites add column if not exists pourquoi jsonb', 'semaines_ecrites add column if not exists branche smallint', 'semaines_ecrites add column if not exists questionnaire jsonb'])
    assert.ok(sql.includes(col), col);
  assert.ok(!/\b(drop|delete|truncate)\b/i.test(sql), 'la migration n’efface rien');
  assert.ok(!/(alter table public\.\w+ (alter|drop|rename)|etat_ecriture\s+(jsonb|text))/i.test(sql), 'aucune colonne de la 8.x modifiée');
  const source = readFileSync(`${RACINE}lib/app/stockageV9.ts`, 'utf8');
  for (const col of ['etat_moteur', 'etat_avant_moteur', 'moteur', 'pourquoi', 'branche', 'questionnaire']) assert.ok(source.includes(col), col);
  assert.ok(!/etat_ecriture|etat_avant:\s|\.revue|realise/.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'le code n’écrit ni ne lit les colonnes de la 8.x');
});

test('branché seulement derrière la garde de version : hors de la chaîne du moteur v1, personne ne lit la chaîne, l’état, le stockage ni la lecture de Nolio', () => {
  const famille = ['lib/app/ecritureV9.ts', 'lib/app/etatMoteur.ts', 'lib/app/stockageV9.ts', 'lib/app/nolioV9.ts', 'lib/app/passeUnPlanV9.ts', 'lib/app/passagesV9.ts'];
  for (const nom of ['ecritureV9', 'etatMoteur', 'stockageV9', 'nolioV9']) {
    let lecteurs = [];
    try {
      lecteurs = execFileSync('grep', ['-rlE', `from ['"][^'"]*${nom}['"]|import\\([^)]*${nom}`, 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
    } catch (e) {
      if (e.status !== 1) throw e;
    }
    // La page de l'athlète du coach lit les semaines que la v1 a écrites (stockageV9, lireLesSemainesRecentes) pour « Saisir le résultat de son test » (25/11/2026, lib/app/testsASaisir.ts), derrière `v9`.
    // « Mes athlètes » (un mot par coaché, 241, lib/app/motsDesCoaches.ts) lit aussi les semaines écrites, derrière `v9`.
    // La nuit, le réalisé des semaines de la v1 (198, 199, lib/app/realiseDuV1.ts), qui ne fait rien sous la 8.x (scripts/test-realise-v9.mjs).
    const autorises = nom === 'stockageV9' ? [...famille, 'app/app/coach/athlete/[id]/page.tsx', 'lib/app/motsDesCoaches.ts', 'lib/app/realiseDuV1.ts'] : famille;
    assert.deepEqual(lecteurs.filter((f) => !autorises.includes(f)), [], nom);
  }
});
