#!/usr/bin/env node
/**
 * LE PARCOURS A, MOMENT 2 (décision 241 du coach, 25/11/2026 ; « Parcours du coach dans l'app — proposition, 25-11 », validée « A ») : sous la 9.x, la page d'un athlète a une seule carte, « Ce que j'ai besoin de savoir »,
 * un seul formulaire et un seul « Enregistrer », puis « Lancer sa préparation ». Des athlètes fictifs, sans réseau ni base ; le composant et les gestes sont lus comme du texte.
 *
 *   node --test scripts/test-parcours-moment2.mjs
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
const C = await charge('carteSavoir');
const page = await charge('pageAthleteSimple');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const sansCommentaires = (texte) => texte.split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l)).join('\n');

const GPX = { montees: [{ dplus_m: 300 }], dplus_par_pente: { vallonne: 120, cote_moderee: 60, cote_raide: 20 } };
// Les réponses d'un objectif fictif : celles de l'achat, puis celles gardées avec le plan, dont ce que le site y a posé.
const INTAKE = {
  nom: 'Fictif', email: 'ancien@exemple.fr', niveau: 'confirme', volume_hebdo_actuel: '4h', sortie_longue_actuelle: '1h30', format: 'TC', duree_mois: '4',
  course_nom: 'Trail fictif', date_course: '2027-05-02', distance_km: '30', dplus_m: '1200', dmoins_m: '', temps_cible: '4h00', terrain: 'pentu',
  jours_disponibles: ['mardi', 'jeudi', 'samedi'], jour_sl: 'samedi', freq_hebdo: '3',
};
const CHAMPS = { ...INTAKE, jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', entree: '2027-01-04', course_precedente: { date: '2026-11-01', duree_h: 2 }, lu: { sl_min: 90 }, gpx: GPX };
const avant = (x = {}) => C.valeursDeLaCarte({ fiche: { cote_min: '8', tapis: 'non', critere_intensite: 'parfois' }, intake: INTAKE, champs: CHAMPS, courseDate: '2027-05-02', fc1: 148, fc2: null, ...x });

test('ce que la carte montre : sa fiche d’abord pour la côte, le tapis et les critères ; les jours, la sortie longue et les séances de l’objectif seul', () => {
  assert.deepEqual(avant({ champs: { ...CHAMPS, cote_min: '3', tapis: 'oui', criteres: { mecanique: 'regulier' } } }), {
    cote_min: '8', tapis: 'non', critere_intensite: 'parfois', critere_denivele: 'regulier', fc_seuil1: '148', fc_seuil2: '', vc_allure: '',
    date_course: '2027-05-02', distance_km: '30', dplus_m: '1200', temps_cible: '4h00', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3',
  });
  // Sans fiche, l'objectif ; sans objectif, rien de la course ni de la semaine, même si l'achat avait des jours.
  assert.equal(avant({ fiche: null, champs: { ...CHAMPS, cote_min: '3,5' } }).cote_min, '3.5');
  const sans = C.valeursDeLaCarte({ fiche: null, intake: null, champs: null, courseDate: '', fc1: null, fc2: undefined });
  assert.deepEqual(Object.values(sans).flat().filter(Boolean), []);
  // Les jours de l'achat ne remplacent pas ceux que l'objectif n'a pas : ce qui manque reste vide.
  assert.deepEqual(avant({ champs: { date_course: '2027-05-02' } }).jours_disponibles, []);
});

test('les réponses reprises : sans ce que le site a posé (entrée, course d’avant, départ lu, trace), ni la santé, ni un objet', () => {
  const r = C.reponsesReprises({ ...INTAKE, blessure: 'non', coeur: 'non', criteres: { intensite: 'jamais' } }, CHAMPS);
  for (const cle of ['entree', 'course_precedente', 'lu', 'gpx', 'blessure', 'coeur', 'criteres']) assert.equal(r[cle], undefined, cle);
  assert.deepEqual(r.jours_disponibles, ['mardi', 'jeudi', 'dimanche'], 'les réponses gardées avec le plan l’emportent');
  assert.equal(r.volume_hebdo_actuel, '4h');
  assert.equal(JSON.stringify(r).includes('[object'), false);
});

test('un champ laissé vide garde ce qu’il avait : rien ne s’efface', () => {
  const a = avant();
  assert.deepEqual(C.completer(a, {}), a);
  assert.deepEqual(C.completer(a, { cote_min: '', tapis: '', fc_seuil1: '  ', distance_km: '', jours_disponibles: [], jour_sl: '' }), a);
  const b = C.completer(a, { cote_min: ' 12 ', fc_seuil2: '170', jours_disponibles: ['lundi'] });
  assert.deepEqual([b.cote_min, b.fc_seuil2, b.jours_disponibles, b.fc_seuil1], ['12', '170', ['lundi'], '148']);
});

test('l’objectif n’a changé que si sa course ou sa semaine change : ni la côte, ni les repères, ni une autre écriture du même nombre', () => {
  const a = avant();
  assert.equal(C.objectifChange(a, a), false);
  assert.equal(C.objectifChange(a, { ...a, cote_min: '20', tapis: 'oui', critere_intensite: 'jamais', fc_seuil1: '150' }), false);
  assert.equal(C.objectifChange(a, { ...a, distance_km: '30,0', jours_disponibles: ['dimanche', 'mardi', 'jeudi'] }), false);
  for (const x of [{ date_course: '2027-05-09' }, { distance_km: '32' }, { dplus_m: '1300' }, { temps_cible: '3h45' }, { jours_disponibles: ['mardi', 'dimanche'] }, { jour_sl: 'jeudi' }, { freq_hebdo: '2' }]) {
    assert.equal(C.objectifChange(a, { ...a, ...x }), true, JSON.stringify(x));
  }
  assert.equal(C.distanceChangee(a, { ...a, dplus_m: '1' }), false);
});

test('« Modifier l’objectif » : les réponses d’avant avec les nouvelles ; la côte donne le terrain, le tapis suit ; les critères restent sur sa fiche, comme avec le questionnaire du coach', () => {
  const a = avant();
  const apres = C.completer(a, { cote_min: '2', tapis: 'oui', critere_denivele: 'regulier', temps_cible: '3h45', jours_disponibles: ['dimanche', 'lundi'], freq_hebdo: '2' });
  const x = C.intakeDeLObjectif({ base: C.reponsesReprises(INTAKE, CHAMPS), avant: a, apres, nom: 'Camille Fictive', email: 'coach@exemple.fr' });
  assert.deepEqual([x.nom, x.email, x.duree_mois, x.coupure, x.niveau], ['Camille Fictive', 'coach@exemple.fr', 'auto', '', 'confirme']);
  // Comme le questionnaire (intakePourApi, critères pas branchés au moteur de l'achat) : les deux critères ne partent pas ; la v1 les lit sur sa fiche.
  assert.deepEqual([x.terrain, x.tapis, x.critere_intensite, x.critere_denivele], ['intermediaire', 'oui', undefined, undefined]);
  assert.deepEqual([x.temps_cible, x.jours_disponibles, x.jour_sl, x.freq_hebdo], ['3h45', ['lundi', 'dimanche'], 'dimanche', '2']);
  assert.deepEqual([x.volume_hebdo_actuel, x.sortie_longue_actuelle, x.course_nom], ['4h', '1h30', 'Trail fictif'], 'ce que la carte ne demande plus reste tel quel');
  for (const cle of ['entree', 'course_precedente', 'lu', 'gpx', 'blessure', 'coeur', 'cote_min']) assert.equal(x[cle], undefined, cle);
  // Sans niveau dans l'objectif : celui de sa fiche, sinon « intermediaire ».
  const sansNiveau = { ...C.reponsesReprises(INTAKE, CHAMPS), niveau: '' };
  assert.equal(C.intakeDeLObjectif({ base: sansNiveau, avant: a, apres: a, nom: 'N', email: 'e', niveau: 'debutant' }).niveau, 'debutant');
  assert.equal(C.intakeDeLObjectif({ base: sansNiveau, avant: a, apres: a, nom: 'N', email: 'e' }).niveau, 'intermediaire');
});

test('un objectif en route : sa date, sa distance et son format repartent au caractère près (la route refuse tout changement)', () => {
  const champs = { ...CHAMPS, distance_km: '30,5' };
  const a = avant({ champs });
  const x = C.intakeDeLObjectif({ base: C.reponsesReprises(INTAKE, champs), avant: a, apres: { ...a, temps_cible: '3h30' }, nom: 'N', email: 'e' });
  assert.deepEqual([x.date_course, x.distance_km, x.format], ['2027-05-02', '30,5', 'TC']);
  // La distance change : son format est celui qu'on lui donne ; un D− qui suivait le D+ le suit encore, un D− à lui reste.
  const base = { ...C.reponsesReprises(INTAKE, CHAMPS), dmoins_m: '1200' };
  const b = avant();
  const y = C.intakeDeLObjectif({ base, avant: b, apres: { ...b, distance_km: '45,5', dplus_m: '2000' }, nom: 'N', email: 'e', format: 'TM' });
  assert.deepEqual([y.distance_km, y.format, y.dplus_m, y.dmoins_m], ['45.5', 'TM', '2000', '']);
  assert.equal(C.intakeDeLObjectif({ base: { ...base, dmoins_m: '900' }, avant: b, apres: { ...b, dplus_m: '2000' }, nom: 'N', email: 'e' }).dmoins_m, '900');
});

test('sur route : ni distance, ni dénivelé à changer, ni critères envoyés', () => {
  const champs = { ...CHAMPS, format: 'R21', distance_km: '21.1', dplus_m: '0', terrain: '' };
  const a = C.valeursDeLaCarte({ fiche: { critere_intensite: 'regulier', critere_denivele: 'regulier' }, intake: INTAKE, champs, courseDate: '2027-05-02', fc1: null, fc2: null });
  const x = C.intakeDeLObjectif({ base: C.reponsesReprises(INTAKE, champs), avant: a, apres: { ...a, distance_km: '50', dplus_m: '900' }, nom: 'N', email: 'e' });
  assert.deepEqual([x.format, x.distance_km, x.dplus_m, x.critere_intensite, x.critere_denivele], ['R21', '21.1', '0', undefined, undefined]);
  assert.ok(x.terrain);
  assert.equal(C.erreurDeLaCarte({ ...a, distance_km: 'x' }, { route: true }), null);
});

test('avant d’enregistrer : une côte, une distance ou une semaine qui ne tiennent pas le disent ; ce qui manque ne bloque rien', () => {
  const a = avant();
  const trail = { route: false };
  assert.equal(C.erreurDeLaCarte(a, trail), null);
  assert.equal(C.erreurDeLaCarte(C.valeursDeLaCarte({ fiche: null, intake: null, champs: {}, courseDate: '', fc1: null, fc2: null }), trail), null, 'une carte vide s’enregistre');
  assert.equal(C.erreurDeLaCarte({ ...a, cote_min: 'douze' }, null), 'Écris sa plus longue côte en minutes, par exemple 12.');
  for (const x of [{ distance_km: 'trente' }, { distance_km: '0' }, { dplus_m: '-5' }]) assert.equal(C.erreurDeLaCarte({ ...a, ...x }, trail), C.TEXTES_CARTE.distanceIllisible, JSON.stringify(x));
  assert.equal(C.erreurDeLaCarte({ ...a, jour_sl: 'lundi' }, trail), C.TEXTES_CARTE.joursEtSortieLongue);
  for (const freq_hebdo of ['4', '0', '1,5', 'x']) assert.equal(C.erreurDeLaCarte({ ...a, freq_hebdo }, trail), C.TEXTES_CARTE.tropDeSeances, freq_hebdo);
  // Sans objectif à modifier, ni sa course ni sa semaine ne se vérifient.
  assert.equal(C.erreurDeLaCarte({ ...a, jour_sl: 'lundi', distance_km: 'x' }, null), null);
});

test('ses repères : envoyés seulement quand une fréquence change, avec l’autre et les deux allures, pour que rien ne s’efface', () => {
  const a = avant();
  const allures = { vs1: '6:00', vc: '4:10' };
  assert.equal(C.reperesAEnvoyer(a, a, allures), null);
  assert.equal(C.reperesAEnvoyer(a, C.completer(a, { fc_seuil1: '', cote_min: '20' }), allures), null, 'vidée : gardée');
  assert.deepEqual(C.reperesAEnvoyer(a, C.completer(a, { fc_seuil2: '171' }), allures),
    [['fc_seuil1', '148'], ['fc_seuil2', '171'], ['vs1_allure', '6:00'], ['vc_allure', '4:10'], ['allures_gardees', '1']]);
  assert.deepEqual(C.reperesAEnvoyer(a, C.completer(a, { fc_seuil1: '150' }), { vs1: null, vc: null }).slice(2, 4), [['vs1_allure', ''], ['vc_allure', '']]);
  // Une saisie qui ne se lit pas part aussi, pour être refusée et non oubliée.
  assert.ok(C.reperesAEnvoyer(a, C.completer(a, { fc_seuil2: 'cent' }), allures));
});

test('son test : envoyé seulement quand un effort est rempli (la date seule ne suffit pas)', () => {
  const vide = { le: '2026-11-25', duree1: '', distance1: '', duree2: '', distance2: '' };
  assert.equal(C.testSaisi(vide), false);
  for (const cle of ['duree1', 'distance1', 'duree2', 'distance2']) assert.equal(C.testSaisi({ ...vide, [cle]: '3' }), true, cle);
});

const formulaire = (champs) => { const f = new FormData(); for (const [k, v] of champs) f.append(k, v); return f; };

test('sa fiche : les champs remplis changent, rien ne s’efface ; son niveau gardé (« intermediaire » à défaut), son terrain tiré de la côte', () => {
  const ancien = { niveau: 'confirme', niveau_coach: 'confirme', cout_trail: 'montee', terrain: 'pentu', cote_min: '8', tapis: 'oui', jours_disponibles: ['mardi'], jour_sl: 'mardi', freq_hebdo: '1' };
  const rien = C.profilAvecLaCarte(ancien, C.lireSaisieCoureur(formulaire([])));
  assert.deepEqual(rien.profil, ancien);
  const lu = C.profilAvecLaCarte(ancien, C.lireSaisieCoureur(formulaire(C.champsDuCoureur(C.completer(avant(), { cote_min: '1,2' }), true))));
  assert.deepEqual(lu.profil, {
    niveau: 'confirme', niveau_coach: 'confirme', cout_trail: 'montee', terrain: 'vallonne', cote_min: '1.2', tapis: 'non', critere_intensite: 'parfois',
    jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3',
  });
  // Partiel : une fiche vide qui ne reçoit que sa côte.
  assert.deepEqual(C.profilAvecLaCarte(null, C.lireSaisieCoureur(formulaire([['cote_min', '12']]))).profil, { niveau: 'intermediaire', cote_min: '12', terrain: 'tres_pentu' });
  // Sans la semaine de l'objectif (aucun, ou refusé) : les jours de la fiche restent.
  const sansSemaine = C.champsDuCoureur(avant(), false);
  assert.ok(sansSemaine.every(([k]) => !['jours_disponibles', 'jour_sl', 'freq_hebdo'].includes(k)));
  assert.deepEqual(C.profilAvecLaCarte(ancien, C.lireSaisieCoureur(formulaire(sansSemaine))).profil.jours_disponibles, ['mardi']);
  // Ce qui ne se lit pas est refusé.
  assert.ok('erreur' in C.profilAvecLaCarte(ancien, C.lireSaisieCoureur(formulaire([['cote_min', 'haute']]))));
  assert.equal(C.profilAvecLaCarte(ancien, C.lireSaisieCoureur(formulaire([['jour_sl', 'jeudi']]))).erreur, C.TEXTES_CARTE.joursEtSortieLongue);
  assert.equal(C.profilAvecLaCarte(ancien, C.lireSaisieCoureur(formulaire([['freq_hebdo', '2']]))).erreur, C.TEXTES_CARTE.tropDeSeances);
  // Les valeurs inconnues sont ignorées, sans rien effacer.
  assert.deepEqual(C.profilAvecLaCarte(ancien, C.lireSaisieCoureur(formulaire([['tapis', 'peut-être'], ['critere_intensite', 'souvent'], ['jours_disponibles', 'jamais']]))).profil, ancien);
});

test('« Lancer sa préparation » : actif carte complète, Nolio associé et accord reçu ; sinon une ligne dit le premier qui manque ; rien une fois démarré', () => {
  const objectif = { ecrit: true, demarre: false, prevu: null };
  const base = { objectif, complet: true, nolio: true, accord: true, aLaMain: false };
  const etat = (x) => page.etatDuLancement({ ...base, ...x });
  assert.deepEqual(etat({}), { actif: true, pourquoi: null });
  assert.deepEqual(etat({ complet: false }), { actif: false, pourquoi: 'Sa carte n’est pas complète.' });
  assert.deepEqual(etat({ nolio: false, accord: false }), { actif: false, pourquoi: 'Son compte Nolio n’est pas associé.' });
  assert.deepEqual(etat({ accord: false }), { actif: false, pourquoi: 'Son accord de lecture n’est pas reçu.' });
  assert.deepEqual(etat({ objectif: { ...objectif, prevu: '2027-01-04' } }), { programme: '2027-01-04' });
  for (const x of [{ objectif: null }, { objectif: { ...objectif, demarre: true } }, { objectif: { ...objectif, ecrit: false } }, { aLaMain: true }]) assert.equal(etat(x), null, JSON.stringify(x));
  assert.equal(page.TEXTES_PAGE_ATHLETE.lancer, 'Lancer sa préparation');
});

test('le geste de départ : celui de la page de l’objectif, avec ses mots à elle par défaut ; sur la page de l’athlète, l’alerte juste au-dessus du bouton', () => {
  const g = source('components/app/GestesEcriture.tsx');
  assert.match(g, /libelle = 'Démarrer dans Nolio', pourquoi = 'Associe d’abord l’athlète à Nolio, sur sa fiche\.',/);
  assert.match(g, /aide = 'Vide : dès que possible\. Plus tard : par exemple après un objectif que tu prépares à la main\.', classe = 'btn btn-primary !py-2\.5 disabled:opacity-50' \}/, 'la page de l’objectif garde son aide et son bouton');
  assert.match(g, /\{enCours \? 'Départ…' : programme \? 'Changer le départ' : libelle\}/);
  assert.match(source('app/app/coach/plan/[id]/page.tsx'), /<DemarrerNolio planId=\{id\} actif=\{Boolean\(nolio\)\}[^>]*\n\s*programme=\{Boolean\(ecriture\.depart_prevu\)\} \/>/, 'la page de l’objectif ne change pas');
  const l = source('components/app/LancerSaPreparation.tsx');
  assert.ok(l.indexOf('alertes.map(') < l.indexOf('<DemarrerNolio'));
  assert.equal((l.match(/<DemarrerNolio/g) ?? []).length, 1);
  assert.match(l, /libelle=\{TEXTES_PAGE_ATHLETE\.lancer\}/);
  const p = sansCommentaires(source('app/app/coach/athlete/[id]/page.tsx'));
  assert.match(p, /alertes: alertes\.filter\(\(x\) => x\.planId === o\?\.plan_id\)\.flatMap\(\(x\) => x\.phrases\)/);
  assert.match(p, /complet: etatCarte\.complet, nolio: Boolean\(a\.nolio_athlete_id\), accord: Boolean\(accord\), aLaMain/);
});

test('l’enregistrement : l’objectif d’abord par la route de « Modifier », puis sa fiche, ses repères, son test en dernier', () => {
  const c = sansCommentaires(source('components/app/CarteSavoir.tsx'));
  const geste = c.slice(c.indexOf('async function enregistrer('));
  const ordre = ['await envoyerObjectif(', 'enregistrerLeCoureur(athleteId', 'enregistrerValeurs(athleteId, null', 'enregistrerTestVc(athleteId, null'].map((m) => geste.indexOf(m));
  assert.ok(ordre.every((i) => i > 0));
  assert.deepEqual([...ordre].sort((x, y) => x - y), ordre);
  assert.match(geste, /if \(!modifiable \|\| \(!objectifChange\(valeurs, apres\) && !gpx\)\)/);
  assert.match(geste, /champsDuCoureur\(apres, semaineAJour\)/);
  assert.match(geste, /if \(testSaisi\(efforts\)\)/);
  assert.match(c, /fetch\('\/app\/coach\/athletes', \{ method: 'POST', body: donnees \}\)/);
  for (const cle of ['intake', 'plan_id', 'athlete_id', 'gpx']) assert.ok(c.includes(`donnees.append('${cle}'`), cle);
  assert.match(c, /disabled=\{objectif\.enRoute\} className=\{CHAMP\}/, 'la date, en route');
  assert.match(c, /nombre\('distance_km', t\.km, objectif\.enRoute\)/);
  // Rien de ce qui ne se demande plus.
  assert.ok(!/niveau_coach|volume_hebdo|sortie_longue_actuelle|anciennete|entrainement/.test(c));
});

test('les gestes du serveur : la fiche fusionnée sans les exigences d’avant ; les allures renvoyées telles quelles gardent leur valeur exacte', () => {
  const a = sansCommentaires(source('lib/app/actionsCoaching.ts'));
  const fiche = a.slice(a.indexOf('export async function enregistrerLeCoureur'), a.indexOf('export async function inviterDansLApp'));
  assert.match(fiche, /profilAvecLaCarte\(await profilDeLaFiche\(athleteId\), lireSaisieCoureur\(form\)\)/);
  assert.match(fiche, /if \(!\(await ficheAthlete\(coach\.compteId, athleteId\)\)\)/);
  assert.match(fiche, /\.eq\('id', athleteId\)\.eq\('coach_id', coach\.compteId\)/);
  assert.match(fiche, /if \(profilEstRempli\(lu\.profil\)\) await quitterLAttenteDuProfil/);
  assert.ok(!fiche.includes('lireProfil'));
  // Sans la carte de la 9.x, `allures_gardees` n'est jamais envoyé : l'enregistrement des repères est celui d'avant.
  assert.match(a, /const gardee = form\.get\('allures_gardees'\) === '1' \? await ficheAthlete\(coach\.compteId, athleteId\) : null;/);
  assert.match(a, /const vcMs = vcGardee \?\? \(allure === null \? null : Math\.round\(\(1000 \/ allure\) \* 1000\) \/ 1000\);/);
  assert.ok(!source('components/app/FormulaireValeurs.tsx').includes('allures_gardees'));
});

test('les textes de la carte : pour le coach, apostrophe typographique, sans mot du moteur', () => {
  for (const [cle, t] of Object.entries(C.TEXTES_CARTE)) {
    assert.ok(!/\w'\w/.test(t), `${cle} : apostrophe droite`);
    assert.ok(!/moteur|Hooper|\bRPE\b|trame|\bD\+/i.test(t), `${cle} : « ${t} »`);
    assert.equal(t, t.trim(), cle);
  }
  assert.equal(C.TEXTES_CARTE.titre, 'Ce que j’ai besoin de savoir');
});

test('une vitesse critique connue d’un test passé s’écrit dans la carte, en allure ; inchangée, elle garde sa valeur exacte', () => {
  const a = C.valeursDeLaCarte({ fiche: null, intake: null, champs: null, courseDate: '', fc1: 148, fc2: 170, vcAllure: '4:10' });
  assert.equal(a.vc_allure, '4:10');
  assert.equal(C.reperesAEnvoyer(a, a, { vs1: null, vc: '4:10' }), null);
  assert.deepEqual(C.reperesAEnvoyer(a, C.completer(a, { vc_allure: '4:05' }), { vs1: '6:00', vc: '4:10' }),
    [['fc_seuil1', '148'], ['fc_seuil2', '170'], ['vs1_allure', '6:00'], ['vc_allure', '4:05'], ['allures_gardees', '1']]);
  // Vidée, elle n'efface rien.
  assert.equal(C.completer(a, { vc_allure: '' }).vc_allure, '4:10');
  const c = readFileSync(`${RACINE}components/app/CarteSavoir.tsx`, 'utf8');
  assert.ok(c.includes('{t.vcConnue}') && c.includes("maj('vc_allure', e.target.value)"));
});

test('une préparation qui commence plus tard dit son premier lundi sous le champ de date ; le bouton a la casse des autres', () => {
  // La règle de la page de l'objectif : plus tard que demain.
  assert.equal(page.auPlusTot('2026-12-21', '2026-11-11'), '2026-12-21');
  assert.equal(page.auPlusTot('2026-11-16', '2026-11-11'), '2026-11-16');
  assert.equal(page.auPlusTot('2026-11-16', '2026-11-15'), null, 'demain : elle part ce soir');
  assert.equal(page.auPlusTot('2026-09-21', '2026-11-11'), null, 'sa préparation a commencé : dès que possible');
  assert.equal(page.auPlusTot(null, '2026-11-11'), null);
  assert.equal(page.TEXTES_PAGE_ATHLETE.departAuPlusTot('lundi 21 décembre 2026'), 'Vide : dès que possible, au plus tôt le lundi 21 décembre 2026.');
  const l = source('components/app/LancerSaPreparation.tsx');
  assert.match(l, /aide=\{plusTot \? TEXTES_PAGE_ATHLETE\.departAuPlusTot\(dateLongue\(plusTot, true\)\) : undefined\}/);
  assert.ok(l.includes('premier={plusTot ?? premier}'), 'pas de lundi plus tôt à choisir');
  assert.ok(/classe="[^"]*rounded-xl bg-teal[^"]*"/.test(l) && !/classe="[^"]*\bbtn\b/.test(l), 'la forme d’« Enregistrer », sans capitales');
  const p = source('app/app/coach/athlete/[id]/page.tsx');
  assert.ok(p.includes(': auPlusTot(p?.debut_plan as string | null | undefined, jour),') && p.includes('demarre_le, depart_prevu, debut_plan, '));
  // Sur la récupération d'une course d'avant (v1) : le lundi qui la suit, s'il est à venir ; commencée, dès que possible.
  assert.ok(p.includes('plusTot: surRecuperation ? (surRecuperation.lundi > jour ? surRecuperation.lundi : null) :'));
  assert.ok(source('app/app/coach/plan/[id]/page.tsx').includes('const lointain = Boolean(!surRecuperation && '));
  assert.match(source('lib/app/ecriture.ts'), /if \(!o\?\.coache \|\| !\(await moteurEstV9\(\)\)\) return null;/);
});

test('la date du test reste vide tant qu’aucun effort n’est entré', () => {
  const c = source('components/app/CarteSavoir.tsx');
  assert.ok(c.includes("useState<EffortsDuTest>(sansEfforts(''))") && c.includes("setEfforts(sansEfforts(''))") && !c.includes('sansEfforts(aujourdhui)'));
  assert.ok(c.includes("value={efforts.le || (testSaisi(efforts) ? aujourdhui : '')}"));
  assert.equal(C.testSaisi({ le: '', duree1: '', distance1: '', duree2: '', distance2: '' }), false);
  assert.equal(C.testSaisi({ le: '', duree1: '3', distance1: '', duree2: '', distance2: '' }), true);
  // Sans date envoyée, l'enregistrement prend aujourd'hui : ce que le champ montre alors.
  assert.ok(source('lib/app/actionsCoaching.ts').includes("const le = String(form.get('le') ?? '') || jour;"));
});
