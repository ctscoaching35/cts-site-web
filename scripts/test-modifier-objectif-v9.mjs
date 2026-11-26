#!/usr/bin/env node
/**
 * « MODIFIER L'OBJECTIF » SOUS LA 9.x : POST /v1/trame reçoit des paramètres à plat, ceux du passage du dimanche, et non la forme rangée avec le plan (défaut du 26/11/2026 : « Les paramètres du plan sont
 * illisibles (KeyError) » sur tout objectif modifié, un trail déjà démarré compris). La route est jouée pour de bon, avec un coaché inventé : ni réseau, ni base, ni moteur.
 *
 *   node --test scripts/test-modifier-objectif-v9.mjs
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const piece = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const PIECES = {
  '/lib/app/nolio.ts': 'export const coachConnecte = async () => ({ compteId: "coach-1" });',
  '/lib/app/supabase.ts': 'export const clientService = () => globalThis.__essai.base; export const supabaseConfigure = () => true; export const clientServeur = async () => globalThis.__essai.base;',
  '/lib/app/acheteurs.ts': 'export const planAchete = async () => null;',
  '/lib/app/coaching.ts': 'export const quitterLAttenteDuProfil = async () => {};',
  '/lib/app/ecriture.ts': 'export const objectifEcrit = async () => globalThis.__essai.objectif; export const reprogrammerSortie = async () => {};',
  '/lib/app/moteurEnLigne.ts': 'export const moteurEstV9 = async () => globalThis.__essai.v9;',
  '/lib/app/traceV9.ts': 'export const lireLaTraceV9 = async () => null;',
  '/lib/app/profilEntrainement.ts': 'export const profilDeLaFiche = async () => globalThis.__essai.fiche;',
  '/lib/app/strategie.ts': 'export const strategieDeLaCourse = async () => null;',
};
const SERVEUR = piece('export const NextResponse = { json: (corps, init) => ({ corps, status: init?.status ?? 200 }) };');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') return { url: SERVEUR, shortCircuit: true };
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
process.env.CTS_CLE_COACH = 'essai';
const { POST } = await import(pathToFileURL(`${RACINE}app/app/coach/athletes/route.ts`).href);

// Un trail déjà démarré (sous la 8.x : ses réponses ont encore le niveau et le terrain), que le coach modifie : son temps visé et ses séances.
const CHAMPS = {
  format: 'TM', date_course: '2027-03-06', distance_km: '55', dplus_m: '3000', dmoins_m: '3000', temps_cible: '7h00', duree_mois: '6', niveau: 'confirme', terrain: 'pentu', coaching: 'oui',
  jours_disponibles: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '4', volume_hebdo_actuel: '6h', sortie_longue_actuelle: '2h30',
};
const AVANT = { schema: 1, declaree_le: '2026-09-28', champs: { ...CHAMPS, entree: '2026-10-05' }, plage_dominante: null, bande_majeure: null };
const MODIFIES = { ...CHAMPS, temps_cible: '6h30', freq_hebdo: '3' };
const DONNEES = { schema: 1, version_moteur: '8.474', athlete: { nom: 'Camille Essai' }, course: { nom: 'Trail inventé', date: '2027-03-06', date_debut_plan: '2026-10-05' },
  semaines: [{ numero: 'S1', lundi: '2026-10-05' }, { numero: 'S2', lundi: '2026-10-12' }] };

async function modifier({ v9 }) {
  const appels = [];
  const ecrits = [];
  const requete = (table) => {
    const q = {};
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'gte', 'lt', 'order']) q[m] = () => q;
    q.update = (valeurs) => { ecrits.push([table, valeurs]); return q; };
    q.maybeSingle = async () => ({ data: { plans: { id: 'p1', parametres: AVANT, demarre_le: '2026-10-05' }, coaching: { athlete_id: 'a1' } }[table] ?? null });
    q.then = (oui, non) => Promise.resolve({ data: [], error: null }).then(oui, non);
    return q;
  };
  globalThis.__essai = {
    v9, base: { from: requete },
    objectif: { planId: 'p1', coache: true, accordLecture: true, parametres: AVANT, plan: DONNEES, profil: { vc_ms: 4 }, reperesSources: {}, dPrime: null },
    fiche: { cote_min: '1min30', tapis: 'non', critere_intensite: 'regulier', critere_denivele: 'parfois' },
  };
  const reponse = (corps) => ({ ok: true, status: 200, json: async () => corps });
  globalThis.fetch = async (url, options) => {
    const chemin = new URL(url).pathname;
    appels.push([chemin, typeof options?.body === 'string' ? JSON.parse(options.body) : null]);
    if (chemin === '/v1/checkout') return reponse({ session_id: 's1' });
    if (chemin === '/v1/plans') return reponse({ donnees_url: '/v1/essai/donnees', parametres: { schema: 1, declaree_le: '2026-11-26', champs: MODIFIES }, intake: {}, resume: {} });
    if (chemin === '/v1/essai/donnees') return reponse(DONNEES);
    return reponse({ semaines: [] });
  };
  const formulaire = new FormData();
  formulaire.set('plan_id', 'p1');
  formulaire.set('athlete_id', 'a1');
  formulaire.set('intake', JSON.stringify(MODIFIES));
  const r = await POST({ formData: async () => formulaire });
  return { r, trame: appels.find(([c]) => c === '/v1/trame')?.[1], ecrit: ecrits.find(([t]) => t === 'plans')?.[1] };
}

test('9.x : un trail démarré puis modifié : le moteur reçoit des paramètres à plat, ceux du dimanche, et la modification s’enregistre', async () => {
  const { r, trame, ecrit } = await modifier({ v9: true });
  assert.deepEqual([r.status, r.corps], [200, { page: '/app/coach/plan/p1' }]);
  const p = trame.parametres;
  for (const range of ['champs', 'schema', 'declaree_le', 'niveau', 'terrain']) assert.ok(!(range in p), range);
  assert.deepEqual([p.format, p.date_course, p.distance_km, p.temps_cible, p.freq_hebdo, p.jour_sl], ['TM', '2027-03-06', '55', '6h30', '3', 'dimanche']);
  // Un coaché, son entrée d'origine, et ce que sa fiche donne.
  assert.deepEqual([p.coaching, p.entree, p.cote_min, p.tapis, p.vc_ms], ['oui', '2026-10-05', 1.5, 'non', 4]);
  assert.deepEqual(p.criteres, { intensite: 'regulier', mecanique: 'parfois' });
  // Ce qui est rangé garde sa forme : les réponses sous `champs`, l'entrée comprise.
  assert.deepEqual([ecrit.parametres.champs.temps_cible, ecrit.parametres.champs.entree, ecrit.parametres.declaree_le], ['6h30', '2026-10-05', '2026-09-28']);
});

test('8.x : rien ne change, la forme rangée part au moteur', async () => {
  const { r, trame, ecrit } = await modifier({ v9: false });
  assert.equal(r.status, 200);
  assert.deepEqual(trame.parametres, ecrit.parametres);
  assert.ok('champs' in trame.parametres);
});
