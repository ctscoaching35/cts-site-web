#!/usr/bin/env node
/**
 * LA SEMAINE ÉCRITE, LUE DANS SES DEUX FORMES (lib/app/semaineLue.ts ; décision du coach du 24/11/2026) : une semaine de la 8.x se lit comme avant, une semaine
 * du moteur v1 (enregistrée en local pour un athlète fictif, scripts/fixtures/moteur-v9/) se lit directement, sans copie ni conversion dans la base. Les écrans
 * et les lecteurs de la page du coaché (la comparaison avec Nolio, le compte des retouches) en tirent leurs jours, leur durée et leur RPE. Aucun réseau.
 *
 *   node --test scripts/test-semaine-lue.mjs
 */
import assert from 'node:assert/strict';
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
const lue = await charge('semaineLue');
const tableau = await charge('tableau');
const compare = await charge('semaineDansNolio');
const retouches = await charge('retouchesCompte');
const fixture = (nom) => JSON.parse(readFileSync(`${RACINE}scripts/fixtures/moteur-v9/${nom}.json`, 'utf8'));
const SEMAINE = fixture('semaine-2').reponse.semaine;
const NOLIO = fixture('nolio-seances').reponse;
const ANCIENNE = (() => {
  const trouver = (x) => {
    if (x && typeof x === 'object') {
      if (Array.isArray(x.jours) && x.jours[0]?.famille) return x;
      for (const v of Object.values(x)) { const r = trouver(v); if (r) return r; }
    }
    return null;
  };
  return trouver(JSON.parse(readFileSync(`${RACINE}lib/app/exemples/app.json`, 'utf8')));
})();

test('la forme d’une semaine : celle du moteur v1 (séance en objet, renfo présent) se distingue de celle de la 8.x (séance en texte)', () => {
  assert.equal(lue.estSemaineV9(SEMAINE), true);
  assert.equal(lue.estSemaineV9(fixture('semaine-1').reponse.semaine), true);
  assert.equal(lue.estSemaineV9(ANCIENNE), false);
  for (const x of [null, undefined, 'x', {}, { jours: [] }, { jours: 'non' }, { jours: [{ seance: 'EF', renfo: null }] }]) assert.equal(lue.estSemaineV9(x), false, JSON.stringify(x));
});

test('une semaine de la 8.x se lit telle quelle (le même objet) ; rien, rien', () => {
  assert.strictEqual(lue.lireLaSemaine(ANCIENNE), ANCIENNE);
  assert.equal(lue.lireLaSemaine(null), null);
  assert.equal(lue.lireLaSemaine('x'), null);
});

test('une semaine du moteur v1 : son numéro, son lundi, son type et son bloc dans les mots de l’app, son volume, ses séances, ses dates', () => {
  const s = lue.lireLaSemaine(SEMAINE);
  assert.equal(s.numero, 'S2');
  assert.equal(s.numero_int, 2);
  assert.equal(s.lundi, SEMAINE.lundi);
  assert.equal(s.type, 'Charge');
  assert.equal(s.bloc, 'Bloc fondations');
  assert.equal(s.volume, tableau.enHeures(SEMAINE.volume_min));
  assert.equal(s.seances, '4 séances');
  assert.equal(s.dates, '30 nov. — 6 déc.');
  assert.equal(s.moteur, '9.0');
  assert.equal(s.jours.length, 7);
});

test('les types du moteur v1 prennent les noms que l’app donne aux types d’une semaine (couleur de la bannière comprise)', () => {
  const type = (t) => lue.lireLaSemaine({ ...SEMAINE, type: t }).type;
  assert.deepEqual(['charge', 'assimilation', 'affutage_debut', 'affutage', 'affutage_1', 'course', 'recuperation'].map(type),
    ['Charge', 'Assimilation', 'Affûtage actif', 'Affûtage actif', 'Affûtage actif', 'Course', 'Récupération']);
});

test('un jour du moteur v1 : le même identifiant que sa séance, sa date, son nom, sa durée en clair, son RPE ; un repos est un repos', () => {
  const s = lue.lireLaSemaine(SEMAINE);
  const mardi = s.jours.find((j) => j.id === 'S2-mardi');
  assert.equal(mardi.jour, 'Mardi');
  assert.equal(mardi.date_iso, '2026-12-01');
  assert.equal(mardi.date, 'Mar. 01/12');
  assert.match(mardi.seance, /^Seuil 1 route · 45 min/);
  assert.equal(mardi.nom, mardi.seance);
  assert.equal(mardi.famille, 'qualite');
  assert.equal(mardi.duree, '1h15');
  assert.equal(mardi.rpe, '5');
  const repos = s.jours.find((j) => j.id === 'S2-mercredi');
  assert.deepEqual([repos.famille, repos.seance, repos.duree, repos.rpe], ['repos', 'Repos', '—', '—']);
  assert.equal(s.jours.find((j) => j.id === 'S2-jeudi').famille, 'mecanique');
  assert.equal(s.jours.find((j) => j.id === 'S2-dimanche').famille, 'sl');
  assert.equal(s.jours.find((j) => j.id === 'S2-samedi').famille, 'ef', 'une endurance');
});

