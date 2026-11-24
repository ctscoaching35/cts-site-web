#!/usr/bin/env node
/**
 * LES HEURES DU DIMANCHE SOUS LE MOTEUR v1 (décision 211 du coach, 24/11/2026 ; lib/app/heuresDePassage.ts, lib/app/rappelDimancheV9.ts, vercel.json) : à l'heure de PARIS toute
 * l'année, alors que les tâches de Vercel sont en UTC. Le point du dimanche et le Hooper sont à midi ; le rappel part vers 19 h ; la semaine s'écrit à 21 h, avec une reprise à 22 h
 * (celle de 18 h est retirée) ; le lundi ne change pas. Les essais prennent le VRAI vercel.json, le font « tirer » à chaque lancement possible un dimanche d'hiver et un dimanche
 * d'été (et ceux où l'heure change), et comptent ce que chaque moteur ferait. Sous la 8.x, rien ne change. Aucun réseau, aucune donnée.
 *
 *   node --test scripts/test-heures-v9.mjs
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
const h = await import(pathToFileURL(`${RACINE}lib/app/heuresDePassage.ts`).href);
const r = await import(pathToFileURL(`${RACINE}lib/app/rappelDimancheV9.ts`).href);
const crons = JSON.parse(readFileSync(`${RACINE}vercel.json`, 'utf8')).crons;
const planifications = (chemin) => crons.filter((c) => c.path === chemin).map((c) => c.schedule);

// Des dimanches : l'hiver (heure de Paris = UTC + 1), l'été (UTC + 2), et ceux où l'heure change (le 28/03/2027 on passe à l'été à 2 h ; le 25/10/2026 on repasse à l'hiver à 3 h).
const DIMANCHES = { 'hiver': '2026-12-06', 'été': '2027-06-06', 'passage à l’heure d’été (28/03/2027)': '2027-03-28', 'retour à l’heure d’hiver (25/10/2026)': '2026-10-25' };
// Un lancement « 0 H * * 0 » : Vercel le lance dans l'heure prévue ; on essaie le début (H:00) et la fin (H:59) de cette heure.
const lancement = (jour, expression, minute) => new Date(`${jour}T${String(Number(expression.split(' ')[1])).padStart(2, '0')}:${minute}:00Z`);
// Ce que fait, ce jour-là, une liste d'expressions pour une garde : les heures de Paris des lancements qui agissent.
const agit = (jour, expressions, garde) => expressions.flatMap((e) => [':00', ':59'].map((m) => lancement(jour, e, m.slice(1)))).filter(garde).map((d) => h.heureDeParis(d));

test('l’heure de Paris d’un lancement UTC : l’hiver UTC + 1, l’été UTC + 2, y compris le jour où elle change', () => {
  assert.equal(h.heureDeParis(new Date('2026-12-06T20:00:00Z')), 21);
  assert.equal(h.heureDeParis(new Date('2027-06-06T19:00:00Z')), 21);
  assert.equal(h.heureDeParis(new Date('2027-03-28T00:30:00Z')), 1, 'avant le changement : UTC + 1');
  assert.equal(h.heureDeParis(new Date('2027-03-28T01:30:00Z')), 3, '1 h UTC = 2 h qui n’existe pas : 3 h à Paris');
  assert.equal(h.heureDeParis(new Date('2026-10-25T00:30:00Z')), 2, 'avant le retour : UTC + 2');
  assert.equal(h.heureDeParis(new Date('2026-10-25T02:30:00Z')), 3, 'après le retour : UTC + 1');
  assert.equal(h.jourDeParis(new Date('2026-12-06T23:30:00Z')), '2026-12-07', 'minuit à Paris est passé : lundi');
});

test('l’écriture de la semaine sous la v1 : exactement deux passages le dimanche soir, à 21 h et à 22 h de Paris, toute l’année ; rien à 18 h', () => {
  const expressions = planifications('/api/ecriture/dimanche');
  assert.deepEqual(expressions, ['0 17 * * 0', '0 19 * * 0', '0 20 * * 0', '0 21 * * 0'], 'les trois de la 8.x et celui de 20 h UTC ajouté pour la v1');
  for (const [saison, jour] of Object.entries(DIMANCHES)) {
    // Chaque heure UTC lance une fois (au début ou à la fin de son heure) : les heures de Paris des lancements qui agissent, sans doublon.
    const parHeure = (d) => h.ecritureDuDimancheV9(d);
    const agissants = expressions.map((e) => [e, [':00', ':59'].map((m) => lancement(jour, e, m.slice(1))).filter(parHeure)]).filter(([, l]) => l.length);
    assert.deepEqual(agissants.map(([, l]) => h.heureDeParis(l[0])).sort(), [21, 22], `${saison} : un passage à 21 h, un à 22 h`);
    assert.equal(agissants.length, 2, `${saison} : deux lancements agissent, pas un de plus`);
    // Celui de 18 h (17 h UTC l'hiver, 16 h l'été) n'existe plus : la v1 ignore le lancement de 17 h UTC, qui est 18 h ou 19 h à Paris.
    assert.deepEqual(agit(jour, ['0 17 * * 0'], parHeure), [], `${saison} : le lancement de 17 h UTC ne fait rien`);
  }
  // L'hiver : 20 h et 21 h UTC ; l'été : 19 h et 20 h UTC.
  assert.deepEqual(['0 19 * * 0', '0 20 * * 0', '0 21 * * 0'].map((e) => h.ecritureDuDimancheV9(lancement(DIMANCHES.hiver, e, '30'))), [false, true, true]);
  assert.deepEqual(['0 19 * * 0', '0 20 * * 0', '0 21 * * 0'].map((e) => h.ecritureDuDimancheV9(lancement(DIMANCHES.été, e, '30'))), [true, true, false]);
  // La dernière reprise, celle qui prévient le coach de ce qui reste : 22 h de Paris.
  assert.equal(h.derniereEcritureDuDimancheV9(lancement(DIMANCHES.hiver, '0 21 * * 0', '10')), true);
  assert.equal(h.derniereEcritureDuDimancheV9(lancement(DIMANCHES.été, '0 20 * * 0', '10')), true);
  assert.equal(h.derniereEcritureDuDimancheV9(lancement(DIMANCHES.hiver, '0 20 * * 0', '10')), false, '21 h : pas la dernière');
});

test('le rappel sous la v1 : exactement un lancement agit, à 19 h de Paris, toute l’année ; ni le lundi, ni un autre soir', () => {
  const expressions = planifications('/api/ecriture/rappel');
  assert.deepEqual(expressions, ['0 14 * * 0', '0 17 * * 0', '0 18 * * 0'], 'celui de la 8.x (14 h UTC) et les deux de la v1');
  for (const [saison, jour] of Object.entries(DIMANCHES)) {
    const agissants = expressions.filter((e) => [':00', ':59'].some((m) => h.rappelDuDimancheV9ALHeure(lancement(jour, e, m.slice(1)))));
    assert.equal(agissants.length, 1, `${saison} : un seul lancement agit`);
    assert.equal(h.heureDeParis(lancement(jour, agissants[0], '30')), 19, saison);
  }
  assert.equal(h.rappelDuDimancheV9ALHeure(new Date('2026-12-07T18:00:00Z')), false, 'un lundi');
  assert.equal(h.rappelDuDimancheV9ALHeure(new Date('2026-12-05T18:00:00Z')), false, 'un samedi');
});

test('l’heure du message du rappel : 19 h, repoussée à dans dix minutes si la tâche est lancée plus tard, et rien après 20 h 30', () => {
  const a = (jour, hhmmZ) => r.heureDuRappelV9(new Date(`${jour}T${hhmmZ}:00Z`));
  assert.equal(a('2026-12-06', '18:00'), '19:10', 'hiver, lancé à 19 h de Paris : dans dix minutes');
  assert.equal(a('2027-06-06', '17:00'), '19:10', 'été, lancé à 19 h de Paris : la même heure de Paris');
  assert.equal(a('2026-12-06', '17:00'), '19:00', 'lancé à 18 h de Paris : 19 h');
  assert.equal(a('2026-12-06', '13:00'), '19:00');
  assert.equal(a('2026-12-06', '18:52'), '20:05', 'lancé tard dans l’heure : arrondi aux cinq minutes');
  assert.equal(a('2026-12-06', '19:20'), '20:30', 'la limite elle-même passe');
  assert.equal(a('2026-12-06', '19:25'), null, 'trop près de l’écriture de 21 h');
  assert.equal(a('2027-06-06', '18:25'), null, 'l’été aussi : 20 h 25 à Paris');
  assert.equal(r.HEURE_RAPPEL_V9, '19:00');
});

test('la 8.x ne change pas : elle garde ses expressions et n’agit que sur elles ; un lancement à la main, sans en-tête, est toujours le sien', () => {
  assert.deepEqual([...h.ECRITURE_DU_DIMANCHE_8X], ['0 17 * * 0', '0 19 * * 0', '0 21 * * 0']);
  assert.deepEqual([...h.RAPPEL_DU_DIMANCHE_8X], ['0 14 * * 0']);
  assert.equal(h.DERNIERE_ECRITURE_DU_DIMANCHE_8X, '0 21 * * 0');
  for (const e of h.ECRITURE_DU_DIMANCHE_8X) assert.equal(h.estUnLancementDe8x(e, h.ECRITURE_DU_DIMANCHE_8X), true, e);
  assert.equal(h.estUnLancementDe8x('0 20 * * 0', h.ECRITURE_DU_DIMANCHE_8X), false, 'le lancement de 20 h UTC n’existe que pour la v1');
  for (const e of ['0 17 * * 0', '0 18 * * 0']) assert.equal(h.estUnLancementDe8x(e, h.RAPPEL_DU_DIMANCHE_8X), false, e);
  assert.equal(h.estUnLancementDe8x(null, h.ECRITURE_DU_DIMANCHE_8X), true);
  assert.equal(h.estUnLancementDe8x(null, h.RAPPEL_DU_DIMANCHE_8X), true);
  // Chaque lancement de vercel.json est celui de l'un des deux moteurs : aucun n'est orphelin.
  const ecriture = planifications('/api/ecriture/dimanche');
  assert.ok(ecriture.every((e) => h.ECRITURE_DU_DIMANCHE_8X.includes(e) || [19, 20, 21].includes(Number(e.split(' ')[1]))));
  assert.ok(planifications('/api/ecriture/rappel').every((e) => h.RAPPEL_DU_DIMANCHE_8X.includes(e) || [17, 18].includes(Number(e.split(' ')[1]))));
});

test('le lundi, le questionnaire du matin et le passage quotidien ne bougent pas ; le nombre de tâches planifiées', () => {
  assert.deepEqual(planifications('/api/ecriture/lundi'), [5, 7, 9, 11, 13, 15, 17, 19, 21].map((x) => `0 ${x} * * 1`));
  assert.deepEqual(planifications('/api/ecriture/questionnaire'), ['0 8 * * 0'], 'posé à 9 h ou 10 h de Paris, visible à midi (HEURE_D_ENVOI) : avant midi toute l’année');
  assert.deepEqual(planifications('/api/relance/envoyer'), ['30 18 * * *']);
  // 19 tâches d'avant, plus le passage de 20 h UTC du dimanche et les deux lancements du rappel : 22.
  assert.equal(crons.length, 22);
  assert.equal(new Set(crons.map((c) => `${c.path} ${c.schedule}`)).size, crons.length, 'aucune tâche en double');
});
