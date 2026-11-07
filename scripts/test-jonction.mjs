#!/usr/bin/env node
/**
 * La jonction de deux objectifs, côté site, sans réseau ni base (lib/app/jonction.ts, lib/plan.ts ; décisions coach du
 * 07/11/2026, « tout A » ; CTS_JONCTION_OBJECTIFS.md du moteur, §8) : le lundi d'où repart le rythme (« rythme_depuis »),
 * la récupération de 14 jours au moins dès 3 h de course, la sortie longue de départ à 75 %, le départ d'une préparation
 * lointaine à sa semaine 1, la saison de fond qui commence par la reprise. Des cas fictifs.
 *
 *   node --test scripts/test-jonction.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Les imports du site n'ont pas d'extension (« ./plan ») : on la leur donne.
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
const { joursRecuperation } = await import('../lib/plan.ts');
const { ajouterJours } = await import('../lib/app/plan.ts');
const { debutApres, departCalcule, dureeTexte, enReprise, lundiDuRythme, preparationLointaine, saisonEnReprise, slApresCourse } =
  await import('../lib/app/jonction.ts');

// L'objectif 1 de la mesure du coach (06/11/2026) : un trail marathon de 5h30, couru le dimanche 18/04/2027.
const COURSE_1 = '2027-04-18';
const REPRISE = '2027-05-03';

test('décision 5 : 14 jours au moins dès 3 h de course, deux par heure en dessous, 21 au plus, 14 après un marathon', () => {
  assert.equal(joursRecuperation(0.77, 'R10'), 3);
  assert.equal(joursRecuperation(2, 'TC'), 4);
  assert.equal(joursRecuperation(2 + 59 / 60, 'TC'), 6, 'sous 3 h : deux jours par heure');
  assert.equal(joursRecuperation(3, 'TM'), 14, 'dès 3 h : 14 jours (avant : 6)');
  assert.equal(joursRecuperation(4, 'TM'), 14, 'un trail de 4 h : 14 jours (avant : 8)');
  assert.equal(joursRecuperation(5.5, 'TM'), 14, 'avant : 11');
  assert.equal(joursRecuperation(8, 'TL'), 16);
  assert.equal(joursRecuperation(11, 'TL'), 21);
  assert.equal(joursRecuperation(22, 'UT'), 21, '21 au plus');
  assert.equal(joursRecuperation(3.75, 'R42'), 14);
  assert.equal(joursRecuperation(2.5, 'R42'), 14);
});

test('décision 5 : le lundi de reprise, jusqu’au lundi qui suit la récupération', () => {
  assert.equal(debutApres({ course_date: COURSE_1, temps_h: 5.5, format: 'TM' }), REPRISE);
  // Un trail de 4 h couru un samedi : 14 jours, jusqu'au samedi 01/05, reprise le lundi 03/05 (avant : 8 jours, le 26/04).
  assert.equal(debutApres({ course_date: '2027-04-17', temps_h: 4, format: 'TM' }), '2027-05-03');
  // Un 10 km (3 jours) un dimanche : reprise le lundi d'après le mercredi.
  assert.equal(debutApres({ course_date: COURSE_1, temps_h: 0.77, format: 'R10' }), '2027-04-26');
});

test('rythme_depuis après une course : le lundi de la première semaine écrite en reprise', () => {
  assert.equal(lundiDuRythme({ premier: REPRISE, reprise: true }), REPRISE);
  // Un départ en milieu de semaine (le lendemain d'un achat, un départ choisi) : le lundi de sa semaine.
  assert.equal(lundiDuRythme({ premier: '2027-05-05', reprise: true }), REPRISE);
  // Un départ en cours de route, sans course juste avant (un objectif ajouté plus tard, un objectif 1 retiré) : rien.
  assert.equal(lundiDuRythme({ premier: REPRISE, reprise: false }), null);
  assert.equal(lundiDuRythme({ premier: REPRISE, reprise: false, saison: [] }), null);
  // La reprise : au plus une semaine après le lundi de reprise.
  assert.equal(enReprise(REPRISE, REPRISE), true);
  assert.equal(enReprise(REPRISE, '2027-05-10'), true);
  assert.equal(enReprise(REPRISE, '2027-05-17'), false);
});

// Une saison de fond de 12 semaines qui démarre au lundi de reprise : 3 blocs de 3 semaines de charge et 1 allégée.
const SAISON = Array.from({ length: 12 }, (_, i) => ({
  lundi: ajouterJours(REPRISE, 7 * i), type: i % 4 === 3 ? 'Assimilation' : 'Charge',
}));

test('décision 7 : la préparation qui coupe une saison de fond en continue le rythme, depuis sa dernière allégée', () => {
  const coupee = (k) => lundiDuRythme({ premier: ajouterJours(REPRISE, 7 * k), reprise: false, saison: SAISON });
  // Coupée après 6 semaines : la dernière allégée est la 4e (le 24/05).
  assert.equal(coupee(6), '2027-05-24');
  assert.equal(coupee(5), '2027-05-24');
  // Finie par son allégée la veille : ce lundi-là (le moteur garde alors le plan tel quel).
  assert.equal(coupee(4), '2027-05-24');
  assert.equal(coupee(8), '2027-06-21');
  assert.equal(coupee(7), '2027-05-24');
  // La saison ne courait pas la semaine d'avant (arrêtée, ou finie depuis longtemps) : rien.
  assert.equal(lundiDuRythme({ premier: ajouterJours(REPRISE, 7 * 14), reprise: false, saison: SAISON }), null);
  // Une course juste avant compte d'abord : le rythme part de la reprise.
  assert.equal(lundiDuRythme({ premier: REPRISE, reprise: true, saison: SAISON }), REPRISE);
  // Deux saisons de suite : la dernière allégée de la première, quand la seconde n'en a pas encore.
  const deux = [...SAISON, ...SAISON.slice(0, 2).map((s, i) => ({ lundi: ajouterJours(REPRISE, 7 * (12 + i)), type: s.type }))];
  assert.equal(lundiDuRythme({ premier: ajouterJours(REPRISE, 7 * 14), reprise: false, saison: deux }), SAISON[11].lundi);
});

test('décision 6 : la sortie longue de départ après une course, 75 % de la plus longue d’avant l’affûtage', () => {
  assert.equal(dureeTexte(slApresCourse(150)), '1h53', '2h30 -> 1h52,5, à la minute');
  assert.equal(dureeTexte(slApresCourse(210)), '2h38', '3h30');
  assert.equal(dureeTexte(slApresCourse(90)), '1h08', '1h30');
  // Jamais sous le plancher du questionnaire (45 min), que le moteur refuserait ; jamais au-dessus de la sortie elle-même.
  assert.equal(dureeTexte(slApresCourse(50)), '0h45');
  assert.equal(dureeTexte(slApresCourse(40)), '0h40');
  assert.equal(dureeTexte(245), '4h05');
});

test('décision 12 : la préparation lointaine part à sa semaine 1, plus au lundi de reprise (le défaut reproduit)', () => {
  // L'objectif 2 existe déjà pendant la préparation de l'objectif 1 : un ultra le 18/12/2027, sa préparation de 24
  // semaines commence le lundi 05/07/2027, 9 semaines après la reprise. Le coach le démarre le 10/04.
  const cas = { aujourdhui: '2027-04-10', debut: '2027-07-05', premierJour: '2027-07-05', posees: null,
    apres: { lundi: REPRISE, nom: 'Trail marathon' } };
  // L'ancienne règle (lib/app/ecriture.ts jusqu'au site f496fa8), mot pour mot : le départ au lundi de reprise ; sa semaine
  // 1 partait ce dimanche-là dans Nolio, 9 semaines d'avance, et la saison de fond ne démarrait jamais.
  const ancienne = ({ aujourdhui, debut, premierJour, apres, posees, lundi }) => (apres && apres.lundi > aujourdhui && (!posees || apres.lundi >= posees.lundi)
    ? { prevu: apres.lundi, apres: apres.nom, raison: 'recuperation' }
    : posees && posees.lundi > premierJour ? { prevu: posees.lundi, apres: posees.derniere, raison: 'seances' }
      : debut > ajouterJours(aujourdhui, 1) ? { prevu: debut, apres: debut, raison: 'preparation' }
        : lundi && lundi > aujourdhui ? { prevu: lundi, apres: aujourdhui, raison: 'seances' } : null);
  assert.deepEqual(ancienne(cas), { prevu: REPRISE, apres: 'Trail marathon', raison: 'recuperation' }, 'le défaut');
  assert.deepEqual(departCalcule(cas), { prevu: '2027-07-05', apres: '2027-07-05', raison: 'preparation' });
  assert.equal(preparationLointaine('2027-07-05', REPRISE), true);
  // Programmé à l'ancienne au lundi de reprise, il se reprogramme la veille, à sa semaine 1 (un départ à venir, décision 13).
  assert.deepEqual(departCalcule({ ...cas, aujourdhui: '2027-05-02', lundi: REPRISE }),
    { prevu: '2027-07-05', apres: '2027-07-05', raison: 'preparation' });
  // Sa semaine 1 la semaine qui suit la reprise : le départ reste au lundi de reprise (cette semaine 1 est la reprise).
  assert.equal(preparationLointaine('2027-05-10', REPRISE), false);
  assert.deepEqual(departCalcule({ ...cas, debut: '2027-05-10', premierJour: '2027-05-10' }),
    { prevu: REPRISE, apres: 'Trail marathon', raison: 'recuperation' });
  // Une préparation déjà commencée à la reprise (le cas courant) : inchangé.
  for (const debut of ['2027-04-12', '2027-05-03']) {
    const x = { ...cas, debut, premierJour: debut > cas.aujourdhui ? debut : cas.aujourdhui };
    assert.deepEqual(departCalcule(x), ancienne(x));
  }
  // Sans objectif précédent, des séances posées, un lundi programmé : la même règle qu'avant.
  for (const x of [
    { ...cas, apres: null },
    { ...cas, apres: null, debut: '2027-04-05', premierJour: '2027-04-10', posees: { lundi: '2027-04-19', derniere: '2027-04-18' } },
    { ...cas, apres: null, debut: '2027-04-05', premierJour: '2027-04-10', lundi: '2027-04-12' },
    { ...cas, apres: null, debut: '2027-04-05', premierJour: '2027-04-10' },
  ]) assert.deepEqual(departCalcule(x), ancienne(x));
});

test('décision 8 : la saison de fond qui suit une récupération commence par la reprise', () => {
  const precedents = [{ course_date: COURSE_1, temps_h: 5.5, format: 'TM' }];
  assert.equal(saisonEnReprise(REPRISE, precedents), true);
  assert.equal(saisonEnReprise('2027-05-10', precedents), true, 'au plus une semaine après le lundi de reprise');
  assert.equal(saisonEnReprise('2027-05-17', precedents), false);
  assert.equal(saisonEnReprise(REPRISE, []), false, 'une saison sans course avant');
  assert.equal(saisonEnReprise(REPRISE, [{ course_date: '2027-06-20', temps_h: 5.5, format: 'TM' }]), false);
});