test('la durée écrite se relit en minutes comme celle de la 8.x (« 1h15 » vaut 75), pour chaque séance de la semaine', () => {
  const s = lue.lireLaSemaine(SEMAINE);
  for (const j of SEMAINE.jours.filter((x) => x.seance)) {
    const lu = s.jours.find((x) => x.date_iso === j.date);
    assert.equal(tableau.minutesDe(lu.duree), Math.round(j.seance.duree_min), j.seance.id);
  }
});

test('le jour d’une course et le « + la course » : dit comme le moteur de la 8.x', () => {
  const avecCourse = { ...SEMAINE, jours: SEMAINE.jours.map((j, i) => (i === 6 ? { ...j, seance: { ...j.seance, famille: 'course', id: 'S2-dimanche', titre: 'Ta course' } } : j)) };
  const s = lue.lireLaSemaine(avecCourse);
  assert.equal(s.seances, '4 séances + la course');
  assert.equal(s.jours[6].famille, 'course');
});

test('« Pourquoi cette semaine » du moteur v1 (sa colonne) se pose sur la semaine ; sans lui, rien', () => {
  const pourquoi = fixture('semaine-2').reponse.pourquoi;
  assert.equal(lue.lireLaSemaine(SEMAINE, { pourquoi }).pourquoi.length, 7);
  assert.equal(lue.lireLaSemaine(SEMAINE).pourquoi, undefined);
  assert.equal(lue.lireLaSemaine(SEMAINE, { pourquoi: [] }).pourquoi, undefined);
});

// ─── Ce que la page du coaché en tire ───────────────────────────────────────────────────────────────

const envoyees = () => NOLIO.seances.filter((s) => s.nolio).map((s) => ({ jour_id: s.id, nolio_id: `n-${s.id}`, genre: 'seance', revision: 'r1' }));
const dansNolio = (modifier = (x) => x) => NOLIO.seances.filter((s) => s.nolio && !s.id.endsWith(':renfo')).map((s) => modifier({
  id: `n-${s.id}`, name: s.nolio.name, date_start: `${s.nolio.date_start}T08:00:00`, sport: s.nolio.sport, duration: s.nolio.duration, rpe: s.nolio.rpe, revision: 'r1' }));

test('la comparaison avec Nolio lit une semaine du moteur v1 : rien de changé, aucune marque ; une séance retirée par le coach ou une séance ajoutée se voit', () => {
  const semaine = lue.lireLaSemaine(SEMAINE);
  const sports = [NOLIO.seances[1].nolio.sport];
  const pareil = compare.comparerLaSemaine({ semaine, envoyees: envoyees().filter((e) => !e.jour_id.endsWith(':renfo')), nolio: dansNolio(), sports });
  assert.equal(pareil.lignes.length, 4, 'les quatre séances de course de la semaine');
  assert.deepEqual(pareil.lignes.flatMap((l) => l.marques), []);
  assert.deepEqual(pareil.lignes.map((l) => l.nom).sort(), NOLIO.seances.filter((s) => s.nolio && !s.id.endsWith(':renfo')).map((s) => s.nolio.name).sort());
  const retiree = compare.comparerLaSemaine({ semaine, envoyees: envoyees().filter((e) => !e.jour_id.endsWith(':renfo')), nolio: dansNolio().slice(1), sports });
  const barree = retiree.lignes.filter((l) => l.barree);
  assert.equal(barree.length, 1, 'la séance retirée reste à son jour, barrée');
  assert.match(barree[0].nom, /^Seuil 1 route/);
  assert.deepEqual(barree[0].marques.map((m) => m.quoi), ['retiree']);
  const ajoutee = compare.comparerLaSemaine({ semaine, envoyees: envoyees().filter((e) => !e.jour_id.endsWith(':renfo')),
    nolio: [...dansNolio(), { id: 'coach-1', name: 'Footing du coach', date_start: '2026-12-02T18:00:00', sport: sports[0], duration: { value: 2400, unit: 's' } }], sports });
  assert.equal(ajoutee.lignes.length, 5);
  assert.deepEqual(ajoutee.lignes.find((l) => l.nom === 'Footing du coach').marques.map((m) => m.quoi), ['ajoutee']);
});

