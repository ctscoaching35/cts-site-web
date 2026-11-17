#!/usr/bin/env node
/**
 * L'APP GRATUITE, lot B (le dossier de course sans plan, décision du coach du 16/11/2026) : l'appel au moteur
 * (POST /v1/course-libre), les repères envoyés (la FC seulement quand le profil la garde), la lecture d'une réponse, l'allégement
 * du profil, la carte à partager (aucune donnée personnelle), ce que le compte garde (un dossier, sa stratégie, sa suppression),
 * le passage au payant (un compte « normal » relit et supprime ses dossiers, n'en crée pas) et la preuve qu'en mode « coupe »
 * rien ne change. Sans réseau ni base : des pièces à la place de Next et de Supabase (scripts/_monde-app-gratuite.mjs) ; les
 * réponses du moteur sont deux réponses RÉELLES de la route en ligne pour des courses fictives (scripts/fixtures/).
 *
 *   node --test scripts/test-app-gratuite-b.mjs
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
let n = 0;
const frais = async (nom) => import(`${RACINE}lib/app/${nom}.ts?cas=${++n}`);
const { Introuvable } = await import(MONDE);
const courseLibre = await import(`${RACINE}lib/app/courseLibre.ts`);
const carte = await import(`${RACINE}lib/app/carteStory.ts`);
const texte = await import(`${RACINE}lib/app/dossierTexte.ts`);
const accesCourses = await import(`${RACINE}lib/app/accesCourses.ts`);
const dossiersG = await import(`${RACINE}lib/app/dossiersGratuit.ts`);

const fixture = (nom) => JSON.parse(readFileSync(`${RACINE}scripts/fixtures/${nom}.json`, 'utf8'));
const SANS_TRACE = fixture('course-libre-sans-trace');
const AVEC_TRACE = fixture('course-libre-avec-trace');

// ─── Une base en mémoire, assez pour les lectures et écritures du lot ─────────────────────────────
function baseEnMemoire(depart = {}) {
  const tables = { courses_gratuites: [], profils_gratuits: [], ...depart };
  const journal = [];
  let compteur = 0;
  const from = (nom) => {
    const lignes = (tables[nom] ??= []);
    const etat = { op: 'select', filtres: [], valeurs: null, options: null, retour: false };
    const choisies = () => lignes.filter((l) => etat.filtres.every(([k, v]) => l[k] === v));
    const executer = async () => {
      journal.push({ table: nom, op: etat.op, valeurs: etat.valeurs, filtres: etat.filtres });
      if (etat.op === 'insert') {
        const ligne = { id: `00000000-0000-4000-8000-${String(++compteur).padStart(12, '0')}`, cree_le: '2026-11-16T10:00:00Z', ...etat.valeurs };
        lignes.push(ligne);
        return { data: [ligne], error: null };
      }
      if (etat.op === 'update') { for (const l of choisies()) Object.assign(l, etat.valeurs); return { data: null, error: null }; }
      if (etat.op === 'delete') { for (const l of choisies()) lignes.splice(lignes.indexOf(l), 1); return { data: null, error: null }; }
      if (etat.options?.head) return { data: null, count: choisies().length, error: null };
      return { data: choisies(), error: null };
    };
    const q = {
      select(_colonnes, options) { if (etat.op !== 'insert') { etat.op = 'select'; etat.options = options ?? null; } return q; },
      eq(k, v) { etat.filtres.push([k, v]); return q; },
      order() { return q; },
      insert(v) { etat.op = 'insert'; etat.valeurs = v; return q; },
      update(v) { etat.op = 'update'; etat.valeurs = v; return q; },
      delete() { etat.op = 'delete'; return q; },
      upsert: async (v, options) => { journal.push({ table: nom, op: 'upsert', valeurs: v, options }); return { error: null }; },
      single: async () => { const r = await executer(); return { data: r.data?.[0] ?? null, error: r.error }; },
      maybeSingle: async () => { const r = await executer(); return { data: r.data?.[0] ?? null, error: r.error }; },
      then: (res, rej) => executer().then(res, rej),
    };
    return q;
  };
  return { tables, journal, from };
}

function poser({ mode = 'ouvert', session = null, plans = [], fiche = null, base = baseEnMemoire(), cookies = {} } = {}) {
  if (mode === undefined) delete process.env.APP_GRATUITE;
  else process.env.APP_GRATUITE = mode;
  process.env.APP_GRATUITE_SECRET = 'mot-secret';
  const ecrits = [];
  globalThis.__monde = {
    appels: [], cookies, supabase: true, demonstration: false, ecrits, base,
    plansDuCompte: async () => plans, ficheDuCompte: async () => fiche, coachConnecte: async () => null,
    client: () => ({
      auth: { getClaims: async () => ({ data: session ? { claims: session } : null }), signInWithOtp: async () => ({ error: null }) },
      from: base.from,
    }),
    service: () => ({ from: (table) => ({ upsert: async (ligne, options) => { ecrits.push({ table: `service:${table}`, ligne, options }); return { error: null }; } }) }),
  };
  return globalThis.__monde;
}
const GRATUIT = { sub: 'u1', email: 'a@b.fr' };
const dossier = (reponse = SANS_TRACE) => ({ entrees: { date_course: '2027-03-14', temps_cible: '2h15', distance_km: 18, dplus_m: 540, trace: false }, reponse, strategie: null });
const TESTS = { vc: { efforts: [{ duree_s: 180, distance_m: 1020 }, { duree_s: 720, distance_m: 3480 }], vc_ms: 3.6, d_prime_m: 150, le: '2026-11-01' },
  parole: { fc_seuil1: 152, v_seuil1_ms: 3.0, le: '2026-11-01' }, fc2: { fc_seuil2: 170, le: '2026-11-01' } };

// ─── Les repères envoyés ────────────────────────────────────────────────────────────────────────
test('repères : la vitesse critique part ; la FC seulement quand le profil la garde (avec l’accord)', () => {
  assert.deepEqual(courseLibre.reperesDuProfil(TESTS, true), { vc_ms: 3.6, fc_seuil1: 152, fc_seuil2: 170 });
  assert.deepEqual(courseLibre.reperesDuProfil(TESTS, false), { vc_ms: 3.6 });
  assert.equal(courseLibre.reperesDuProfil({}, true), null);
  assert.equal(courseLibre.reperesDuProfil({ parole: TESTS.parole }, false), null);
});

test('repères : dans les bornes du moteur, et deux seuils qui se contredisent ne partent pas (le moteur refuserait tout)', () => {
  assert.equal(courseLibre.reperesDuProfil({ vc: { ...TESTS.vc, vc_ms: 9 } }, true), null);
  assert.deepEqual(courseLibre.reperesDuProfil({ ...TESTS, fc2: { fc_seuil2: 150, le: 'x' } }, true), { vc_ms: 3.6 });
  assert.deepEqual(courseLibre.reperesDuProfil({ parole: { fc_seuil1: 70, v_seuil1_ms: null, le: 'x' } }, true), null);
});

test('la demande : ce qui est vide ne part pas ; le temps visé et la date partent tels quels', () => {
  const d = courseLibre.construireDemande({ nom: ' ', date: '2027-03-14', temps: ' 2h15 ', distance: '18,5', dplus: '', }, { reperes: null });
  assert.deepEqual(d, { date_course: '2027-03-14', temps_cible: '2h15', distance_km: 18.5 });
  const e = courseLibre.construireDemande({ nom: 'Trail', date: '2027-03-14', temps: '90 min', distance: '', dplus: '' }, { reperes: { vc_ms: 3.6 } });
  assert.deepEqual(e, { date_course: '2027-03-14', temps_cible: '90 min', reperes: { vc_ms: 3.6 }, course_nom: 'Trail' });
  // Un nombre illisible part tel quel : c'est le moteur qui refuse, avec sa phrase.
  assert.equal(courseLibre.construireDemande({ nom: '', date: 'd', temps: 't', distance: 'abc', dplus: '' }, { reperes: null }).distance_km, 'abc');
});

// ─── L'appel au moteur ────────────────────────────────────────────────────────────────────────────
const reponseHttp = (statut, corps) => async (url, options) => {
  reponseHttp.dernier = { url, options };
  return { ok: statut >= 200 && statut < 300, status: statut, json: async () => { if (corps === undefined) throw new Error('pas du JSON'); return corps; } };
};

test('appel sans trace : le JSON en corps de requête, sur la route publique du moteur, sans clé', async () => {
  const r = await courseLibre.appelerCourseLibre({ date_course: '2027-03-14', temps_cible: '2h15', distance_km: 18, dplus_m: 540 }, null, reponseHttp(200, SANS_TRACE));
  assert.equal(r.ok, true);
  assert.equal(r.reponse.course.classe, 'vallonnee');
  const { url, options } = reponseHttp.dernier;
  assert.ok(url.endsWith('/v1/course-libre'));
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(Object.keys(options.headers), ['Content-Type']);
  assert.equal(JSON.parse(options.body).temps_cible, '2h15');
});

test('appel avec trace : un envoi multipart (corps, gpx), le navigateur seul fixe son en-tête', async () => {
  const gpx = new Blob(['<gpx/>'], { type: 'application/gpx+xml' });
  const r = await courseLibre.appelerCourseLibre({ date_course: '2027-03-14', temps_cible: '2h15' }, gpx, reponseHttp(200, AVEC_TRACE));
  assert.equal(r.ok, true);
  const { options } = reponseHttp.dernier;
  assert.ok(options.body instanceof FormData);
  assert.equal(JSON.parse(options.body.get('corps')).date_course, '2027-03-14');
  assert.ok(options.body.get('gpx'));
  assert.equal(options.headers, undefined);
});

test('les refus du moteur : sa phrase est affichée telle quelle ; 429, 500 et réseau coupé ont la leur', async () => {
  const refus = { error: 'refus_metier', message: 'Donne le temps que tu vises : sans lui, la grille de l’effort du jour J ne peut pas se calculer.', raison: 'temps_vise_manquant' };
  const a = await courseLibre.appelerCourseLibre({ date_course: 'x', temps_cible: '' }, null, reponseHttp(422, refus));
  assert.deepEqual(a, { ok: false, message: refus.message, raison: 'temps_vise_manquant' });
  const b = await courseLibre.appelerCourseLibre({ date_course: 'x', temps_cible: '' }, null, reponseHttp(429, { error: 'limite' }));
  assert.equal(b.message, courseLibre.MESSAGE_TROP_DE_DEMANDES);
  const c = await courseLibre.appelerCourseLibre({ date_course: 'x', temps_cible: '' }, null, reponseHttp(500, { error: 'generation', message: 'secret interne' }));
  assert.equal(c.message, courseLibre.MESSAGE_INCIDENT);
  const d = await courseLibre.appelerCourseLibre({ date_course: 'x', temps_cible: '' }, null, async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(d.message, courseLibre.MESSAGE_SANS_RESEAU);
  const e = await courseLibre.appelerCourseLibre({ date_course: 'x', temps_cible: '' }, null, reponseHttp(200, { n: 'importe quoi' }));
  assert.equal(e.ok, false);
  const f = await courseLibre.appelerCourseLibre({ date_course: 'x', temps_cible: '' }, null, reponseHttp(502, undefined));
  assert.equal(f.message, courseLibre.MESSAGE_INCIDENT);
});

// ─── Lire une réponse ─────────────────────────────────────────────────────────────────────────────
test('les réponses réelles du moteur (sans trace, avec trace) se lisent ; une réponse trouée est refusée', () => {
  assert.ok(courseLibre.reponseSure(SANS_TRACE));
  assert.ok(courseLibre.reponseSure(AVEC_TRACE));
  assert.equal(courseLibre.reponseSure(null), null);
  assert.equal(courseLibre.reponseSure({ ...SANS_TRACE, course: { ...SANS_TRACE.course, classe: 'plate' } }), null);
  assert.equal(courseLibre.reponseSure({ ...SANS_TRACE, effort_jour_j: null }), null);
  assert.equal(courseLibre.reponseSure({ ...SANS_TRACE, seances_types: undefined }), null);
  assert.equal(courseLibre.dossierSur({ entrees: { date_course: 'd', temps_cible: 't' }, reponse: 'x' }), null);
  assert.ok(courseLibre.dossierSur(dossier()));
});

test('le nom d’une course sans nom, et les pentes dans la forme de l’app des acheteurs', () => {
  assert.equal(courseLibre.nomDeLaCourse(AVEC_TRACE), 'Course de 16,93 km');
  assert.equal(courseLibre.nomDeLaCourse(SANS_TRACE), 'Course fictive');
  assert.equal(courseLibre.pentesPourBarres(SANS_TRACE), null);
  const barres = courseLibre.pentesPourBarres(AVEC_TRACE);
  assert.equal(barres.length, 5);
  assert.deepEqual(barres[0], ['descente_raide', 'Descente raide (< -15%)', 0]);
  assert.equal(courseLibre.tempsViseSecondes(SANS_TRACE), 8100);
});

// ─── L'allégement du profil ───────────────────────────────────────────────────────────────────────
test('allègement : un ultra de 11 000 points tient en 800, les limites de plages gardées et valides', () => {
  const total = 11000;
  const altitude_m = Array.from({ length: total }, (_, i) => 500 + 300 * Math.sin(i / 700));
  const plages = [[0, 3999, 'montee'], [3999, 7500, 'vallonne'], [7500, total - 1, 'descente']];
  const a = courseLibre.allegerPoints({ pas_km: 0.01, km: null, altitude_m, plages, secteurs: null }, 800);
  assert.ok(a.altitude_m.length <= 800 + 3 && a.altitude_m.length >= 700, `n = ${a.altitude_m.length}`);
  assert.equal(a.km.length, a.altitude_m.length);
  assert.equal(a.km[0], 0);
  assert.ok(Math.abs(a.km.at(-1) - 109.99) < 0.02);
  assert.ok(a.km.every((k, i) => i === 0 || k > a.km[i - 1]));
  assert.equal(a.plages.length, 3);
  // Chaque plage commence où la précédente finit, et ses bornes pointent les mêmes altitudes que l'original.
  assert.equal(a.plages[0][0], 0);
  assert.equal(a.plages[0][1], a.plages[1][0]);
  assert.equal(a.plages[2][1], a.altitude_m.length - 1);
  assert.equal(a.altitude_m[a.plages[1][0]], altitude_m[3999]);
  assert.equal(a.altitude_m[a.plages[2][0]], altitude_m[7500]);
});

test('allègement : un profil court reste tel quel ; la réponse allégée reste lisible', () => {
  const p = AVEC_TRACE.profil.points;
  assert.equal(p.altitude_m.length, 1694);
  const r = courseLibre.allegerReponse(AVEC_TRACE);
  assert.ok(r.profil.points.altitude_m.length <= 803);
  assert.ok(courseLibre.reponseSure(r));
  assert.equal(courseLibre.allegerReponse(SANS_TRACE), SANS_TRACE);
  assert.ok(JSON.stringify(r).length < JSON.stringify(AVEC_TRACE).length);
});

// ─── La carte à partager : la course seule ─────────────────────────────────────────────────────────
test('modèle de la carte : seulement la course (nom, date, distance, D+, classe, profil), jamais du personnel', () => {
  const m = courseLibre.modeleCarte(AVEC_TRACE);
  assert.deepEqual(Object.keys(m).sort(), ['classe', 'date', 'distance_km', 'dplus_m', 'nom', 'profil']);
  assert.ok(m.profil.altitude_m.length > 100);
  const avecRepere = courseLibre.modeleCarte({ ...SANS_TRACE });
  const json = JSON.stringify(avecRepere);
  for (const interdit of ['temps', '2h15', 'fc', 'seuil', '152', '170', 'allure', 'vc_ms', 'experience']) assert.ok(!json.toLowerCase().includes(interdit), interdit);
  assert.equal(avecRepere.profil, null);
});

function faussaire() {
  const dessins = [];
  const c = {
    textes: dessins, appels: [],
    measureText: (t) => ({ width: t.length * 20 }),
    fillText(t, x, y) { dessins.push({ t, x, y }); },
    drawImage() { c.appels.push('drawImage'); }, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arcTo() {},
  };
  return c;
}

test('la carte : 1080 × 1920, le nom, la date, les chiffres et l’adresse, sans la classe ; ni FC, ni allure, ni temps visé', () => {
  assert.equal(carte.LARGEUR, 1080);
  assert.equal(carte.HAUTEUR, 1920);
  const c = faussaire();
  carte.dessinerCarte(c, courseLibre.modeleCarte(AVEC_TRACE), { famille: 'sans-serif', logo: null });
  const tout = c.textes.map((x) => x.t).join('|');
  assert.ok(tout.includes('Course de 16,93 km'.split(' ')[0]));
  assert.ok(tout.includes('cts-coaching.com'));
  assert.ok(!/vallonn|de montagne|roulante|^COURSE$|\|COURSE\|/.test(tout), tout);
  assert.ok(tout.includes('Comprends ta course, gratuitement'));
  assert.ok(tout.includes('KM') && tout.includes('M D+'));
  assert.ok(tout.includes('dimanche 14 mars 2027'));
  assert.ok(!/temps|2h15|FC |min\/km|seuil/i.test(tout), tout);
  // Tout ce qui s'écrit reste dans la zone visible d'une story : ni sous la barre d'Instagram, ni sous le nom du compte.
  for (const { y } of c.textes) assert.ok(y >= 250 && y <= 1720, `y = ${y}`);
});

test('la carte : le logo quand il est là, la marque en lettres sinon ; un long nom se coupe en trois lignes au plus', () => {
  const avec = faussaire();
  carte.dessinerCarte(avec, courseLibre.modeleCarte(AVEC_TRACE), { famille: 'x', logo: { width: 100, height: 90 } });
  assert.ok(avec.appels.includes('drawImage'));
  const sans = faussaire();
  carte.dessinerCarte(sans, courseLibre.modeleCarte(AVEC_TRACE), { famille: 'x', logo: null });
  assert.ok(sans.textes.some((x) => x.t === 'CITY TO SUMMIT'));
  const long = { ...courseLibre.modeleCarte(AVEC_TRACE), nom: 'Le trail des crêtes et des vallons de la grande traversée du massif central en hiver' };
  const l = faussaire();
  carte.dessinerCarte(l, long, { famille: 'x', logo: null });
  const lignesDuNom = l.textes.filter((x) => x.y > 520 && x.y < 900);
  assert.ok(lignesDuNom.length <= 3 && lignesDuNom.length >= 1);
  const lignes = carte.decouperLignes({ measureText: (t) => ({ width: t.length * 10 }) }, 'un deux trois quatre cinq six sept huit neuf dix', 100, 2);
  assert.equal(lignes.length, 2);
  assert.ok(lignes[1].endsWith('…'));
});

test('la carte : la date, le nom du fichier, le profil dessiné quand il existe', () => {
  assert.equal(carte.dateDeLaCarte('2027-03-14'), 'dimanche 14 mars 2027');
  assert.equal(carte.dateDeLaCarte('n’importe quoi'), '');
  assert.equal(carte.nomDuFichier('Trail de la Côte sauvage !'), 'city-to-summit-trail-de-la-cote-sauvage.png');
  assert.equal(carte.nomDuFichier('???'), 'city-to-summit-course.png');
  const c = faussaire();
  let traits = 0;
  c.lineTo = () => { traits += 1; };
  carte.dessinerCarte(c, courseLibre.modeleCarte(AVEC_TRACE), { famille: 'x', logo: null });
  assert.ok(traits > 100);
  const sans = faussaire();
  let t2 = 0;
  sans.lineTo = () => { t2 += 1; };
  carte.dessinerCarte(sans, courseLibre.modeleCarte(SANS_TRACE), { famille: 'x', logo: null });
  assert.equal(t2, 0);
});

// ─── Ce que l'écran en tire ───────────────────────────────────────────────────────────────────────
test('mises en forme : FC et allures, étapes d’une séance type, zones dans l’ordre', () => {
  assert.equal(texte.texteFc({ bas: null, haut: 147 }), 'FC sous 147');
  assert.equal(texte.texteFc({ bas: 157, haut: 165 }), 'FC 157 à 165');
  assert.equal(texte.texteFc(null), null);
  assert.equal(texte.texteAllure({ lente: '5:23', rapide: '5:02', unite: 'min/km', pct_vc: [86, 92] }), '5:23 à 5:02 /km');
  assert.equal(texte.texteAllure(null), null);
  const seance = SANS_TRACE.seances_types.find((s) => s.zone === 'seuil2');
  assert.deepEqual(texte.lignesDesEtapes(seance.etapes), [
    'Échauffement 15 min (RPE 3)', '4 fois : effort 5 min (RPE 7), récupération 2 min (RPE 2)', 'Retour au calme 8 min (RPE 3)']);
  assert.deepEqual(texte.lignesDeZones(SANS_TRACE).map((l) => l.zone), ['ef', 'seuil1', 'tempo', 'seuil2', 'vo2max']);
  assert.deepEqual(texte.lignesDeZones({ ...SANS_TRACE, zones: null }), []);
  assert.equal(texte.nomDeZone('seuil1'), 'Seuil 1');
});

test('la réponse sans repère : zones nulles, pas de chiffres ; le dossier se lit', () => {
  const r = { ...SANS_TRACE, zones: null, effort_jour_j: { ...SANS_TRACE.effort_jour_j, chiffres: null } };
  assert.ok(courseLibre.reponseSure(r));
  assert.equal(r.zones, null);
});

test('le niveau du calculateur suit l’expérience du profil, la durée visée aussi', () => {
  assert.equal(courseLibre.niveauDuCalculateur('debutant'), 'deb');
  assert.equal(courseLibre.niveauDuCalculateur('intermediaire'), 'int');
  assert.equal(courseLibre.niveauDuCalculateur('confirme'), 'exp');
  assert.equal(courseLibre.niveauDuCalculateur(null), 'int');
  const p = courseLibre.parametresNutrition({ ...SANS_TRACE, course: { ...SANS_TRACE.course, experience: 'confirme' } }, null);
  assert.deepEqual(p, { heures: '2', minutes: '15', niveau: 'exp', garder: 'objectif' });
  assert.equal(courseLibre.parametresNutrition(SANS_TRACE, null, false).garder, undefined);
  // La stratégie gardée remplace les réponses du calculateur.
  const s = { entrees: { heures: '2', minutes: '15', niveau: 'deb', poids: '68' }, cartes: [], le: '2026-11-16' };
  assert.equal(courseLibre.parametresNutrition(SANS_TRACE, s).niveau, 'deb');
});

// ─── Qui voit les dossiers ────────────────────────────────────────────────────────────────────────
test('en coupe : les pages des dossiers n’existent pas (404 comme avant), pour tous', async () => {
  for (const session of [null, GRATUIT]) {
    poser({ mode: 'coupe', session });
    const { pageCourses } = await frais('accesCourses');
    await assert.rejects(() => pageCourses(), Introuvable);
  }
  assert.equal(accesCourses.genreCourses({ cas: 'normal', mode: 'coupe', compteId: 'u1' }), null);
  assert.equal(accesCourses.AVEC_DOSSIERS('coupe', 5), false);
  assert.equal(accesCourses.AVEC_DOSSIERS('ouvert', 0), false);
  assert.equal(accesCourses.AVEC_DOSSIERS('ouvert', 2), true);
});

test('le titre d’une page de dossier : seulement quand elle est ouverte pour la visite (en coupe, rien ne transparaît)', async () => {
  poser({ mode: 'coupe', session: GRATUIT });
  assert.deepEqual(await (await frais('accesCourses')).titreCourses('Courses'), {});
  poser({ mode: 'ouvert', session: null });
  assert.deepEqual(await (await frais('accesCourses')).titreCourses('Courses'), { title: 'Courses' });
  poser({ mode: 'invitation', session: null });
  assert.deepEqual(await (await frais('accesCourses')).titreCourses('Courses'), {});
});

test('les genres de visite : visiteur, compte gratuit, ancien (compte « normal » connecté) ; une visite sans session ni ouverture : rien', () => {
  const g = accesCourses.genreCourses;
  assert.equal(g({ cas: 'visiteur', mode: 'ouvert' }), 'visiteur');
  assert.equal(g({ cas: 'gratuit', mode: 'invitation', compteId: 'u1' }), 'gratuit');
  assert.equal(g({ cas: 'normal', mode: 'ouvert', compteId: 'u1' }), 'ancien');
  assert.equal(g({ cas: 'normal', mode: 'ouvert' }), null);
  assert.equal(g({ cas: 'connexion', mode: 'ouvert' }), null);
});

test('un acheteur (compte « normal ») ouvre ses dossiers : pageCourses lui répond « ancien »', async () => {
  poser({ mode: 'ouvert', session: GRATUIT, plans: [{ id: 'p1' }] });
  const { pageCourses } = await frais('accesCourses');
  const r = await pageCourses();
  assert.equal(r.genre, 'ancien');
});

// ─── Ce que garde le compte ───────────────────────────────────────────────────────────────────────
test('garder un dossier : une ligne du compte, les entrées et la réponse du moteur, jamais le fichier ; la liste e-mail suit', async () => {
  const base = baseEnMemoire({ profils_gratuits: [{ compte_id: 'u1', liste_email_le: '2026-11-10T00:00:00Z', experience: 'intermediaire', tests: {} }] });
  const m = poser({ session: GRATUIT, base });
  const { enregistrerDossier } = await frais('actionsCourses');
  const r = await enregistrerDossier({ ...dossier(AVEC_TRACE), entrees: { date_course: '2027-03-14', temps_cible: '2h15', trace: true } });
  assert.equal(r.ok, true);
  assert.match(r.id, /^[0-9a-f-]{36}$/);
  const ligne = base.tables.courses_gratuites[0];
  assert.equal(ligne.compte_id, 'u1');
  assert.equal(ligne.nom, 'Course de 16,93 km');
  assert.equal(ligne.course_date, '2027-03-14');
  assert.equal(ligne.temps_vise_s, 8100);
  assert.equal(ligne.distance_km, 16.93);
  assert.equal(ligne.dplus_m, 350);
  assert.equal(ligne.strategie, null);
  assert.equal(ligne.resultat.entrees.trace, true);
  assert.ok(ligne.resultat.reponse.profil.points.altitude_m.length <= 803, 'le profil est gardé allégé');
  assert.ok(!JSON.stringify(ligne).includes('<gpx'), 'aucun fichier GPX');
  // La clé des tables, posée par le serveur ; et Brevo : inscrit à la liste, ses attributs suivent (la lecture de la prochaine course).
  assert.ok(m.ecrits.some((e) => e.table === 'service:comptes'));
  assert.ok(base.journal.some((j) => j.table === 'courses_gratuites' && j.op === 'select'));
});

test('la liste e-mail : un compte inscrit voit TYPE_COURSE et DATE_COURSE suivre son dossier ; un compte non inscrit, rien', async () => {
  const appels = [];
  const fetchAvant = globalThis.fetch;
  globalThis.fetch = async (url, options) => { appels.push({ url: String(url), corps: options?.body ? JSON.parse(options.body) : null }); return { ok: true, status: 201 }; };
  process.env.BREVO_API_KEY = 'cle-de-test';
  process.env.BREVO_LISTE_APP = '7';
  try {
    const inscrit = baseEnMemoire({ profils_gratuits: [{ compte_id: 'u1', liste_email_le: '2026-11-10T00:00:00Z', experience: 'confirme', tests: {} }] });
    poser({ session: GRATUIT, base: inscrit });
    const a = await frais('actionsCourses');
    await a.enregistrerDossier(dossier());
    const contact = appels.find((x) => x.url.endsWith('/contacts'));
    assert.ok(contact, 'Brevo a reçu la mise à jour');
    assert.equal(contact.corps.email, 'a@b.fr');
    assert.equal(contact.corps.attributes.TYPE_COURSE, 'vallonnee');
    assert.equal(contact.corps.attributes.DATE_COURSE, '2027-03-14');
    // Supprimer son dossier : la prochaine course change, les attributs suivent.
    appels.length = 0;
    await a.supprimerDossier(inscrit.tables.courses_gratuites[0].id);
    assert.ok(appels.some((x) => x.url.endsWith('/contacts')));
    // Un compte qui n'a pas donné son accord à la liste : aucun appel.
    appels.length = 0;
    poser({ session: GRATUIT, base: baseEnMemoire() });
    await (await frais('actionsCourses')).enregistrerDossier(dossier());
    assert.equal(appels.length, 0);
  } finally {
    globalThis.fetch = fetchAvant;
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_LISTE_APP;
  }
});

test('garder un dossier : un compte gratuit seulement, un dossier lisible seulement, vingt au plus', async () => {
  poser({ session: null });
  assert.equal((await (await frais('actionsCourses')).enregistrerDossier(dossier())).ok, false);
  // Un compte « normal » (un acheteur) n'en crée pas.
  poser({ session: GRATUIT, plans: [{ id: 'p1' }] });
  assert.equal((await (await frais('actionsCourses')).enregistrerDossier(dossier())).ok, false);
  const base = baseEnMemoire();
  poser({ session: GRATUIT, base });
  const { enregistrerDossier } = await frais('actionsCourses');
  assert.equal((await enregistrerDossier({ entrees: {}, reponse: {} })).ok, false);
  assert.equal(base.tables.courses_gratuites.length, 0);
  for (let i = 0; i < 20; i++) assert.equal((await enregistrerDossier(dossier())).ok, true);
  const trop = await enregistrerDossier(dossier());
  assert.equal(trop.ok, false);
  assert.match(trop.message, /20 dossiers/);
  assert.equal(base.tables.courses_gratuites.length, 20);
});

test('la stratégie de nutrition : gardée dans le dossier (relue, datée), effacée ; refusée sans durée', async () => {
  const base = baseEnMemoire();
  poser({ session: GRATUIT, base });
  const a = await frais('actionsCourses');
  const { id } = await a.enregistrerDossier(dossier());
  const donnees = { entrees: { heures: '2', minutes: '15', poids: '68', niveau: 'int' },
    cartes: [{ valeur: '45 à 55 g', sous: 'par heure' }, { valeur: '500 à 700 mL', sous: '' }, { valeur: 'Rien', sous: '' }, { valeur: '170 mg', sous: '' }] };
  assert.equal((await a.garderStrategieDossier(id, donnees)).ok, true);
  const s = base.tables.courses_gratuites[0].strategie;
  assert.equal(s.cartes[0].nom, 'Glucides');
  assert.match(s.le, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await a.garderStrategieDossier(id, { entrees: {}, cartes: [] })).ok, false);
  assert.equal((await a.garderStrategieDossier('pas-un-uuid', donnees)).ok, false);
  const lu = await dossiersG.dossierDuCompte('u1', id);
  assert.equal(lu.strategie.cartes[1].nom, 'Boisson');
  assert.equal((await a.effacerStrategieDossier(id)).ok, true);
  assert.equal(base.tables.courses_gratuites[0].strategie, null);
});

test('un dossier se relit : la liste du plus proche au plus ancien, un autre compte ne voit rien', async () => {
  const base = baseEnMemoire();
  poser({ session: GRATUIT, base });
  const a = await frais('actionsCourses');
  const un = await a.enregistrerDossier(dossier());
  base.tables.courses_gratuites.push({ id: '11111111-1111-4111-8111-111111111111', compte_id: 'u1', nom: 'Passée', course_date: '2020-01-01', distance_km: 10, dplus_m: 0, cree_le: 'x', classe: 'roulante' });
  base.tables.courses_gratuites.push({ id: '22222222-2222-4222-8222-222222222222', compte_id: 'autre', nom: 'Autre', course_date: '2027-05-01', distance_km: 10, dplus_m: 0, cree_le: 'x', classe: null });
  const liste = await dossiersG.dossiersDuCompte('u1');
  assert.deepEqual(liste.map((l) => l.nom), ['Course fictive', 'Passée']);
  assert.equal(liste[1].classe, 'roulante');
  assert.equal(await dossiersG.nombreDeDossiers('u1'), 2);
  assert.equal(await dossiersG.dossierDuCompte('u1', '22222222-2222-4222-8222-222222222222'), null);
  assert.equal(await dossiersG.dossierDuCompte('u1', 'x'), null);
  assert.equal((await dossiersG.dossierDuCompte('u1', un.id)).reponse.course.classe, 'vallonnee');
});

test('l’ordre des dossiers : à venir par date, puis passés du plus récent, puis sans date', () => {
  const l = (nom, date) => ({ id: nom, nom, date, distance_km: null, dplus_m: null, classe: null, cree_le: '' });
  const ordre = dossiersG.ordreDesDossiers([l('passé 2019', '2019-01-01'), l('sans', null), l('loin', '2028-01-01'), l('passé 2020', '2020-01-01'), l('près', '2027-01-01')], '2026-11-16');
  assert.deepEqual(ordre.map((x) => x.nom), ['près', 'loin', 'passé 2020', 'passé 2019', 'sans']);
});

// ─── Le passage au payant : lisibles et supprimables, jamais créés ──────────────────────────────────
test('un compte « normal » (acheteur ou coaché) lit ses dossiers et peut les supprimer, mais pas les modifier ni en créer', async () => {
  const base = baseEnMemoire({ courses_gratuites: [{ id: '33333333-3333-4333-8333-333333333333', compte_id: 'u1', nom: 'Avant l’achat', course_date: '2027-05-01',
    resultat: { entrees: dossier().entrees, reponse: SANS_TRACE }, strategie: null, cree_le: 'x' }] });
  poser({ session: GRATUIT, plans: [{ id: 'p1' }], base });
  const a = await frais('actionsCourses');
  assert.equal((await a.enregistrerDossier(dossier())).ok, false);
  assert.equal((await a.garderStrategieDossier('33333333-3333-4333-8333-333333333333', { entrees: { heures: '2' }, cartes: [] })).ok, false);
  assert.equal((await a.effacerStrategieDossier('33333333-3333-4333-8333-333333333333')).ok, false);
  assert.equal((await dossiersG.dossierDuCompte('u1', '33333333-3333-4333-8333-333333333333')).reponse.course.nom, 'Course fictive');
  assert.equal((await a.supprimerDossier('33333333-3333-4333-8333-333333333333')).ok, true);
  assert.equal(base.tables.courses_gratuites.length, 0);
});

test('supprimer : seulement ses lignes (le filtre du compte), refusé sans session et en coupe', async () => {
  const base = baseEnMemoire();
  poser({ session: GRATUIT, base });
  const a = await frais('actionsCourses');
  await a.supprimerDossier('44444444-4444-4444-8444-444444444444');
  const suppression = base.journal.find((j) => j.op === 'delete');
  assert.deepEqual(suppression.filtres, [['id', '44444444-4444-4444-8444-444444444444'], ['compte_id', 'u1']]);
  assert.equal((await a.supprimerDossier('pas-un-uuid')).ok, false);
  poser({ session: null });
  assert.equal((await (await frais('actionsCourses')).supprimerDossier('44444444-4444-4444-8444-444444444444')).ok, false);
  const coupe = baseEnMemoire();
  poser({ mode: 'coupe', session: GRATUIT, base: coupe });
  assert.equal((await (await frais('actionsCourses')).supprimerDossier('44444444-4444-4444-8444-444444444444')).ok, false);
  assert.equal(coupe.journal.length, 0, 'en coupe, aucune lecture ni écriture');
});

// ─── Un visiteur qui se connecte : son dossier entre dans son compte ───────────────────────────────
test('connexion d’un visiteur : son profil, puis son dossier (et sa stratégie), entrent dans le compte', async () => {
  const base = baseEnMemoire();
  poser({ session: GRATUIT, base });
  const { garderApresConnexion } = await frais('actionsGratuit');
  const stra = { entrees: { heures: '2', minutes: '15' }, cartes: [{ valeur: '45 g' }, { valeur: '500 mL' }, { valeur: 'Rien' }, { valeur: '0' }] };
  const r = await garderApresConnexion({ saisie: null, liste: false, consentementFc: false, dossier: { ...dossier(), strategie: stra } });
  assert.deepEqual(r, { ok: true, message: '', gratuit: true });
  assert.equal(base.tables.courses_gratuites.length, 1);
  assert.equal(base.tables.courses_gratuites[0].strategie.cartes[0].valeur, '45 g');
  // Sans dossier : rien de plus.
  const vide = baseEnMemoire();
  poser({ session: GRATUIT, base: vide });
  await (await frais('actionsGratuit')).garderApresConnexion({ saisie: null, liste: false, consentementFc: false });
  assert.equal(vide.tables.courses_gratuites.length, 0);
});

test('connexion : un dossier illisible ne défait pas le compte, et le dit', async () => {
  const base = baseEnMemoire();
  poser({ session: GRATUIT, base });
  const { garderApresConnexion } = await frais('actionsGratuit');
  const r = await garderApresConnexion({ saisie: null, liste: false, consentementFc: false, dossier: { entrees: 1, reponse: 2 } });
  assert.equal(r.ok, false);
  assert.equal(r.gratuit, true);
  assert.equal(base.tables.courses_gratuites.length, 0);
});

// ─── Le passage des dossiers sans plan à l'écran : rien de ce qui est interdit ─────────────────────
test('aucun texte du site pour le dossier ne parle de « ta préparation » ni de « ton plan »', () => {
  for (const f of ['components/app/courses/DossierCourse.tsx', 'components/app/courses/FormulaireCourse.tsx', 'components/app/courses/Visiteur.tsx',
    'components/app/courses/ActionsDossier.tsx', 'app/app/courses/page.tsx', 'app/app/courses/[id]/page.tsx', 'lib/app/dossierTexte.ts']) {
    const src = readFileSync(`${RACINE}${f}`, 'utf8');
    // Les commentaires de code peuvent citer la règle ; les textes affichés, non.
    const affiche = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(!/ta préparation|ton plan|ta préparation/i.test(affiche), f);
    assert.ok(!/échanger avec (le|ton) coach|écris au coach|contacte ton coach/i.test(affiche), f);
  }
});
