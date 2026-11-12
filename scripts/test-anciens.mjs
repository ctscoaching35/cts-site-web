#!/usr/bin/env node
/**
 * L'ÉQUIPE NOLIO SYNCHRONISÉE AVEC L'APP COACH (lot 2 de l'app, décision A du coach du 12/11/2026) : lib/app/anciens.ts
 * rapproche l'équipe Nolio et les fiches — les entrées (une fiche pour qui n'en a pas, jamais un acheteur), les départs
 * (« Anciens athlètes »), les retours ; personne ne bouge quand Nolio est muet, en erreur ou rend une équipe vide — et dit
 * pour quelles fiches le moteur n'écrit rien (le dimanche, les reprises, les départs, le soir). Des noms fictifs, sans
 * réseau ni base.
 *
 *   node --test scripts/test-anciens.mjs
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
const { rapprocherEquipe, sansEcriture, estAncien, enAttenteDeProfil } = await import('../lib/app/anciens.ts');

const COACH = 'coach-1';
const AUTRE = 'coach-2';
const toi = { id: 'usr_coach', name: 'Coach Fictif (toi)' };
const m = (id, name = id) => ({ id: `usr_${id}`, name });
const fiche = (id, usr, { coach = COACH, ancien = null } = {}) => ({ id, coach_id: coach, nom: id, nolio_athlete_id: usr, ancien_le: ancien });
const rien = { creer: [], partis: [], revenus: [] };
const rapprocher = (equipe, fiches, acheteurs = []) => rapprocherEquipe({ equipe, fiches, acheteurs: new Set(acheteurs), coachId: COACH });

test('les entrées : une fiche pour chaque athlète de l’équipe qui n’en a nulle part ; ni acheteur, ni le coach', () => {
  const r = rapprocher([m('alix', 'Alix Fictive'), m('basile'), m('chloe'), m('dora'), toi],
    [fiche('f-alix', 'usr_alix'), fiche('f-chloe', 'usr_chloe', { coach: AUTRE })], ['usr_dora']);
  // Basile n'a pas de fiche ; Chloé en a une chez un autre coach ; Dora est une acheteuse ; le coach garde son bouton.
  assert.deepEqual(r.creer, [{ id: 'usr_basile', name: 'basile' }]);
  assert.deepEqual(r.partis, []);
  assert.deepEqual(r.revenus, []);
});

test('les départs : une fiche du coach dont l’athlète n’est plus dans l’équipe, et seulement elle', () => {
  const r = rapprocher([m('alix'), toi], [
    fiche('f-alix', 'usr_alix'), fiche('f-eli', 'usr_eli'),
    // Un autre coach, une fiche pas reliée, un numéro de la v1, sa fiche de test, un ancien déjà parti : rien.
    fiche('f-gus', 'usr_gus', { coach: AUTRE }), fiche('f-sans', null), fiche('f-v1', '123456'), fiche('f-test', 'usr_coach'),
    fiche('f-jo', 'usr_jo', { ancien: '2026-11-01T18:00:00Z' }),
  ]);
  assert.deepEqual(r.partis, ['f-eli']);
  assert.deepEqual(r.revenus, []);
  assert.deepEqual(r.creer, []);
});

test('les retours : un ancien revenu dans l’équipe en ressort, sans seconde fiche', () => {
  const r = rapprocher([m('alix'), m('jo'), toi], [fiche('f-alix', 'usr_alix'), fiche('f-jo', 'usr_jo', { ancien: '2026-11-01T18:00:00Z' })]);
  assert.deepEqual(r.revenus, ['f-jo']);
  assert.deepEqual(r.partis, []);
  assert.deepEqual(r.creer, []);
});

test('Nolio en erreur ou muet (null) : personne ne bouge', () => {
  assert.deepEqual(rapprocher(null, [fiche('f-alix', 'usr_alix'), fiche('f-jo', 'usr_jo', { ancien: '2026-11-01' })]), rien);
});

test('une équipe vide (rien, ou le coach seul) : personne ne part, personne ne revient, rien ne se crée', () => {
  const fiches = [fiche('f-alix', 'usr_alix'), fiche('f-jo', 'usr_jo', { ancien: '2026-11-01' })];
  assert.deepEqual(rapprocher([], fiches), rien);
  assert.deepEqual(rapprocher([toi], fiches), rien);
});

test('un même athlète deux fois dans la réponse de Nolio : une seule fiche', () => {
  assert.deepEqual(rapprocher([m('basile'), m('basile'), toi], []).creer.map((x) => x.id), ['usr_basile']);
});

test('l’écriture du moteur saute les anciens athlètes, comme la programmation à la main et le mode plan', () => {
  assert.equal(sansEcriture({ programmation: 'auto', mode: 'coaching', ancien_le: null }), false);
  assert.equal(sansEcriture({ programmation: 'auto', mode: 'coaching', ancien_le: '2026-11-12T08:00:00Z' }), true);
  assert.equal(sansEcriture({ programmation: 'main', mode: 'coaching' }), true);
  assert.equal(sansEcriture({ programmation: 'auto', mode: 'plan' }), true);
  // Sans la migration, la colonne manque : personne n'est ancien.
  assert.equal(sansEcriture({ programmation: 'auto', mode: 'coaching' }), false);
  assert.equal(estAncien({}), false);
});

test('une fiche créée d’elle-même attend son profil (ni questionnaire, ni Hooper) ; sans la migration, aucune n’attend', () => {
  assert.equal(enAttenteDeProfil({ programmation: 'main', en_attente_profil: true }), true);
  assert.equal(enAttenteDeProfil({ programmation: 'auto', en_attente_profil: false }), false);
  assert.equal(enAttenteDeProfil({ programmation: 'main' }), false);
  // Programmée à la main pendant l'attente : le moteur n'écrit rien pour elle.
  assert.equal(sansEcriture({ programmation: 'main', mode: 'coaching', en_attente_profil: true }), true);
});
