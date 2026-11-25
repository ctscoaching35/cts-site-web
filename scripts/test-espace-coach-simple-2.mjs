#!/usr/bin/env node
/**
 * L'ESPACE COACH SIMPLE SOUS LA 9.x, DEUXIÈME SIMPLIFICATION : « une page athlète courte » (décision 220 du coach, 24/11/2026 ; reports/Application coach — revue de simplicité, 24-11.md,
 * proposition 2). Sous la 9.x, la page d'un athlète tient en quatre blocs : (a) « À faire pour lui », (b) sa carte de coureur (ce qui manque en tête, avec son geste), (c) ses objectifs (de quoi
 * vérifier que tout est rempli), (d) sa semaine qui arrive ; puis « Réglages », replié, où va tout le reste (rien ne disparaît). Sous la 8.x, RIEN ne change : les treize blocs d'avant, dans leur ordre.
 * Les écrans ne se rendent pas ici : le calcul est essayé (lib/app/pageAthleteSimple.ts) et la page est lue comme un texte (la garde `v9`, l'ordre des blocs, l'absence de doublon). Aucun réseau,
 * aucune donnée d'athlète.
 *
 *   node --test scripts/test-espace-coach-simple-2.mjs
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
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const source = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');
const sansCommentaires = (texte) => texte.split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l)).join('\n');
const lib = await import(`${RACINE}lib/app/pageAthleteSimple.ts`);
const { entreeDe, NOTE_AVANT_DE_DEMARRER } = await import(`${RACINE}lib/app/entree.ts`);
const { groupeUrgent, GROUPES_URGENT } = await import(`${RACINE}lib/app/espaceParAthlete.ts`);
const { CRITERES } = await import(`${RACINE}lib/criteres.ts`);
const {
  aFairePourLui, ceQuiManqueAuCoureur, departagerLesObjectifs, entreeDansLesReglages, lignesDEntree, motDuGeste, ORDRE_8X, ORDRE_9X, ORDRE_DES_REGLAGES_8X, ORDRE_DES_REGLAGES_9X,
  ordreDeLaPage, ordreDesReglages, ouEstLeGeste, PLACE_EN_9X, pointsAVenir, profilEstRempli, repereDeLObjectif, TEXTES_PAGE_ATHLETE, verifierObjectif,
} = lib;

const PAGE = 'app/app/coach/athlete/[id]/page.tsx';
const page = source(PAGE);
// Le corps de la page : la 9.x (jusqu'à `) : (`), puis la 8.x (jusqu'à « Réglages »), puis « Réglages ».
const i9 = page.indexOf('      {v9 ? (\n        <>\n');
const i8 = page.indexOf('      ) : (\n        <>\n', i9);
const iReglages = page.indexOf('      {/* « Réglages », replié');
assert.ok(i9 > 0 && i8 > i9 && iReglages > i8, 'la page a une branche 9.x, une branche 8.x, puis « Réglages »');
const branche9 = page.slice(i9, i8);
const branche8 = page.slice(i8, iReglages);
const reglages = page.slice(iReglages);
const avantLeCorps = page.slice(0, i9);

const point = (niveau, genre, extra = {}) => ({ niveau, genre, athlete: 'x', texte: `${genre} à voir.`, action: 'Voir ›', href: '#', cle: `${genre}:${niveau}`, ...extra });
const GPX = { montees: [{ dplus_m: 300 }], dplus_par_pente: { vallonne: 120, cote_moderee: 60, cote_raide: 20 } };
// Sa semaine habituelle comme l'objectif la garde (parametres.champs) : ses jours, sa sortie longue, son nombre de séances.
const SEMAINE = { jours_disponibles: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '4' };
const PROFIL_COMPLET = { niveau: 'intermediaire', terrain: 'pentu', jour_sl: 'dimanche', freq_hebdo: '4', jours_disponibles: ['mardi', 'jeudi', 'samedi', 'dimanche'] };
const ENTREE = (x = {}) => entreeDe({
  athleteId: 'a1', nolio: true, accord: true, programmation: 'auto', objectif: { plan_id: 'p1', ecrit: true, demarre: true, prevu: null },
  dimanchesJusqua: '2026-12-01', aujourdhui: '2026-11-24', ...x,
});

// ─── L'ordre des blocs : sous la 9.x le nouveau, sous la 8.x celui d'avant ─────────────────────────────────────────────────

test('l’ordre : quatre blocs sous la 9.x (à faire, carte de coureur, objectifs, semaine qui arrive), puis « Réglages » ; sous la 8.x, les blocs d’avant', () => {
  assert.deepEqual([...ordreDeLaPage(true)], ['a_faire', 'carte', 'objectifs', 'semaine_qui_arrive', 'reglages']);
  assert.deepEqual([...ordreDeLaPage(false)], ['demande', 'entree', 'a_faire', 'semaine_qui_arrive', 'semaine_passee', 'objectifs', 'courses_nolio', 'reperes', 'zones', 'style', 'profil', 'reglages']);
  assert.equal(ORDRE_8X.length + 1, 13, 'les douze blocs du corps, plus l’en-tête : les treize blocs de la page d’avant');
  assert.deepEqual([...ordreDesReglages(false)], ['programmation', 'app', 'nolio', 'accord', 'retirer']);
  assert.equal(ORDRE_DES_REGLAGES_9X.at(-1), 'retirer', '« Retirer cet athlète » est toujours en dernier');
  assert.equal(ORDRE_DES_REGLAGES_8X.at(-1), 'retirer');
});

test('rien ne disparaît : chaque bloc d’avant a sa place sous la 9.x, en haut ou dans « Réglages »', () => {
  assert.deepEqual(Object.keys(PLACE_EN_9X).sort(), [...ORDRE_8X].sort(), 'les treize blocs (sans l’en-tête) ont chacun une place');
  const hauts = new Set(ORDRE_9X);
  const sections = new Set(ORDRE_DES_REGLAGES_9X);
  for (const [bloc, places] of Object.entries(PLACE_EN_9X)) {
    assert.ok(places.length > 0, bloc);
    for (const p of places) assert.ok(hauts.has(p) || sections.has(p), `${bloc} → ${p}`);
  }
  // Tout ce que la 8.x montre dans « Réglages » est encore dans « Réglages ».
  for (const s of ORDRE_DES_REGLAGES_8X) assert.ok(sections.has(s), s);
  // Les quatre blocs d'avant (repères, profil, zones, style) deviennent une seule carte.
  for (const b of ['reperes', 'profil', 'zones', 'style']) assert.deepEqual([...PLACE_EN_9X[b]], ['carte']);
  // Ce qui est en haut sous la 9.x : ni la semaine passée ni ses 7 jours, ni ses courses dans Nolio, ni la revue du dimanche, ni une entrée complète.
  for (const b of ['semaine_passee', 'courses_nolio']) assert.ok(!PLACE_EN_9X[b].some((p) => hauts.has(p)), b);
  assert.deepEqual([...PLACE_EN_9X.a_faire], ['a_faire', 'a_venir', 'revue']);
  assert.deepEqual([...PLACE_EN_9X.entree], ['a_faire', 'entree']);
  // Aucune place ne reste sans bloc d'avant : chaque morceau de la 9.x vient de quelque part (sauf l'état, que les pastilles de l'en-tête d'avant donnaient).
  const utilises = new Set(Object.values(PLACE_EN_9X).flat());
  for (const h of ORDRE_9X) assert.ok(utilises.has(h), h);
  for (const s of ORDRE_DES_REGLAGES_9X) assert.ok(utilises.has(s), s);
});

test('la page 9.x suit cet ordre : (a), (b), (c), (d), puis « Réglages » ; rien d’autre en tête', () => {
  const ordre = [...branche9.matchAll(/<(PointsPourLui|CarteCoureur|ObjectifsAVerifier)\b|\{(semaine)\}/g)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(ordre, ['PointsPourLui', 'CarteCoureur', 'ObjectifsAVerifier', 'semaine']);
  const sesNoms = { PointsPourLui: 'a_faire', CarteCoureur: 'carte', ObjectifsAVerifier: 'objectifs', semaine: 'semaine_qui_arrive' };
  assert.deepEqual(ordre.map((o) => sesNoms[o]), ORDRE_9X.slice(0, 4));
  // Aucun autre bloc dans la branche : pas de carte à part, pas de revue, pas de semaine passée, pas d'entrée.
  assert.deepEqual([...branche9.matchAll(/<([A-Z][A-Za-z]*)\b/g)].map((m) => m[1]), ['PointsPourLui', 'CarteCoureur', 'ObjectifsAVerifier']);
  for (const interdit of ['Carte ', 'CarteEntree', 'TableauZones', 'StyleCoureur', 'ProfilAthlete', 'contenuRevue', 'contenuSemainePassee', 'contenuCoursesNolio']) {
    assert.ok(!branche9.includes(interdit), `${interdit} n’est pas en tête sous la 9.x`);
  }
  // L'en-tête (le nom) est avant, « Réglages » après, la barre « Athlète suivant » en dernier.
  assert.ok(avantLeCorps.includes('{a.nom}</h1>'));
  assert.ok(page.indexOf('<details id="reglages"') > i8);
  assert.ok(page.indexOf('aria-label="Athlète suivant"') > page.indexOf('<details id="reglages"'));
  // Les trois formulaires sont ceux de la page d'avant, donnés à la carte ; les zones et le style y sont repliés.
  assert.match(branche9, /formulaires=\{\{ profil: contenuProfil, test_vc: contenuTest, reperes: contenuReperes \}\} zonesEtStyle=\{zonesEtStyle\}/);
  assert.match(branche9, /<CarteCoureur lignesProfil=\{profilVide \? \[\] : lignesProfil\}/);
});

test('« Réglages » sous la 9.x : les sections dans l’ordre de ORDRE_DES_REGLAGES_9X, « Retirer cet athlète » en dernier', () => {
  const marques = {
    etat: '{v9 && sectionEtat}', programmation: '<h3 className="text-sm font-bold">Sa programmation</h3>', app: '<h3 className="text-sm font-bold">Dans l’app</h3>',
    nolio: '<h3 className="text-sm font-bold">Son compte Nolio</h3>', accord: '<h3 className="text-sm font-bold">Son accord de lecture</h3>', a_venir: '{v9 && sectionsEnPlus}',
    retirer: '<section id="retirer"',
  };
  const positions = Object.entries(marques).map(([cle, m]) => [cle, reglages.indexOf(m)]);
  for (const [cle, p] of positions) assert.ok(p > 0, `${cle} est dans « Réglages »`);
  const attendu = ORDRE_DES_REGLAGES_9X.filter((s) => s in marques);
  assert.deepEqual(positions.sort((x, y) => x[1] - y[1]).map(([cle]) => cle), attendu);
  // Ce qui s'ajoute, dans l'ordre : ce qui arrive, la revue, la semaine passée, les courses dans Nolio, les objectifs passés, la demande, l'entrée. (Les courses de préparation n'y sont plus :
  // la 9.x ne les porte pas, troisième simplification, scripts/test-espace-coach-simple-3.mjs.)
  const iPlus = page.indexOf('  const sectionsEnPlus = (');
  const plus = page.slice(iPlus, page.indexOf('  return (\n    <CadreCoach', iPlus));
  const ordreEnPlus = [
    ['a_venir', '<PointsAVenir points={pointsAVenir(points)} />'], ['revue', '<section id="revue"'], ['semaine_passee', '<section id="sa-semaine-passee"'],
    ['courses_nolio', '<section id="courses-nolio"'], ['anciens_objectifs', 'TEXTES_PAGE_ATHLETE.anciensObjectifs'],
    ['demande', 'Sa demande de coaching, du'], ['entree', '<CarteEntree entree={entree} plat />'],
  ].map(([cle, m]) => { assert.ok(plus.includes(m), cle); return [cle, plus.indexOf(m)]; });
  assert.deepEqual(ordreEnPlus.sort((x, y) => x[1] - y[1]).map(([cle]) => cle), ORDRE_DES_REGLAGES_9X.slice(ORDRE_DES_REGLAGES_9X.indexOf('a_venir'), ORDRE_DES_REGLAGES_9X.indexOf('retirer')));
  // L'état (les trois pastilles que l'en-tête d'avant donnait) est la première section.
  assert.match(page, /const sectionEtat = \(\s*<section className="py-4 space-y-3">\s*<h3 className="text-sm font-bold">\{TEXTES_PAGE_ATHLETE\.ouEnEstIl\}<\/h3>\s*<div className="flex flex-wrap gap-2">\{lesPastilles\}<\/div>/);
});

// ─── Sous la 8.x, rien ne change ─────────────────────────────────────────────────────────────────────────────────────────

test('sous la 8.x, la page garde ses blocs d’avant, dans leur ordre, sans aucun morceau de la 9.x', () => {
  const marques = [
    ['demande', "{/* Lot A2 de l'app gratuite : la demande de coaching qui a ouvert cette fiche reste lisible ici. */}"], ['entree', '{!entree.complete && ('],
    ['a_faire', '<Surtitre>À faire pour lui</Surtitre>'], ['semaine_qui_arrive', '{semaine}'], ['semaine_passee', '<Carte id="sa-semaine-passee" className="!p-5 scroll-mt-6">'],
    ['objectifs', '<Surtitre>Ses objectifs</Surtitre>'], ['courses_nolio', '<Carte id="courses-nolio" className="!p-5 space-y-3 order-2 scroll-mt-6">'],
    ['reperes', '<Surtitre>Ses repères</Surtitre>'], ['profil', '<Carte id="son-profil" className="!p-5 space-y-1 scroll-mt-6 order-6">'],
    ['zones', '<TableauZones zones={zones} lignes={lignesZones} profil={profilZones} titre="Ses zones" />'], ['style', '<StyleCoureur profil={profilZones} titre="Son style de coureur" />'],
  ];
  const positions = marques.map(([cle, m]) => { assert.ok(branche8.includes(m), cle); return [cle, branche8.indexOf(m)]; });
  const ordre = positions.map(([cle]) => cle);
  // L'ordre du code (les deux colonnes sur ordinateur) : demande, entrée, à faire, semaine qui arrive, semaine passée, objectifs, courses, repères, profil, zones, style.
  assert.deepEqual([...positions].sort((x, y) => x[1] - y[1]).map(([cle]) => cle),
    ['demande', 'entree', 'a_faire', 'semaine_qui_arrive', 'semaine_passee', 'objectifs', 'courses_nolio', 'reperes', 'profil', 'zones', 'style']);
  assert.deepEqual([...ordre].sort(), ORDRE_8X.filter((b) => b !== 'reglages').sort());
  for (const nouveau of ['PointsPourLui', 'CarteCoureur', 'ObjectifsAVerifier', 'PointsAVenir', 'sectionEtat', 'sectionsEnPlus', 'TEXTES_PAGE_ATHLETE', ' plat']) {
    assert.ok(!branche8.includes(nouveau), `la branche 8.x ne contient pas ${nouveau}`);
  }
  // Les textes de la 8.x, mot pour mot.
  for (const t of ['Rien à faire pour lui pour l’instant.', 'Sa revue du dimanche', 'Ses 7 jours', 'Ses objectifs', 'Pas encore démarré dans Nolio : la trame, ses questionnaires et sa semaine partent au départ.',
    'Saisir son test de vitesse critique', 'Modifier ses repères', 'Remplir son profil', 'Modifier son profil', 'Ce qu’il lit dans son app', 'Garder la séance d’origine', 'Relire maintenant']) {
    assert.ok(page.includes(t), t);
  }
  // Un seul bloc « À faire pour lui » d'avant, et son seul « Réglé ».
  assert.equal((page.match(/<Regle cles=/g) ?? []).length, 1);
  assert.equal((page.match(/Surtitre>À faire pour lui</g) ?? []).length, 1);
  // Les pastilles de l'en-tête sont celles d'avant sous la 8.x seulement ; leur calcul et leur texte n'ont pas bougé.
  assert.ok(avantLeCorps.includes('{!v9 && lesPastilles}'));
  assert.match(page, /\[a\.nolio_athlete_id \? 'Nolio relié' : 'Nolio à associer', Boolean\(a\.nolio_athlete_id\)\]/);
  // « Réglages » : le bloc `details` d'avant, ses cinq sections ; sa phrase d'avant sous la 8.x.
  assert.ok(reglages.includes("'sa programmation, l’app, son compte Nolio, son accord '"));
  assert.match(reglages, /\{v9 \? `\$\{TEXTES_PAGE_ATHLETE\.reglagesSous\} ` : 'sa programmation/);
  assert.equal((reglages.match(/<section/g) ?? []).length, 5, 'les cinq sections d’avant : sa programmation, l’app, son compte Nolio, son accord (s’il est reçu), « Retirer »');
});

