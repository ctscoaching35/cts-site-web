#!/usr/bin/env node
/**
 * L'espace coach par athlète (lib/app/espaceParAthlete.ts ; maquette validée par le coach le 08/11/2026, « tout A ») :
 * l'ordre de « Mes athlètes » et « Athlète suivant » (Q2), les étiquettes de « Ce qui l'attend » (Q6, Q7), le classement
 * de « Urgent » (Q8), la raison de la couleur (Q1), le bilan du dimanche (Q10). Sans réseau ni base, sur des athlètes
 * fabriqués (ceux de la maquette).
 *
 *   node --test scripts/test-espace-coach.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

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
const {
  athletesUrgents, bilanVisible, decimale, etiquettes, groupeDe, groupeUrgent, ordonner, raisonDuNiveau, suiteDe, texteBilan,
  urgentDe, virgule,
} = await import('../lib/app/espaceParAthlete.ts');

const point = (niveau, genre, extra = {}) => ({ niveau, genre, athlete: 'x', texte: `${genre}.`, action: '', href: '', cle: `${genre}:${Math.random()}`, ...extra });

// Les dix coachés de la maquette, le dimanche 15 novembre 2026 à 20 h 30.
const MAQUETTE = [
  { id: 'lea', nom: 'Léa Martin', couleur: 'vert', points: [], moteur: false },
  { id: 'hugo', nom: 'Hugo Bernard', couleur: 'vert', points: [point('sante', 'commentaire'), point('arrive', 'preparation')], moteur: false },
  { id: 'ines', nom: 'Inès Moreau', couleur: 'orange', points: [point('sante', 'rpe')], moteur: true },
  { id: 'thomas', nom: 'Thomas Petit', couleur: 'orange', points: [point('sante', 'sensations'), point('sante', 'sensations')], moteur: false },
  { id: 'camille', nom: 'Camille Roux', couleur: 'vert', points: [point('bloque', 'semaine')], moteur: false },
  { id: 'julien', nom: 'Julien Fabre', couleur: 'rouge', points: [point('sante', 'silence')], moteur: true },
  { id: 'manon', nom: 'Manon Girard', couleur: 'rien', points: [point('bloque', 'demarrer'), point('bloque', 'accord')], moteur: false },
  { id: 'antoine', nom: 'Antoine Dubois', couleur: 'vert', points: [point('bloque', 'demande'), point('arrive', 'suite')], moteur: false },
  { id: 'sarah', nom: 'Sarah Lambert', couleur: 'vert', points: [], moteur: false },
  { id: 'nicolas', nom: 'Nicolas Faure', couleur: 'vert', points: [point('arrive', 'course_nolio')], moteur: false },
].map((a) => ({ ...a, groupe: groupeDe(a.couleur, a.points, a.moteur) }));

test('l’ordre de Nolio : alphabétique du prénom, quelle que soit la couleur (09/11/2026)', () => {
  assert.deepEqual(ordonner(MAQUETTE).map((a) => a.id),
    ['antoine', 'camille', 'hugo', 'ines', 'julien', 'lea', 'manon', 'nicolas', 'sarah', 'thomas']);
});

test('ce que le moteur a réglé seul se range entre la santé et ce qui arrive', () => {
  assert.equal(groupeDe('vert', [], true), 4);
  assert.equal(groupeDe('vert', [point('arrive', 'suite')], true), 4);
  assert.ok(groupeDe('vert', [point('sante', 'mot')], true) < groupeDe('vert', [], true));
  assert.ok(groupeDe('vert', [], true) < groupeDe('vert', [point('arrive', 'suite')], false));
  // La couleur passe avant tout.
  assert.equal(groupeDe('rouge', [], false), 0);
  assert.equal(groupeDe('orange', [point('bloque', 'demande')], false), 1);
  assert.equal(groupeDe('rien', [], false), 6);
});

test('Athlète suivant : son rang, celui d’avant et celui d’après, dans l’ordre de la liste', () => {
  const ordre = ordonner(MAQUETTE);
  assert.deepEqual(suiteDe(ordre, 'ines'), { rang: 4, total: 10, precedent: { id: 'hugo', nom: 'Hugo Bernard' }, suivant: { id: 'julien', nom: 'Julien Fabre' } });
  assert.deepEqual(suiteDe(ordre, 'antoine'), { rang: 1, total: 10, precedent: null, suivant: { id: 'camille', nom: 'Camille Roux' } });
  assert.deepEqual(suiteDe(ordre, 'thomas'), { rang: 10, total: 10, precedent: { id: 'sarah', nom: 'Sarah Lambert' }, suivant: null });
  assert.equal(suiteDe(ordre, 'inconnu'), null);
});

test('Q1 : la raison de la couleur', () => {
  assert.equal(raisonDuNiveau({ niveau: 'rouge', pourquoi: 'aucune séance en 7 jours', prevoit: '' }, 4, true), 'Rouge · aucune séance en 7 jours');
  assert.equal(raisonDuNiveau({ niveau: 'orange', pourquoi: 'plus dur que prévu', prevoit: '' }, 5, true), 'Orange · plus dur que prévu');
  assert.equal(raisonDuNiveau({ niveau: 'vert', pourquoi: '', prevoit: 'Semaine normale' }, 5, true), 'Vert · semaine normale');
  assert.equal(raisonDuNiveau({ niveau: 'vert', pourquoi: '', prevoit: 'Semaine normale' }, 0, true), 'Vert · aucune séance à lire');
  assert.equal(raisonDuNiveau({ niveau: 'rien', pourquoi: '', prevoit: '' }, null, false), 'Sans signal · pas d’accord de lecture');
  assert.equal(raisonDuNiveau({ niveau: 'rien', pourquoi: '', prevoit: '' }, null, true), 'Sans signal · pas encore lu');
});

test('Q6 et Q7 : ce qui bloque, la santé, ce que le moteur a réglé, ce qui arrive ; deux jours en une étiquette', () => {
  const thomas = [
    point('sante', 'sensations', { jour: 'mardi 10/11', mesure: 'sensations 2/5' }),
    point('sante', 'sensations', { jour: 'jeudi 12/11', mesure: 'sensations 2/5' }),
  ];
  assert.deepEqual(etiquettes(thomas, null), [{ texte: 'Mauvaises sensations', ton: 'ko', detail: 'Mardi 10/11 et jeudi 12/11 (sensations 2/5)' }]);
  const julien = [point('sante', 'silence', { detail: 'Depuis 12 jours : sa montre, ou il décroche' })];
  assert.deepEqual(etiquettes(julien, { texte: 'Arrêt de course', detail: '13 jours sans courir au lundi 16 nov.' }), [
    { texte: 'Rien de remonté', ton: 'ko', detail: 'Depuis 12 jours : sa montre, ou il décroche' },
    { texte: 'Arrêt de course', ton: 'warn', detail: '13 jours sans courir au lundi 16 nov.' },
  ]);
  const hugo = [point('arrive', 'preparation', { detail: 'GRF18 dans 6 jours' }),
    point('sante', 'commentaire', { jour: 'lundi 9/11', texte: 'un commentaire à lire sur sa séance du lundi 9/11.' })];
  assert.deepEqual(etiquettes(hugo, null), [
    { texte: 'Commentaire à lire', ton: 'ko', detail: 'Sur sa séance du lundi 9/11' },
    { texte: 'Course de préparation', ton: 'neutre', detail: 'GRF18 dans 6 jours' },
  ]);
  const antoine = [point('arrive', 'suite', { texte: 'GRF18 dans 6 jours, rien après.' }), point('bloque', 'demande', { texte: 'demande Les Lucioles, le 29/05/2027.' })];
  assert.deepEqual(etiquettes(antoine, null), [
    { texte: 'Objectif demandé', ton: 'ko', detail: 'Demande Les Lucioles, le 29/05/2027' },
    { texte: 'Rien après', ton: 'neutre', detail: 'GRF18 dans 6 jours, rien après' },
  ]);
  assert.deepEqual(etiquettes([], null), [{ texte: 'Rien à signaler', ton: 'ok' }]);
  // Un arrêt sans durée connue : pas de ligne.
  assert.deepEqual(etiquettes([point('sante', 'arret', { texte: 'arrêt de course depuis plus de 7 jours.' })], null), [{ texte: 'Arrêt de course', ton: 'ko' }]);
});

test('Q8 : « Urgent », quatre groupes, une ligne par point, jamais « À venir »', () => {
  assert.equal(groupeUrgent(point('sante', 'commentaire')), 'besoin');
  assert.equal(groupeUrgent(point('sante', 'mot')), 'besoin');
  assert.equal(groupeUrgent(point('sante', 'hooper')), 'besoin');
  assert.equal(groupeUrgent(point('sante', 'arret')), 'besoin');
  assert.equal(groupeUrgent(point('sante', 'silence')), 'silence');
  assert.equal(groupeUrgent(point('bloque', 'semaine')), 'semaine');
  // « saison » (8.460, décision 8 du 09/11/2026) : la saison de fond refusée par le moteur, jamais tue.
  for (const g of ['demande', 'demarrer', 'nolio', 'equipe', 'accord', 'profil', 'saison']) assert.equal(groupeUrgent(point('bloque', g)), 'bloque');
  assert.equal(etiquettes([point('bloque', 'saison', { texte: 'sa saison de fond du 16/11 n’a pas pu être créée : …' })], null)[0].texte,
    'Saison de fond refusée');
  for (const g of ['preparation', 'suite', 'week_end_choc', 'test', 'course_nolio', 'chrono_route', 'prerequis', 'courses_proches']) {
    assert.equal(groupeUrgent(point('arrive', g)), null);
  }
  // Un genre nouveau suit son niveau.
  assert.equal(groupeUrgent(point('bloque', 'nouveau')), 'bloque');
  assert.equal(groupeUrgent(point('sante', 'nouveau')), 'besoin');

  const groupes = urgentDe(ordonner(MAQUETTE));
  assert.deepEqual(groupes.map((g) => [g.titre, g.lignes.map((l) => l.athleteId)]), [
    ['A besoin de toi', ['hugo', 'ines', 'thomas', 'thomas']], // dans un groupe, l'ordre de Nolio (prénom), 09/11/2026
    ['Ne court plus', ['julien']],
    ['Semaine pas partie', ['camille']],
    ['Objectif bloqué', ['antoine', 'manon', 'manon']],
  ]);
  // La pastille du menu : 7 athlètes (maquette).
  assert.equal(athletesUrgents(groupes), 7);
  assert.deepEqual(urgentDe([{ id: 'lea', nom: 'Léa', points: [point('arrive', 'suite')] }]), []);
});

test('Q10 : le bilan du dimanche, du passage au lundi soir', () => {
  assert.equal(bilanVisible(6, true), true);
  assert.equal(bilanVisible(6, false), false);
  assert.equal(bilanVisible(0, false), true);
  assert.equal(bilanVisible(1, false), false);
  assert.equal(texteBilan(8, 1, 7), '8 semaines parties, 1 pas partie · 7 athlètes attendent quelque chose de toi.');
  assert.equal(texteBilan(1, 0, 1), '1 semaine partie, 0 pas partie · 1 athlète attend quelque chose de toi.');
  assert.equal(texteBilan(3, 2, 0), '3 semaines parties, 2 pas parties.');
});

test('la moyenne du Hooper à la française', () => {
  assert.equal(decimale(8.8), '8,8');
  assert.equal(decimale(8.83333), '8,8');
  assert.equal(decimale(9), '9');
  assert.equal(virgule('indice 14 pour 9.5 en moyenne sur 3 semaines'), 'indice 14 pour 9,5 en moyenne sur 3 semaines');
  assert.equal(virgule('S13-mardi'), 'S13-mardi');
});
