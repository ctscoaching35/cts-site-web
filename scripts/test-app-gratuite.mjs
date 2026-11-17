#!/usr/bin/env node
/**
 * L'APP GRATUITE, lot A1 (maquette validée par le coach le 16/11/2026) : l'interrupteur APP_GRATUITE (coupe, invitation,
 * ouvert), le lien secret, les cas de visite (connexion, normal, visiteur, gratuit), la preuve qu'en mode « coupe » rien ne
 * change pour l'acheteur, le coaché et le coach, le calcul du profil sans plan (les fonctions de l'app des acheteurs), et
 * ce que garde le compte (la FC seulement avec l'accord, l'accord à la liste e-mail daté). Sans réseau ni base : des pièces
 * à la place de Next et de Supabase (scripts/_monde-app-gratuite.mjs).
 *
 *   node --test scripts/test-app-gratuite.mjs
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const MONDE = pathToFileURL(`${RACINE}scripts/_monde-app-gratuite.mjs`).href;
const REMPLACES = ['/lib/app/contexte.ts', '/lib/app/demandes.ts', '/lib/app/demonstrationPorte.ts', '/lib/app/nolio.ts', '/lib/app/supabase.ts'];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(next\/(headers|navigation|cache)|react)$/.test(specifier)) return { url: MONDE, shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    let r;
    try {
      r = nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    return REMPLACES.some((f) => r.url.endsWith(f)) ? { url: MONDE, shortCircuit: true } : r;
  },
});
const lib = (nom) => import(`${RACINE}lib/app/${nom}.ts`);
const { Redirection, Introuvable } = await import(MONDE);
const regles = await lib('gratuitRegles');
const profilG = await lib('profilGratuit');

// Le monde d'un test : l'environnement, les cookies, la session, ce que la base dit du compte.
function poser({ mode, secret = 'mot-secret', cookies = {}, supabase = true, demonstration = false, session = null, plans = [], fiche = null,
  coach = false, lignes = {} } = {}) {
  if (mode === undefined) delete process.env.APP_GRATUITE;
  else process.env.APP_GRATUITE = mode;
  process.env.APP_GRATUITE_SECRET = secret;
  const ecrits = [];
  const lu = (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: lignes[table] ?? null, error: null }) }) }),
    upsert: async (ligne, options) => { ecrits.push({ table, ligne, options }); return { error: null }; } });
  globalThis.__monde = {
    appels: [], cookies, supabase, demonstration, ecrits,
    plansDuCompte: async () => plans, ficheDuCompte: async () => fiche, coachConnecte: async () => (coach ? { compteId: 'c', email: 'coach@x.fr' } : null),
    client: () => ({
      auth: {
        getClaims: async () => ({ data: session ? { claims: session } : null }),
        signInWithOtp: async (e) => { ecrits.push({ table: 'otp', ligne: e }); return { error: null }; },
      },
      from: lu,
    }),
    service: () => ({ from: (table) => ({ upsert: async (ligne, options) => { ecrits.push({ table: `service:${table}`, ligne, options }); return { error: null }; } }) }),
  };
  return globalThis.__monde;
}
// Un module frais par cas (react `cache` garde la lecture d'une requête).
let n = 0;
const frais = async (nom) => import(`${RACINE}lib/app/${nom}.ts?cas=${++n}`);

// ─── L'interrupteur et le lien secret ────────────────────────────────────────
test('APP_GRATUITE : coupe par défaut, et pour toute valeur inconnue', () => {
  assert.equal(regles.modeAppGratuite(undefined), 'coupe');
  assert.equal(regles.modeAppGratuite(''), 'coupe');
  assert.equal(regles.modeAppGratuite('oui'), 'coupe');
  assert.equal(regles.modeAppGratuite('invitation'), 'invitation');
  assert.equal(regles.modeAppGratuite(' Ouvert '), 'ouvert');
});

test('le lien secret : le bon mot seulement ; sans mot attendu, rien ne s’ouvre', () => {
  assert.equal(regles.essaiValide('mot-secret', 'mot-secret'), true);
  assert.equal(regles.essaiValide('mot-secreT', 'mot-secret'), false);
  assert.equal(regles.essaiValide('mot', 'mot-secret'), false);
  assert.equal(regles.essaiValide('', ''), false);
  assert.equal(regles.essaiValide(undefined, undefined), false);
  assert.equal(regles.essaiValide(undefined, 'mot-secret'), false);
});

test('qui peut entrer : coupe personne, invitation le porteur du cookie, ouvert tout le monde', () => {
  assert.equal(regles.gratuitOuvertPour('coupe', 'mot-secret', 'mot-secret'), false);
  assert.equal(regles.gratuitOuvertPour('invitation', undefined, 'mot-secret'), false);
  assert.equal(regles.gratuitOuvertPour('invitation', 'faux', 'mot-secret'), false);
  assert.equal(regles.gratuitOuvertPour('invitation', 'mot-secret', 'mot-secret'), true);
  assert.equal(regles.gratuitOuvertPour('ouvert', undefined, undefined), true);
});

// ─── Les cas de visite : la preuve que « coupe » ne change rien ─────────────────
test('mode coupe : sans session, la connexion ; avec une session, l’app de toujours, quoi que le compte ait', () => {
  for (const ouvertPourLui of [false, true]) for (const sansPlan of [false, true]) {
    assert.equal(regles.decider({ mode: 'coupe', ouvertPourLui, session: false, sansPlan }), 'connexion');
    assert.equal(regles.decider({ mode: 'coupe', ouvertPourLui, session: true, sansPlan }), 'normal');
  }
});

test('mode ouvert : le visiteur, le compte gratuit ; l’acheteur, le coaché et le coach restent « normal »', () => {
  assert.equal(regles.decider({ mode: 'ouvert', ouvertPourLui: true, session: false, sansPlan: false }), 'visiteur');
  assert.equal(regles.decider({ mode: 'ouvert', ouvertPourLui: true, session: true, sansPlan: true }), 'gratuit');
  assert.equal(regles.decider({ mode: 'ouvert', ouvertPourLui: true, session: true, sansPlan: false }), 'normal');
});

test('mode invitation : sans le cookie du lien secret, tout reste comme avant', () => {
  assert.equal(regles.decider({ mode: 'invitation', ouvertPourLui: false, session: false, sansPlan: false }), 'connexion');
  assert.equal(regles.decider({ mode: 'invitation', ouvertPourLui: false, session: true, sansPlan: true }), 'normal');
  assert.equal(regles.decider({ mode: 'invitation', ouvertPourLui: true, session: false, sansPlan: false }), 'visiteur');
});

test('lireAcces en coupe : « normal » sans lire ni cookie, ni session, ni base', async () => {
  const m = poser({ mode: undefined, session: { sub: 'u1', email: 'a@b.fr' }, cookies: { cts_essai: 'mot-secret' } });
  const { lireAcces } = await frais('acces');
  assert.deepEqual(await lireAcces(), { cas: 'normal', mode: 'coupe' });
  assert.deepEqual(m.appels, []);
});

test('accès en coupe : la page Courses et « Me connecter » n’existent pas (404 comme avant), pour tous', async () => {
  for (const session of [null, { sub: 'u1', email: 'a@b.fr' }]) {
    poser({ mode: 'coupe', session });
    const { pageGratuite } = await frais('accesGratuit');
    await assert.rejects(() => pageGratuite(), Introuvable);
  }
});

test('en coupe, un compte sans plan reste sur « Sans plan » : l’app gratuite ne le prend pas', async () => {
  const m = poser({ mode: 'coupe', session: { sub: 'u1' } });
  const { compteGratuitPossible, gratuitOuvert } = await frais('gratuit');
  assert.equal(await gratuitOuvert(), false);
  assert.equal(await compteGratuitPossible(), false);
  assert.deepEqual(m.appels, []);
});

test('invitation : un compte sans plan est « gratuit » avec le cookie, « normal » sans', async () => {
  poser({ mode: 'invitation', session: { sub: 'u1', email: 'a@b.fr' }, cookies: { cts_essai: 'mot-secret' } });
  assert.deepEqual(await (await frais('acces')).lireAcces(), { cas: 'gratuit', mode: 'invitation', compteId: 'u1', email: 'a@b.fr' });
  poser({ mode: 'invitation', session: { sub: 'u1', email: 'a@b.fr' } });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'normal');
  poser({ mode: 'invitation', cookies: { cts_essai: 'mot-secret' } });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'visiteur');
  poser({ mode: 'invitation' });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'connexion');
});

test('ouvert : l’acheteur (un plan), le coaché (une fiche) et le coach ne passent pas en gratuit', async () => {
  const session = { sub: 'u1', email: 'a@b.fr' };
  poser({ mode: 'ouvert', session, plans: [{ id: 'p1' }] });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'normal');
  poser({ mode: 'ouvert', session, fiche: { id: 'f1' } });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'normal');
  poser({ mode: 'ouvert', session, coach: true });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'normal');
  poser({ mode: 'ouvert', session });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'gratuit');
});

test('les pages gratuites : le visiteur et le compte entrent, l’acheteur est renvoyé à son accueil', async () => {
  poser({ mode: 'ouvert' });
  assert.equal((await (await frais('accesGratuit')).pageGratuite()).cas, 'visiteur');
  poser({ mode: 'ouvert', session: { sub: 'u1' } });
  assert.equal((await (await frais('accesGratuit')).pageGratuite()).cas, 'gratuit');
  poser({ mode: 'ouvert', session: { sub: 'u1' } });
  await assert.rejects(() => frais('accesGratuit').then((x) => x.pageGratuite({ visiteurSeulement: true })), (e) => e instanceof Redirection && e.vers === '/app');
  poser({ mode: 'ouvert', session: { sub: 'u1' }, plans: [{ id: 'p' }] });
  await assert.rejects(() => frais('accesGratuit').then((x) => x.pageGratuite()), (e) => e instanceof Redirection && e.vers === '/app');
});

test('sans Supabase (démonstration) : le visiteur seulement en développement, jamais en coupe', async () => {
  poser({ mode: 'ouvert', supabase: false, demonstration: true });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'visiteur');
  poser({ mode: 'ouvert', supabase: false, demonstration: false });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'normal');
  poser({ mode: 'coupe', supabase: false, demonstration: true });
  assert.equal((await (await frais('acces')).lireAcces()).cas, 'normal');
});

// ─── Le code de connexion : la seule porte de création de compte ────────────────
test('le code : refusé en coupe et sans le lien secret, avec création de compte seulement ici', async () => {
  const { demanderCodeGratuit } = await frais('actionsGratuit');
  let m = poser({ mode: 'coupe' });
  assert.equal((await demanderCodeGratuit('a@b.fr')).ok, false);
  assert.deepEqual(m.ecrits, []);
  m = poser({ mode: 'invitation' });
  assert.equal((await demanderCodeGratuit('a@b.fr')).ok, false);
  m = poser({ mode: 'invitation', cookies: { cts_essai: 'mot-secret' } });
  assert.equal((await demanderCodeGratuit('pas une adresse')).ok, false);
  assert.equal((await demanderCodeGratuit(' A@B.fr ')).ok, true);
  assert.deepEqual(m.ecrits, [{ table: 'otp', ligne: { email: 'a@b.fr', options: { shouldCreateUser: true } } }]);
});

// ─── Le calcul du profil : les fonctions de l'app des acheteurs ──────────────────
const SAISIE = { ...profilG.SAISIE_VIDE, e1t: '3', e1d: '1020', e2t: '12', e2d: '3480', fc1: '152', al1: '4:30', fc2: '172' };

test('le profil : la vitesse critique, le seuil 1 et le style viennent de zones.ts', async () => {
  const zones = await lib('zones');
  const c = profilG.calculer(SAISIE, '2026-11-16');
  assert.equal(c.ok, true);
  const vc = zones.vitesseCritique({ duree_s: 180, distance_m: 1020 }, { duree_s: 720, distance_m: 3480 });
  assert.equal(c.profil.vc_ms, vc.vc_ms);
  assert.equal(c.profil.d_prime_m, vc.d_prime_m);
  assert.equal(c.profil.fc_seuil1, 152);
  assert.equal(c.profil.fc_seuil2, 172);
  assert.equal(c.profil.v_seuil1_ms, Math.round((1000 / 270) * 1000) / 1000);
  assert.equal(zones.profilCoureur(c.profil).nom, 'Plutôt endurant');
});

test('le profil : les mêmes refus que l’app des acheteurs (écart, durées, FC, allure, FC 2 sans VC)', () => {
  const j = '2026-11-16';
  const msg = (s) => { const c = profilG.calculer({ ...profilG.SAISIE_VIDE, ...s }, j); assert.equal(c.ok, false); return c.message; };
  assert.match(msg({ e1t: '3', e1d: '1020', e2t: '6', e2d: '1900' }), /5 minutes/);
  assert.match(msg({ e1t: '1', e1d: '400', e2t: '12', e2d: '3480' }), /2 à 15 minutes/);
  assert.match(msg({ e1t: '3', e1d: '1020' }), /durée .* distance/);
  assert.match(msg({ fc1: '300' }), /entre 80 et 220/);
  assert.match(msg({ fc1: '150', al1: '1:00' }), /entre 2:30 et 12:00/);
  assert.match(msg({ fc2: '170' }), /vitesse critique/);
  assert.match(msg({}), /au moins un test/);
  assert.equal(profilG.calculer({ ...profilG.SAISIE_VIDE }, j).ok, false);
  assert.equal('experience' in profilG.SAISIE_VIDE, false);
});

test('le profil : sans l’accord, la FC ne se garde pas, la vitesse critique si', () => {
  const c = profilG.calculer(SAISIE, '2026-11-16');
  const sans = profilG.sansLaFc(c.tests);
  assert.deepEqual(Object.keys(sans), ['vc']);
  assert.equal(profilG.aDesFcGardees(sans), false);
  const retour = profilG.saisieDepuis(c.tests);
  assert.equal(profilG.calculer(retour, '2026-11-17').ok, true);
  assert.equal(retour.e1t, '3:00');
});

// ─── Ce que garde le compte ─────────────────────────────────────────────────────
const connecte = { sub: 'u1', email: 'a@b.fr' };
const brouillon = { ...SAISIE };

test('garder : le nouveau compte reçoit son profil, sa FC avec l’accord, l’accord à la liste daté', async () => {
  const m = poser({ mode: 'ouvert', session: connecte });
  const { garderApresConnexion } = await frais('actionsGratuit');
  const r = await garderApresConnexion({ saisie: brouillon, liste: true, consentementFc: true });
  assert.deepEqual([r.ok, r.gratuit], [true, true]);
  const compte = m.ecrits.find((e) => e.table === 'service:comptes');
  assert.equal(compte.ligne.id, 'u1');
  assert.equal(compte.options.ignoreDuplicates, true);
  const p = m.ecrits.find((e) => e.table === 'profils_gratuits').ligne;
  assert.equal(p.compte_id, 'u1');
  assert.equal('experience' in p, false);
  assert.ok(p.tests.vc && p.tests.parole && p.tests.fc2);
  assert.ok(p.consentement_fc_le && p.liste_email_le);
});

test('garder : sans l’accord à la FC, pas de FC ; la case de la liste non cochée ne laisse aucune date', async () => {
  const m = poser({ mode: 'ouvert', session: connecte });
  const { garderApresConnexion } = await frais('actionsGratuit');
  await garderApresConnexion({ saisie: brouillon, liste: false, consentementFc: false });
  const p = m.ecrits.find((e) => e.table === 'profils_gratuits').ligne;
  assert.deepEqual(Object.keys(p.tests), ['vc']);
  assert.equal(p.consentement_fc_le, null);
  assert.equal(p.liste_email_le, null);
});

test('garder : un acheteur ou un coaché qui se connecte ici ne reçoit rien, et un visiteur sans brouillon garde son accord', async () => {
  let m = poser({ mode: 'ouvert', session: connecte, plans: [{ id: 'p' }] });
  let r = await (await frais('actionsGratuit')).garderApresConnexion({ saisie: brouillon, liste: true, consentementFc: true });
  assert.deepEqual([r.ok, r.gratuit, m.ecrits.length], [true, false, 0]);
  m = poser({ mode: 'ouvert', session: connecte });
  r = await (await frais('actionsGratuit')).garderApresConnexion({ saisie: null, liste: true, consentementFc: false });
  const p = m.ecrits.find((e) => e.table === 'profils_gratuits').ligne;
  assert.deepEqual([r.gratuit, p.tests, Boolean(p.liste_email_le)], [true, {}, true]);
});

test('enregistrer ses tests : la FC exige l’accord, une fois ; sans session, rien', async () => {
  let m = poser({ mode: 'ouvert', session: connecte });
  const { enregistrerProfilGratuit } = await frais('actionsGratuit');
  let r = await enregistrerProfilGratuit({ saisie: SAISIE, consentementFc: false });
  assert.equal(r.ok, false);
  assert.deepEqual(m.ecrits, []);
  r = await enregistrerProfilGratuit({ saisie: SAISIE, consentementFc: true });
  assert.equal(r.ok, true);
  assert.ok(m.ecrits.find((e) => e.table === 'profils_gratuits').ligne.consentement_fc_le);
  // Le consentement déjà donné vaut pour les tests suivants.
  m = poser({ mode: 'ouvert', session: connecte, lignes: { profils_gratuits: { experience: null, tests: {}, consentement_fc_le: '2026-11-16T10:00:00Z', liste_email_le: null } } });
  r = await (await frais('actionsGratuit')).enregistrerProfilGratuit({ saisie: SAISIE, consentementFc: false });
  assert.equal(r.ok, true);
  assert.equal(m.ecrits.find((e) => e.table === 'profils_gratuits').ligne.consentement_fc_le, '2026-11-16T10:00:00Z');
  poser({ mode: 'ouvert' });
  assert.equal((await (await frais('actionsGratuit')).enregistrerProfilGratuit({ saisie: SAISIE, consentementFc: true })).ok, false);
});
