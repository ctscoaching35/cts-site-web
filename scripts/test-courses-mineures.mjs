#!/usr/bin/env node
/**
 * LES COURSES DE PRÉPARATION D'UN COACHÉ, SOUS LA 9.x (décision du coach du 25/11/2026, C5 : « le moteur v1 lit `courses_mineures` ; la durée est le chrono visé », entrée 214 ; CONTRAT_API_CTS.md, branche du moteur
 * claude/moteur-v1-540ea4) : ce qui part au moteur (`parametres.courses_mineures` : date, durée en heures, nom), d'un coaché seulement ; le serveur qui ajoute, modifie et retire une course sans le moteur de la 8.x ;
 * la saisie qui revient dans « Ses objectifs » de la page de l'athlète. Des cas fictifs, sans réseau ni donnée d'athlète.
 *
 *   node --test scripts/test-courses-mineures.mjs
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
const charge = (f) => import(pathToFileURL(`${RACINE}${f}`).href);
const moteur = await charge('lib/app/moteurV9.ts');
const passe = await charge('lib/app/passeUnPlanV9.ts');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// Ce que le site garde d'une course de préparation (`parametres.courses_secondaires`, lib/app/actionsEcriture.ts).
const COURSE = (changement = {}) => ({ nom: 'Trail du Mont', date: '2026-12-20', distance_km: 21, dplus_m: 900, discipline: 'trail', mode: 'gestion', temps_h: 2.25, chrono: '2h15', ...changement });

test('une course de préparation part au moteur comme le contrat la décrit : sa date, sa durée en heures (le chrono visé), son nom ; rien d’autre', () => {
  const [c] = moteur.coursesMineuresDe([COURSE()]);
  assert.deepEqual(c, { date: '2026-12-20', duree_h: 2.25, nom: 'Trail du Mont' });
  // La forme du contrat : `{ "date": "AAAA-MM-JJ", "duree_h": 2.5, "nom"?: "…" }` ; ni distance, ni D+, ni mode, ni discipline.
  for (const cle of Object.keys(c)) assert.ok(['date', 'duree_h', 'nom'].includes(cle), cle);
  assert.equal(typeof c.duree_h, 'number');
  assert.deepEqual(moteur.coursesMineuresDe([COURSE({ temps_h: 0.75, chrono: '0h45', discipline: 'route', dplus_m: 0 })]), [{ date: '2026-12-20', duree_h: 0.75, nom: 'Trail du Mont' }]);
  assert.equal(moteur.coursesMineuresDe([COURSE({ temps_h: 2.3333333 })])[0].duree_h, 2.33, 'deux décimales');
});

test('sans chrono lisible, pas de durée (le moteur prend la tranche de 1 h 30 à 3 h et le dit) ; sans nom, pas de nom ; une date illisible, rien', () => {
  assert.deepEqual(moteur.coursesMineuresDe([COURSE({ temps_h: null, nom: '' })]), [{ date: '2026-12-20' }]);
  assert.deepEqual(moteur.coursesMineuresDe([COURSE({ temps_h: 0 })]), [{ date: '2026-12-20', nom: 'Trail du Mont' }]);
  assert.deepEqual(moteur.coursesMineuresDe([COURSE({ temps_h: undefined, nom: '  Les Crêtes  ' })]), [{ date: '2026-12-20', nom: 'Les Crêtes' }]);
  assert.equal(moteur.coursesMineuresDe([COURSE({ nom: 'x'.repeat(200) })])[0].nom.length, 80);
  for (const date of ['demain', '2026-12-2', '', null, undefined, 20261220]) assert.deepEqual(moteur.coursesMineuresDe([COURSE({ date })]), [], String(date));
  for (const rien of [undefined, null, 'x', {}, [], [null], [3]]) assert.deepEqual(moteur.coursesMineuresDe(rien), [], JSON.stringify(rien));
});

test('rangées par date, jamais deux le même jour ; celles d’avant son entrée ne partent pas', () => {
  const r = moteur.coursesMineuresDe([COURSE({ date: '2027-01-17', nom: 'B' }), COURSE({ date: '2026-12-20', nom: 'A' }), COURSE({ date: '2026-12-20', nom: 'A bis' }), COURSE({ date: '2026-11-22', nom: 'Passée' })]);
  assert.deepEqual(r.map((c) => c.nom), ['Passée', 'A', 'B']);
  const depuis = moteur.coursesMineuresDe([COURSE({ date: '2026-11-22', nom: 'Passée' }), COURSE({ date: '2026-11-30', nom: 'Le jour de l’entrée' }), COURSE({ date: '2026-12-20', nom: 'A' })], '2026-11-30');
  assert.deepEqual(depuis.map((c) => c.nom), ['Le jour de l’entrée', 'A']);
});

// Les paramètres que le site envoie pour un plan (lib/app/passeUnPlanV9.ts) : ses courses sont dans `parametres.courses_secondaires`, pas dans les réponses.
const CHAMPS = { format: 'TC', date_course: '2027-03-14', distance_km: '42', dplus_m: '2400', temps_cible: '7h00', jours_disponibles: ['mardi', 'samedi'], jour_sl: 'samedi', freq_hebdo: '2', entree: '2026-11-30' };
const envoye = (coache, courses, changement = {}) => passe.parametresDuPlanV9({ parametres: { champs: { ...CHAMPS, ...changement }, courses_secondaires: courses }, profil: {}, coache, accordLecture: true, premierLundi: '2026-11-30' }, null);

test('pour un coaché, `courses_mineures` part avec les paramètres ; pour un acheteur, jamais ; sans course, rien', () => {
  const c = envoye(true, [COURSE(), COURSE({ date: '2027-01-17', nom: 'Les Crêtes', temps_h: 3 })]);
  assert.deepEqual(c.courses_mineures, [{ date: '2026-12-20', duree_h: 2.25, nom: 'Trail du Mont' }, { date: '2027-01-17', duree_h: 3, nom: 'Les Crêtes' }]);
  assert.equal(c.coaching, 'oui');
  assert.ok(!('courses_mineures' in envoye(false, [COURSE()])), 'un acheteur n’a pas de course de préparation');
  assert.ok(!('courses_mineures' in envoye(true, [])), 'rien à envoyer : la clé n’est pas là');
  assert.ok(!('courses_mineures' in envoye(true, undefined)));
  // Une course d'avant son entrée (le lundi de sa première semaine, celui de l'objectif parti ou, à défaut, le prochain) ne part pas.
  assert.deepEqual(envoye(true, [COURSE({ date: '2026-11-22' })]).courses_mineures, undefined);
  assert.deepEqual(envoye(true, [COURSE({ date: '2026-11-22' }), COURSE()], { entree: '2026-11-16' }).courses_mineures.map((x) => x.date), ['2026-11-22', '2026-12-20']);
  // Les courses ne passent que par `courses_mineures` : l'ancienne clé ne part pas, ni dans les réponses.
  assert.ok(!('courses_secondaires' in c));
});

test('un objectif majeur n’est pas une course mineure : l’objectif du plan n’y est jamais', () => {
  const c = envoye(true, [COURSE()]);
  assert.ok(!c.courses_mineures.some((x) => x.date === CHAMPS.date_course));
  assert.equal(c.date_course, '2027-03-14', 'il reste l’objectif du plan');
});

// ─── Le serveur ────────────────────────────────────────────────────────────────────────────────────

test('le serveur : sous la 9.x un coaché ajoute sa course sans le moteur de la 8.x, un acheteur est refusé ; la course tombe avant l’objectif ; la trame se refait', () => {
  const a = sansCommentaires(source('lib/app/actionsEcriture.ts'));
  assert.match(a, /const v9 = await moteurEstV9\(\);\n\s*if \(v9 && !o\.coache\) return \{ ok: false, message: MESSAGE_COURSE_DE_PREPARATION_FERMEE \};/);
  assert.match(a, /if \(v9 && date >= o\.plan\.course\.date\) return \{ ok: false, message: 'Choisis une date avant celle de ton objectif\.' \};/);
  assert.ok(!a.includes('Ta course doit tomber avant ton objectif'), 'la phrase dit quoi faire (décision 236)');
  // La route retirée n'est appelée que sous la 8.x, une seule fois.
  assert.equal((a.match(/\/v1\/course-secondaire/g) ?? []).length, 1);
  assert.match(a, /if \(!v9\) \{\n\s*const reelles[^]*?\/v1\/course-secondaire[^]*?\n  \}\n/);
  // La course se garde dans `courses_secondaires` (d'où `courses_mineures` la lit) et la trame gardée se refait, sous la 9.x ; la 8.x garde son écriture d'avant.
  assert.match(a, /update\(\{ parametres: \{ \.\.\.o\.parametres, courses_secondaires: \[\.\.\.autres, course\] \}, \.\.\.\(v9 \? \{ trame: null \} : \{\}\) \}\)/);
  assert.match(a, /courses_secondaires: courses\.filter\(\(c\) => c\.date !== date\) \}, \.\.\.\(\(await moteurEstV9\(\)\) \? \{ trame: null \} : \{\}\) \}\)/, 'retirer : de même');
  // Les textes que dit le serveur sous la 8.x ne changent pas.
  assert.ok(a.includes("' Ses semaines s’ajustent autour d’elle dans le moteur.'"));
  assert.ok(a.includes("v9 ? ' Ses prochaines semaines s’ajustent autour d’elle.'"));
});

// ─── La saisie, dans « Ses objectifs » ─────────────────────────────────────────────────────────────

test('« Ses courses de préparation » : sous chaque objectif de « Ses objectifs », le formulaire de toujours sans « Comment tu la cours ? » ; la page de l’objectif garde sa section cachée', () => {
  const g = source('components/app/GestesEcriture.tsx');
  assert.match(g, /\{!sansMode && <div className="text-xs font-semibold text-indigo">Comment tu la cours \?/);
  assert.match(g, /<AjouterCourse planId=\{planId\} ancienne=\{course\.date\} sansMode=\{sansMode\}/, 'modifier aussi');
  const c = sansCommentaires(source('components/app/CoursesDePreparation.tsx'));
  assert.match(c, /<AjouterCourse planId=\{planId\} sansMode \/>/);
  assert.match(c, /<ModifierCourse planId=\{planId\} course=\{c\} sansMode \/>/);
  assert.match(c, /<RetirerCourse planId=\{planId\} date=\{c\.date\} nom=\{c\.nom\} \/>/);
  assert.match(c, /\{c\.date > jour && \(/, 'seule une course à venir se modifie ou se retire');
  for (const t of ['t.coursesDePreparation', 't.aucuneCourse', 't.ajouterUneCourse']) assert.ok(c.includes(t), t);
  const o = sansCommentaires(source('components/app/ObjectifsAVerifier.tsx'));
  assert.match(o, /\{o\.courses && <CoursesDePreparation planId=\{o\.planId\} courses=\{o\.courses\} jour=\{jour\} \/>\}/);
  assert.match(o, /courses\?: CourseDePreparation\[\] \| null/);
  const page = sansCommentaires(source('app/app/coach/athlete/[id]/page.tsx'));
  assert.match(page, /courses: parametres \? \(\(parametres as \{ courses_secondaires\?: CourseDePreparation\[\] \}\)\.courses_secondaires \?\? \[\]\) : null/);
  assert.match(page, /<ObjectifsAVerifier athleteId=\{a\.id\} lignes=\{lignesObjectifs\} jour=\{jour\} \/>/);
  // Les textes sont ceux du coach, dans le fichier des textes de la page ; la page de l'objectif garde sa section cachée sous la 9.x.
  const t = source('lib/app/pageAthleteSimple.ts');
  for (const m of ["coursesDePreparation: 'Ses courses de préparation'", "aucuneCourse: 'Aucune pour l’instant.'", "ajouterUneCourse: 'Ajouter une course de préparation'"]) assert.ok(t.includes(m), m);
  assert.match(source('app/app/coach/plan/[id]/page.tsx'), /\{preparationsDisponibles\(v9\) && ecriture\?\.parametres && \(/);
});

test('dans son app, le coaché ajoute sa course sans « Comment tu la cours ? » sous la 9.x ; un acheteur n’a pas la carte', () => {
  const p = sansCommentaires(source('app/app/plan/page.tsx'));
  assert.match(p, /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/);
  assert.match(p, /\{d\.ecrit && !plan\.fond && \(!v9 \|\| ctx\.coache\) && \(/);
  assert.match(p, /<ModifierCourse planId=\{ctx\.cle\} course=\{c\} sansMode=\{v9\} \/>/);
  assert.match(p, /<AjouterCourse planId=\{ctx\.cle\} sansMode=\{v9\} \/>/);
});

// ─── Une seule course dans Nolio ──────────────────────────────────────────────────────────────────

// Ce que la v1 rend pour la semaine d'une course de préparation (CONTRAT_API_CTS.md : « la course comme une séance `famille: "course"`, sans étapes » ; `POST /v1/nolio/seances` : « `nolio` est `null` pour la course »).
const SEMAINE_G8 = {
  cycle: { name: 'S4', date_start: '2026-12-14', date_end: '2026-12-20', color: '#123456' },
  seances: [
    { id: 'S4-mardi', famille: 'endurance', nolio: { name: 'EF', date_start: '2026-12-15' } },
    { id: 'S4-samedi', famille: 'course', nolio: null },
    { id: 'S4-dimanche', famille: 'sl', nolio: null },
  ],
};

test('un seul objet dans Nolio pour une course de préparation : la compétition que le site pose ; la séance « course » de la v1 n’y part pas', async () => {
  const ecriture = await charge('lib/app/ecritureV9.ts');
  const creations = [];
  const port = { creer: async (id, corps, genre) => { creations.push([genre, id]); return { jour_id: id, nolio_id: `n-${id}` }; }, poserLaNote: async () => {}, garder: async () => {} };
  const r = await ecriture.envoyerLaSemaine(port, { numero: 4, lundi: '2026-12-14', seances: SEMAINE_G8, note: ['Une ligne.'] });
  assert.deepEqual(creations, [['cycle', 'semaine'], ['seance', 'S4-mardi']], 'la séance « course » (nolio null) ne part pas');
  assert.equal(r.seances, 1);
  // Du côté du site : la seule création d'une course dans le calendrier de Nolio est `poserCourse` (lib/app/ecriture.ts), une fois par date, jamais par-dessus une compétition déjà posée ce jour-là.
  const lecteurs = (motif) => execFileSync('grep', ['-rlE', motif, 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  assert.deepEqual(lecteurs("'POST', 'planned/competitions/'"), ['lib/app/ecriture.ts'], 'une seule porte pour poser une compétition');
  const e = source('lib/app/ecriture.ts');
  assert.match(e, /export async function poserCourse\(o: Objectif, c: Course, principale: boolean\) \{\n  const cle = `course:\$\{c\.date\}`;\n  if \(!o\.nolioAthlete \|\| o\.envois\.some\(\(e\) => e\.semaine === cle\)\) return;/, 'une course déjà posée par le site : rien');
  assert.match(e, /if \(deja\.length\) return;/, 'une compétition déjà posée ce jour-là, par le coach ou l’athlète : rien');
  // La chaîne de la v1 ne pose jamais de compétition : ni elle, ni son écriture, ni son départ ne l'appellent hors de poserCourse.
  for (const f of ['lib/app/ecritureV9.ts', 'lib/app/passagesV9.ts', 'lib/app/passeUnPlanV9.ts', 'lib/app/nolioV9.ts']) assert.ok(!/planned\/competitions/.test(source(f)), f);
  assert.ok(!/famille === 'course'|famille: 'course'/.test(sansCommentaires(source('lib/app/passagesV9.ts'))), 'la chaîne n’invente pas de séance « course »');
});
