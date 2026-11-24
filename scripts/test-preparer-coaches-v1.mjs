#!/usr/bin/env node
/**
 * PRÉPARER SES COACHÉS POUR LA v1 (25/11/2026, la v1 tourne sur les coachés ce week-end ; reports/Préparer ses coachés pour la v1, 25-11.md) : ce que le moteur v1 lit pour un
 * coaché, d'où ça vient, et le geste simple du coach pour chacune. Les essais fixent :
 *   - ce que le site envoie au moteur pour un coaché, et ce qu'il n'envoie pas encore (la liste de l'inventaire) ;
 *   - « Modifier l'objectif » d'un objectif parti : son entrée, sa course d'avant et ce qu'il courait au départ restent (lib/app/entreesGardees.ts) ;
 *   - chaque « Il manque » d'un objectif a son geste, et sa semaine habituelle est dite (lib/app/pageAthleteSimple.ts) ;
 *   - « Modifier son profil » dit ce qui sert tout de suite (lib/app/erreursDuCoach.ts) ;
 *   - l'alerte du moteur (entrée 234) : les deux phrases validées, avec les nombres du contrat de `POST /v1/prerequis` (lib/app/alerteCoach.ts), la route donnée en faux.
 * Des cas fictifs, sans réseau ni donnée d'athlète.
 *
 *   node --test scripts/test-preparer-coaches-v1.mjs
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
const charge = (f) => import(pathToFileURL(`${RACINE}${f}`).href);
const passe = await charge('lib/app/passeUnPlanV9.ts');
const gardees = await charge('lib/app/entreesGardees.ts');
const simple = await charge('lib/app/pageAthleteSimple.ts');
const erreurs = await charge('lib/app/erreursDuCoach.ts');
const alerte = await charge('lib/app/alerteCoach.ts');
const ancres = await charge('lib/app/ancresDuReglage.ts');

const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// ─── Ce que le site envoie au moteur v1 pour un coaché ────────────────────────────────────────────────────

const GPX = { montees: [{ dplus_m: 300 }], dplus_par_pente: { vallonne: 120, cote_moderee: 60, cote_raide: 20 } };
// Les réponses d'un objectif (parametres.champs), telles que le questionnaire et le départ les gardent.
const CHAMPS = {
  format: 'TC', date_course: '2027-03-14', distance_km: '42', dplus_m: '2400', temps_cible: '7h00',
  jours_disponibles: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '4',
  volume_hebdo_actuel: '5h', sortie_longue_actuelle: '2h', niveau: 'intermediaire', terrain: 'pentu',
  entree: '2026-11-30', course_precedente: { date: '2026-10-18', duree_h: 5.5 }, lu: { volume_min: 300, sl_min: 120 }, gpx: GPX,
};
const FICHE = { cote_min: '12', tapis: 'oui', critere_intensite: 'regulier', critere_denivele: 'parfois', jours_disponibles: ['lundi'], jour_sl: 'lundi', freq_hebdo: '2' };
const envoye = () => passe.parametresDuPlanV9({ parametres: { champs: CHAMPS }, profil: { vc_ms: 3.6, fc_seuil1: 150, fc_seuil2: 168, d_prime_m: 200 }, coache: true, accordLecture: true,
  premierLundi: '2026-12-07', glucides: 70 }, FICHE);

test('l’inventaire : ce que le moteur v1 lit d’un coaché et d’où ça vient (réponses de l’objectif, fiche, tests, départ)', () => {
  const p = envoye();
  // De l'objectif : la course, sa semaine habituelle, ce qu'il court (déclaré), ce que le départ a posé, sa trace.
  for (const cle of ['format', 'date_course', 'distance_km', 'dplus_m', 'temps_cible', 'jours_disponibles', 'jour_sl', 'freq_hebdo', 'volume_hebdo_actuel', 'sortie_longue_actuelle']) assert.deepEqual(p[cle], CHAMPS[cle], cle);
  assert.equal(p.coaching, 'oui');
  assert.equal(p.entree, '2026-11-30', 'l’entrée gardée au départ l’emporte sur le premier lundi du plan');
  assert.deepEqual(p.course_precedente, { date: '2026-10-18', duree_h: 5.5 });
  assert.deepEqual(p.lu, { volume_min: 300, sl_min: 120 });
  assert.deepEqual(p.gpx, GPX);
  // De la fiche, relue à chaque passage : la côte en minutes, le tapis, les deux critères ; jamais ses jours (ceux de l'objectif).
  assert.equal(p.cote_min, 12);
  assert.equal(p.tapis, 'oui');
  assert.deepEqual(p.criteres, { intensite: 'regulier', mecanique: 'parfois' });
  assert.deepEqual(p.jours_disponibles, CHAMPS.jours_disponibles, 'la fiche ne change pas la semaine d’un objectif en route : « Modifier » l’objectif');
  // Des tests, de l'accord de lecture, de la cible du calculateur.
  assert.equal(p.vc_ms, 3.6);
  assert.equal(p.fc_seuil1, 150);
  assert.equal(p.fc_seuil2, 168);
  assert.equal(p.accord_lecture, true);
  assert.equal(p.glucides_cible, 70);
  // Ce que le moteur a retiré ne part plus.
  for (const cle of ['niveau', 'terrain', 'critere_intensite', 'critere_denivele']) assert.ok(!(cle in p), cle);
});

test('ce que le site n’envoie pas encore (après la mise en ligne, avec le coach) : la liste de l’inventaire', () => {
  const p = envoye();
  // `d_prime_m` du test (C6), `aisance`, `montees` corrigé sur la fiche, `courses_mineures` (C5), `saison_de_fond` et `pic_precedent` : le moteur retombe sur ses repli (« Pourquoi cette semaine » le dit).
  for (const cle of ['d_prime_m', 'aisance', 'montees', 'courses_mineures', 'saison_de_fond', 'pic_precedent']) assert.ok(!(cle in p), `${cle} n’est pas envoyé`);
});

// ─── « Modifier l'objectif » d'un objectif parti ─────────────────────────────────────────────────────────

test('« Modifier l’objectif » : l’entrée, la course d’avant et ce qu’il courait au départ passent de l’ancien plan au nouveau, jamais par-dessus ce que le nouveau dit', () => {
  const avant = { champs: { entree: '2026-11-30', course_precedente: { date: '2026-10-18', duree_h: 5.5 }, lu: { sl_min: 120 }, gpx: GPX, temps_cible: '7h00' }, ancien: 1 };
  const neuf = { champs: { temps_cible: '6h30', format: 'TC' }, version: 'neuve' };
  const r = gardees.avecLesEntreesGardees(neuf, avant);
  assert.deepEqual(r.champs, { temps_cible: '6h30', format: 'TC', entree: '2026-11-30', course_precedente: { date: '2026-10-18', duree_h: 5.5 }, lu: { sl_min: 120 } });
  assert.equal(r.version, 'neuve');
  assert.ok(!('gpx' in r.champs), 'la trace a sa fonction (avecLeGpx) : pas deux fois');
  assert.deepEqual(neuf.champs, { temps_cible: '6h30', format: 'TC' }, 'rien n’est modifié en place');
  // Ce que le nouveau dit déjà l'emporte.
  const dit = { champs: { entree: '2026-12-07', lu: { sl_min: 90 } } };
  assert.deepEqual(gardees.avecLesEntreesGardees(dit, avant).champs, { entree: '2026-12-07', lu: { sl_min: 90 }, course_precedente: { date: '2026-10-18', duree_h: 5.5 } });
  // Rien à garder : les mêmes paramètres (la même référence).
  for (const rien of [undefined, null, {}, { champs: {} }, { champs: null }]) assert.equal(gardees.avecLesEntreesGardees(neuf, rien), neuf);
  assert.deepEqual(gardees.ENTREES_GARDEES, ['entree', 'course_precedente', 'lu']);
});

test('la route de « Modifier » : seulement pour un objectif parti, derrière la garde du moteur ; l’achat et la 8.x n’y changent rien', () => {
  const route = source('app/app/coach/athletes/route.ts');
  assert.equal((route.match(/avecLesEntreesGardees\(/g) ?? []).length, 1);
  assert.match(route, /const gardes = ancien\.demarre_le && \(await moteurEstV9\(\)\) \? avecLesEntreesGardees\(parametres, anciensParametres\) : parametres;/);
  assert.match(route, /body: JSON\.stringify\(\{ parametres: gardes \}\)/, 'le moteur reçoit ce qui sera gardé');
  assert.match(route, /intake: c2\.intake \?\? \{\}, parametres: gardes, trame: null,/, 'et c’est cela qui est gardé');
  assert.match(route, /import \{ avecLesEntreesGardees \} from '@\/lib\/app\/entreesGardees';/);
});

// ─── Chaque « Il manque » a son geste ────────────────────────────────────────────────────────────────

const SEMAINE = { jours_disponibles: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '4' };

test('sa semaine habituelle, comme l’objectif la garde : « 4 séances · mar, jeu, sam, dim · sortie longue le dimanche » ; un morceau qui manque, rien', () => {
  assert.equal(simple.semaineDeLObjectif(SEMAINE), '4 séances · mar, jeu, sam, dim · sortie longue le dimanche');
  assert.equal(simple.semaineDeLObjectif({ ...SEMAINE, freq_hebdo: 1, jours_disponibles: ['samedi'], jour_sl: 'samedi' }), '1 séance · sam · sortie longue le samedi');
  for (const mal of [{}, null, undefined, { ...SEMAINE, jours_disponibles: [] }, { ...SEMAINE, jours_disponibles: 'mardi' }, { ...SEMAINE, jour_sl: '' }, { ...SEMAINE, freq_hebdo: '0' }, { ...SEMAINE, freq_hebdo: 'beaucoup' }])
    assert.equal(simple.semaineDeLObjectif(mal), null, JSON.stringify(mal));
});

test('les gestes d’un objectif : la fiche pour la côte, les critères et le tapis ; l’objectif pour la trace et la semaine ; dans l’ordre, un seul chacun', () => {
  const complet = { cote_min: '12', tapis: 'oui', critere_intensite: 'regulier', critere_denivele: 'parfois', gpx: GPX, ...SEMAINE };
  assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif(complet)), []);
  assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif({})), ['profil', 'trace', 'semaine']);
  for (const cle of ['cote_min', 'tapis', 'critere_intensite', 'critere_denivele']) assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif({ ...complet, [cle]: undefined })), ['profil'], cle);
  assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif({ ...complet, gpx: undefined })), ['trace']);
  assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif({ ...complet, freq_hebdo: undefined })), ['semaine']);
  // Plusieurs côte, critère et tapis manquants : un seul geste, celui de la fiche.
  assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif({ gpx: GPX, ...SEMAINE })), ['profil']);
  // Une course sur route : ni côte, ni tapis, ni trace ; l'intensité (la fiche) et la semaine (l'objectif).
  assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif({ format: 'R21' })), ['profil', 'semaine']);
  assert.deepEqual(simple.gestesDeLObjectif(simple.verifierObjectif({ format: 'R21', critere_intensite: 'jamais', ...SEMAINE })), []);
  // Les mots des gestes : ceux de la carte (« Modifier son profil »), celui du bouton de l'athlète (« Ajouter la trace »), « Modifier l’objectif ».
  assert.equal(simple.TEXTES_PAGE_ATHLETE.modifierProfil, 'Modifier son profil');
  assert.equal(simple.TEXTES_PAGE_ATHLETE.gesteTrace, 'Ajouter la trace');
  assert.equal(simple.TEXTES_PAGE_ATHLETE.gesteObjectif, 'Modifier l’objectif');
});

test('les gestes sont sur la page : « Modifier son profil » ouvre le formulaire de la carte, les deux autres mènent au questionnaire de l’objectif', () => {
  const o = sansCommentaires(source('components/app/ObjectifsAVerifier.tsx'));
  assert.match(o, /<a key=\{g\} href="#geste-profil" className=\{GESTE\}>\{t\.modifierProfil\}<\/a>/);
  assert.match(o, /href=\{`\/app\/coach\/nouveau\?athlete=\$\{athleteId\}&modifier=\$\{o\.planId\}`\}/);
  assert.match(o, /g === 'trace' \? t\.gesteTrace : t\.gesteObjectif/);
  assert.match(o, /o\.verif && gestesDeLObjectif\(o\.verif\)\.length > 0/, 'rien quand tout y est');
  // Les gestes sont hors du lien de la carte (un lien ne contient pas un lien).
  assert.ok(o.indexOf('</Link>') < o.indexOf('gestesDeLObjectif(o.verif)'));
  // Le formulaire de la carte porte cette adresse, au bandeau comme sous le profil (un seul des deux est rendu).
  const c = sansCommentaires(source('components/app/CarteCoureur.tsx'));
  assert.equal((c.match(/id="geste-profil"/g) ?? []).length, 1);
  assert.match(c, /id=\{m\.cle === 'profil' \? 'geste-profil' : m\.cle === 'test_vc' \? 'geste-test-vc' : 'geste-reperes'\}/);
  assert.match(c, /<details id=\{id\} open=\{ouvert\}/);
  // La page suit l'ancre et ouvre le `details` : le même mécanisme que « Réglages ».
  const ouvert = { tagName: 'DETAILS', open: false, parentElement: null };
  assert.equal(ancres.ouvrirLaCible({ getElementById: (id) => (id === 'geste-profil' ? ouvert : null) }, 'geste-profil', false), true);
  assert.equal(ouvert.open, true);
});

// ─── Ce que dit « Modifier son profil » ─────────────────────────────────────────────────────────────────

test('« Modifier son profil » enregistré : sous la 9.x, ce qui sert tout de suite et ce qui passe par l’objectif ; sous la 8.x, la phrase d’avant', () => {
  assert.equal(erreurs.profilEnregistre(false), 'C’est enregistré. Ses prochains objectifs partent de ce profil ; « Modifier » sur son objectif en cours le lui donne aussi.');
  assert.equal(erreurs.profilEnregistre(true), 'C’est enregistré. Sa côte, ses critères et son tapis servent dès sa prochaine semaine, et ses prochains objectifs partent de ce profil ; pour ses jours, sa sortie longue et son nombre de séances, « Modifier » son objectif en cours.');
  assert.ok(!/\w'\w/.test(erreurs.profilEnregistre(true)));
  const a = sansCommentaires(source('lib/app/actionsCoaching.ts'));
  assert.ok(a.includes('return { ok: true, message: profilEnregistre(await moteurEstV9().catch(() => false)) };'));
  assert.ok(a.includes("import { moteurEstV9 } from './moteurEnLigne';"));
});

// ─── L'alerte du moteur (234) ──────────────────────────────────────────────────────────────────────────

// Ce que rend `POST /v1/prerequis` (CONTRAT_API_CTS.md, branche du moteur claude/moteur-v1-540ea4) : les deux raisons, tous les champs.
const PREREQUIS = {
  applicable: true, vendable: false, pic_atteint_pct: 62, pic_table_min: 240, sl_atteinte_min: 149, seuil_pct: 70, seances_min: 3, seances_declarees: 2,
  sl_depart_min: 95, sl_depart_min_min: 112, sl_depart_min_min_5: 115, semaines_pour_s_y_preparer: 3, raisons: ['sl', 'seances'], alerte_coach: { active: true, raisons: ['sl', 'seances'] },
};
const REPONSE = { prerequis: PREREQUIS, version_moteur: '9.0' };

test('l’alerte du coach : les deux phrases du lot validé, avec les nombres du contrat (sortie longue arrondie à 5 min, séances déclarées)', () => {
  assert.deepEqual(alerte.phrasesDeLAlerte(alerte.lirePrerequis(REPONSE)), [
    'Pour cet objectif, il lui faudrait une sortie longue de 1h55 au départ : il court aujourd’hui 1h35.',
    'Pour cet objectif, il lui faudrait 3 séances par semaine : il en a déclaré 2.',
  ]);
  const seule = (raisons) => alerte.phrasesDeLAlerte({ ...PREREQUIS, alerte_coach: { active: true, raisons } });
  assert.deepEqual(seule(['sl']), ['Pour cet objectif, il lui faudrait une sortie longue de 1h55 au départ : il court aujourd’hui 1h35.']);
  assert.deepEqual(seule(['seances']), ['Pour cet objectif, il lui faudrait 3 séances par semaine : il en a déclaré 2.']);
  assert.deepEqual(alerte.phrasesDeLAlerte({ ...PREREQUIS, sl_depart_min_min_5: 120, sl_depart_min: 60, alerte_coach: { active: true, raisons: ['sl'] } }),
    ['Pour cet objectif, il lui faudrait une sortie longue de 2h au départ : il court aujourd’hui 1h.']);
  assert.equal(alerte.TEXTES_ALERTE.sl('2h30', '1h45'), 'Pour cet objectif, il lui faudrait une sortie longue de 2h30 au départ : il court aujourd’hui 1h45.');
  assert.ok(!/moteur|calculé|\w'\w/.test(alerte.phrasesDeLAlerte(PREREQUIS).join(' ')));
});

test('l’alerte : pas d’alerte quand elle n’est pas active, applicable, ou sans ses nombres ; rien d’inventé', () => {
  const sans = (changement) => alerte.phrasesDeLAlerte({ ...PREREQUIS, ...changement });
  assert.deepEqual(sans({ alerte_coach: { active: false, raisons: [] } }), []);
  assert.deepEqual(sans({ alerte_coach: null }), [], 'un acheteur : null');
  assert.deepEqual(sans({ alerte_coach: undefined }), []);
  assert.deepEqual(sans({ applicable: false }), [], 'une saison de fond sans date n’a pas de pic de table');
  assert.deepEqual(sans({ alerte_coach: { active: true } }), [], 'aucune raison lue');
  assert.deepEqual(sans({ alerte_coach: { active: true, raisons: ['autre'] } }), []);
  // Sans le nombre qu'une phrase dit, pas de phrase (la plus petite sortie longue qui tient peut être `null`).
  assert.deepEqual(sans({ sl_depart_min_min_5: null }), ['Pour cet objectif, il lui faudrait 3 séances par semaine : il en a déclaré 2.']);
  assert.deepEqual(sans({ sl_depart_min: null, seances_min: null }), []);
  assert.deepEqual(alerte.phrasesDeLAlerte(null), []);
  assert.deepEqual(alerte.phrasesDeLAlerte(undefined), []);
  // La réponse du moteur : son `prerequis`, ou rien.
  for (const mal of [null, undefined, 'x', 3, {}, { prerequis: null }, { prerequis: [1] }, { prerequis: 'oui' }]) assert.equal(alerte.lirePrerequis(mal), null, JSON.stringify(mal));
  assert.equal(alerte.lirePrerequis(REPONSE), PREREQUIS);
});

test('les alertes de ses objectifs : un appel par objectif, en parallèle ; une lecture qui échoue ne donne rien et ne fait rien échouer', async () => {
  const appels = [];
  const lire = async (parametres) => {
    appels.push(parametres.n);
    if (parametres.n === 2) throw new Error('route absente');
    if (parametres.n === 3) return null;
    return parametres.n === 1 ? REPONSE : { prerequis: { ...PREREQUIS, alerte_coach: { active: false, raisons: [] } } };
  };
  const objectifs = [1, 2, 3, 4].map((n) => ({ planId: `p${n}`, nom: `Course ${n}`, parametres: { n } }));
  const r = await alerte.alertesDuCoach(objectifs, lire);
  assert.deepEqual(appels, [1, 2, 3, 4], 'un appel par objectif');
  assert.deepEqual(r, [{ planId: 'p1', nom: 'Course 1', phrases: alerte.phrasesDeLAlerte(PREREQUIS) }]);
  assert.deepEqual(await alerte.alertesDuCoach([], lire), []);
});

test('le lundi qui vient : jamais aujourd’hui ; l’entrée d’un objectif qui n’a pas démarré', () => {
  assert.equal(alerte.prochainLundi('2026-11-25'), '2026-11-30', 'un mercredi');
  assert.equal(alerte.prochainLundi('2026-11-29'), '2026-11-30', 'un dimanche');
  assert.equal(alerte.prochainLundi('2026-11-30'), '2026-12-07', 'un lundi : celui d’après');
  assert.equal(alerte.prochainLundi('2026-12-26'), '2026-12-28', 'un samedi, à cheval sur la fin de l’année');
});

test('la route du moteur : POST /v1/prerequis avec { parametres } ; une réponse qui ne va pas, un délai, une route absente : null', async () => {
  const vrai = globalThis.fetch;
  const vus = [];
  try {
    globalThis.fetch = async (url, init) => { vus.push({ url: String(url), init }); return { ok: true, json: async () => REPONSE }; };
    assert.deepEqual(await alerte.lirePrerequisDuMoteur({ format: 'TC' }), REPONSE);
    assert.ok(vus[0].url.endsWith('/v1/prerequis'));
    assert.equal(vus[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(vus[0].init.body), { parametres: { format: 'TC' } });
    assert.equal(vus[0].init.headers['Content-Type'], 'application/json');
    assert.ok(vus[0].init.signal, 'un délai : la page n’attend pas un moteur qui ne répond pas');
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ message: 'introuvable' }) });
    assert.equal(await alerte.lirePrerequisDuMoteur({}), null, 'la route n’est pas encore en ligne');
    globalThis.fetch = async () => { throw new Error('réseau'); };
    assert.equal(await alerte.lirePrerequisDuMoteur({}), null);
    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new Error('pas du json'); } });
    assert.equal(await alerte.lirePrerequisDuMoteur({}), null);
  } finally {
    globalThis.fetch = vrai;
  }
});

test('l’alerte dans « À faire pour lui » : après ses points, avant les étapes de son entrée ; rien sans alerte ; la page la lit sous la 9.x seulement, pour un objectif pas démarré', () => {
  const entree = { etapes: [{ cle: 'depart', fait: false, action: { texte: 'Démarrer', href: '/x' } }] };
  const ligne = { planId: 'p1', nom: 'Course 1', phrases: ['Phrase.'], href: '/app/coach/nouveau?athlete=a&modifier=p1' };
  const avec = simple.aFairePourLui([], entree, false, [ligne]);
  assert.deepEqual(avec.map((l) => l.type), ['alerte', 'entree']);
  assert.deepEqual(avec[0].alerte, ligne);
  assert.deepEqual(simple.aFairePourLui([], entree, false).map((l) => l.type), ['entree'], 'sans alerte, comme avant');
  assert.deepEqual(simple.aFairePourLui([], entree, false, []), simple.aFairePourLui([], entree, false));
  const page = sansCommentaires(source('app/app/coach/athlete/[id]/page.tsx'));
  assert.match(page, /const alertes: LigneAlerte\[\] = v9 \? \(await alertesDuCoach\(objectifsAVenir\.flatMap\(\(o\) => \{/);
  assert.match(page, /if \(!p\?\.parametres \|\| p\.demarre_le\) return \[\];/, 'un objectif pas démarré : c’est « au départ »');
  assert.match(page, /premierLundi: \(p\.depart_prevu as string \| null\) \?\? prochainLundi\(jour\)/);
  assert.match(page, /\}\), lirePrerequisDuMoteur\)\)\.map\(\(x\) => \(\{ \.\.\.x, href: `\/app\/coach\/nouveau\?athlete=\$\{a\.id\}&modifier=\$\{x\.planId\}` \}\)\) : \[\];/);
  assert.ok(page.indexOf('const alertes: LigneAlerte[]') < page.indexOf('const lignesAFaire = v9'), 'lues avant d’être rangées');
  const c = sansCommentaires(source('components/app/PointsPourLui.tsx'));
  assert.match(c, /l\.type === 'alerte' \? \(/);
  assert.match(c, /\{l\.alerte\.phrases\.map\(\(ph\) => <span key=\{ph\}/);
  assert.match(c, /<Link href=\{l\.alerte\.href\} className=\{geste\}>\{t\.gesteObjectif\}<\/Link>/);
});
