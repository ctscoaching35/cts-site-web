#!/usr/bin/env node
/**
 * CE QUE LE MOTEUR v1 LIT DE CE QU'IL COURT AU DÉPART (entrée 203, décision du coach du 24/11/2026, « Oui, valide » ; lib/app/charge.ts, luAuDepart, et le lecteur,
 * lib/app/luAuDepart.ts) :
 *   - `sl_min` : sa plus longue sortie des 4 dernières semaines, jours de course exclus ;
 *   - `volume_min` : la moyenne de ses 4 plus grosses semaines des 8 dernières, les semaines où il a couru une course exclues ; une semaine vide n'y est jamais ;
 *   - course, trail et tapis seulement ; sans aucune activité lue, pas de `lu` (le déclaré du questionnaire).
 * Le calcul est essayé seul ; le lecteur avec de fausses pièces (Nolio, la base) qui notent chaque appel. Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-lu-au-depart.mjs
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
// De fausses pièces : Nolio rend ce que globalThis.__nolio lui donne et note chaque lecture ; la base ne sait que la table des accords.
const FAUX = {
  '/lib/app/nolio.ts': `
export const SPORTS_COURSE = ['spt_course', 'spt_trail', 'spt_tapis'];
export const nolioConfigure = () => globalThis.__configure !== false;
export const moiNolio = async () => ({ id: globalThis.__moi ?? 'usr_coach' });
export const sansVitesseImpossible = (r) => r;
export const listeNolio = async (chemin) => {
  globalThis.__lectures.push(chemin);
  if (globalThis.__panne && chemin.startsWith(globalThis.__panne)) throw new Error('Nolio ne répond pas');
  const cle = Object.keys(globalThis.__nolio).find((k) => chemin.startsWith(k));
  return cle ? structuredClone(globalThis.__nolio[cle]) : [];
};`,
  '/lib/app/supabase.ts': `
export const clientService = () => ({ from: (table) => { const f = { table }; const ch = { select: () => ch, eq: (k, v) => { f[k] = v; return ch; },
  maybeSingle: async () => { globalThis.__bases.push([f.table, f]); return { data: globalThis.__accord === false ? null : { accord_le: '2026-11-01' }, error: null }; } }; return ch; } });`,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    let r;
    try {
      r = nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    const cle = Object.keys(FAUX).find((f) => r.url.endsWith(f));
    return cle ? { url: `data:text/javascript,${encodeURIComponent(FAUX[cle])}`, shortCircuit: true } : r;
  },
});
const { luAuDepart, fenetreDuDepart } = await import(pathToFileURL(`${RACINE}lib/app/charge.ts`).href);
const { lireLuAuDepart } = await import(pathToFileURL(`${RACINE}lib/app/luAuDepart.ts`).href);

// Le lundi de la semaine que le moteur va écrire. Les 8 semaines lues : lundis 05/10, 12/10, 19/10, 26/10 | 02/11, 09/11, 16/11, 23/11 ; les 4 dernières : de 02/11 à 29/11.
const LUNDI = '2026-11-30';
const SEMAINES = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'];
const jour = (lundi, n) => new Date(Date.parse(`${lundi}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
// Une semaine de sorties : [jour 0 à 6, minutes].
const semaine = (i, ...sorties) => sorties.map(([n, min]) => ({ date: jour(SEMAINES[i], n), min }));

test('les semaines lues : les 8 complètes avant le lundi écrit, les 4 dernières pour la sortie longue', () => {
  assert.deepEqual(fenetreDuDepart(LUNDI), { debut: '2026-10-05', debutSl: '2026-11-02', fin: '2026-11-30' });
});

test('une série affûtage, course puis récupération : le volume vient des semaines de charge, la SL ne prend pas la course', () => {
  const course = jour(SEMAINES[5], 6); // le dimanche 15/11
  const activites = [
    ...semaine(0, [1, 120], [3, 90], [5, 150]), // 360
    ...semaine(1, [1, 120], [3, 100], [5, 200]), // 420
    ...semaine(2, [1, 140], [3, 120], [5, 220]), // 480
    ...semaine(3, [1, 120], [3, 90], [5, 180]), // 390
    ...semaine(4, [1, 60], [3, 50], [5, 90]), // 200, l'affûtage
    ...semaine(5, [1, 40], [3, 70], [6, 300]), // sa semaine de course : 70 min d'entraînement le jeudi et la course (300 min) le dimanche
    ...semaine(6, [2, 30], [4, 60]), // 90, la récupération
    ...semaine(7, [1, 50], [3, 40], [5, 60]), // 150
  ];
  // Sans la semaine de course : 360, 420, 480, 390, 200, 90, 150 ; ses 4 plus grosses : 480, 420, 390, 360, soit 412,5. Sa SL des 4 dernières : 90 (la course de 300 n'y est pas).
  assert.deepEqual(luAuDepart(LUNDI, activites, [course]), { volume_min: 413, sl_min: 90 });
  // Sans le calendrier des courses, la course de 300 min serait sa plus longue sortie et sa semaine de course (410) entrerait dans ses plus grosses : c'est ce que la règle évite.
  assert.deepEqual(luAuDepart(LUNDI, activites, []), { volume_min: 425, sl_min: 300 });
});

test('une semaine vide n’est jamais parmi les plus grosses ; une semaine exceptionnelle y pèse peu', () => {
  const huit = (...volumes) => volumes.flatMap((min, i) => (min ? semaine(i, [2, min]) : []));
  assert.equal(luAuDepart(LUNDI, huit(0, 300, 320, 280, 310, 0, 290, 0), []).volume_min, 305, '320, 310, 300, 290 : les vides ne comptent pas');
  assert.equal(luAuDepart(LUNDI, huit(300, 300, 300, 300, 300, 300, 300, 600), []).volume_min, 375, 'un week-end choc : 600, 300, 300, 300');
  // Moins de 4 semaines courues : la moyenne de celles qui existent (une semaine vide ne la fait jamais baisser).
  assert.equal(luAuDepart(LUNDI, huit(0, 0, 0, 0, 0, 0, 200, 100), []).volume_min, 150);
});

test('aucun historique : rien (le moteur garde le déclaré) ; rien d’avant les 8 semaines, rien de la semaine du lundi écrit, rien de nul', () => {
  assert.equal(luAuDepart(LUNDI, [], []), null);
  assert.equal(luAuDepart(LUNDI, [{ date: '2026-10-04', min: 90 }, { date: '2026-11-30', min: 90 }, { date: '2026-11-02', min: 0 }], []), null);
});

test('rien qu’une course : ni volume (sa semaine est écartée) ni SL (son jour l’est)', () => {
  const course = jour(SEMAINES[6], 5);
  assert.equal(luAuDepart(LUNDI, [{ date: course, min: 240 }], [course]), null);
});

test('la sortie longue ne regarde que les 4 dernières semaines ; le volume regarde les 8', () => {
  const activites = [...semaine(1, [5, 240]), ...semaine(5, [2, 100]), ...semaine(6, [4, 80]), ...semaine(7, [2, 90])];
  // 240 min, il y a 7 semaines : hors de la SL, mais sa semaine compte pour le volume (240, 100, 80, 90 : 127,5).
  assert.deepEqual(luAuDepart(LUNDI, activites, []), { volume_min: 128, sl_min: 100 });
  // Rien dans les 4 dernières semaines : le volume se lit encore sur les 8, la SL n'est pas donnée (le déclaré).
  assert.deepEqual(luAuDepart(LUNDI, semaine(1, [5, 240]), []), { volume_min: 240 });
});

test('les entraînements de la semaine d’une course comptent pour la SL (seul le jour de course est exclu)', () => {
  const course = jour(SEMAINES[7], 6);
  const activites = [...semaine(7, [1, 100], [6, 250])];
  assert.deepEqual(luAuDepart(LUNDI, activites, [course]), { sl_min: 100 });
});

// ─── Le lecteur ─────────────────────────────────────────────────────────────────────────────────────

const lecteur = async ({ usr = 'usr_1', moi = 'usr_coach', nolio = {}, accord = true, configure = true, panne = null } = {}) => {
  globalThis.__lectures = []; globalThis.__bases = []; globalThis.__nolio = nolio; globalThis.__moi = moi; globalThis.__accord = accord; globalThis.__configure = configure; globalThis.__panne = panne;
  try {
    return { lu: await lireLuAuDepart('coach_1', usr, LUNDI), lectures: globalThis.__lectures };
  } catch (e) {
    return { erreur: e.message, lectures: globalThis.__lectures };
  }
};
const reel = (date, minutes, sport = 'spt_course') => ({ id: `r_${date}_${sport}`, date_start: `${date}T07:00:00`, duration: { value: minutes * 60 }, sport });

test('le lecteur : les activités de course, trail et tapis des 8 semaines et le calendrier des courses de l’athlète, lus une fois', async () => {
  const course = jour(SEMAINES[6], 6);
  const r = await lecteur({ nolio: {
    'planned/competitions/': [{ id: 'c1', date_start: `${course}T00:00:00` }],
    'real/trainings/': [reel(jour(SEMAINES[3], 2), 200), reel(jour(SEMAINES[4], 2), 100, 'spt_trail'), reel(jour(SEMAINES[5], 3), 60, 'spt_tapis'),
      reel(jour(SEMAINES[5], 4), 300, 'spt_velo'), reel(course, 240), reel(jour(SEMAINES[6], 1), 50)],
  } });
  assert.deepEqual(r.lectures, [
    'planned/competitions/?date_from=2026-10-05&date_to=2026-11-29&fields=id,date_start&athlete=usr_1',
    'real/trainings/?date_from=2026-10-05&date_to=2026-11-29&fields=id,date_start,duration,distance,sport&athlete=usr_1',
  ]);
  // Le vélo est écarté ; la semaine de la course (50 + 240) aussi ; restent 200, 100 et 60 : volume 120 ; SL : 100 (la course et le vélo n'y sont pas).
  assert.deepEqual(r.lu, { volume_min: 120, sl_min: 100 });
});

test('le lecteur : le coach lui-même n’a pas de paramètre d’athlète ; sans activité lue, rien', async () => {
  const r = await lecteur({ usr: 'usr_coach', nolio: {} });
  assert.equal(r.lu, null);
  assert.ok(r.lectures.every((l) => !l.includes('athlete=')), r.lectures.join(' | '));
  assert.equal(r.lectures.length, 2);
});

test('le lecteur : sans Nolio relié, sans Nolio configuré ou sans accord de lecture, il ne lit rien', async () => {
  for (const cas of [{ usr: null }, { configure: false }, { accord: false }]) {
    const r = await lecteur({ nolio: { 'real/trainings/': [reel(jour(SEMAINES[7], 1), 90)] }, ...cas });
    assert.equal(r.lu, null, JSON.stringify(cas));
    assert.deepEqual(r.lectures, [], JSON.stringify(cas));
  }
});

test('le lecteur : une lecture de Nolio qui échoue remonte, jamais un `lu` calculé sans le calendrier des courses', async () => {
  for (const panne of ['planned/competitions/', 'real/trainings/']) {
    const r = await lecteur({ nolio: { 'real/trainings/': [reel(jour(SEMAINES[7], 1), 90)] }, panne });
    assert.equal(r.erreur, 'Nolio ne répond pas', panne);
    assert.equal(r.lu, undefined, panne);
  }
});
