#!/usr/bin/env node
/**
 * « SES COURSES » ET LA VUE D'ENSEMBLE (décision 241 du coach, 25/11/2026) : tous ses objectifs à venir dans l'ordre des dates, avec date, distance, D+, chrono visé et trace, ses courses de préparation sous chacun, les courses
 * d'une récupération sous leur majeur ; en haut de la page, en lecture, le coureur et ses courses sur une ligne de temps ; le nouvel objectif reprend la semaine de celui en cours. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-ses-courses.mjs
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
const S = await import(pathToFileURL(`${RACINE}lib/app/sesCourses.ts`).href);
const { debutApres } = await import(pathToFileURL(`${RACINE}lib/app/jonction.ts`).href);
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const jour = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const O = (planId, date, extra = {}) => ({ planId, nom: `Course ${planId}`, date, temps_cible: '5h00', format: 'TC', distance_km: '42', dplus_m: '2400', route: false, trace: false, preparations: [], ...extra });
const UNE = O('a', '2027-03-14', { trace: true, preparations: [{ nom: 'Trail de la côte', date: '2027-02-07' }] });
const REPRISE = debutApres({ course_date: UNE.date, temps_h: 5, format: 'TC' });
const DEDANS = O('b', jour(UNE.date, 5), { temps_cible: '1h00', distance_km: '10' });
const APRES = O('c', jour(REPRISE, 60));

test('une course en une ligne : distance, D+, chrono visé, trace ; sur route, ni D+ ni trace', () => {
  assert.equal(S.detailsDeLaCourse(UNE), '42 km · 2400 m D+ · chrono visé 5h00 · trace GPX donnée');
  assert.equal(S.detailsDeLaCourse(O('x', '2027-01-01', { dplus_m: '', temps_cible: '' })), '42 km · sans trace GPX');
  assert.equal(S.detailsDeLaCourse(O('r', '2027-01-01', { route: true, temps_cible: '0h46', distance_km: '10' })), '10 km · chrono visé 0h46');
});

test('les majeurs dans l’ordre des dates ; une course dans la récupération d’un majeur n’en est pas un : elle va sous lui', () => {
  const r = S.rangerSesCourses([APRES, DEDANS, UNE]);
  assert.deepEqual(r.map((x) => [x.majeur.planId, x.mineures.map((m) => m.planId)]), [['a', ['b']], ['c', []]]);
  assert.deepEqual(S.rangerSesCourses([]), []);
});

test('la ligne de temps : majeurs, préparations, courses pendant une récupération, par date ; les passées n’y sont pas', () => {
  const r = S.ligneDeTemps([APRES, DEDANS, UNE], '2027-01-01');
  assert.deepEqual(r.map((e) => [e.date, e.nom, e.genre]), [
    ['2027-02-07', 'Trail de la côte', 'Préparation'], [UNE.date, 'Course a', 'Objectif'], [DEDANS.date, 'Course b', 'Pendant la récupération'], [APRES.date, 'Course c', 'Objectif']]);
  assert.deepEqual(S.ligneDeTemps([UNE], '2027-03-01').map((e) => e.nom), ['Course a'], 'la préparation passée n’y est plus');
});

test('le coureur en lecture : côte, tapis, critères, vitesse critique et repères ; « — » quand il manque', () => {
  assert.deepEqual(S.vueDuCoureur({ cote_min: '12', tapis: 'oui', critere_intensite: 'regulier', critere_denivele: '' }, [['FC au seuil 1', '150 bpm', null], ['Vitesse critique', null, null]]), [
    ['Côte', '12 min'], ['Tapis', 'oui'], ['Intensité', 'Régulièrement'], ['Mécanique', '—'], ['FC au seuil 1', '150 bpm'], ['Vitesse critique', '—']]);
});

test('le nouvel objectif reprend la semaine de celui en cours, quand il l’a', () => {
  assert.deepEqual(S.semaineReprise({ jours_disponibles: ['mardi', 'samedi'], jour_sl: 'samedi', freq_hebdo: '2' }), { jours_disponibles: ['mardi', 'samedi'], jour_sl: 'samedi', freq_hebdo: '2' });
  for (const rien of [undefined, null, {}, { jours_disponibles: [] }]) assert.deepEqual(S.semaineReprise(rien), {});
  const p = source('app/app/coach/nouveau/page.tsx');
  assert.match(p, /const semaineDeLObjectifEnCours = v9 && suite && enCours && !aModifier && !demande/);
  assert.match(p, /suite \? \{ \.\.\.suite\.initial, \.\.\.semaineDeLObjectifEnCours \} : undefined/);
});

test('la page : la vue d’ensemble en haut, « Ses courses » dans la carte avec la ligne des récupérations, sous la 9.x seulement', () => {
  const p = source('app/app/coach/athlete/[id]/page.tsx');
  assert.match(p, /\{carte && <VueDEnsemble coureur=\{vueDuCoureur\(carte\.savoir\.valeurs, reperes\)\} courses=\{ligneDeTemps\(objectifsLus, jour\)\} \/>\}/);
  assert.match(p, /const lignesObjectifs: LigneObjectif\[\] = rangerSesCourses\(objectifsLus\)\.map/);
  const o = source('components/app/ObjectifsAVerifier.tsx');
  assert.match(o, /\{TEXTE_DANS_LA_RECUPERATION\(o\.nom\)\}/);
  assert.match(o, /\{o\.details && <span/);
  const c = source('components/app/CarteSavoir.tsx');
  assert.match(c, /<\/form>\n\n\s+\{courses\}/, '« Ses courses » hors du formulaire : elles ont les leurs');
  assert.ok(c.includes('{TEXTES_COURSES.sesCourses}') && c.includes('{TEXTES_COURSES.prochaine} · {objectif.nom}'));
  for (const t of Object.values(S.TEXTES_COURSES)) assert.ok(!/\w'\w/.test(t) && !/moteur|Hooper|RPE|trame/i.test(t), t);
});
