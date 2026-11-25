#!/usr/bin/env node
/**
 * L'ESPACE COACH SIMPLE SOUS LA 9.x, CINQUIÈME SIMPLIFICATION (décision 220 du coach, 24/11/2026 ; reports/Application coach — revue de simplicité, 24-11.md, § 3 « Jargon et
 * textes difficiles à lire » et proposition 5) : « les mots du coach remplacent le jargon, avec une ligne d'explication sous chaque chiffre ; les messages techniques ne
 * s'affichent plus au coach ». Sous la 8.x, RIEN ne change. Les écrans ne se rendent pas ici : le calcul est essayé (lib/app/motsDuCoach.ts) et chaque morceau est lu dans le
 * source de son écran, derrière `v9`. Aucun réseau, aucune donnée d'athlète.
 *   (a) sous la 8.x, chaque texte est celui d'avant, mot pour mot ;
 *   (b) sous la 9.x, aucun des mots du jargon n'apparaît dans les textes du coach (objet lu, phrases dites en mots du coach, règles) ;
 *   (c) l'apostrophe typographique, des phrases courtes ;
 *   et les lignes d'explication (le sens vient du code), les messages d'infrastructure, la carte « Son départ », les composants partagés avec l'app de l'athlète.
 *
 *   node --test scripts/test-espace-coach-simple-5.mjs
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
// Un texte de JSX se lit sur plusieurs lignes : les espaces (y compris insécables) et les sauts de ligne comptent pour un.
const espaces = (t) => t.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
const sansCommentaires = (texte) => texte.split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l)).join('\n');
const grep = (motif, ...dossiers) => {
  try {
    return execFileSync('grep', ['-rlE', motif, ...dossiers], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  } catch {
    return []; // grep rend 1 sans résultat
  }
};

const { MOTS_DU_COACH, REGLES_DES_MOTS, motsDuCoach, pointEnMotsDuCoach } = await import(`${RACINE}lib/app/motsDuCoach.ts`);
const { PILIERS_D_AVANT, jaugeDuPlan, calculDeLaMontee, libelleDeLaMontee, texteCourtDeLaMontee, texteDeLaMontee } = await import(`${RACINE}lib/app/tableau.ts`);
const { TEXTES_PREVISION_D_AVANT, prevision } = await import(`${RACINE}lib/app/prevision.ts`);
const { SIGNAL, etiquettes, virgule } = await import(`${RACINE}lib/app/espaceParAthlete.ts`);
const { signaux } = await import(`${RACINE}lib/app/signauxSuivi.ts`);
const { montrerLInfra, TEXTES_A_FAIRE } = await import(`${RACINE}lib/app/espaceCoachSimple.ts`);
const { TEXTES_CACHES } = await import(`${RACINE}lib/app/cacherSousLaV1.ts`);
const { TEXTES_PAGE_ATHLETE } = await import(`${RACINE}lib/app/pageAthleteSimple.ts`);
const { TEXTES_CARTE } = await import(`${RACINE}lib/app/carteSavoir.ts`);
const { TEXTES_SERIES } = await import(`${RACINE}lib/app/seriesDuSamedi.ts`);
const { NOTE_AVANT_DE_DEMARRER } = await import(`${RACINE}lib/app/entree.ts`);

const ATHLETE = 'app/app/coach/athlete/[id]/page.tsx';
const PLAN = 'app/app/coach/plan/[id]/page.tsx';
const ACCUEIL = 'app/app/coach/page.tsx';
const CHIFFRES = 'app/app/coach/chiffres/page.tsx';
const DEMANDES = 'app/app/coach/demandes/page.tsx';
const DEMANDE = 'app/app/coach/demandes/[id]/page.tsx';
const SERIES = 'app/app/coach/series-du-samedi/page.tsx';
const TABLEAU = 'components/app/TableauAthletes.tsx';
const SEMAINE = 'components/app/SemaineQuiArrive.tsx';
const LU = 'components/app/CeQuIlALu.tsx';
const athlete = source(ATHLETE);
const plan = source(PLAN);

// Les mots du jargon (reports/Application coach — revue de simplicité, 24-11.md, § 3) tels qu'ils s'écrivent à l'écran.
// « vitesse critique », « Seuil 1 » et « Seuil 2 » ne sont pas du jargon : ce sont les mots du coach.
const JARGON = /\bmarche\b|\bdose\b|\bbranche\b|\bR[1-6]\b|\bcran\b|\btrame\b|\bpilier|\bbloc\b|\bmontée\b|charge tenue|écart au prévu|Hooper|\bRPE\b|\bD\+|\bEF\b|\bSL\b|proche d’un seuil|le moteur changera/i;
const INFRA = /NOLIO_API_KEY|Supabase|Vercel|Stripe|migration|variable|à passer|clé de l|clé Stripe|Analytics|reprises de/i;

// De quoi essayer chaque fonction du jeu de mots.
const MONTEE = { fait: 0.62, prevu: 0.7, dansLesTemps: false, mesure: 'charge' };
const MONTEE_MIN = { ...MONTEE, mesure: 'minutes' };

// Tous les textes d'un jeu de mots, en clair : les fonctions sont appelées avec des valeurs de l'écran.
function rendu(m) {
  const t = {};
  const mettre = (cle, v) => { t[cle] = v; };
  m.legende.forEach(([c, texte], i) => mettre(`legende.${i}.${c}`, texte));
  mettre('legendeSous', m.legendeSous);
  mettre('entetePassee', m.entetePassee('2 nov.', '8 nov.'));
  mettre('entetePassee.point', m.entetePassee('26 oct.', '1er nov.'));
  m.legendeDesChiffres.forEach((x, i) => mettre(`legendeDesChiffres.${i}`, x));
  mettre('passee.sansEffort', m.passee.sansEffort);
  mettre('passee.tenueSous', m.passee.tenueSous);
  mettre('passee.fatigue.sans', m.passee.fatigue(8, null));
  mettre('passee.fatigue.hausse', m.passee.fatigue(8, 'en hausse'));
  for (const [cle, x] of [['charge', MONTEE], ['minutes', MONTEE_MIN]]) {
    mettre(`montee.libelle.${cle}`, m.montee.libelle(x));
    mettre(`montee.suite.${cle}`, m.montee.suite(x));
    mettre(`montee.calcul.${cle}`, m.montee.calcul(x));
    mettre(`montee.court.${cle}`, m.montee.court(x));
  }
  mettre('montee.sous', m.montee.sous);
  mettre('piliers.assiduite', m.piliers.assiduite('87 %', 12, 14));
  mettre('piliers.sortiesLongues.1', m.piliers.sortiesLongues(1, 3, '2 h'));
  mettre('piliers.sortiesLongues.2', m.piliers.sortiesLongues(2, 3, 'pas encore'));
  mettre('piliers.cles.1', m.piliers.cles(1, 3, false));
  mettre('piliers.cles.2', m.piliers.cles(2, 3, true));
  mettre('piliers.fraicheur.vrai', m.piliers.fraicheur(true));
  mettre('piliers.fraicheur.faux', m.piliers.fraicheur(false));
  mettre('prevision.sousSoixante', m.prevision.sousSoixante);
  mettre('prevision.plusDur', m.prevision.plusDur);
  for (const [genre, texte] of Object.entries(m.etiquettes)) mettre(`etiquettes.${genre}`, texte);
  for (const [cle, texte] of Object.entries(m.reperes)) mettre(`reperes.${cle}`, texte);
  mettre('tuiles.tenue', m.tuiles.tenue);
  mettre('tuiles.fatigue.sans', m.tuiles.fatigue(null));
  mettre('tuiles.fatigue.hausse', m.tuiles.fatigue('en hausse'));
  mettre('tuiles.sansEffort', m.tuiles.sansEffort);
  mettre('tuiles.explicationTenue', m.tuiles.explicationTenue);
  mettre('tuiles.explicationFatigue', m.tuiles.explicationFatigue);
  mettre('revue.sansEffort', m.revue.sansEffort);
  mettre('revue.tenue', m.revue.tenue(87));
  mettre('septJours.fatigue.moyenne', m.septJours.fatigue(12, '8,8'));
  mettre('septJours.fatigue.sans', m.septJours.fatigue(12, null));
  mettre('septJours.explication', m.septJours.explication);
  mettre('test.manque', m.test.manque);
  mettre('test.geste', m.test.geste);
  mettre('reperesAide', m.reperesAide);
  mettre('accordLu', m.accordLu);
  mettre('dplus', m.dplus('1 200'));
  mettre('cibles.fc1', m.cibles.fc1('150'));
  mettre('cibles.vs1', m.cibles.vs1('6:00'));
  mettre('cibles.vc', m.cibles.vc('4:10'));
  mettre('cibles.fc2', m.cibles.fc2('172'));
  mettre('cibles.liste', m.cibles.liste('x'));
  mettre('cibles.sans', m.cibles.sans);
  mettre('semaines.sansEffort', m.semaines.sansEffort);
  mettre('semaines.tenue', m.semaines.tenue(87));
  mettre('semaines.charge', m.semaines.charge('1 240'));
  mettre('semaines.fatigue', m.semaines.fatigue(8));
  m.semaines.legende.forEach((x, i) => mettre(`semaines.legende.${i}`, x));
  mettre('carteDepart', m.carteDepart);
  mettre('effortVise', m.effortVise(6));
  mettre('bloc', m.bloc('Bloc fondations'));
  mettre('reponse.libelle.dose', m.reponse.libelle('Dose'));
  mettre('reponse.libelle.autre', m.reponse.libelle('Sécurité'));
  mettre('reponse.texte', m.reponse.texte('Tempo à la marche suivante.'));
  mettre('lu.sansEffort', m.lu.sansEffort);
  mettre('lu.tenue', m.lu.tenue(87));
  mettre('lu.sansEffortLu', m.lu.sansEffortLu);
  mettre('lu.colonneEffort', m.lu.colonneEffort);
  for (const [cle, texte] of Object.entries(m.lu.famille)) mettre(`lu.famille.${cle}`, texte);
  mettre('lu.pasLues', m.lu.pasLues);
  mettre('lu.explique', m.lu.explique);
  mettre('chiffres.coachingsSous', m.chiffres.coachingsSous);
  mettre('chiffres.coachingsDetail.a_brancher', m.chiffres.coachingsDetail('a_brancher'));
  mettre('chiffres.coachingsDetail.cle', m.chiffres.coachingsDetail('cle_posee'));
  mettre('chiffres.tunnel', m.chiffres.tunnel);
  mettre('chiffres.retouches', m.chiffres.retouches);
  for (const [cle, texte] of Object.entries(m.chiffres.famille)) mettre(`chiffres.famille.${cle}`, texte);
  for (const [cle, texte] of Object.entries(m.demandes)) mettre(`demandes.${cle}`, texte);
  m.series.marche.forEach((x, i) => mettre(`series.marche.${i}`, x));
  mettre('enMots.identite', m.enMots('Un texte sans jargon.'));
  return t;
}

// ─── (a) La 8.x : les mots d'avant, mot pour mot ──────────────────────────────────────────────────────────────────

// Copiés de ce que les écrans disaient avant cette étape (HEAD du 24/11/2026, 21 h 23 : TableauAthletes.tsx, page de l'athlète, page de l'objectif, « Chiffres », « Demandes », CeQuIlALu,
// SemaineQuiArrive, lib/app/tableau.ts, lib/app/prevision.ts, lib/app/seriesDuSamedi.ts) ; rien n'y est refait.
const AVANT = {
  'legende.0.rouge': 'le moteur changera sa semaine', 'legende.1.orange': 'proche d’un seuil', 'legende.2.vert': 'elle suit le plan', 'legende.3.rien': 'rien de lu',
  legendeSous: null,
  entetePassee: 'Séances, charge tenue et Hooper : semaine du 2 nov. au 8 nov..'.replace('8 nov..', '8 nov.'),
  'entetePassee.point': 'Séances, charge tenue et Hooper : semaine du 26 oct. au 1er nov.',
  'passee.sansEffort': 'sans RPE', 'passee.tenueSous': null, 'passee.fatigue.sans': '8', 'passee.fatigue.hausse': '8 · en hausse',
  'montee.libelle.charge': '62\u00a0% de la charge de ta préparation réalisée', 'montee.libelle.minutes': '62\u00a0% du volume de ta préparation réalisé',
  'montee.suite.charge': 'de la charge de ta préparation réalisée', 'montee.suite.minutes': 'du volume de ta préparation réalisé',
  'montee.calcul.charge': 'Chaque séance faite compte selon sa durée et son intensité. 100\u00a0%, c’est toute la charge prévue jusqu’à ta course\u00a0: ce chiffre ne fait que monter.',
  'montee.calcul.minutes': 'Chaque séance faite compte pour sa durée. 100\u00a0%, c’est tout le volume prévu jusqu’à ta course\u00a0: ce chiffre ne fait que monter.',
  'montee.court.charge': 'Charge réalisée 62\u00a0% · prévue à ce jour 70\u00a0%', 'montee.court.minutes': 'Volume réalisé 62\u00a0% · prévu à ce jour 70\u00a0%', 'montee.sous': null,
  'piliers.assiduite': 'charge tenue : 87 % de la prévue · 12 séances faites sur 14',
  'piliers.sortiesLongues.1': '1 tenue sur 3 · ta plus longue : 2 h', 'piliers.sortiesLongues.2': '2 tenues sur 3 · ta plus longue : pas encore',
  'piliers.cles.1': '1 réussie sur 3', 'piliers.cles.2': '2 réussies sur 3, au bon effort',
  'piliers.fraicheur.vrai': 'Ta forme du dimanche est revenue dans ta zone habituelle.',
  'piliers.fraicheur.faux': 'Ta forme du dimanche reste au-dessus de ta zone habituelle : dors, mange, garde l’affûtage tel quel.',
  'prevision.sousSoixante': 'Si sa charge reste sous 60 % : ses séances clés refont la même marche',
  'prevision.plusDur': 'Si c’est une séance clé : la suivante refait la même marche',
  'reperes.fc1': 'FC au seuil 1', 'reperes.vs1': 'Allure au seuil 1', 'reperes.vc': 'Vitesse critique', 'reperes.fc2': 'FC au seuil 2',
  'tuiles.tenue': 'charge tenue', 'tuiles.fatigue.sans': 'Hooper', 'tuiles.fatigue.hausse': 'Hooper · en hausse', 'tuiles.sansEffort': 'sans RPE',
  'tuiles.explicationTenue': null, 'tuiles.explicationFatigue': null,
  'revue.sansEffort': 'sans RPE', 'revue.tenue': 'tenue (87 %)',
  'septJours.fatigue.moyenne': ' · Hooper 12 (moyenne 8,8)', 'septJours.fatigue.sans': ' · Hooper 12', 'septJours.explication': null,
  'test.manque': 'son test de vitesse critique', 'test.geste': 'Saisir son test de vitesse critique',
  reperesAide: 'Avec eux, les séances partent avec une allure sur le plat ou une FC, puis le RPE ; sans eux, au RPE, et le test s’écrit à la place d’une séance. Gardés seulement avec son accord de lecture.',
  accordLu: 'ses séances, son RPE et son Hooper sont lus dans Nolio, et ses repères gardés sur sa fiche.',
  dplus: '1 200 m D+',
  'cibles.fc1': 'FC seuil 1 150', 'cibles.vs1': 'allure seuil 1 6:00/km', 'cibles.vc': 'VC 4:10/km', 'cibles.fc2': 'FC seuil 2 172', 'cibles.liste': 'Cibles : x.',
  'cibles.sans': 'Sans valeurs : cibles au RPE.',
  'semaines.sansEffort': 'sans RPE', 'semaines.tenue': 'charge tenue 87\u00a0%', 'semaines.charge': 'charge 1 240', 'semaines.fatigue': 'Hooper 8',
  carteDepart: true,
  effortVise: 'RPE 6', bloc: 'Bloc fondations', 'reponse.libelle.dose': 'Dose', 'reponse.libelle.autre': 'Sécurité', 'reponse.texte': 'Tempo à la marche suivante.',
  'lu.sansEffort': 'sans RPE', 'lu.tenue': 'charge tenue : 87 % de la prévue', 'lu.sansEffortLu': ' (sans RPE lu : la charge compte le RPE prévu)', 'lu.colonneEffort': 'RPE',
  'lu.pasLues': 'Ses séances de qualité n’ont pas pu être lues : la marche suit le plan.',
  'lu.explique': 'Ses séances de qualité faites des 4 dernières semaines, classées par leur structure. La dernière de chaque famille, quand c’est la tienne, fixe la marche.',
  'chiffres.coachingsSous': 'coachings · à brancher sur ton Stripe',
  'chiffres.coachingsDetail.a_brancher': 'Ils se liront dans ton Stripe, en totaux par mois, avec une clé restreinte en lecture seule que tu crées dans Stripe et colles dans Vercel. Aujourd’hui, le site ne lit rien des coachings.',
  'chiffres.coachingsDetail.cle': 'Ta clé Stripe en lecture seule est posée : la lecture des coachings arrive à la prochaine étape. Aujourd’hui, le site ne lit rien des coachings.',
  'chiffres.tunnel': 'Combien de personnes passent chaque étape, semaine par semaine. Les étapes sont comptées sans aucune donnée personnelle, une fois par visite. Les visites du site et leur provenance (Instagram, recherche…) sont dans Vercel, onglet Analytics.',
  'chiffres.retouches': 'Comptées chaque nuit sur la semaine en cours et la précédente. Semaines sans retouche : les semaines envoyées où rien n’a été modifié, déplacé, supprimé ni ajouté. Modifiée : sa révision a changé dans Nolio, son contenu ou son jour (Nolio change la révision d’une séance seulement déplacée). Dont déplacées : celles qui ont aussi changé de jour (comptées depuis le 16/11). Ajoutées : les séances de course que tu as posées dans une semaine écrite par le moteur. Durée des modifiées : leur durée dans Nolio par rapport à la durée prévue (−15 % : tu les raccourcis).',
  'demandes.illisibles': 'Les demandes ne se lisent pas : la migration demandes_coaching est-elle passée dans Supabase ?',
  'demandes.ficheCree': 'Une fiche de coaché est créée à ce nom, avec sa vitesse critique du profil gratuit ; ses FC n’y sont reprises que si son consentement FC est donné.',
  'demandes.dplusPossible': 'D+ possible', 'demandes.vitesseCritique': 'Vitesse critique', 'demandes.fc1': 'FC au seuil 1', 'demandes.fc2': 'FC au seuil 2',
  'series.marche.0': 'Ouvre Nolio, l’agenda de l’athlète.', 'series.marche.1': 'Au jour indiqué, ouvre le questionnaire « Ta semaine prochaine » et supprime-le, lui seul.',
  'series.marche.2': 'Ne retire pas « Ton point du dimanche » ni le Hooper : ils restent.',
  'enMots.identite': 'Un texte sans jargon.',
};

test('sous la 8.x, chaque texte est celui d’avant, mot pour mot ; `motsDuCoach(v9)` choisit entre les deux jeux', () => {
  assert.deepEqual(Object.keys(MOTS_DU_COACH), ['ancien', 'simple']);
  assert.equal(motsDuCoach(false), MOTS_DU_COACH.ancien);
  assert.equal(motsDuCoach(true), MOTS_DU_COACH.simple);
  assert.deepEqual(rendu(MOTS_DU_COACH.ancien), AVANT);
  // Les deux jeux disent les mêmes choses : mêmes clés, texte pour texte.
  assert.deepEqual(Object.keys(rendu(MOTS_DU_COACH.simple)).sort().filter((k) => !/^(legendeDesChiffres|semaines\.legende|etiquettes|lu\.famille|chiffres\.famille)/.test(k)),
    Object.keys(rendu(MOTS_DU_COACH.ancien)).sort().filter((k) => !/^(legendeDesChiffres|semaines\.legende|etiquettes|lu\.famille|chiffres\.famille)/.test(k)));
});

test('les mots d’avant qui existent ailleurs ne sont pas recopiés : ce sont ceux du fichier où ils vivent', () => {
  const a = MOTS_DU_COACH.ancien;
  assert.equal(a.piliers, PILIERS_D_AVANT);
  assert.equal(a.prevision, TEXTES_PREVISION_D_AVANT);
  assert.equal(a.montee.calcul, calculDeLaMontee);
  assert.equal(a.montee.court, texteCourtDeLaMontee);
  assert.equal(a.montee.libelle(MONTEE), libelleDeLaMontee(MONTEE, true));
  assert.equal(a.montee.suite(MONTEE), texteDeLaMontee(MONTEE, true));
  assert.equal(a.series.marche, TEXTES_SERIES.marche);
  // Ce que les composants de l'athlète lisent n'a pas bougé : leurs mots par défaut sont ceux d'avant (lib/app/tableau.ts, test-montee.mjs).
  assert.equal(libelleDeLaMontee(MONTEE), '62\u00a0% de la charge de ton plan réalisée');
  assert.equal(texteDeLaMontee(MONTEE, true), 'de la charge de ta préparation réalisée');
});

test('les mots d’avant qui restent écrits dans un écran y sont mot pour mot, et sa branche 8.x les garde', () => {
  const a = MOTS_DU_COACH.ancien;
  // La page de l'athlète garde, dans sa branche 8.x, le bouton et les deux phrases d'avant (écrits une fois, dans la page).
  assert.ok(espaces(athlete).includes(espaces(a.reperesAide)));
  assert.ok(athlete.includes(a.test.geste));
  assert.ok(espaces(athlete).includes('Rien de lu pour l’instant. Ses séances et son Hooper des 7 derniers jours se lisent dans Nolio chaque soir, dès qu’un objectif ou une saison a démarré. « Relire maintenant » les lit tout de suite.'));
  // Les phrases de « Chiffres », de « Demandes » et de « Séries du samedi » d'avant sont celles du dépôt avant cette étape : aucune n'a été refaite (essais de l'étape 1 et de test-series-du-samedi.mjs).
  assert.ok(source('lib/app/seriesDuSamedi.ts').includes(a.series.marche[2].replace('ni le Hooper : ils restent', 'ni le Hooper : ils restent')));
  // La phrase d'avant de « Demandes » reste la phrase qui part au journal du serveur : un essai la lit dans l'objet.
  assert.match(source(DEMANDES), /montrerLInfra\(v9, MOTS_DU_COACH\.ancien\.demandes\.illisibles\)/);
});

// ─── (b) La 9.x : aucun mot du jargon dans les textes du coach ────────────────────────────────────────────────────

test('sous la 9.x, aucun des mots du jargon n’est dans les textes du coach ; chaque texte d’avant qui en avait un est remplacé', () => {
  const avant = rendu(MOTS_DU_COACH.ancien);
  const apres = rendu(MOTS_DU_COACH.simple);
  for (const [cle, texte] of Object.entries(apres)) {
    if (typeof texte === 'string') assert.ok(!JARGON.test(texte), `${cle} : jargon dans « ${texte} »`);
  }
  // Les textes d'avant qui avaient du jargon : remplacés. Ceux qui n'en avaient pas : gardés, ou dits plus simplement.
  let remplaces = 0;
  for (const [cle, texte] of Object.entries(avant)) {
    if (typeof texte === 'string' && JARGON.test(texte)) {
      assert.notEqual(apres[cle], texte, `${cle} : « ${texte} » est resté`);
      remplaces += 1;
    }
  }
  assert.ok(remplaces >= 30, `trente textes au moins remplacés (${remplaces})`);
  // Les deux phrases d'un autre fichier que le jeu de mots (étapes 2 et 3) : sans jargon, elles aussi.
  for (const t of [...Object.values(TEXTES_CACHES), ...Object.values(TEXTES_PAGE_ATHLETE).filter((x) => typeof x === 'string'), ...Object.values(TEXTES_CARTE), ...Object.values(TEXTES_A_FAIRE).filter((x) => typeof x === 'string')]) {
    assert.ok(!JARGON.test(t), `jargon dans « ${t} »`);
  }
  assert.equal(TEXTES_PAGE_ATHLETE.saisirTest, MOTS_DU_COACH.simple.test.geste);
  assert.equal(TEXTES_PAGE_ATHLETE.saisirTest, 'Saisir son test de vitesse critique');
  assert.equal(TEXTES_CARTE.test, 'Son dernier test de vitesse critique', '« vitesse critique » reste le mot du coach');
});

test('les mots du coach de chaque remplacement : ceux de la décision (« semaine tenue à 87 % du prévu », « fatigue déclarée », « effort ressenti », « dénivelé », « endurance », « sortie longue »)', () => {
  const s = MOTS_DU_COACH.simple;
  assert.equal(s.semaines.tenue(87), 'semaine tenue à 87\u00a0% du prévu');
  assert.equal(s.lu.tenue(87), 'semaine tenue à 87 % du prévu');
  assert.equal(s.semaines.fatigue(8), 'fatigue déclarée 8');
  assert.equal(s.tuiles.fatigue('en hausse'), 'fatigue déclarée · en hausse');
  assert.equal(s.septJours.fatigue(12, '8,8'), ' · fatigue déclarée 12 (sa moyenne : 8,8)');
  assert.equal(s.effortVise(6), 'effort visé 6');
  assert.equal(s.passee.sansEffort, 'effort non noté');
  assert.equal(s.dplus('1 200'), '1 200 m de dénivelé');
  assert.equal(s.lu.famille.ef, 'Endurance');
  assert.equal(s.chiffres.famille.ef, 'Endurance');
  assert.deepEqual([s.lu.famille.seuil1, s.lu.famille.seuil2], ['Seuil 1', 'Seuil 2']);
  assert.deepEqual([s.reperes.fc1, s.reperes.vc, s.reperes.fc2], ['FC au seuil 1', 'Vitesse critique', 'FC au seuil 2']);
  assert.equal(s.reponse.libelle('Dose'), 'En résumé');
  assert.equal(s.reponse.libelle('  dose '), 'En résumé');
  assert.equal(s.reponse.libelle('Sécurité'), 'Sécurité');
  assert.equal(s.bloc('Bloc fondations'), 'Fondations');
  assert.equal(s.bloc('Récupération'), 'Récupération');
  // La légende : les deux mots du jargon (« le moteur changera sa semaine », « proche d'un seuil ») n'y sont plus ; les quatre couleurs y sont toujours, dans le même ordre.
  assert.deepEqual(s.legende.map(([c]) => c), ['rouge', 'orange', 'vert', 'rien']);
  assert.deepEqual(s.legende.map(([c]) => c), MOTS_DU_COACH.ancien.legende.map(([c]) => c));
});

test('les chiffres de la montée disent les mêmes nombres, en mots du coach', () => {
  const s = MOTS_DU_COACH.simple.montee;
  const chiffres = (t) => t.replace(/\u00a0/g, ' ').match(/\d+/g);
  assert.deepEqual(chiffres(s.court(MONTEE)), ['62', '70']);
  assert.deepEqual(chiffres(MOTS_DU_COACH.ancien.montee.court(MONTEE)), ['62', '70']);
  assert.deepEqual(chiffres(s.libelle(MONTEE)), ['62']);
  assert.match(s.court(MONTEE_MIN), /volume/);
  assert.match(s.court(MONTEE), /charge/);
  assert.ok(s.libelle(MONTEE).startsWith('62\u00a0%'));
  for (const m of [MONTEE, MONTEE_MIN]) {
    assert.ok(!/ta |ton |ton plan/i.test(`${s.libelle(m)} ${s.suite(m)} ${s.calcul(m)} ${s.court(m)}`), 'au coach, pas « ta préparation »');
  }
});

// ─── (c) L'apostrophe typographique, des phrases courtes ──────────────────────────────────────────────────────────

test('les textes du coach : apostrophe typographique, phrases courtes, rien de superflu autour', () => {
  const textes = Object.entries(rendu(MOTS_DU_COACH.simple)).filter(([, t]) => typeof t === 'string');
  const nouveaux = [...Object.entries(TEXTES_CACHES), ['reperesAide', MOTS_DU_COACH.simple.reperesAide]];
  assert.ok(textes.length >= 70, `soixante-dix textes au moins (${textes.length})`);
  for (const [cle, t] of [...textes, ...nouveaux]) {
    assert.ok(!/\w'\w/.test(t), `${cle} : apostrophe droite dans « ${t} »`);
    // Une phrase se termine par . ? ! ou ; : aucune ne dépasse 140 caractères.
    for (const phrase of t.split(/(?<=[.?!;])\s+/)) assert.ok(phrase.length <= 140, `${cle} : phrase de ${phrase.length} caractères : « ${phrase} »`);
    // Les fragments (« 87 % », « du prévu ») peuvent commencer par une espace : ceux de septJours en ont besoin (« · fatigue … »).
    if (!cle.startsWith('septJours.fatigue') && !cle.startsWith('lu.sansEffortLu')) assert.equal(t, t.trim(), cle);
  }
});

// ─── Les règles : la même phrase, en mots du coach ────────────────────────────────────────────────────────────────

// Ce que les lectures du site écrivent, tel que le code l'écrit (chaque phrase est lue dans son fichier : le corpus ne peut pas dériver de lui).
const CORPUS = [
  // lib/app/espaceCoach.ts : les points de santé
  ['lib/app/espaceCoach.ts', 'RPE à revoir avec lui : séance clé jugée trop dure deux semaines de suite.'],
  ['lib/app/espaceCoach.ts', 'Pas de retour depuis deux semaines : ses séances sont faites, sans aucun RPE noté.'],
  ['lib/app/espaceCoach.ts', 'Sous le plan depuis trois semaines : moins de 80 % de la charge prévue tenue, trois semaines de suite.'],
  // lib/app/entree.ts : l'entrée
  ['lib/app/entree.ts', 'Envoie-lui le message d’accord dans Nolio : ses séances faites, son RPE et son Hooper remontent alors. Quand il répond oui, coche « Accord reçu » : sa réponse écrite reste ta preuve.'],
  ['lib/app/entree.ts', 'Questionnaire et Hooper : ils partent au passage de 18 h 30, rien à faire.'],
  ['lib/app/entree.ts', 'Questionnaire et Hooper : ils partiront une fois Nolio relié.'],
  ['lib/app/entree.ts', NOTE_AVANT_DE_DEMARRER],
];

test('les règles : chaque phrase du corpus est écrite dans son fichier, et sort sans jargon, avec le même sens', () => {
  const enMots = MOTS_DU_COACH.simple.enMots;
  for (const [fichier, phrase] of CORPUS) assert.ok(espaces(source(fichier)).includes(espaces(phrase)), `${fichier} : « ${phrase} »`);
  const attendu = {
    'RPE à revoir avec lui : séance clé jugée trop dure deux semaines de suite.': 'effort ressenti à revoir avec lui : séance clé jugée trop dure deux semaines de suite.',
    'Pas de retour depuis deux semaines : ses séances sont faites, sans aucun RPE noté.': 'Pas de retour depuis deux semaines : ses séances sont faites, sans aucun effort ressenti noté.',
    'Sous le plan depuis trois semaines : moins de 80 % de la charge prévue tenue, trois semaines de suite.': 'Sous le plan depuis trois semaines : moins de 80 % du prévu tenu, trois semaines de suite.',
    [NOTE_AVANT_DE_DEMARRER]: 'Avant de démarrer, retire de son Nolio tes anciennes séries de questionnaire et de fatigue : les siennes partent désormais d’ici.',
    'Questionnaire et Hooper : ils partent au passage de 18 h 30, rien à faire.': 'Questionnaire et question de fatigue : ils partent au passage de 18 h 30, rien à faire.',
  };
  for (const [avant, apres] of Object.entries(attendu)) assert.equal(enMots(avant), apres);
  assert.equal(enMots(CORPUS[3][1]).includes('son effort ressenti et sa fatigue déclarée remontent alors'), true);
  for (const [, phrase] of CORPUS) {
    assert.ok(!JARGON.test(enMots(phrase)), `jargon dans « ${enMots(phrase)} »`);
    assert.equal(enMots(enMots(phrase)), enMots(phrase), 'dire deux fois ne change rien');
  }
  // Sous la 8.x, rien ne passe par ces règles.
  for (const [, phrase] of CORPUS) assert.equal(MOTS_DU_COACH.ancien.enMots(phrase), phrase);
});

test('les signaux du soir : le détail d’un Hooper, d’un RPE trop haut et de mauvaises sensations, lus sur les vrais calculs, sortent en mots du coach', () => {
  const seuils = { jours: 7, rpe_au_dessus: 2, sensations_max: 2, hooper_semaines: 3, hooper_ecart: 3 };
  const prevues = [{ id: 'p1', name: 'Seuil 1', date_start: '2026-11-16', rpe: 5 }];
  const realisees = [{ id: 'r1', name: 'Seuil 1', date_start: '2026-11-16', planned: 'p1', debrief: { rpe: 8, feeling: 2 } }];
  const hooper = [['2026-10-26', 8], ['2026-11-02', 9], ['2026-11-09', 8], ['2026-11-16', 14]].map(([d, v], i) => ({ id: `h${i}`, date_start: d, value: v }));
  const lu = signaux(prevues, realisees, hooper, seuils, '2026-11-17');
  const parGenre = Object.fromEntries(lu.signaux.map((s) => [s.genre, s.detail]));
  assert.match(parGenre.hooper, /^indice 14 pour 8[,.]3 en moyenne sur 3 semaines$/);
  assert.equal(parGenre.plus_dur, 'RPE 8 pour 5 prévu');
  const enMots = MOTS_DU_COACH.simple.enMots;
  assert.equal(enMots(virgule(parGenre.hooper)), 'fatigue déclarée 14 pour 8,3 en moyenne sur 3 semaines');
  assert.equal(enMots(parGenre.plus_dur), 'effort ressenti 8 pour 5 prévu');
  assert.equal(enMots(parGenre.sensations), parGenre.sensations, 'les sensations, mot du coach, ne bougent pas');
  // Le point de santé de « À faire » : sa phrase est celle de mesAthletes.ts, dite en mots du coach, sa ligne de « Ce qui l'attend » aussi.
  assert.ok(source('lib/app/mesAthletes.ts').includes('texte: `sa fatigue monte : ${virgule(s.detail)}.` });'));
  const point = { niveau: 'sante', genre: 'hooper', texte: `sa fatigue monte : ${virgule(parGenre.hooper)}.`, detail: virgule(parGenre.hooper).replace(/^./, (c) => c.toUpperCase()) };
  const dit = pointEnMotsDuCoach(point);
  assert.equal(dit.texte, 'sa fatigue déclarée monte : 14 pour 8,3 en moyenne sur 3 semaines.');
  assert.equal(dit.detail, 'Fatigue déclarée 14 pour 8,3 en moyenne sur 3 semaines');
  assert.ok(!JARGON.test(`${dit.texte} ${dit.detail}`));
  assert.equal(dit.etiquette, undefined, 'le nom court de « Fatigue qui monte » ne change pas');
});

test('les phrases du moteur (les sept réponses, « Ce qu’il a lu ») : la marche et le Hooper dits en mots du coach, un nom de séance jamais touché', () => {
  const enMots = MOTS_DU_COACH.simple.reponse.texte;
  assert.equal(enMots('Tempo à la marche suivante.'), 'Tempo au niveau suivant.');
  assert.equal(enMots('Tempo refait la même marche.'), 'Tempo refait le même niveau.');
  // « Seuil 2 » dans une phrase du moteur reste « Seuil 2 » : c'est le nom que Nolio donne à la séance (voir le rapport : le moteur écrit ces phrases, le site ne les réécrit que pour la marche, le Hooper, le RPE).
  assert.equal(enMots('Seuil 2 à la marche suivante.'), 'Seuil 2 au niveau suivant.');
  assert.equal(enMots('Manque : son Hooper de dimanche, pas de réponse ; sa fatigue n’est lue que sur ses RPE.'),
    'Manque : sa fatigue déclarée de dimanche, pas de réponse ; sa fatigue n’est lue que sur ses efforts ressentis.');
  // Les noms de séances (Nolio) ne sont jamais réécrits : « marche active », « marche rapide », « SL D+ Bauges », « Seuil 1 côte ».
  for (const nom of ['Seuil 1 côte > 20 % · 30 min — 3 × 10 min · marche active', 'TAPIS 3×8′ marche 15 %', 'SL D+ Bauges', 'S1 marche active · 30 min', 'Montée sur tapis · 24 min — 3 × 8 min · marche rapide à 15 %']) {
    assert.equal(enMots(nom), nom, nom);
  }
  assert.equal(enMots('Aucun D+ ici'), 'Aucun D+ ici', 'seul « 1 200 m D+ » devient « m de dénivelé »');
  assert.equal(MOTS_DU_COACH.simple.enMots('objectif : 1 800 m D+, 5 h 40'), 'objectif : 1 800 m de dénivelé, 5 h 40');
  assert.equal(MOTS_DU_COACH.simple.enMots('objectif : 1\u202f800\u00a0m D+'), 'objectif : 1\u202f800 m de dénivelé');
  assert.ok(REGLES_DES_MOTS.length >= 20);
});

// ─── La prévision, les étiquettes, les piliers : leurs mots d'avant par défaut ───────────────────────────────────────

test('la couleur de la semaine : la phrase de la marche dite en mots du coach sous la 9.x ; par défaut, celle d’avant', () => {
  const orange = { prevues: 5, faites: 2, signaux: [], hooper: null };
  const plusDur = { prevues: 0, faites: 0, signaux: [{ genre: 'plus_dur', jour: '2026-11-12', seance: '', detail: 'RPE 8 pour 5 prévu' }], hooper: null };
  assert.deepEqual(prevision(orange, '2026-11-09'), prevision(orange, '2026-11-09', TEXTES_PREVISION_D_AVANT));
  assert.equal(prevision(orange, '2026-11-09').prevoit, 'Si sa charge reste sous 60 % : ses séances clés refont la même marche');
  assert.equal(prevision(plusDur, '2026-11-09').prevoit, 'Si c’est une séance clé : la suivante refait la même marche');
  const s = MOTS_DU_COACH.simple.prevision;
  assert.equal(prevision(orange, '2026-11-09', s).prevoit, 'Si sa semaine reste sous 60 % du prévu : ses séances clés ne montent pas');
  assert.equal(prevision(plusDur, '2026-11-09', s).prevoit, 'Si c’est une séance clé : la suivante ne monte pas');
  // Le niveau, la raison : inchangés.
  assert.equal(prevision(orange, '2026-11-09', s).niveau, prevision(orange, '2026-11-09').niveau);
  assert.equal(prevision(orange, '2026-11-09', s).pourquoi, prevision(orange, '2026-11-09').pourquoi);
  assert.ok(!JARGON.test(`${s.sousSoixante} ${s.plusDur}`));
});

test('« Ce qui l’attend » : « Effort ressenti à revoir » sous la 9.x ; un point sans nom court garde SIGNAL, comme avant', () => {
  const rpe = { niveau: 'sante', genre: 'rpe', athlete: 'x', texte: 'RPE à revoir avec lui.', action: '', href: '', cle: 'rpe:1' };
  assert.equal(SIGNAL.rpe, 'RPE à revoir');
  assert.equal(etiquettes([rpe], null)[0].texte, 'RPE à revoir');
  const dit = pointEnMotsDuCoach(rpe);
  assert.equal(dit.etiquette, 'Effort ressenti à revoir');
  assert.equal(etiquettes([dit], null)[0].texte, 'Effort ressenti à revoir');
  // Les autres noms courts : les mêmes.
  for (const genre of Object.keys(SIGNAL).filter((g) => g !== 'rpe')) assert.equal(pointEnMotsDuCoach({ genre, texte: 'x.' }).etiquette, undefined, genre);
  for (const [genre, nom] of Object.entries(SIGNAL)) if (genre !== 'rpe') assert.ok(!JARGON.test(nom), `${genre} : « ${nom} »`);
  // La donnée n'est pas touchée : seuls la phrase, le détail et la ligne de dessous changent.
  const p = { niveau: 'sante', genre: 'rpe', cle: 'rpe:1', href: '/x', action: 'Lui écrire ›', texte: 'RPE à revoir.', externe: true };
  const d = pointEnMotsDuCoach(p);
  assert.deepEqual({ ...d, texte: p.texte, etiquette: undefined }, { ...p, etiquette: undefined });
  const mes = source('lib/app/mesAthletes.ts');
  assert.match(mes, /const enMotsDuCoach = \(liste: Point\[\]\) => \(v9 \? liste\.map\(pointEnMotsDuCoach\) : liste\);/);
  assert.match(mes, /const points: Point\[\] = enMotsDuCoach\(\[/);
  assert.match(mes, /juge, motsDuCoach\(v9\)\.prevision\)/);
  assert.ok(source('lib/app/espaceParAthlete.ts').includes('texte: lot[0].etiquette ?? SIGNAL[g] ?? ligneCourte(lot[0].texte)'));
});

test('les piliers de la préparation : les mots d’avant par défaut (l’app de l’athlète), les mots du coach sous la 9.x, les mêmes nombres', () => {
  const lundi = (n) => new Date(Date.UTC(2026, 9, 5 + 7 * n, 12)).toISOString().slice(0, 10);
  const trame = Array.from({ length: 8 }, (_, i) => ({ numero: `S${i + 1}`, type: 'Charge', bloc: 'Bloc fondations', lundi: lundi(i), dates: '', volume_h: 4, charge: 300,
    seances_cles: [], week_end_choc: false, sl_min: 90, passee: false }));
  const realises = [0, 1, 2].map((i) => ({ numero: `S${i + 1}`, lundi: lundi(i), type: 'Charge', charge_prevue: 300, charge_faite: 261, charge_tenue: 261, rpe_lu: true,
    seances_prevues: 4, seances_faites: 4, duree_prevue_min: 240, duree_faite_min: 230, sl_prevue_min: 90, sl_faite_min: 95, cles_prevues: 2, cles_reussies: 2, dplus_m: null, hooper: 8 }));
  const jour = lundi(3);
  const defaut = jaugeDuPlan(trame, realises, jour);
  assert.deepEqual(defaut, jaugeDuPlan(trame, realises, jour, null, PILIERS_D_AVANT));
  assert.deepEqual(defaut.piliers.map((p) => p.detail), [
    'charge tenue : 87 % de la prévue · 12 séances faites sur 12', '3 tenues sur 3 · ta plus longue : 1h35', '6 réussies sur 6, au bon effort',
  ]);
  const coach = jaugeDuPlan(trame, realises, jour, null, MOTS_DU_COACH.simple.piliers);
  assert.deepEqual(coach.piliers.map((p) => p.detail), [
    '87 % du prévu tenu · 12 séances faites sur 12', '3 sorties longues tenues sur 3 · sa plus longue : 1h35', '6 séances clés réussies sur 6, au bon effort',
  ]);
  // Le reste de la jauge ne bouge pas.
  assert.deepEqual({ ...coach, piliers: coach.piliers.map((p) => ({ ...p, detail: '' })) }, { ...defaut, piliers: defaut.piliers.map((p) => ({ ...p, detail: '' })) });
  for (const p of coach.piliers) assert.ok(!JARGON.test(p.detail) && !/\bta |\bton /.test(p.detail), p.detail);
  // Les appels de l'app de l'athlète n'ont pas de dernier argument : ils gardent leurs mots.
  for (const [f, motif] of [['app/app/donnees/page.tsx', /jaugeDuPlan\(d\.trame, d\.realises, ctx\.jour, [^;]*\) : null;/], ['app/app/plan/page.tsx', /jaugeDuPlan\(d\.trame, d\.realises, jour, depuisMontagne\);/],
    ['components/app/AccueilAthlete.tsx', /jaugeDuPlan\(d\.trame, d\.realises, jour, depuis\);/], ['lib/app/espaceCoach.ts', /jaugeDuPlan\(trame, realises, jour, depuis\)/]]) {
    assert.match(source(f), motif, f);
    assert.ok(!source(f).includes('PILIERS') && !source(f).includes('motsDuCoach'), f);
  }
  assert.match(plan, /jaugeDuPlan\(trame\.semaines, realises, jour, debutObjectif, mots\.piliers\)/);
});

// ─── Une ligne d'explication sous chaque chiffre : le sens vient du code ─────────────────────────────────────────

test('sous chaque chiffre qui n’est pas évident, une ligne d’explication (sous la 9.x) ; sous la 8.x, rien de plus', () => {
  const a = MOTS_DU_COACH.ancien;
  const s = MOTS_DU_COACH.simple;
  // La page de l'athlète : « charge tenue » (devenu « du prévu tenu ») et « Hooper » (devenu « fatigue déclarée »), chacun avec sa phrase.
  assert.equal(a.tuiles.explicationTenue, null);
  assert.equal(a.tuiles.explicationFatigue, null);
  assert.equal(a.septJours.explication, null);
  assert.equal(s.tuiles.explicationTenue, 'Sa charge faite sur sa charge prévue : chaque séance compte pour sa durée et son effort ressenti.');
  assert.equal(s.tuiles.explicationFatigue, 'Son questionnaire du dimanche : plus le chiffre est haut, plus il est fatigué.');
  assert.ok(athlete.includes('{mots.tuiles.explicationTenue && <p className="mt-1.5 text-[0.72rem] leading-snug text-[#5E5C78]">{mots.tuiles.explicationTenue}</p>}'));
  assert.ok(athlete.includes('{mots.tuiles.explicationFatigue && <p className="mt-1.5 text-[0.72rem] leading-snug text-[#5E5C78]">{mots.tuiles.explicationFatigue}</p>}'));
  // Ses 7 jours : la moyenne entre parenthèses, expliquée dessous.
  assert.match(s.septJours.explication, /plus c’est haut|plus le chiffre est haut/);
  assert.match(s.septJours.explication, /moyenne/);
  assert.ok(athlete.includes('{septJours.hooper && mots.septJours.explication && <p className="text-xs text-[#5E5C78]">{mots.septJours.explication}</p>}'));
  // Les trois chiffres de la semaine passée : l'un sous l'autre sous la 9.x (une phrase ne tient pas dans une case sur trois).
  assert.ok(athlete.includes("<div className={v9 ? 'grid gap-2' : 'grid grid-cols-3 gap-2'}>"));
  // « Mes athlètes » : la légende de chaque colonne, une fois, sous l'en-tête ; la légende des couleurs, sous la sienne.
  assert.equal(a.legendeDesChiffres.length, 0);
  assert.equal(a.legendeSous, null);
  assert.equal(s.legendeDesChiffres.length, 3);
  assert.match(s.legendeDesChiffres.join(' '), /Objectif[^]*Part du prévu[^]*Fatigue déclarée/);
  const t = source(TABLEAU);
  assert.ok(t.includes('{mots.legendeDesChiffres.length > 0 && ('));
  assert.ok(t.includes('{mots.legendeSous && <span className="basis-full">{mots.legendeSous}</span>}'));
  assert.ok(t.includes('{mots.tenueSous && <span className="text-[#5E5C78]"> {mots.tenueSous}</span>}'));
  // La page de l'objectif : la semaine par semaine (la charge, la part tenue, la fatigue), sa préparation (le premier chiffre, le second).
  assert.equal(a.semaines.legende.length, 0);
  assert.equal(s.semaines.legende.length, 3);
  assert.match(s.semaines.legende[0], /^Semaine tenue/);
  assert.match(s.semaines.legende[1], /^Charge faite/);
  assert.match(s.semaines.legende[2], /^Fatigue déclarée/);
  assert.ok(plan.includes('{mots.semaines.legende.length > 0 && ('));
  assert.equal(a.montee.sous, null);
  assert.ok(s.montee.sous);
  assert.ok(source(TABLEAU).includes('{aide && mots.sous && <span'));
  assert.match(plan, /<EcartAuPrevu montee=\{jauge\.montee\} sombre v9=\{v9\} aide \/>/);
});

test('le sens des explications est celui du code : la charge est durée fois RPE, la tenue est charge tenue sur charge prévue, le Hooper haut est de la fatigue', () => {
  // La charge d'une séance : sa durée fois son RPE (lib/app/resumeSemaine.ts) ; la charge prévue : celle des séances qui ont un RPE prévu.
  assert.ok(source('lib/app/resumeSemaine.ts').includes("La charge (RPE × durée) ne compte que les séances dont l'athlète a donné le RPE"));
  assert.ok(source('lib/app/resumeSemaine.ts').includes('(n, r) => n + (r.debrief?.rpe as number) * (minutes(r.duration) as number)'));
  // La part tenue : charge_tenue sur charge_prevue de la semaine passée (le chiffre de « Mes athlètes » et de la page de l'athlète).
  assert.ok(source('lib/app/espaceCoach.ts').includes('tenue: rPassee.charge_prevue > 0 ? Math.round((rPassee.charge_tenue / rPassee.charge_prevue) * 100) : null,'));
  assert.ok(source('lib/app/tableau.ts').includes('« charge tenue », le mot décidé le 04/11/2026'));
  // Le Hooper : plus il est haut, plus l'athlète est fatigué (la phrase de son app) ; l'alerte part au-dessus de sa moyenne d'un écart ; la moyenne est celle des valeurs d'avant.
  assert.ok(espaces(source('components/app/Graphiques.tsx')).includes('Plus le Hooper est haut, plus tu es fatigué.'));
  assert.ok(source('lib/app/signauxSuivi.ts').includes('derniere.value >= moyenne + s.hooper_ecart'));
  assert.ok(source('lib/app/signauxSuivi.ts').includes('const moyenne = avant.length >= s.hooper_semaines ? avant.reduce((t, v) => t + v.value, 0) / avant.length : null;'));
  assert.ok(source('lib/app/espaceCoach.ts').includes("hooperPasse >= hooperAvant + 2 ? 'hausse'"), 'la tendance « en hausse » : au moins deux points de plus que la semaine d’avant');
  // La couleur : ce que ses signaux de la semaine laissent prévoir pour le passage du dimanche (lib/app/prevision.ts).
  assert.ok(source('lib/app/prevision.ts').includes("Ce que le moteur prévoit dimanche, d'après les signaux gardés du soir"));
  assert.match(MOTS_DU_COACH.simple.legendeSous, /prévoir pour sa semaine de dimanche/);
  // Les phrases disent la même chose que l'app de l'athlète, dite au coach (« il », « sa »).
  assert.match(MOTS_DU_COACH.simple.tuiles.explicationFatigue, /plus le chiffre est haut, plus il est fatigué/);
  assert.match(MOTS_DU_COACH.simple.tuiles.explicationTenue, /durée et son effort ressenti/);
  assert.match(MOTS_DU_COACH.simple.semaines.legende[1], /durée de chaque séance fois son effort ressenti/);
});

// ─── Les écrans : chaque morceau est derrière `v9`, les mots d'avant sous la 8.x ──────────────────────────────────

test('les écrans lisent le moteur eux-mêmes et prennent leurs mots dans le jeu : `motsDuCoach(v9)`', () => {
  for (const [f, motif] of [
    [ATHLETE, /const mots = motsDuCoach\(v9\);/], [PLAN, /const mots = motsDuCoach\(v9\);/], [CHIFFRES, /const mots = motsDuCoach\(v9\);/], [DEMANDE, /const mots = motsDuCoach\(v9\);/],
    [SEMAINE, /const mots = motsDuCoach\(v9\);/], [TABLEAU, /const mots = motsDuCoach\(v9\);/], [SERIES, /motsDuCoach\(enLigne\)\.series\.marche/], [DEMANDES, /motsDuCoach\(v9\)\.demandes\.illisibles/],
    ['components/app/DemandeLue.tsx', /const mots = motsDuCoach\(v9\);/],
  ]) assert.match(source(f), motif, f);
  for (const f of [ATHLETE, PLAN, CHIFFRES, DEMANDE, DEMANDES]) assert.match(source(f), /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/, f);
  // Chiffres : ses sous-composants (async) lisent le moteur eux-mêmes ; la page ne leur passe rien, leurs balises sont celles d'avant.
  const c = source(CHIFFRES);
  assert.equal((c.match(/motsDuCoach\(await moteurEstV9\(\)\.catch\(\(\) => false\)\)/g) ?? []).length, 2);
  assert.ok(c.includes('<Retouches r={c.retouches} enCours={c.lundi} />'));
  // Le tableau et la page de l'athlète : les mots d'avant à la place des textes écrits en dur ; plus de « charge tenue » ni de « Hooper » dans leur source (hors commentaires).
  for (const f of [TABLEAU, LU, SEMAINE]) {
    const code = sansCommentaires(source(f));
    assert.ok(!/charge tenue|Hooper|proche d’un seuil|le moteur changera|la marche|fixe la marche|Dose/.test(code), `${f} : un mot du jargon est resté écrit en dur`);
  }
  // La page de l'athlète : plus de jargon écrit en dur, sauf ce que sa branche 8.x garde (sa phrase de « Ses 7 jours », le bouton du test, la phrase des repères, « m D+ » de sa carte d'objectifs et de ses préparations).
  const code = sansCommentaires(athlete).replace(/'Rien de lu pour l’instant\.[^']*'/, '').replace('Saisir son test de vitesse critique', '').replace(/'Avec eux[^']*'/, '');
  assert.ok(!/charge tenue|Hooper|Vitesse critique|FC au seuil [12]|sans RPE/.test(code), 'la page de l’athlète ne dit plus le jargon qu’à sa branche 8.x');
  const debut8x = athlete.indexOf("{/* Lot A2 de l'app gratuite : la demande de coaching qui a ouvert cette fiche reste lisible ici. */}");
  const dplus = [...athlete.matchAll(/ m D\+/g)].map((m) => m.index);
  assert.equal(dplus.length, 2);
  assert.ok(debut8x > 0 && dplus.every((i) => i > debut8x), '« m D+ » : seulement dans la branche 8.x');
  // La page de l'objectif : « m D+ » ne reste que dans la carte des courses de préparation (cachée sous la 9.x), « Hooper » que dans un commentaire.
  const codePlan = sansCommentaires(plan).replace(/Reprise de Nolio : relis la distance, le D\+ et le chrono visé\./, '');
  assert.ok(!/charge tenue|VC \$|FC seuil [12]|sans RPE|cibles au RPE/.test(codePlan), 'la page de l’objectif non plus');
  assert.equal([...codePlan.matchAll(/ m D\+/g)].length, 1);
  assert.ok(codePlan.indexOf(' m D+') > codePlan.indexOf('preparationsDisponibles(v9) && ecriture?.parametres'));
});

