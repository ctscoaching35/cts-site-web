#!/usr/bin/env node
/**
 * LE PARCOURS A, MOMENT 3 (décision 241 du coach, 25/11/2026 ; « Parcours du coach dans l'app — proposition, 25-11 », validée « A ») : sous la 9.x, « Mes athlètes » est une liste, un coaché par ligne et un seul mot :
 * « Partie », ou la seule action la plus urgente ; un clic ouvre le bon geste. Des athlètes fictifs, sans réseau.
 *
 *   node --test scripts/test-parcours-moment3.mjs
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
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const { unMot, TEXTES_UN_MOT } = await charge('unMot');
const { lireLesMots } = await charge('motsDesCoaches');
const { ordonner } = await charge('espaceParAthlete');
const stockage = await charge('stockageV9');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

const BASE = { id: 'a1', nolio: true, accord: true, aLaMain: false, objectif: { plan_id: 'p1', demarre: true, prevu: null, partie: true }, points: [], manque: null, gesteDuManque: null, test: null, sansReponse: false };
const P = (genre, niveau, href = '/ici', externe = false) => ({ genre, niveau, href, externe });
const mot = (changement) => unMot({ ...BASE, ...changement });

test('sans rien à faire : « Partie » (sa semaine est dans Nolio) ; la ligne mène à sa page', () => {
  assert.deepEqual(mot({}), { mot: 'Partie', href: '/app/coach/athlete/a1', ton: 'ok', rang: 15 });
  assert.equal(mot({ objectif: { ...BASE.objectif, partie: null, suivante: { partie: true } } }).mot, 'Partie', 'le dimanche soir, la semaine qui arrive');
  assert.equal(mot({ objectif: { ...BASE.objectif, partie: null } }).mot, 'Rien à faire', 'rien d’écrit à ce jour : on ne dit pas « Partie »');
  assert.equal(mot({ objectif: { ...BASE.objectif, partie: false } }).mot, 'Rien à faire', '« pas partie » vient d’un point (semaine), pas de la ligne seule');
});

test('un seul mot, le plus urgent : la santé, la semaine, la demande, Nolio, l’accord, le manque, le lancement, le test, la réponse', () => {
  const tout = { points: [P('mot', 'sante', '/mot', true), P('semaine', 'bloque', '/semaine'), P('demande', 'bloque', '/demande')], nolio: false, accord: false, manque: 'sa côte en minutes', gesteDuManque: 'profil', test: { geste: 'test_vc' }, sansReponse: true };
  assert.equal(mot({ ...tout, points: [P('arret', 'sante', '/arret'), ...tout.points] }).mot, 'Arrêt signalé');
  assert.equal(mot({ ...tout, points: [P('silence', 'sante', '/silence'), ...tout.points] }).mot, 'Ne court plus');
  assert.equal(mot(tout).mot, 'Message à lire');
  for (const genre of ['hooper', 'rpe', 'retour', 'sensations', 'sous_plan', 'remontee']) assert.equal(mot({ points: [P(genre, 'sante')] }).mot, 'Signal à regarder', genre);
  const sansSante = { ...tout, points: tout.points.slice(1) };
  assert.equal(mot(sansSante).mot, 'Semaine pas partie');
  assert.equal(mot({ ...sansSante, points: [P('demande', 'bloque', '/demande')] }).mot, 'Demande à relire');
  assert.equal(mot({ ...sansSante, points: [] }).mot, 'Nolio à associer');
  assert.equal(mot({ ...sansSante, points: [], nolio: true }).mot, 'Accord à recevoir');
  assert.equal(mot({ ...sansSante, points: [], nolio: true, accord: true }).mot, 'Il manque : sa côte en minutes');
  assert.equal(mot({ test: { geste: 'test_vc' }, sansReponse: true }).mot, 'Saisir son test');
  assert.equal(mot({ sansReponse: true }).mot, 'Pas de réponse dimanche');
  assert.equal(mot({ objectif: null }).mot, 'Pas d’objectif');
  assert.equal(mot({ objectif: { ...BASE.objectif, demarre: false, partie: null } }).mot, 'À lancer');
  assert.equal(mot({ objectif: { ...BASE.objectif, demarre: false, prevu: '2027-01-04', partie: null } }).mot, 'Rien à faire', 'programmé : rien à lancer');
  assert.equal(mot({ aLaMain: true, accord: false, manque: 'x' }).mot, 'À la main', 'le coach écrit lui-même : rien de la v1');
});

test('le clic ouvre le bon geste : la fiche pour la côte et les critères, l’objectif pour la trace et la semaine, la carte pour le test, l’accord, le point', () => {
  assert.equal(mot({ manque: 'sa côte en minutes', gesteDuManque: 'profil' }).href, '/app/coach/athlete/a1#geste-profil');
  assert.equal(mot({ manque: 'sa trace GPX', gesteDuManque: 'trace' }).href, '/app/coach/athlete/a1#champ-gpx', 'sa carte, sur le champ surligné');
  assert.equal(mot({ manque: 'sa semaine habituelle', gesteDuManque: 'semaine' }).href, '/app/coach/athlete/a1#champ-semaine');
  assert.equal(mot({ accord: false }).href, '/app/coach/athlete/a1#son-entree');
  assert.equal(mot({ test: { geste: 'test_vc' } }).href, '/app/coach/athlete/a1#geste-test-vc');
  assert.equal(mot({ test: { geste: 'reperes' } }).href, '/app/coach/athlete/a1#geste-reperes');
  assert.equal(mot({ objectif: { ...BASE.objectif, demarre: false, partie: null } }).href, '/app/coach/athlete/a1#lancer-sa-preparation', 'le bouton « Lancer sa préparation »');
  assert.equal(mot({ objectif: null }).href, '/app/coach/nouveau?athlete=a1');
  const m = mot({ points: [P('mot', 'sante', 'https://nolio/x', true)] });
  assert.deepEqual([m.href, m.externe], ['https://nolio/x', true]);
});

test('la liste : dans l’ordre de Nolio (le prénom), quel que soit ce qui attend le coach (demande du coach du 26/11/2026)', async () => {
  // Des athlètes inventés ; le plus urgent est le dernier par le prénom.
  const ligne = (id, nom, a = {}, points = []) => ({ id, nom, groupe: 6, points, a: { nolio: true, accord: true, coache: true, aLaMain: false, objectif: null, ...a } });
  const lignes = ordonner([ligne('z', 'Zoé Essai', {}, [P('arret', 'sante')]), ligne('e', 'Émile Essai', { accord: false }), ligne('a', 'Ana Zèbre', { aLaMain: true }), ligne('b', 'Bao Abel')]);
  const vide = () => { const q = { select: () => q, eq: () => q, in: () => q, gte: () => q, then: (oui, non) => Promise.resolve({ data: [], error: null }).then(oui, non) }; return q; };
  const mots = await lireLesMots({ from: vide }, 'coach-1', lignes, '2026-11-26');
  assert.deepEqual(mots.map((m) => m.nom), ['Ana Zèbre', 'Bao Abel', 'Émile Essai', 'Zoé Essai']);
  assert.ok(mots[3].un.rang < mots[0].un.rang, 'le plus urgent reste à sa place dans la liste');
  // La page les montre tels quels, « À faire » au-dessus.
  const p = source('app/app/coach/page.tsx');
  assert.ok(p.indexOf('<AFaire lignes={[]} series={series} />') < p.indexOf('<ListeSimple lignes={mots} />'));
  assert.ok(source('lib/app/mesAthletes.ts').includes('const ordonnees = ordonner(lignes);'));
});

test('les mots : un seul par ligne, courts, apostrophe typographique, sans jargon', () => {
  const mots = Object.values(TEXTES_UN_MOT).map((t) => (typeof t === 'function' ? t('sa côte en minutes') : t));
  for (const t of mots) {
    assert.ok(!/\w'\w/.test(t), t);
    assert.ok(t.length < 45, `${t} : ${t.length}`);
    assert.ok(!/moteur|Hooper|RPE|trame|cran|palier|\bEF\b/i.test(t), t);
  }
});

test('« pas de réponse dimanche » : la semaine en cours écrite sans réponse lue, alors qu’un point avait été posé à la fin de la semaine d’avant', () => {
  const s = (numero, lundi, reponsesLues, pointPose, planId = 'p1') => ({ planId, numero, lundi, reponsesLues, pointPose });
  const lundi = '2026-12-07';
  assert.equal(stockage.sansReponseAuPoint([s(1, '2026-11-30', false, true), s(2, lundi, false, false)], 'p1', lundi), true);
  assert.equal(stockage.sansReponseAuPoint([s(1, '2026-11-30', false, true), s(2, lundi, true, false)], 'p1', lundi), false, 'une réponse lue');
  assert.equal(stockage.sansReponseAuPoint([s(1, '2026-11-30', false, false), s(2, lundi, false, false)], 'p1', lundi), false, 'aucun point posé');
  assert.equal(stockage.sansReponseAuPoint([s(2, lundi, false, false)], 'p1', lundi), false, 'la première semaine');
  assert.equal(stockage.sansReponseAuPoint([s(1, '2026-11-30', false, true), s(2, lundi, false, false, 'autre')], 'p1', lundi), false);
  assert.equal(stockage.sansReponseAuPoint([], 'p1', lundi), false);
});

test('les réponses des semaines récentes : leur lundi, si des réponses ont été lues et un point posé ; rien d’autre', async () => {
  const appels = [];
  const faux = { from: () => { const q = { select: (x) => { appels.push(x); return q; }, in: () => q, eq: () => q, gte: () => Promise.resolve({ error: null, data: [
    { plan_id: 'p1', numero: 'S2', lundi: '2026-12-07', reponses_lues: null, questionnaire: null }, { plan_id: 'p1', numero: 'S1', lundi: '2026-11-30', reponses_lues: { version: 'normale' }, questionnaire: { version: 'normale' } },
    { plan_id: 'p1', numero: 'x', lundi: null, reponses_lues: null, questionnaire: null }] }) }; return q; } };
  assert.deepEqual(await stockage.lireLesReponsesRecentes(faux, ['p1'], 'depuis'), [
    { planId: 'p1', numero: 2, lundi: '2026-12-07', reponsesLues: false, pointPose: false }, { planId: 'p1', numero: 1, lundi: '2026-11-30', reponsesLues: true, pointPose: true }]);
  assert.ok(appels[0].includes('reponses_lues') && !appels[0].includes('jours'), 'pas le contenu des semaines');
  assert.deepEqual(await stockage.lireLesReponsesRecentes(faux, [], 'x'), []);
});

test('la page : sous la 9.x, la liste d’un mot et le reste replié dans « Réglages » ; sans appel à Nolio de plus ; la 8.x garde son tableau', () => {
  const p = source('app/app/coach/page.tsx');
  assert.match(p, /\{v9 \? <ListeSimple lignes=\{mots\} \/> : <TableauAthletes/);
  assert.match(p, /<summary className="cursor-pointer min-h-11 flex items-center text-\[0\.8125rem\] font-bold text-teal">Réglages<\/summary>/);
  assert.match(p, /return v9 \? \(\s*<details className="space-y-5">/);
  const lecture = source('lib/app/motsDesCoaches.ts');
  assert.ok(!/listeNolio|appelNolio|athletesNolio/.test(lecture), 'de la base du site seulement');
  assert.match(lecture, /verifierObjectif\(parametres\.champs \?\? \{\}, fiche\?\.profil\)/);
  const liste = source('components/app/ListeSimple.tsx');
  assert.match(liste, /\{l\.un\.externe \? <a href=\{l\.un\.href\} target="_blank" rel="noopener"/);
});

test('sous la 9.x, la page de l’objectif n’a plus « Démarrer dans Nolio » : elle renvoie à « Lancer sa préparation » ; en 8.x rien ne change', () => {
  const p = readFileSync(`${RACINE}app/app/coach/plan/[id]/page.tsx`, 'utf8');
  assert.match(p, /\{v9\n?\s*\? !ecriture\.depart_prevu && [\s\S]{0,200}?#lancer-sa-preparation[\s\S]{0,400}?: <DemarrerNolio/);
  assert.equal((p.match(/<DemarrerNolio/g) ?? []).length, 1);
  // La page d'un athlète : l'ancien bouton ne reste que dans la branche 8.x.
  const a = readFileSync(`${RACINE}app/app/coach/athlete/[id]/page.tsx`, 'utf8');
  const i9 = a.indexOf('      {v9 ? (\n        <>\n');
  const i8 = a.indexOf('      ) : (\n        <>\n', i9);
  assert.ok(i9 > 0 && i8 > i9);
  assert.ok(!a.slice(i9, i8).includes('Démarrer dans Nolio'));
  assert.ok(a.slice(i8).includes('>Démarrer dans Nolio</Link>'), 'la 8.x garde son lien');
  const c = readFileSync(`${RACINE}components/app/CarteSavoir.tsx`, 'utf8');
  assert.ok(c.includes('<div id="champ-gpx"') && c.includes('<div id="champ-semaine"'));
});

test('« À faire pour lui » sous la 9.x : la ligne du départ dit « Lancer sa préparation › » et mène au bouton du bas ; la phrase sur les anciennes séries reste', async () => {
  const page = await import(pathToFileURL(`${RACINE}lib/app/pageAthleteSimple.ts`).href);
  const entree = { etapes: [{ cle: 'depart', titre: 'Démarré dans Nolio', fait: false, action: { texte: 'Démarrer ›', href: '/app/coach/plan/p1' } }] };
  const [ligne] = page.aFairePourLui([], entree, false);
  assert.deepEqual([ligne.ligne.action, ligne.ligne.texte], [{ texte: 'Lancer sa préparation ›', href: '#lancer-sa-preparation' }, 'Son objectif n’a pas démarré dans Nolio.']);
  assert.match(ligne.ligne.sous, /^Avant de démarrer, retire de son Nolio tes anciennes séries/);
});