test('le compte des retouches lit une semaine du moteur v1 : une famille par séance posée, la séance du coach modifiée se compte', () => {
  const semaine = lue.lireLaSemaine(SEMAINE);
  const nolio = new Map(dansNolio().map((x) => [x.id, { ...x, minutes: Math.round(x.duration.value / 60), date: x.date_start.slice(0, 10) }]));
  const familles = retouches.compterLaSemaine(semaine, envoyees(), nolio);
  const total = Object.values(familles).reduce((n, f) => n + f.envoyees, 0);
  assert.equal(total, envoyees().length, 'chaque séance posée est comptée dans sa famille, le renfo dans le sien');
  assert.ok(familles.seuil1?.envoyees >= 1 && familles.mecanique?.envoyees >= 1 && familles.sl?.envoyees >= 1);
});

test('les lecteurs prennent la semaine par lireLaSemaine, jamais en la lisant comme la 8.x à la main', () => {
  for (const f of ['lib/app/tableauDuPlan.ts', 'lib/app/semaineQuiArrive.ts', 'lib/app/retouches.ts', 'lib/app/espaceCoach.ts', 'app/app/coach/plan/[id]/apercu/page.tsx']) {
    assert.ok(readFileSync(`${RACINE}${f}`, 'utf8').includes('lireLaSemaine('), f);
  }
  for (const f of ['lib/app/tableauDuPlan.ts', 'lib/app/semaineQuiArrive.ts', 'lib/app/retouches.ts']) {
    assert.ok(!/donnees(\)|\s)?\s*as (unknown as )?Semaine\b/.test(readFileSync(`${RACINE}${f}`, 'utf8')), `${f} : plus de lecture en ancienne forme`);
  }
});

// ─── La trame (« Mon plan », le tableau de bord, l'espace du coach) ─────────────────────────────────

test('la trame du moteur v1 se lit dans la forme de l’app : numéro « S2 », type et bloc en mots, dates, volume, séances clés ; la charge visée n’y est pas', () => {
  const brute = fixture('trame').reponse;
  const t = lue.trameLue(brute.semaines, { date: '2027-03-14' }, '2026-12-02');
  assert.equal(t.moteur, '9.0');
  assert.deepEqual(t.course, { date: '2027-03-14' });
  assert.equal(t.semaines.length, brute.semaines.length);
  const [s1, s2, s3] = t.semaines;
  assert.deepEqual([s1.numero, s2.numero, s3.numero], ['S1', 'S2', 'S3']);
  assert.equal(s1.lundi, brute.semaines[0].lundi);
  assert.equal(s1.type, 'Charge');
  assert.equal(s1.bloc, 'Bloc fondations');
  assert.equal(s1.dates, '23 nov. — 29 nov.');
  assert.equal(s1.volume_h, brute.semaines[0].volume_h);
  assert.equal(s1.charge, null);
  assert.equal(s1.passee, true, 'la semaine du 23 est passée le 2 décembre');
  assert.equal(s2.passee, false, 'celle du 30 est en cours');
  assert.equal(s3.passee, false);
  assert.ok(s1.seances_cles.length >= 1);
  for (const c of s1.seances_cles) {
    assert.match(c.jour, /^[A-ZÉ]/);
    assert.ok(['qualite', 'mecanique', 'sl', 'course', 'ef'].includes(c.famille), c.famille);
    assert.equal(c.nom, c.seance);
  }
  assert.ok(t.semaines.every((l) => /^S\d+$/.test(l.numero) && l.lundi && l.dates));
  // Les types de la trame se lisent comme ceux des semaines écrites (la bannière et le nom d'une semaine allégée).
  assert.deepEqual([...new Set(t.semaines.map((l) => l.type))].sort(), [...new Set(brute.semaines.map((l) => lue.TYPE[l.type]))].sort());
});

test('une trame gardée avec le plan n’est la bonne que si elle vient du moteur en ligne : celle de la 8.x se redemande sous une 9.x, et celle du v1 sous une 8.x', () => {
  const huit = { course: { date: '2027-03-14' }, semaines: [] };
  const neuf = { course: { date: '2027-03-14' }, semaines: [], moteur: '9.0' };
  assert.equal(lue.trameDuBonMoteur(huit, false), true);
  assert.equal(lue.trameDuBonMoteur(neuf, true), true);
  assert.equal(lue.trameDuBonMoteur(huit, true), false);
  assert.equal(lue.trameDuBonMoteur(neuf, false), false);
  assert.equal(lue.trameDuBonMoteur(null, false), false);
  assert.equal(lue.trameDuBonMoteur(null, true), false);
});