test('les composants partagés avec l’app de l’athlète ne changent pas de mots : leurs options sont réservées au coach et absentes par défaut', () => {
  // Aucun ne lit le jeu de mots.
  for (const f of ['components/app/TableauDeBord.tsx', 'components/app/Graphiques.tsx', 'components/app/ZonesEtStyle.tsx', 'components/app/BanniereSemaine.tsx', 'components/app/SemaineEcrite.tsx',
    'components/app/FormulaireValeurs.tsx', 'components/app/GestesEcriture.tsx', 'components/app/ProfilAthlete.tsx', 'components/app/Ui.tsx', 'lib/app/tableau.ts', 'lib/app/prevision.ts', 'lib/app/journalEnClair.ts']) {
    assert.ok(!/from '[^']*motsDuCoach'/.test(source(f)), `${f} ne lit pas les mots du coach`);
  }
  // Leurs options : facultatives, absentes par défaut.
  const t = source('components/app/TableauDeBord.tsx');
  assert.match(t, /mots\?: \{ suite: \(m: Montee\) => string; calcul: \(m: Montee\) => string \}/);
  assert.ok(t.includes('{mots ? mots.suite(montee) : texteDeLaMontee(montee, coache)}') && t.includes('{mots ? mots.calcul(montee) : calculDeLaMontee(montee)}'));
  assert.match(source('components/app/SemaineEcrite.tsx'), /effortVise\?: \(rpe: string\) => string/);
  assert.ok(source('components/app/SemaineEcrite.tsx').includes('effortVise ? effortVise(j.rpe) : `RPE ${j.rpe}`'));
  assert.match(source('components/app/BanniereSemaine.tsx'), /bloc\?: \(nom: string\) => string/);
  assert.ok(source('components/app/BanniereSemaine.tsx').includes('bloc ? bloc(semaine.bloc) : semaine.bloc'));
  assert.match(source('components/app/FormulaireValeurs.tsx'), /titres = TITRES_D_AVANT/);
  assert.match(source('components/app/FormulaireValeurs.tsx'), /const TITRES_D_AVANT = \{ fc1: 'FC au seuil 1', vs1: 'Allure au seuil 1', vc: 'Vitesse critique', fc2: 'FC au seuil 2' \};/);
  assert.match(source(LU), /mots: MotsDuCoach\['lu'\] = MOTS_DU_COACH\.ancien\.lu/);
  assert.match(source(LU), /mots = MOTS_DU_COACH\.ancien\.lu/);
  assert.match(source(TABLEAU), /export function EcartAuPrevu\(\{ montee, sombre = false, v9 = false, aide = false \}/);
  assert.match(source('components/app/DemandeLue.tsx'), /v9 = false/);
  assert.match(source('components/app/ActionsDemande.tsx'), /ficheCree = 'Une fiche de coaché est créée à ce nom, avec sa vitesse critique du profil gratuit/);
  // Les composants et pages de l'athlète ne passent aucune de ces options.
  for (const f of grep("(ChiffreDeLaMontee|JoursEcrits|BanniereSemaine|FormulaireValeurs|EcartAuPrevu)", 'app', 'components').filter((x) => !x.startsWith('app/app/coach/') && !x.includes('SemaineQuiArrive')
    && !['components/app/TableauDeBord.tsx', 'components/app/SemaineEcrite.tsx', 'components/app/BanniereSemaine.tsx', 'components/app/FormulaireValeurs.tsx', 'components/app/TableauAthletes.tsx'].includes(x))) {
    assert.ok(!/mots=|effortVise=|titres=|bloc=\{/.test(source(f)), `${f} : l'athlète garde ses mots`);
  }
  const tableauDeBord = sansCommentaires(t);
  assert.ok(!/<ChiffreDeLaMontee[^>]*mots=/.test(tableauDeBord), 'CarteObjectif et CarteMontagne (l’app de l’athlète) ne passent pas de mots');
  assert.ok(!/mots=|effortVise=|bloc=\{/.test(sansCommentaires(source('components/plan/ApercuPlan.tsx'))), 'l’aperçu avant paiement garde ses mots');
  // Les textes ne sont lus que par l'espace coach : leurs lecteurs.
  const lecteurs = grep("from '[^']*motsDuCoach'", 'app', 'components', 'lib');
  assert.deepEqual(lecteurs, [
    ATHLETE, CHIFFRES, DEMANDE, DEMANDES, PLAN, SERIES, 'components/app/CarteEntree.tsx', LU, 'components/app/DemandeLue.tsx', 'components/app/PointsPourLui.tsx', SEMAINE, TABLEAU,
    'lib/app/mesAthletes.ts', 'lib/app/pageAthleteSimple.ts',
  ].sort());
  for (const f of lecteurs.filter((x) => x.startsWith('components/'))) {
    const nom = f.replace('components/app/', '').replace('.tsx', '');
    const importeurs = grep(`components/app/${nom}'|'\\./${nom}'`, 'app', 'components', 'lib').filter((x) => x !== f);
    assert.ok(importeurs.every((x) => x.startsWith('app/app/coach/') || lecteurs.includes(x) || x === 'components/app/SemaineQuiArrive.tsx'), `${nom} : ${importeurs.join(', ')}`);
  }
  // CarteEntree et PointsPourLui n'ont qu'un lecteur : la page de l'athlète du coach.
  assert.deepEqual(grep("components/app/(CarteEntree|PointsPourLui)'", 'app', 'components', 'lib'), [ATHLETE]);
});

// ─── Les messages techniques : plus aucun message d'infrastructure sous la 9.x ──────────────────────────────────────

test('« Chiffres » et « Demandes » : plus de clé Stripe, de Vercel Analytics ni de migration sous la 9.x ; ils vont au journal du serveur', () => {
  const s = MOTS_DU_COACH.simple;
  for (const t of [s.chiffres.coachingsSous, s.chiffres.coachingsDetail('a_brancher'), s.chiffres.coachingsDetail('cle_posee'), s.chiffres.tunnel, s.chiffres.retouches, s.demandes.illisibles]) {
    assert.ok(!INFRA.test(t), `infrastructure dans « ${t} »`);
  }
  assert.equal(s.chiffres.coachingsDetail('a_brancher'), 'Cette partie n’est pas disponible pour l’instant.');
  assert.equal(s.demandes.illisibles, 'Cette partie n’est pas disponible pour l’instant.');
  // Ce que le coach lisait avant : ce que la 8.x lit toujours (et ce qui va au journal sous la 9.x).
  assert.ok(INFRA.test(MOTS_DU_COACH.ancien.chiffres.coachingsDetail('a_brancher')) && INFRA.test(MOTS_DU_COACH.ancien.chiffres.tunnel) && INFRA.test(MOTS_DU_COACH.ancien.demandes.illisibles));
  // « Chiffres » : la phrase d'avant part au journal ; sous la 8.x, `montrerLInfra` ne dit rien et laisse tout.
  const c = source(CHIFFRES);
  assert.match(c, /montrerLInfra\(v9, `Chiffres : les coachings ne se lisent pas \(\$\{coachings\.etat === 'a_brancher' \? 'la clé Stripe en lecture seule n’est pas posée dans Vercel' : 'la lecture des coachings n’est pas encore branchée'\}\)\.`\);/);
  assert.ok(c.includes('{mots.chiffres.coachingsDetail(coachings.etat)}') && c.includes('{mots.chiffres.coachingsSous}') && c.includes('{mots.chiffres.tunnel}'));
  // Plus un mot de l'infrastructure écrit en dur dans la page « Chiffres » (hors commentaires) : « Stripe » reste le nom de l'outil de paiement (trois phrases sur ce qui est encaissé, une sur un remboursement), jamais d'une clé ; « Vercel », « clé », « migration » n'y sont plus.
  const code = sansCommentaires(c).replace(/montrerLInfra\(v9, `Chiffres[^\n]*\n/, '');
  assert.ok(!/Vercel|migration|Supabase|NOLIO_API|clé|Analytics|variable/.test(code), 'plus de message d’infrastructure dans Chiffres');
  assert.deepEqual([...new Set(code.match(/[^'`"\n<>{}]*Stripe[^'`"\n<>{}]*/g))].map((x) => x.trim()).filter((x) => !x.startsWith('import ')).sort(), [
    'Montants encaissés, codes promo déduits ; les frais Stripe et les remboursements ne sont pas lus aujourd’hui.', 'payés par tes coachés par Stripe, via Nolio',
    'préparation », puis le remboursement dans Stripe.', 'vendus sur le site, encaissés sur ton Stripe',
  ].sort());
  // « Demandes » : même chose.
  const d = sansCommentaires(source(DEMANDES));
  assert.ok(!/Supabase|migration|demandes_coaching/.test(d.replace('MOTS_DU_COACH.ancien.demandes.illisibles', '')), 'plus de migration à l’écran de « Demandes »');
  assert.match(source(DEMANDES), /if \(demandes === null\) montrerLInfra\(v9, MOTS_DU_COACH\.ancien\.demandes\.illisibles\);/);
  // `montrerLInfra` : la 9.x l'écrit au journal et ne l'affiche pas ; la 8.x l'affiche et ne journalise rien (l'essai de l'étape 1, repris pour ces deux messages).
  const journal = [];
  assert.equal(montrerLInfra(true, MOTS_DU_COACH.ancien.demandes.illisibles, (m) => journal.push(m)), false);
  assert.deepEqual(journal, [MOTS_DU_COACH.ancien.demandes.illisibles]);
  assert.equal(montrerLInfra(false, MOTS_DU_COACH.ancien.demandes.illisibles, (m) => journal.push(m)), true);
  assert.equal(journal.length, 1);
});

test('« Séries du samedi » : la ligne qui parlait du Hooper dit la question de fatigue ; les deux autres, celles d’avant', () => {
  const s = MOTS_DU_COACH.simple.series.marche;
  assert.equal(s.length, TEXTES_SERIES.marche.length);
  assert.deepEqual(s.slice(0, 2), TEXTES_SERIES.marche.slice(0, 2));
  assert.ok(!JARGON.test(s.join(' ')));
  assert.match(s[2], /« Ton point du dimanche »/);
  assert.ok(source(SERIES).includes('motsDuCoach(enLigne).series.marche.map((m) => <li key={m}>{m}</li>)'));
  assert.equal(TEXTES_SERIES.marche[2], 'Ne retire pas « Ton point du dimanche » ni le Hooper : ils restent.', 'le texte d’avant (test-series-du-samedi.mjs) n’a pas bougé');
});

// ─── La carte « Son départ » ──────────────────────────────────────────────────────────────────────────────────────────

test('« Son départ » : caché sous la 9.x, parce que seul le départ de la 8.x écrit `depart_lu` ; la 8.x garde sa carte', () => {
  assert.equal(MOTS_DU_COACH.ancien.carteDepart, true);
  assert.equal(MOTS_DU_COACH.simple.carteDepart, false);
  assert.ok(plan.includes('{depart && mots.carteDepart && ('));
  assert.ok(plan.includes('<Surtitre>Son départ</Surtitre>') && plan.includes('Fondations sautées : il sortait d’un bloc de qualité'), 'la 8.x garde ses phrases');
  // Qui écrit `depart_lu` : le départ de la 8.x seulement (lib/app/ecriture.ts, deciderLeDepart), appelé après le retour du départ sous le moteur v1.
  assert.deepEqual(grep('depart_lu', 'app', 'components', 'lib'), [PLAN, 'lib/app/ecriture.ts'].sort());
  const e = source('lib/app/ecriture.ts');
  assert.equal((e.match(/depart_lu: \{/g) ?? []).length, 1);
  assert.equal((e.match(/await deciderLeDepart\(/g) ?? []).length, 1);
  const v1 = e.indexOf('if (await moteurEstV9()) {', e.indexOf('export async function demarrerObjectif'));
  const retour = e.indexOf('return', e.indexOf('demarrerSousLeMoteurV1(o,', v1));
  assert.ok(v1 > 0 && retour > v1 && retour < e.indexOf('await deciderLeDepart(o'), 'le départ sous le moteur v1 rend la main avant le départ individualisé');
  for (const f of ['lib/app/departV9.ts', 'lib/app/passagesV9.ts', 'lib/app/ecritureV9.ts', 'lib/app/stockageV9.ts', 'lib/app/passeUnPlanV9.ts']) assert.ok(!source(f).includes('depart_lu'), `${f} n'écrit pas depart_lu`);
});