test('chaque morceau de la 9.x est derrière `v9` : la branche, les deux sections de « Réglages », les calculs, la phrase de « Réglages »', () => {
  assert.match(page, /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/);
  assert.ok(branche9.startsWith('      {v9 ? (\n'));
  assert.match(page, /\{v9 && sectionEtat\}/);
  assert.match(page, /\{v9 && sectionsEnPlus\}/);
  assert.match(page, /const manqueCoureur = v9 \? ceQuiManqueAuCoureur\(/);
  assert.match(page, /const lignesAFaire = v9 \? aFairePourLui\(points, entree, manqueCoureur\.some\(\(m\) => m\.cle === 'profil'\), alertes, testsAFaire\) : \[\];/);
  assert.match(page, /const \{ aVenir: objectifsAVenir, passes: objectifsPasses \} = v9 \? departagerLesObjectifs\(objectifs, jour\) : \{ aVenir: \[\], passes: \[\] \};/);
  // La saison de fond et les courses de préparation ne sont plus rendues sous la 9.x (troisième simplification) : ni leur calcul ni leur section.
  assert.ok(!page.includes('saison9') && !/const preparations\b/.test(page));
  assert.match(page, /const zonesEtStyle = v9 && \(/);
  // La ligne du premier essai reste : les points de la page, sans ce que « Son entrée » dit déjà (étape 1).
  assert.match(page, /const pointsIci = v9 \? pointsDeSaPage\(points, entree\) : points;/);
  // Les composants posés plats ne le sont que sous la 9.x ; les cartes d'avant (l'app de l'athlète) ne les reçoivent jamais.
  for (const f of ['app/app/profil/page.tsx', 'app/app/objectif/nouveau/page.tsx', 'app/app/compte/page.tsx']) assert.ok(!/\bplat\b/.test(source(f)), f);
  const plats = page.split('\n').filter((x) => / plat \/>/.test(x));
  assert.equal(plats.length, 3, 'zones, style, entrée : trois, tous sous la 9.x');
  assert.ok(plats.some((l) => l.includes('<TableauZones')) && plats.some((l) => l.includes('<StyleCoureur')) && plats.some((l) => l.includes('entreeDansLesReglages(entree) && <CarteEntree entree={entree} plat />')));
  // Les deux premiers sont dans `zonesEtStyle`, calculé derrière `v9` ; le troisième est dans `sectionsEnPlus`, rendu derrière `v9`.
  assert.ok(page.indexOf('const zonesEtStyle = v9 &&') < page.indexOf('<TableauZones zones={zones} lignes={lignesZones} profil={profilZones} titre="Ses zones" plat />'));
});

test('les composants partagés gardent leur rendu d’avant par défaut (`plat` est faux) ; le rappel du départ est un seul texte', () => {
  const z = source('components/app/ZonesEtStyle.tsx');
  assert.match(z, /titre: string; saisie\?: string \| null; plat\?: boolean/);
  assert.match(z, /export function TableauZones\(\{ zones, lignes, profil, titre, saisie = null, plat = false \}/);
  assert.match(z, /const Cadre = plat \? Plat : Carte;\s*return \(\s*<Cadre className=\{plat \? '' : '!pb-2\.5'\}>/);
  assert.match(z, /export function StyleCoureur\(\{ profil, titre, plat = false \}/);
  assert.match(z, /if \(plat\) \{\s*if \(!coureur\) return null;/);
  // Les trois lignes que d'autres essais lisent n'ont pas bougé.
  assert.match(z, /export const NOTE_SEUIL2 = 'En relief, ta FC guide les blocs longs, de 6 à 15 min\. Sur les fractions courtes, elle n’a pas '\s*\+\s*'le temps de monter/);
  assert.match(z, /export const estSeuil2 = \(nom: string\) => \/seuil 2\/i\.test\(nom\);/);
  const e = source('components/app/CarteEntree.tsx');
  assert.match(e, /plat = false \}: \{ entree: Entree; accordRecu\?: \(\) => Promise<void>; plat\?: boolean \}/);
  assert.match(e, /<Cadre id="son-entree" className=\{plat \? 'py-4 space-y-3 scroll-mt-6' : '!p-5 space-y-3 scroll-mt-6'\}>/);
  assert.match(e, /\{!entree\.complete && <p className="p-3 rounded-xl bg-sand text-xs text-\[#4A4866\] leading-relaxed">\{NOTE_AVANT_DE_DEMARRER\}<\/p>\}/);
  assert.equal(NOTE_AVANT_DE_DEMARRER, 'Avant de démarrer, retire de son Nolio tes anciennes séries de questionnaire et de Hooper : les siennes partent désormais d’ici.', 'le texte d’avant, mot pour mot');
  assert.ok(!sansCommentaires(e).includes('Avant de démarrer'), 'le rappel n’est écrit qu’une fois (lib/app/entree.ts)');
});

// ─── (a) « À faire pour lui » ───────────────────────────────────────────────────────────────────────────────────────────────

test('les étapes de « Son entrée » que fait le coach sont des lignes de « À faire pour lui » : compte Nolio, accord, départ ; une ligne seulement quand le geste existe', () => {
  // Rien d'associé : le compte Nolio seulement (l'accord attend Nolio, le départ attend un objectif écrit).
  const rien = ENTREE({ nolio: false, accord: false, objectif: null });
  assert.deepEqual(lignesDEntree(rien).map((l) => l.cle), ['nolio']);
  assert.deepEqual(lignesDEntree(rien)[0].action, { texte: 'Associer ›', href: '#son-nolio' });
  // Nolio relié, accord pas reçu, objectif écrit pas démarré : l'accord (son bouton) puis le départ (son lien, avec le rappel).
  const lundi = ENTREE({ accord: false, objectif: { plan_id: 'p1', ecrit: true, demarre: false, prevu: null } });
  const lignes = lignesDEntree(lundi);
  assert.deepEqual(lignes.map((l) => l.cle), ['accord', 'depart']);
  assert.equal(lignes[0].bouton, 'accord');
  assert.equal(lignes[0].action, undefined, '« Accord reçu » est un bouton, pas un lien');
  assert.equal(lignes[0].sous, TEXTES_PAGE_ATHLETE.accordSous);
  assert.deepEqual(lignes[1].action, { texte: 'Démarrer ›', href: '/app/coach/plan/p1' });
  assert.equal(lignes[1].sous, NOTE_AVANT_DE_DEMARRER, 'le rappel du départ suit « Démarrer »');
  // Tout est fait : aucune ligne ; la carte, complète, est dans « Réglages ».
  assert.deepEqual(lignesDEntree(ENTREE()), []);
  assert.equal(ENTREE().complete, true);
  assert.equal(entreeDansLesReglages(ENTREE()), true);
  // Pas d'objectif seulement : le geste est « + Objectif » de « Ses objectifs », pas une ligne ; la carte est dans « Réglages ».
  const sansObjectif = ENTREE({ objectif: null });
  assert.deepEqual(lignesDEntree(sansObjectif), []);
  assert.equal(entreeDansLesReglages(sansObjectif), true);
  // À la main : ni objectif ni départ à faire.
  assert.deepEqual(lignesDEntree(ENTREE({ accord: false, programmation: 'main', objectif: null })).map((l) => l.cle), ['accord']);
  // Tant qu'une ligne est à faire, la carte n'est pas dans « Réglages » (une étape n'est dite qu'une fois).
  for (const e of [rien, lundi]) assert.equal(entreeDansLesReglages(e), false);
});

test('« À faire pour lui » : ses points à faire rangés comme les groupes d’« Urgent », puis les étapes de son entrée ; jamais « À venir »', () => {
  const points = [
    point('bloque', 'demarrer'), point('bloque', 'semaine', { planId: 'p1' }), point('sante', 'silence'), point('sante', 'commentaire'), point('bloque', 'nolio'),
    point('arrive', 'preparation'), point('sante', 'sensations'), point('bloque', 'saison'), point('arrive', 'suite'),
  ];
  const entree = ENTREE({ nolio: false, accord: false, objectif: null });
  const lignes = aFairePourLui(points, entree, false);
  const dits = lignes.map((l) => (l.type === 'point' ? l.point.genre : `entree:${l.ligne.cle}`));
  // « A besoin de toi » (commentaire, sensations), « Ne court plus », « Semaine pas partie », « Objectif bloqué » (demarrer, saison) ; puis l'étape du compte Nolio.
  assert.deepEqual(dits, ['commentaire', 'sensations', 'silence', 'semaine', 'demarrer', 'saison', 'entree:nolio']);
  // Le point « nolio » est remplacé par la ligne de l'entrée : un point n'est dit qu'une fois.
  assert.ok(!dits.includes('nolio'));
  // Jamais « À venir » en tête ; ils sont dans « Réglages ».
  assert.ok(lignes.every((l) => l.type === 'entree' || groupeUrgent(l.point) !== null));
  assert.deepEqual(pointsAVenir(points).map((p) => p.genre), ['preparation', 'suite']);
  // L'ordre de chaque groupe est celui reçu.
  assert.deepEqual(aFairePourLui([point('sante', 'sensations'), point('sante', 'commentaire')], ENTREE(), false).map((l) => l.point.genre), ['sensations', 'commentaire']);
  // Sans rien : une liste vide (« Rien à faire pour lui pour l’instant. »).
  assert.deepEqual(aFairePourLui([], ENTREE(), false), []);
  assert.deepEqual(aFairePourLui([point('arrive', 'suite')], ENTREE(), false), []);
});

test('un point n’est dit qu’une fois : ce que dit une ligne de l’entrée ou la carte de coureur n’est pas redit ; ce qu’aucune ne dit reste', () => {
  const entree = ENTREE({ accord: false, objectif: { plan_id: 'p1', ecrit: true, demarre: false, prevu: null } });
  const points = [point('bloque', 'accord'), point('bloque', 'demarrer'), point('bloque', 'nolio'), point('bloque', 'profil'), point('bloque', 'equipe'), point('sante', 'mot')];
  // La ligne « accord » et la ligne « départ » remplacent les points « accord » et « demarrer » ; « nolio » reste (Nolio est relié : aucune ligne ne le dit).
  const sansCarte = aFairePourLui(points, entree, false).map((l) => (l.type === 'point' ? l.point.genre : `entree:${l.ligne.cle}`));
  assert.deepEqual(sansCarte, ['mot', 'nolio', 'profil', 'equipe', 'entree:accord', 'entree:depart']);
  // La carte dit « Il manque : son profil de coureur » : le point « profil » part.
  const avecCarte = aFairePourLui(points, entree, true).map((l) => (l.type === 'point' ? l.point.genre : `entree:${l.ligne.cle}`));
  assert.deepEqual(avecCarte, ['mot', 'nolio', 'equipe', 'entree:accord', 'entree:depart']);
  // Le même contrôle, sur toutes les combinaisons : chaque point est dans « À faire pour lui », dans « À venir », ou remplacé par une ligne ou par la carte ; jamais deux fois.
  const genres = ['accord', 'demarrer', 'nolio', 'profil', 'mot', 'semaine', 'suite', 'preparation', 'silence'];
  const etats = [ENTREE({ nolio: false, accord: false, objectif: null }), ENTREE({ accord: false, objectif: { plan_id: 'p1', ecrit: true, demarre: false, prevu: null } }), ENTREE()];
  for (const e of etats) {
    for (const profilManque of [false, true]) {
      const tous = genres.map((g) => point(g === 'suite' || g === 'preparation' ? 'arrive' : g === 'mot' || g === 'silence' ? 'sante' : 'bloque', g));
      const lignes = aFairePourLui(tous, e, profilManque);
      const enTete = lignes.filter((l) => l.type === 'point').map((l) => l.point.cle);
      const aVenir = pointsAVenir(tous).map((p) => p.cle);
      assert.equal(new Set([...enTete, ...aVenir]).size, enTete.length + aVenir.length, 'jamais deux fois');
      const remplaces = tous.filter((p) => ![...enTete, ...aVenir].includes(p.cle)).map((p) => p.genre);
      const attendus = [...lignesDEntree(e).map((l) => ({ nolio: 'nolio', accord: 'accord', depart: 'demarrer' })[l.cle]), ...(profilManque ? ['profil'] : [])].sort();
      assert.deepEqual(remplaces.sort(), attendus, 'ce qui manque en tête est exactement ce qu’une ligne ou la carte dit à la place');
      // Une ligne de l'entrée n'est jamais là deux fois.
      const cles = lignes.filter((l) => l.type === 'entree').map((l) => l.ligne.cle);
      assert.equal(new Set(cles).size, cles.length);
    }
  }
});

test('« À faire pour lui » sous la 9.x : les mêmes gestes et le même « Réglé » que « À faire » de l’accueil ; l’étape de l’entrée n’a pas de « Réglé »', () => {
  const c = source('components/app/PointsPourLui.tsx');
  assert.match(c, /import \{ BOUTON_POINT, Geste, Regle \} from '\.\/PointsCoach';/);
  assert.equal((c.match(/export function Regle|function Regle/g) ?? []).length, 0, 'le « Réglé » est celui de PointsCoach.tsx');
  assert.equal((c.match(/<Regle cles=\{\[[a-z.]+\.cle\]\} \/>/g) ?? []).length, 2, 'un par ligne : « À faire pour lui » et « À venir pour lui »');
  assert.equal((c.match(/<Geste r=\{[a-z.]+\} \/>/g) ?? []).length, 2);
  assert.match(c, /\{!l\.point\.sansGeste && \(\s*<div className="flex items-center gap-2">\s*<Geste r=\{l\.point\} \/>\s*<Regle cles=\{\[l\.point\.cle\]\} \/>/);
  // La ligne de l'entrée : « Accord reçu » est un bouton (le geste de la page d'avant), « Associer » et « Démarrer » des liens ; pas de « Réglé » (elle se coche d'elle-même).
  const entree = c.slice(c.indexOf('// « son-entree »'));
  assert.ok(!entree.slice(0, entree.indexOf('</li>')).includes('<Regle'));
  assert.match(c, /<form action=\{accordRecu\}>/);
  assert.match(c, /id=\{l\.ligne\.cle === 'accord' \? 'son-entree' : undefined\}/, 'l’adresse que « Mes athlètes » donne à « Accord reçu »');
  assert.match(c, /<Carte id="a-faire"/, 'l’adresse que prend la revue du dimanche');
  // Un seul « À faire pour lui » : le titre vient du texte, une fois.
  assert.equal((c.match(/\{t\.aFaire\}/g) ?? []).length, 1);
  assert.ok(!c.includes("from './AFaire'"), 'ce n’est pas le bloc de l’accueil (components/app/AFaire.tsx) : celui-ci est celui de la page d’un athlète');
  // Les points « À venir » ont leur section dans « Réglages » (rien ne disparaît), sans rien quand il n'y en a pas.
  assert.match(c, /if \(points\.length === 0\) return null;/);
  assert.match(page, /<PointsAVenir points=\{pointsAVenir\(points\)\} \/>/);
});

// ─── (b) Sa carte de coureur ─────────────────────────────────────────────────────────────────────────────────────────────────

test('ce qui manque à sa carte : son profil de coureur, son test de vitesse critique, ses repères', () => {
  const tout = ceQuiManqueAuCoureur({ profil: {}, vcMs: null, fc1: null, fc2: null, vs1: null });
  assert.deepEqual(tout.map((m) => m.cle), ['profil', 'test_vc', 'reperes']);
  assert.deepEqual(tout.map((m) => m.texte), ['son profil de coureur', 'son test de vitesse critique', 'ses repères']);
  // Rien ne manque.
  assert.deepEqual(ceQuiManqueAuCoureur({ profil: PROFIL_COMPLET, vcMs: 3.8, fc1: 150, fc2: 172, vs1: null }), []);
  // Chacun à son tour.
  assert.deepEqual(ceQuiManqueAuCoureur({ profil: PROFIL_COMPLET, vcMs: null, fc1: 150, fc2: 172 }).map((m) => m.cle), ['test_vc']);
  assert.deepEqual(ceQuiManqueAuCoureur({ profil: PROFIL_COMPLET, vcMs: 3.8 }).map((m) => m.cle), ['reperes']);
  assert.deepEqual(ceQuiManqueAuCoureur({ profil: { ...PROFIL_COMPLET, freq_hebdo: undefined }, vcMs: 3.8, fc1: 150 }).map((m) => m.cle), ['profil']);
  // Un profil à moitié rempli compte comme pas rempli : les cinq réponses de la règle de « Profil à remplir » (lib/app/espaceCoach.ts).
  assert.equal(profilEstRempli(PROFIL_COMPLET), true);
  for (const k of Object.keys(PROFIL_COMPLET)) assert.equal(profilEstRempli({ ...PROFIL_COMPLET, [k]: undefined }), false, k);
  assert.equal(profilEstRempli({ ...PROFIL_COMPLET, jours_disponibles: [] }), false);
  assert.equal(profilEstRempli(null), false);
  // Un seul repère suffit (« pas de repères » : aucun) ; le test de référence a son propre mot.
  for (const x of [{ fc1: 150 }, { fc2: 172 }, { vs1: 3.1 }]) assert.deepEqual(ceQuiManqueAuCoureur({ profil: PROFIL_COMPLET, vcMs: 3.8, ...x }), []);
  assert.equal(ceQuiManqueAuCoureur({ profil: PROFIL_COMPLET, vcMs: 0 }).some((m) => m.cle === 'test_vc'), true, 'une VC à zéro n’est pas un test');
});

test('un seul geste par chose : dans le bandeau « Il manque » quand elle manque, sous elle sinon ; les mots sont ceux des boutons d’avant', () => {
  const cles = ['profil', 'test_vc', 'reperes'];
  for (let masque = 0; masque < 8; masque += 1) {
    const manque = cles.filter((_, i) => masque & (1 << i)).map((cle) => ({ cle, texte: cle }));
    for (const cle of cles) {
      const ou = ouEstLeGeste(cle, manque);
      assert.equal(ou, manque.some((m) => m.cle === cle) ? 'bandeau' : 'carte', `${cle} ${masque}`);
    }
  }
  assert.equal(motDuGeste('profil', [{ cle: 'profil', texte: '' }]), 'Remplir son profil');
  assert.equal(motDuGeste('profil', []), 'Modifier son profil');
  // Étape 5 (décision 220, 24/11/2026) : « vitesse critique » reste, c'est le mot du coach (comme « Seuil 1 » et « Seuil 2 »).
  assert.equal(motDuGeste('test_vc', []), 'Saisir son test de vitesse critique');
  assert.equal(motDuGeste('reperes', []), 'Modifier ses repères');
  for (const mot of ['Remplir son profil', 'Modifier son profil', 'Saisir son test de vitesse critique', 'Modifier ses repères', 'Ce qu’il lit dans son app']) {
    assert.ok(page.includes(mot), `« ${mot} » est le mot de la page d’avant (la 8.x : sa branche le garde)`);
  }
  const c = source('components/app/CarteCoureur.tsx');
  assert.match(c, /\{manque\.length > 0 && \(/, 'le bandeau n’est là que s’il manque quelque chose');
  assert.match(c, /t\.ilManque\(manque\.map\(\(m\) => m\.texte\)\)/);
  assert.match(c, /ouvert=\{m\.cle === 'profil' && profilVide\}/, 'un profil vide s’ouvre de lui-même, comme avant');
  for (const cle of cles) {
    const n = (c.match(new RegExp(`ici\\('${cle}'\\) && <GesteDeCarte cle="${cle}"`, 'g')) ?? []).length;
    assert.equal(n, 1, `${cle} : un seul geste sous la carte`);
  }
  assert.equal((c.match(/<GesteDeCarte key=\{m\.cle\}/g) ?? []).length, 1, 'et un seul dans le bandeau, pour chaque chose qui manque');
  // La carte réunit ce que quatre blocs montraient : profil (lignes du coach), repères, zones et style repliés.
  assert.match(c, /<Surtitre>\{t\.carte\}<\/Surtitre>/);
  assert.match(c, /<Surtitre as="h3" ton="gris">Ses repères<\/Surtitre>/);
  assert.match(c, /<details className="pt-3 border-t border-indigo\/\[0\.07\]">\s*<summary[^>]*>\{t\.ceQuIlLit\}<\/summary>/);
  assert.match(c, /<Carte id="son-profil"/, 'l’adresse que prennent « Son profil › » et la revue du dimanche');
});

test('la carte lit le profil comme avant : les lignes du coach (lignesDuProfil), les trois repères, les mêmes formulaires', () => {
  assert.match(page, /const lignesProfil = lignesDuProfil\(profil, true\);/);
  assert.match(page, /const profilVide = Object\.keys\(profil\)\.length === 0;/);
  for (const f of ['ProfilAthlete athleteId={a.id} profil={profil} pointDuDimanche={v9}', '<TestVcCoach athleteId={a.id} aujourdhui={jour} />', '<FormulaireValeurs athleteId={a.id}']) {
    assert.equal((page.match(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, `${f} : un seul formulaire, donné à la 8.x et à la 9.x`);
  }
  // Les textes des formulaires sont ceux d'avant (écrits une fois, dans la page).
  assert.equal((page.match(/S’il ne l’a pas fait dans l’app/g) ?? []).length, 1);
  assert.equal((page.match(/Avec eux, les séances partent avec une allure/g) ?? []).length, 1);
  // Les zones et le style : les composants de l'app de l'athlète, à plat, sans nouveau texte.
  assert.match(page, /<TableauZones zones=\{zones\} lignes=\{lignesZones\} profil=\{profilZones\} titre="Ses zones" plat \/>/);
  assert.match(page, /<StyleCoureur profil=\{profilZones\} titre="Son style de coureur" plat \/>/);
  assert.match(page, /\(zones && lignesZones\.length > 0\) \|\| profilCoureur\(profilZones\)/, 'rien à lire : pas de repli vide');
});

// ─── (c) Ses objectifs ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('un objectif complet : sa côte, ses deux critères, son tapis, sa trace ; chacun lu comme le moteur le lit', () => {
  const champs = { cote_min: '12', tapis: 'oui', critere_intensite: 'regulier', critere_denivele: 'parfois', gpx: GPX, format: 'TC', ...SEMAINE };
  const v = verifierObjectif(champs);
  assert.equal(v.complet, true);
  assert.deepEqual(v.manque, []);
  assert.equal(v.route, false);
  assert.deepEqual(v.items.map((i) => [i.cle, i.titre, i.valeur]), [
    ['cote', 'Côte', '12 min'], ['intensite', 'Intensité', 'Régulièrement'], ['mecanique', 'Mécanique', 'De temps en temps'], ['tapis', 'Tapis', 'oui'], ['gpx', 'Trace GPX', 'donnée'],
    ['semaine', 'Semaine', '4 séances · mar, jeu, sam, dim · sortie longue le dimanche'],
  ]);
  assert.equal(repereDeLObjectif(v), 'Complet');
  // Les titres des deux critères sont ceux de la fiche du coaché (lib/criteres.ts).
  assert.deepEqual(CRITERES.map((q) => q.fiche), [TEXTES_PAGE_ATHLETE.titreIntensite, TEXTES_PAGE_ATHLETE.titreMecanique]);
});

test('ce qui manque à un objectif : la liste, dans l’ordre (côte, intensité, mécanique, tapis, trace, semaine) ; « Il manque : … »', () => {
  const vide = verifierObjectif({});
  assert.equal(vide.complet, false);
  assert.deepEqual(vide.manque, ['sa côte en minutes', 'son critère d’intensité', 'son critère de mécanique', 'son tapis (oui ou non)', 'sa trace GPX', 'sa semaine habituelle']);
  assert.equal(repereDeLObjectif(vide), 'Il manque : sa côte en minutes, son critère d’intensité, son critère de mécanique, son tapis (oui ou non), sa trace GPX, sa semaine habituelle');
  assert.ok(vide.items.every((i) => i.valeur === null));
  // Un seul manque.
  const sansTrace = verifierObjectif({ cote_min: '8', tapis: 'non', critere_intensite: 'jamais', critere_denivele: 'jamais', ...SEMAINE });
  assert.deepEqual(sansTrace.manque, ['sa trace GPX']);
  assert.equal(repereDeLObjectif(sansTrace), 'Il manque : sa trace GPX');
  // Rien (null, undefined) : tout manque, rien ne plante.
  for (const rien of [null, undefined]) assert.equal(verifierObjectif(rien).manque.length, 6);
  // Les réponses ne sont pas modifiées.
  const champs = Object.freeze({ cote_min: '12', gpx: Object.freeze({ ...GPX }) });
  assert.doesNotThrow(() => verifierObjectif(champs, Object.freeze({ tapis: 'oui' })));
});

test('chaque réponse se lit comme le moteur la lit : la côte en minutes (plancher 1), le tapis oui ou non, les critères à trois réponses, la trace de la forme du contrat', () => {
  const manque = (champs, fiche) => verifierObjectif({ ...champs }, fiche).items.filter((i) => i.valeur === null).map((i) => i.cle);
  const tout = { cote_min: '12', tapis: 'oui', critere_intensite: 'jamais', critere_denivele: 'jamais', gpx: GPX, ...SEMAINE };
  // La côte : « 12 », « 12,5 », « 12 min », 0,5 (vaut 1 min) se lisent ; « douze », vide, rien non.
  for (const v of ['12', '12,5', '12 min', 12, '0,5', '0']) assert.deepEqual(manque({ ...tout, cote_min: v }), [], String(v));
  for (const v of ['douze', '', undefined, null, '500']) assert.deepEqual(manque({ ...tout, cote_min: v }), ['cote'], String(v));
  assert.equal(verifierObjectif({ ...tout, cote_min: '0,5' }).items[0].valeur, '1 min');
  // Le tapis : « oui » ou « non » ; vide ou autre chose manque.
  for (const v of ['oui', 'non']) assert.deepEqual(manque({ ...tout, tapis: v }), []);
  for (const v of ['', 'peut-être', undefined]) assert.deepEqual(manque({ ...tout, tapis: v }), ['tapis']);
  // Les critères : trois réponses ; ailleurs, ils manquent. À plat, ou dans `criteres`.
  for (const v of ['jamais', 'parfois', 'regulier']) assert.deepEqual(manque({ ...tout, critere_intensite: v, critere_denivele: v }), []);
  for (const v of ['souvent', '', undefined]) assert.deepEqual(manque({ ...tout, critere_intensite: v, critere_denivele: v }), ['intensite', 'mecanique']);
  assert.deepEqual(manque({ ...tout, critere_intensite: undefined, critere_denivele: undefined, criteres: { intensite: 'regulier', mecanique: 'jamais' } }), []);
  assert.deepEqual(manque({ ...tout, critere_intensite: undefined, critere_denivele: undefined, criteres: { intensite: 'regulier' } }), ['mecanique']);
  assert.deepEqual(manque({ ...tout, critere_intensite: undefined, critere_denivele: undefined, criteres: 'oui' }), ['intensite', 'mecanique'], 'un `criteres` qui n’est pas un objet ne dit rien');
  // La trace : la forme du contrat du moteur (lib/app/gpxV9.ts) ; sinon elle manque.
  for (const v of [undefined, null, 'trace.gpx', {}, { montees: 'x' }, { montees: [{ dplus_m: 1 }] }, { montees: [{ dplus_m: -1 }], dplus_par_pente: GPX.dplus_par_pente }]) {
    assert.deepEqual(manque({ ...tout, gpx: v }), ['gpx'], JSON.stringify(v));
  }
});

test('les critères, la côte et le tapis sont lus sur la fiche d’abord, comme le moteur v1 ; sans réponse sur la fiche, ceux de l’objectif', () => {
  const objectif = { cote_min: '5', tapis: 'non', critere_intensite: 'jamais', critere_denivele: 'jamais', gpx: GPX, ...SEMAINE };
  const fiche = { cote_min: '12', tapis: 'oui', critere_intensite: 'regulier', critere_denivele: 'parfois' };
  const v = verifierObjectif(objectif, fiche);
  assert.deepEqual(v.items.map((i) => i.valeur), ['12 min', 'Régulièrement', 'De temps en temps', 'oui', 'donnée', '4 séances · mar, jeu, sam, dim · sortie longue le dimanche']);
  // Sans réponse sur la fiche (rien, ou vide), celle de l'objectif.
  for (const vide of [null, {}, { cote_min: '', tapis: '', critere_intensite: '', critere_denivele: '' }]) {
    assert.deepEqual(verifierObjectif(objectif, vide).items.map((i) => i.valeur), ['5 min', 'Jamais', 'Jamais', 'non', 'donnée', '4 séances · mar, jeu, sam, dim · sortie longue le dimanche']);
  }
  // Ce qui manque à l'objectif mais que la fiche donne ne manque pas ; la fiche ne donne jamais la trace.
  assert.deepEqual(verifierObjectif({}, fiche).manque, ['sa trace GPX', 'sa semaine habituelle']);
  assert.deepEqual(verifierObjectif({ gpx: GPX, ...SEMAINE }, fiche).manque, []);
});

test('une course sur route (10 km, semi, marathon) : l’intensité et la semaine ; ni côte, ni mécanique, ni tapis, ni trace (le questionnaire de la route ne les pose pas)', () => {
  for (const format of ['R10', 'R21', 'R42']) {
    const v = verifierObjectif({ format });
    assert.equal(v.route, true, format);
    assert.deepEqual(v.items.map((i) => i.cle), ['intensite', 'semaine']);
    assert.deepEqual(v.manque, ['son critère d’intensité', 'sa semaine habituelle']);
    assert.equal(verifierObjectif({ format, critere_intensite: 'parfois', ...SEMAINE }).complet, true, 'complet avec l’intensité et la semaine');
    assert.equal(repereDeLObjectif(verifierObjectif({ format, critere_intensite: 'parfois', ...SEMAINE })), 'Complet');
  }
  // Un trail : les six.
  for (const format of ['TC', 'TM', 'TL', undefined]) assert.equal(verifierObjectif({ format }).items.length, 6, String(format));
});

test('ses objectifs : ceux à venir sont vérifiés, ceux dont la course est passée vont dans « Réglages » ; la page lit les réponses de l’objectif sans nouvelle lecture', () => {
  const objectifs = [{ course_date: '2026-10-01', n: 1 }, { course_date: '2026-11-24', n: 2 }, { course_date: '2027-05-01', n: 3 }];
  const { aVenir, passes } = departagerLesObjectifs(objectifs, '2026-11-24');
  assert.deepEqual(aVenir.map((o) => o.n), [2, 3], 'le jour de la course compte encore à venir (comme « prochain »)');
  assert.deepEqual(passes.map((o) => o.n), [1]);
  assert.deepEqual(departagerLesObjectifs([], '2026-11-24'), { aVenir: [], passes: [] });
  assert.match(page, /verif: parametres \? verifierObjectif\(parametres\.champs \?\? \{\}, a\.profil\) : null/, 'un objectif envoyé en entier n’a pas de réponses à vérifier');
  assert.match(page, /const parametres = parPlan\.get\(o\.plan_id\)\?\.parametres as/);
  // Aucune lecture de plus : la requête des plans est celle d'avant.
  assert.equal((page.match(/from\('plans'\)/g) ?? []).length, 2, 'la requête des plans et celle de l’intake, comme avant');
  const c = source('components/app/ObjectifsAVerifier.tsx');
  assert.match(c, /href=\{`\/app\/coach\/plan\/\$\{o\.planId\}`\}/, 'le lien vers la page de l’objectif reste');
  assert.match(c, /\+ Objectif route/);
  assert.match(c, /\+ Objectif trail/);
  assert.match(c, /\{o\.verif \? \(/);
  assert.match(c, /repereDeLObjectif\(o\.verif\)/);
  assert.ok(c.includes('<PastilleDate iso={o.date} />') && c.includes('{o.nom}'), 'la course et sa date');
  assert.ok(!/statut|distance|dplus|Démarrer dans Nolio/.test(sansCommentaires(c)), 'seulement ce qui sert à vérifier : ni statut, ni distance, ni bouton de départ');
});

// ─── Les textes : pour le coach seul, en mots simples ─────────────────────────────────────────────────────────────────────

test('les textes nouveaux : apostrophe typographique, phrases courtes, mots simples, rien du jargon du moteur', () => {
  const textes = Object.entries(TEXTES_PAGE_ATHLETE).flatMap(([cle, t]) => (typeof t === 'string' ? [[cle, t]] : [[cle, t(['sa côte en minutes', 'sa trace GPX'])]]));
  for (const [cle, t] of textes) {
    assert.ok(!/\w'\w/.test(t), `${cle} : apostrophe droite dans « ${t} »`);
    assert.ok(!/trame|pilier|charge tenue|\bmarche\b|\bdose\b|Hooper|RPE|\bEF\b|\bD\+|\bFC\b|cran|palier/i.test(t), `${cle} : jargon dans « ${t} »`);
    assert.ok(t.length < 100, `${cle} : phrase courte (${t.length})`);
    assert.equal(t, t.trim());
  }
  assert.deepEqual(textes.map(([cle]) => cle), [
    'aFaire', 'rienAFaire', 'nolio', 'accord', 'accordSous', 'depart', 'boutonAccord', 'carte', 'ilManque', 'manqueProfil', 'manqueTest', 'manqueReperes', 'remplirProfil', 'modifierProfil',
    'saisirTest', 'modifierReperes', 'ceQuIlLit', 'objectifs', 'aucunObjectif', 'complet', 'envoyeEnEntier', 'manqueCote', 'manqueIntensite', 'manqueMecanique', 'manqueTapis', 'manqueGpx', 'manqueSemaine', 'gesteTrace', 'gesteObjectif',
    'titreCote', 'titreIntensite', 'titreMecanique', 'titreTapis', 'titreGpx', 'titreSemaine', 'coursesDePreparation', 'aucuneCourse', 'ajouterUneCourse', 'traceDonnee', 'sansValeur', 'reglagesSous', 'ouEnEstIl', 'aVenir', 'anciensObjectifs',
  ]);
  // Les textes repris de la page d'avant sont ceux de la page d'avant, mot pour mot.
  // (saisirTest : « Saisir son test de vitesse critique », le même mot sous les deux moteurs.)
  for (const cle of ['aFaire', 'rienAFaire', 'remplirProfil', 'modifierProfil', 'modifierReperes', 'ceQuIlLit', 'objectifs', 'aucunObjectif']) {
    assert.ok(page.includes(TEXTES_PAGE_ATHLETE[cle]), `${cle} : « ${TEXTES_PAGE_ATHLETE[cle]} » est dans la page d’avant`);
  }
  assert.ok(page.includes('Saisir son test de vitesse critique') && TEXTES_PAGE_ATHLETE.saisirTest === 'Saisir son test de vitesse critique', '« vitesse critique » reste : c’est le mot du coach');
  assert.equal(TEXTES_PAGE_ATHLETE.ilManque(['a', 'b']), 'Il manque : a, b');
  // Chaque texte de la liste est écrit dans le fichier, et les pages ne l'écrivent pas une seconde fois en dur.
  for (const cle of ['nolio', 'accord', 'depart', 'carte', 'complet', 'ouEnEstIl']) {
    const t = TEXTES_PAGE_ATHLETE[cle];
    assert.ok(![page, source('components/app/CarteCoureur.tsx'), source('components/app/PointsPourLui.tsx'), source('components/app/ObjectifsAVerifier.tsx')].some((f) => sansCommentaires(f).includes(t)), cle);
  }
});

test('aucun texte nouveau n’est lu par un athlète : le fichier et les trois composants ne sont lus que par l’espace coach', () => {
  const grep = (motif, ...dossiers) => execFileSync('grep', ['-rlE', motif, ...dossiers], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  // « Mes athlètes » (un mot par coaché, 241) en lit la vérification de l'objectif (lib/app/motsDesCoaches.ts), pour le coach seul.
  assert.deepEqual(grep("from '[^']*pageAthleteSimple'", 'app', 'components', 'lib').concat(grep("from '\\./pageAthleteSimple'", 'lib')).sort().filter((f, i, a) => a.indexOf(f) === i), [
    PAGE, 'components/app/CarteCoureur.tsx', 'lib/app/motsDesCoaches.ts', 'components/app/CoursesDePreparation.tsx', 'components/app/ObjectifsAVerifier.tsx', 'components/app/PointsPourLui.tsx',
  ].sort());
  for (const nom of ['CarteCoureur', 'ObjectifsAVerifier', 'PointsPourLui']) {
    const lecteurs = grep(`components/app/${nom}'`, 'app', 'components', 'lib');
    assert.deepEqual(lecteurs, [PAGE], `${nom} : lu par la page de l’athlète du coach seulement`);
  }
  // Les composants partagés avec l'app de l'athlète n'ont reçu aucun texte : ils ne lisent pas le fichier des textes.
  for (const f of ['components/app/ZonesEtStyle.tsx', 'components/app/CarteEntree.tsx', 'components/app/ProfilAthlete.tsx', 'components/app/PointsCoach.tsx']) assert.ok(!source(f).includes('pageAthleteSimple'), f);
  // Les lecteurs du premier essai n'ont pas changé : ce fichier-ci n'est pas parmi ceux qui lisent les textes de la première simplification.
  assert.ok(!source('lib/app/pageAthleteSimple.ts').includes('espaceCoachSimple') && !source('lib/app/pageAthleteSimple.ts').includes('TEXTES_A_FAIRE'));
  for (const f of ['components/app/CarteCoureur.tsx', 'components/app/ObjectifsAVerifier.tsx', 'components/app/PointsPourLui.tsx']) {
    assert.ok(!source(f).includes('espaceCoachSimple') && !source(f).includes('TEXTES_A_FAIRE'), f);
  }
  // Le seul texte nouveau d'un module que l'athlète lit est une constante déplacée, la même : le rappel du départ (lib/app/entree.ts), sous la carte « Son entrée » du coach.
  const lecteursEntree = grep('NOTE_AVANT_DE_DEMARRER', 'app', 'components', 'lib');
  assert.deepEqual(lecteursEntree, ['components/app/CarteEntree.tsx', 'lib/app/entree.ts', 'lib/app/pageAthleteSimple.ts']);
  assert.deepEqual(grep('components/app/CarteEntree\'', 'app', 'components', 'lib'), [PAGE]);
});

test('aucun doublon : chaque adresse (id) de la page n’est posée qu’une fois sous la 9.x et qu’une fois sous la 8.x', () => {
  const ids = (texte) => [...texte.matchAll(/\bid="([a-z-]+)"/g)].map((m) => m[1]);
  const composants = (...noms) => noms.map((n) => source(`components/app/${n}.tsx`)).join('\n');
  const iPlus = page.indexOf('  const sectionEtat = (');
  const sectionsReglages = page.slice(iPlus, page.indexOf('  return (\n    <CadreCoach', iPlus));
  // Sous la 9.x : les composants de la branche, la semaine qui arrive, « Réglages » (ses sections d'avant, l'état, les ajouts) ; la carte d'entrée ou la ligne « accord » (jamais les deux).
  const neuf = [...ids(composants('PointsPourLui', 'CarteCoureur', 'ObjectifsAVerifier', 'CarteEntree')), ...ids(source('components/app/SemaineQuiArrive.tsx')).slice(0, 1), ...ids(reglages), ...ids(sectionsReglages)];
  assert.equal(new Set(neuf).size, neuf.length, `un doublon : ${neuf.filter((x, i) => neuf.indexOf(x) !== i)}`);
  // « son-entree » : la carte plate (Réglages) ; la ligne « accord » de « À faire pour lui » le porte aussi, et les deux s'excluent (entreeDansLesReglages).
  assert.match(source('components/app/PointsPourLui.tsx'), /id=\{l\.ligne\.cle === 'accord' \? 'son-entree' : undefined\}/);
  const accord = lignesDEntree(ENTREE({ accord: false }));
  assert.ok(accord.some((l) => l.cle === 'accord') && !entreeDansLesReglages(ENTREE({ accord: false })));
  assert.ok(entreeDansLesReglages(ENTREE()) && !lignesDEntree(ENTREE()).some((l) => l.cle === 'accord'));
  // Sous la 8.x : la branche d'avant et « Réglages » (sans les sections de la 9.x, qui n'y sont pas rendues).
  const vieux = [...ids(branche8), ...ids(reglages)];
  assert.equal(new Set(vieux).size, vieux.length, `un doublon sous la 8.x : ${vieux.filter((x, i) => vieux.indexOf(x) !== i)}`);
  // Les adresses que d'autres écrans donnent à cette page existent sous la 9.x : son-profil, a-faire, semaine-qui-arrive, son-nolio, retirer, son-entree, reglages.
  for (const ancre of ['son-profil', 'a-faire', 'son-nolio', 'retirer', 'son-entree', 'reglages']) assert.ok(neuf.includes(ancre), `#${ancre}`);
  assert.ok(source('components/app/SemaineQuiArrive.tsx').includes('id="semaine-qui-arrive"'));
  // Une chose n'est dite qu'une fois en tête : « À faire pour lui » n'est pas redit par la revue du dimanche (elle est dans « Réglages »), ni par les pastilles de l'en-tête.
  assert.ok(!branche9.includes('revue') && !avantLeCorps.slice(avantLeCorps.indexOf('  return (\n    <CadreCoach')).includes('contenuRevue'));
});

test('la garde : la page lit le moteur comme les autres composants serveur, et rien de la 9.x ne se rend sans lui', () => {
  assert.match(page, /moteurEstV9\(\)\.catch\(\(\) => false\)/);
  for (const f of ['components/app/PointsPourLui.tsx', 'components/app/CarteCoureur.tsx', 'components/app/ObjectifsAVerifier.tsx']) {
    assert.ok(!/moteurEstV9/.test(source(f)), `${f} reçoit le choix, il ne le fait pas`);
  }
  // Les composants de la 9.x ne sont rendus que dans la branche `v9 ? (` et les deux sections de « Réglages » gardées par `v9 &&`.
  const dehors = page.replace(branche9, '');
  for (const nom of ['<PointsPourLui', '<CarteCoureur', '<ObjectifsAVerifier']) assert.ok(!dehors.includes(nom), `${nom} n’est que dans la branche 9.x`);
  assert.equal((dehors.match(/<PointsAVenir/g) ?? []).length, 1);
  assert.ok(dehors.indexOf('<PointsAVenir') > dehors.indexOf('const sectionsEnPlus'));
  assert.equal(PLACE_EN_9X.a_faire.includes('a_venir'), true);
  assert.deepEqual(GROUPES_URGENT.map((g) => g.cle), ['besoin', 'silence', 'semaine', 'bloque'], 'l’ordre des quatre groupes qu’« À faire pour lui » suit');
});