test('la trame d’un plan : sous une 9.x elle se demande avec les paramètres du moteur v1 et se lit par trameLue ; l’espace du coach ne lit pas une trame de l’autre moteur', () => {
  const e = readFileSync(`${RACINE}lib/app/ecriture.ts`, 'utf8');
  assert.match(e, /const v9 = await moteurEstV9\(\);\n\s+if \(p\.trame && trameDuBonMoteur\(p\.trame, v9\)\) return p\.trame as Trame;/);
  assert.match(e, /await \(v9 \? trameDuMoteurV1\(planId\) : trameDu\(p\.parametres as Record<string, unknown>, cles\)\)/);
  assert.match(e, /moteur\('\/v1\/trame', \{ parametres: await parametresDuObjectifV9\(o\) \}\)/);
  const c = readFileSync(`${RACINE}lib/app/espaceCoach.ts`, 'utf8');
  assert.match(c, /p\.trame && trameDuBonMoteur\(p\.trame, v9\)/);
});

test('sous le moteur v1, une semaine pas encore écrite n’a pas de repli : celle du plan d’achat de la 8.x n’est pas celle que le moteur v1 écrira', () => {
  const t = readFileSync(`${RACINE}lib/app/tableauDuPlan.ts`, 'utf8');
  assert.match(t, /return lireLaSemaine\(data\?\.donnees\) \?\? \(\(await moteurEstV9\(\)\) \? null : duPlan\);/);
});

// ─── Les mêmes lecteurs sur une semaine de la 8.x : comme avant ─────────────────────────────────────

const SPORT = 'spt_kNYHjuEzDJRiYCX';
const seancesAncienne = () => ANCIENNE.jours.filter((j) => j.famille !== 'repos' && j.famille !== 'course' && j.date_iso);
const envoyeesAncienne = () => seancesAncienne().map((j) => ({ jour_id: j.id, nolio_id: `n-${j.id}`, genre: 'seance', revision: 'r1' }));
const nolioAncienne = (modifier = (x) => x) => seancesAncienne().map((j) => modifier({
  id: `n-${j.id}`, name: j.nom ?? j.seance, date_start: `${j.date_iso}T08:00:00`, sport: SPORT, duration: { value: tableau.minutesDe(j.duree) * 60, unit: 's' }, rpe: Number(j.rpe), revision: 'r1' }));

test('une semaine de la 8.x : la comparaison avec Nolio rend ses séances sans aucune marque, une séance déplacée ou retirée se voit', () => {
  const semaine = lue.lireLaSemaine(ANCIENNE);
  assert.strictEqual(semaine, ANCIENNE);
  const pareil = compare.comparerLaSemaine({ semaine, envoyees: envoyeesAncienne(), nolio: nolioAncienne(), sports: [SPORT] });
  assert.equal(pareil.lignes.length, seancesAncienne().length);
  assert.deepEqual(pareil.lignes.flatMap((l) => l.marques), []);
  const retiree = compare.comparerLaSemaine({ semaine, envoyees: envoyeesAncienne(), nolio: nolioAncienne().slice(1), sports: [SPORT] });
  assert.deepEqual(retiree.lignes.filter((l) => l.barree).map((l) => l.marques.map((m) => m.quoi)), [['retiree']]);
});

test('une semaine de la 8.x : le compte des retouches donne une famille par séance posée, comme avant', () => {
  const nolio = new Map(nolioAncienne().map((x) => [x.id, { ...x, minutes: Math.round(x.duration.value / 60), date: x.date_start.slice(0, 10) }]));
  const familles = retouches.compterLaSemaine(ANCIENNE, envoyeesAncienne(), nolio);
  assert.equal(Object.values(familles).reduce((n, f) => n + f.envoyees, 0), envoyeesAncienne().length);
});

test('les noms des séances du journal et la bannière lisent les deux formes', async () => {
  const { nomsDesSeances } = await charge('journalEnClair');
  const ancienne = nomsDesSeances([lue.lireLaSemaine(ANCIENNE)]);
  assert.equal(ancienne(ANCIENNE.jours[0].id), ANCIENNE.jours[0].seance);
  const v9 = nomsDesSeances([lue.lireLaSemaine(SEMAINE)]);
  assert.match(v9('S2-mardi'), /^Seuil 1 route/);
  assert.equal(v9('S2-mercredi'), 'Repos');
});
