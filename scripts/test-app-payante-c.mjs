#!/usr/bin/env node
/**
 * LA REFONTE DE L'APP PAYANTE, étape (c) (décisions du coach du 16/11/2026) : l'onglet Courses d'un acheteur ou d'un coaché et le
 * dossier de son objectif. Le temps et la demande envoyés au moteur (la course et l'expérience, rien d'autre, sans trace), l'appel
 * côté serveur (code du site, délai, jamais d'exception), la carte à partager sans donnée personnelle, la place dans la
 * préparation, et la preuve que la page Courses d'un compte payant marche en mode « coupe ». Cas fictifs, sans réseau ni base.
 *
 *   node --test scripts/test-app-payante-c.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const lire = (c) => readFileSync(`${RACINE}${c}`, 'utf8');
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
const cp = await import(`${RACINE}lib/app/coursePlan.ts`);

const course = { date: '2027-05-09', distance_km: 42, dplus_m: 1800, temps_cible: '6h30' };

test('le temps visé du plan part dans la forme du moteur, ou pas du tout', () => {
  assert.equal(cp.tempsPourLeMoteur('6h30'), '6h30');
  assert.equal(cp.tempsPourLeMoteur('2 h 15'), '2h15');
  assert.equal(cp.tempsPourLeMoteur('3h'), '3h00');
  assert.equal(cp.tempsPourLeMoteur(''), null);
  assert.equal(cp.tempsPourLeMoteur('n’importe quoi'), null);
  assert.equal(cp.tempsPourLeMoteur('0h05'), null);
  assert.equal(cp.tempsPourLeMoteur('60h'), null);
});

test('la demande au moteur : la course, le temps visé et l’expérience, rien d’autre (ni nom, ni repère, ni trace)', () => {
  const d = cp.demandeDuPlan({ course }, 'intermediaire', '2027-03-01');
  assert.deepEqual(d, { date_course: '2027-05-09', temps_cible: '6h30', distance_km: 42, dplus_m: 1800, experience: 'intermediaire' });
  assert.deepEqual(Object.keys(cp.demandeDuPlan({ course }, '', '2027-03-01')).sort(), ['date_course', 'distance_km', 'dplus_m', 'temps_cible']);
});

test('rien à demander au moteur : saison de fond, route, course passée, temps illisible', () => {
  assert.equal(cp.demandeDuPlan({ course, fond: { saison: 1 } }, 'confirme', '2027-03-01'), null);
  assert.equal(cp.demandeDuPlan({ course: { ...course, dplus_m: 0 } }, 'confirme', '2027-03-01'), null);
  assert.equal(cp.demandeDuPlan({ course }, 'confirme', '2027-05-10'), null);
  assert.ok(cp.demandeDuPlan({ course }, 'confirme', '2027-05-09'), 'le jour J, la date est encore valable');
  assert.equal(cp.demandeDuPlan({ course: { ...course, temps_cible: '' } }, 'confirme', '2027-03-01'), null);
});

const reponse = { course: { classe: 'montagne', distance_km: 42, dplus_m: 1800, date: '2027-05-09', temps_cible: '6h30', temps_cible_h: 6.5, classe_libelle: 'Course de montagne' },
  determinants: { physio: { puces: [] } }, effort_jour_j: { plat: { libelle: 'Seuil 1' }, cote: { libelle: 'Tempo bref' }, descente: 'Au RPE' },
  profil: {}, seances_types: [] };

test('l’appel côté serveur : le code du site, sans trace, la réponse rendue ; un échec ou un délai rendent null', async () => {
  process.env.CTS_API_CLE = 'cle-de-test';
  let vu = null;
  const bon = async (url, init) => { vu = { url, init }; return new Response(JSON.stringify(reponse), { status: 200 }); };
  const r = await cp.lireCourseLibre({ date_course: '2027-05-09', temps_cible: '6h30' }, { appel: bon });
  assert.equal(r.course.classe, 'montagne');
  assert.match(vu.url, /\/v1\/course-libre$/);
  assert.equal(vu.init.headers['X-CTS-Cle'], 'cle-de-test');
  assert.equal(typeof vu.init.body, 'string', 'du JSON, jamais un envoi avec fichier GPX');
  assert.equal(await cp.lireCourseLibre({ date_course: 'x', temps_cible: 'y' }, { appel: async () => new Response('{}', { status: 422 }) }), null);
  assert.equal(await cp.lireCourseLibre({ date_course: 'x', temps_cible: 'y' }, { appel: async () => { throw new Error('réseau'); } }), null);
  const lent = (url, init) => new Promise((_, rejeter) => init.signal.addEventListener('abort', () => rejeter(new Error('abort'))));
  const t0 = Date.now();
  assert.equal(await cp.lireCourseLibre({ date_course: 'x', temps_cible: 'y' }, { appel: lent, delai: 40 }), null);
  assert.ok(Date.now() - t0 < 1000);
  delete process.env.CTS_API_CLE;
  await cp.lireCourseLibre({ date_course: 'x', temps_cible: 'y' }, { appel: bon });
  assert.equal(vu.init.headers['X-CTS-Cle'], undefined, 'sans la variable, aucun en-tête');
  assert.equal(cp.DELAI_COURSE_LIBRE_MS, 5000);
});

test('la carte à partager de l’objectif : la course seule, aucune donnée personnelle', () => {
  const plan = { course: { nom: 'Trail des Crêtes', date: '2027-05-09', distance_km: 42, dplus_m: 1800, temps_cible: '6h30' },
    profil: { points: { pas_km: null, km: [0, 1, 2], altitude_m: [100, 150, 130], plages: null, secteurs: null } } };
  const m = cp.modeleCarteDuPlan(plan, 'montagne');
  assert.deepEqual(Object.keys(m).sort(), ['classe', 'date', 'distance_km', 'dplus_m', 'nom', 'profil']);
  assert.equal(m.classe, 'montagne');
  assert.deepEqual(m.profil.altitude_m, [100, 150, 130]);
  assert.ok(!JSON.stringify(m).includes('6h30'), 'le temps visé ne part pas sur la carte');
  const sans = cp.modeleCarteDuPlan({ ...plan, profil: { points: { pas_km: null, km: null, altitude_m: null, plages: null,
    secteurs: [{ distance_km: 2, dplus_m: 100, dmoins_m: 20, type: 'x', categorie: 'y' }, { distance_km: 3, dplus_m: 0, dmoins_m: 60, type: 'x', categorie: 'y' }] } } }, 'vallonnee');
  assert.deepEqual(sans.profil.km, [0, 2, 5]);
  assert.deepEqual(sans.profil.altitude_m, [0, 80, 20]);
});

test('la place dans la préparation : la semaine en cours sur le total, comme « Ta semaine »', () => {
  const trame = ['2027-03-01', '2027-03-08', '2027-03-15', '2027-03-22'].map((lundi, i) => ({ lundi, numero: `S${i + 3}` }));
  assert.deepEqual(cp.placeDansLaPreparation(trame, '2027-03-10'), { numero: 4, total: 4 }, 'un acheteur garde le numéro du plan');
  assert.deepEqual(cp.placeDansLaPreparation(trame, '2027-03-10', '2027-03-08'), { numero: 1, total: 3 }, 'un coaché compte depuis son début');
  assert.equal(cp.placeDansLaPreparation(trame, '2027-06-01'), null);
  assert.equal(cp.placeDansLaPreparation([], '2027-03-10'), null);
});

test('la page Courses d’un compte payant marche en mode « coupe » ; seuls les dossiers du gratuit en dépendent', () => {
  const page = lire('app/app/courses/page.tsx');
  assert.match(page, /comptePayant\(acces\)/);
  assert.match(page, /acces\.mode !== 'coupe' && acces\.compteId \? await dossiersDuCompte/);
  assert.ok(page.indexOf('comptePayant') < page.indexOf('<ListeVisiteur'), 'le payant est traité avant le visiteur');
  const acces = lire('lib/app/accesCourses.ts');
  assert.match(acces, /a\.cas !== 'normal'\) return false/);
  assert.match(acces, /plansDuCompte\(id\)\)\.length > 0 \|\| Boolean\(await ficheDuCompte\(id\)\)/);
  // Le mode « coupe » n'ouvre toujours rien d'autre : le genre reste nul pour tous.
  assert.match(acces, /if \(a\.mode === 'coupe'\) return null/);
});

test('le dossier de l’objectif : l’ordre du dossier du gratuit, les blocs du plan gardés, le moteur sans retenir le reste, aucune invitation au coach', () => {
  const src = lire('components/app/courses/DossierObjectif.tsx');
  const i = (s) => src.indexOf(s);
  assert.ok(i('Dans ta préparation') < i('<BlocType') && i('<BlocType') < i('<Partie titre={profil.titre}>') && i('<Partie titre={profil.titre}>') < i('<h2 className={titreDeSection}>{d.titre}</h2>')
    && i('<h2 className={titreDeSection}>{d.titre}</h2>') < i('{!semaineDeCourse && jourJ}') && i('{!semaineDeCourse && jourJ}') < i('<BlocPartager'));
  assert.match(src, /id="jour-j"/);
  assert.match(src, /semaineDeCourse && jourJ/, 'en semaine de course, le jour J passe en tête');
  assert.match(src, /StrategieCourse/);
  assert.equal((src.match(/<Suspense fallback=\{null\}>/g) ?? []).length, 3);
  for (const f of ['components/app/courses/DossierObjectif.tsx', 'components/app/courses/CoursesPayant.tsx']) {
    assert.doesNotMatch(lire(f), /écris[- ]\w+ à ton coach|contacte ton coach|échange avec ton coach|ton coach/i, f);
  }
  assert.match(lire('app/app/plan/jour-j/page.tsx'), /#jour-j/);
  assert.match(lire('app/app/plan/course/page.tsx'), /if \(plan\.fond\) redirect\(/);
});
