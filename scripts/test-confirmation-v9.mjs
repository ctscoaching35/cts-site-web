#!/usr/bin/env node
/**
 * LA CHARGE CORRIGÉE AVANT UN DÉPART, SOUS LA 9.x : POST /v1/trame reçoit des paramètres à plat, ceux du passage du dimanche, et non la forme rangée avec le plan (défaut du 26/11/2026 : toute correction
 * était refusée, « Les paramètres du plan sont illisibles (KeyError) »). La fonction est jouée pour de bon, avec un acheteur inventé : ni réseau, ni base, ni moteur.
 *
 *   node --test scripts/test-confirmation-v9.mjs
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const piece = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const PIECES = {
  '/lib/app/supabase.ts': 'export const clientService = () => globalThis.__essai.base; export const supabaseConfigure = () => true; export const clientServeur = async () => globalThis.__essai.base;',
  '/lib/app/ecriture.ts': 'export const objectifEcrit = async () => globalThis.__essai.objectif; export const prevenirCoach = async () => {};',
  '/lib/app/moteurEnLigne.ts': 'export const moteurEstV9 = async () => globalThis.__essai.v9;',
  '/lib/app/strategie.ts': 'export const strategieDeLaCourse = async () => null;',
  '/lib/app/emailBienvenue.ts': 'export const envoyerRappelConfirmation = async () => {};',
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const cible = specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}`).href : specifier;
    let r;
    try {
      r = nextResolve(cible, context);
    } catch (e) {
      if (!/^(file:|\.)/.test(cible) || cible.endsWith('.ts')) throw e;
      r = nextResolve(`${cible}.ts`, context);
    }
    const remplace = Object.keys(PIECES).find((f) => r.url.endsWith(f));
    return remplace ? { url: piece(PIECES[remplace]), shortCircuit: true } : r;
  },
});
const { enregistrerConfirmation } = await import(pathToFileURL(`${RACINE}lib/app/confirmation.ts`).href);

const CHAMPS = {
  format: 'TM', date_course: '2027-03-06', distance_km: '55', dplus_m: '3000', temps_cible: '7h00', duree_mois: '4', niveau: 'confirme', terrain: 'pentu',
  jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3', volume_hebdo_actuel: '5h', sortie_longue_actuelle: '2h',
};
const PARAMETRES = { schema: 1, declaree_le: '2026-10-01', champs: CHAMPS };
const PLAN = { semaines: [{ numero: 'S1', lundi: '2026-11-30' }] };

async function corriger({ v9 }) {
  const envoyes = [];
  const gardes = [];
  const requete = () => {
    const q = {};
    for (const m of ['select', 'eq']) q[m] = () => q;
    q.update = (valeurs) => { gardes.push(valeurs); return q; };
    q.maybeSingle = async () => ({ data: { compte_id: 'c1', cree_le: '2026-10-01T10:00:00Z', debut_plan: '2026-11-30', parametres: PARAMETRES, demarre_le: null, nolio_statut: 'invite' } });
    q.then = (oui, non) => Promise.resolve({ error: null }).then(oui, non);
    return q;
  };
  globalThis.__essai = { v9, base: { from: requete }, objectif: { planId: 'p1', coache: false, accordLecture: false, parametres: PARAMETRES, plan: PLAN, profil: {}, reperesSources: undefined, dPrime: null } };
  globalThis.fetch = async (url, options) => {
    envoyes.push([new URL(url).pathname, JSON.parse(options.body)]);
    return { ok: true, status: 200, json: async () => ({ semaines: [] }) };
  };
  const r = await enregistrerConfirmation('p1', { volume_hebdo_actuel: '4h', sortie_longue_actuelle: '1h30' });
  return { r, envoyes, gardes };
}

test('9.x : la charge corrigée part à plat au moteur, comme au dimanche, et s’enregistre', async () => {
  const { r, envoyes, gardes } = await corriger({ v9: true });
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(envoyes.map(([c]) => c), ['/v1/trame']);
  const p = envoyes[0][1].parametres;
  for (const range of ['champs', 'schema', 'declaree_le', 'niveau', 'terrain', 'coaching']) assert.ok(!(range in p), range);
  assert.deepEqual([p.volume_hebdo_actuel, p.sortie_longue_actuelle, p.duree_mois, p.date_course, p.jour_sl], ['4h', '1h30', '4', '2027-03-06', 'dimanche']);
  assert.equal(gardes[0].confirmation_charge.reponse, 'corrige');
});

test('8.x : rien ne change, la forme rangée part au moteur avec la charge corrigée', async () => {
  const { r, envoyes } = await corriger({ v9: false });
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(envoyes[0][1].parametres, { ...PARAMETRES, champs: { ...CHAMPS, volume_hebdo_actuel: '4h', sortie_longue_actuelle: '1h30' } });
});
