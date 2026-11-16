#!/usr/bin/env node
/**
 * L'APERÇU DU PLAN AVANT PAIEMENT (décision du coach du 16/11/2026, lot A2 ; contrat de POST /v1/apercu, moteur 8.470) :
 * la route serveur (porte, relais sans e-mail ni nom, en-têtes, délai, erreurs), la limite de 10 par visiteur et par heure
 * (empreinte HMAC, jamais l'IP ; sans la table, l'aperçu passe), le cache de session (mêmes réponses, même jour à Paris),
 * les réponses du moteur simulées (200, 404, 422, 500, délai), et le périmètre : seulement un achat. Sans réseau ni base :
 * des doublures (scripts/_monde-apercu.mjs), des cas fictifs.
 *
 *   node --test scripts/test-apercu.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const MONDE = pathToFileURL(`${RACINE}scripts/_monde-apercu.mjs`).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^next\/(server|headers)$/.test(specifier)) return { url: MONDE, shortCircuit: true };
    if (specifier === '@/lib/app/supabase') return { url: MONDE, shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const A = await import(`${RACINE}lib/apercu.ts`);
const limite = await import(`${RACINE}lib/app/apercuLimite.ts`);
const route = await import(`${RACINE}app/plan/apercu/route.ts`);
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// Un aperçu fictif, tel que le contrat le décrit.
const APERCU = (jour = '2026-12-16') => ({
  calcule_le: jour, version_moteur: '8.470',
  resume: { course: 'Trail de la Côte sauvage', date_course: '2027-06-27', date_debut_plan: '2026-12-21', duree_mois: 6, prix_eur: 59, trace_ignoree: false },
  blocs: [{ bloc: 'Fondations', du: '2026-12-21', au: '2027-01-31', semaines: 6, but: 'Texte du but, tel quel.' }],
  trame: { course: { date: '2027-06-27' }, semaines: [] },
  semaine_1: { semaine: { numero: 'S1', jours: [] }, notes: [{ regle: 'x', texte: 'Une note.' }] },
});
const INTAKE = { nom: 'Alix Fictive', email: 'alix@cts-coaching.test', prenom: 'Alix', nolio_email: 'a@cts-coaching.test', niveau: 'intermediaire', course_nom: 'Trail de la Côte sauvage', date_course: '2027-06-27', distance_km: '18', dplus_m: '540' };

// Le monde d'une route : la porte, la base, le moteur simulé (espion sur fetch).
function poser({ ouvert = true, tableAbsente = false, moteur = { statut: 200, corps: APERCU() }, secret = 'secret-de-test' } = {}) {
  process.env.CTS_PLAN_OUVERT = ouvert ? '1' : '0';
  delete process.env.CTS_INVITATION;
  process.env.CTS_API_CLE = 'cle-moteur-de-test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  const m = { cookies: {}, table: [], purges: [], appels: [], tableAbsente, moteur, envoyes: [] };
  globalThis.__apercu = m;
  globalThis.fetch = async (url, init) => {
    m.envoyes.push({ url: String(url), init });
    if (m.moteur instanceof Error) throw m.moteur;
    return new Response(m.moteur.corps === undefined ? null : JSON.stringify(m.moteur.corps), { status: m.moteur.statut });
  };
  return m;
}
const requete = ({ intake = INTAKE, gpx = null, ip = '203.0.113.7', brut } = {}) => {
  const f = new FormData();
  f.append('intake', brut ?? JSON.stringify(intake));
  if (gpx) f.append('gpx', new File([gpx], 'trace.gpx', { type: 'application/gpx+xml' }));
  return Object.assign(new Request('https://cts-coaching.test/plan/apercu', { method: 'POST', body: f, headers: { 'x-real-ip': ip } }));
};

// ─── Le pur ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('retirerIdentite : ni e-mail ni nom, le reste intact ; l’original n’est pas touché', () => {
  const r = A.retirerIdentite(INTAKE);
  for (const cle of ['email', 'nom', 'prenom', 'nolio_email']) assert.equal(cle in r, false, cle);
  assert.equal(r.course_nom, 'Trail de la Côte sauvage');
  assert.equal(INTAKE.email, 'alix@cts-coaching.test');
});

test('jourParis : le jour à l’heure de Paris (23 h 30 UTC l’hiver, c’est déjà le lendemain)', () => {
  assert.equal(A.jourParis(new Date('2026-12-16T23:30:00Z')), '2026-12-17');
  assert.equal(A.jourParis(new Date('2026-12-16T10:00:00Z')), '2026-12-16');
  assert.equal(A.jourParis(new Date('2027-06-30T22:30:00Z')), '2027-07-01'); // l'été, UTC+2
});

test('dateEnLettres : « 16 décembre 2026 », « 1er février 2027 »', () => {
  assert.equal(A.dateEnLettres('2026-12-16'), '16 décembre 2026');
  assert.equal(A.dateEnLettres('2027-02-01'), '1er février 2027');
});

test('le cache de session : mêmes réponses et même jour, l’aperçu gardé ; une réponse changée, un autre jour : rien', () => {
  const e = A.empreinteApercu(INTAKE, null);
  const garde = { empreinte: e, calcule_le: '2026-12-16', apercu: APERCU('2026-12-16') };
  assert.equal(A.apercuGardeValide(garde, e, '2026-12-16'), garde.apercu);
  // L'identité ne compte pas dans l'empreinte (elle ne part pas) ; une réponse, si.
  assert.equal(A.empreinteApercu({ ...INTAKE, email: 'autre@cts-coaching.test', nom: 'Autre' }, null), e);
  assert.notEqual(A.empreinteApercu({ ...INTAKE, dplus_m: '600' }, null), e);
  // La trace compte : nom, taille, date.
  const t = { name: 'a.gpx', size: 10, lastModified: 1 };
  assert.notEqual(A.empreinteApercu(INTAKE, t), e);
  assert.notEqual(A.empreinteApercu(INTAKE, { ...t, size: 11 }), A.empreinteApercu(INTAKE, t));
  // L'ordre des clés ne change rien.
  assert.equal(A.empreinteApercu({ b: 1, a: 2 }, null), A.empreinteApercu({ a: 2, b: 1 }, null));
  assert.equal(A.apercuGardeValide(garde, A.empreinteApercu({ ...INTAKE, dplus_m: '600' }, null), '2026-12-16'), null);
  assert.equal(A.apercuGardeValide(garde, e, '2026-12-17'), null);
  assert.equal(A.apercuGardeValide(null, e, '2026-12-16'), null);
});

test('classerReponse : 200 → l’aperçu ; 404 → absent ; 422 → les messages de la vérification ; le reste → « pas disponible »', () => {
  const TROP = 'Ta course est trop proche.';
  assert.deepEqual(A.classerReponse(200, APERCU(), TROP), { type: 'ok', apercu: APERCU() });
  assert.deepEqual(A.classerReponse(404, null, TROP), { type: 'absent' });
  assert.deepEqual(A.classerReponse(422, { raison: 'course_trop_proche', message: 'x' }, TROP), { type: 'refus', raison: 'course_trop_proche', message: TROP });
  assert.deepEqual(A.classerReponse(422, { error: 'refus_metier', message: 'Pas de plan pour ce format.' }, TROP), { type: 'refus', raison: undefined, message: 'Pas de plan pour ce format.' });
  const PAS = { type: 'indisponible', message: 'L’aperçu n’est pas disponible pour l’instant.' };
  assert.deepEqual(A.classerReponse(500, { error: 'qualite', message: 'x' }, TROP), PAS);
  assert.deepEqual(A.classerReponse(400, { error: 'intake', message: 'x' }, TROP), PAS);
  assert.deepEqual(A.classerReponse(504, { error: 'delai' }, TROP), PAS);
  assert.deepEqual(A.classerReponse(200, { calcule_le: '2026-12-16' }, TROP), PAS); // un 200 sans blocs ni semaine : pas un aperçu
  assert.equal(A.classerReponse(429, { error: 'limite', message: A.MESSAGE_APERCU_LIMITE }, TROP).message, A.MESSAGE_APERCU_LIMITE);
});

// ─── La route ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('la route : même porte que l’achat (planOuvert), sinon 404, sans toucher au moteur ni à la base', async () => {
  const m = poser({ ouvert: false });
  const r = await route.POST(requete());
  assert.equal(r.status, 404);
  assert.equal(m.envoyes.length, 0);
  assert.equal(m.appels.length, 0);
});

test('la route : relaie au moteur en multipart, intake sans e-mail ni nom, la trace, X-CTS-Cle, jamais X-CTS-Coach, un délai de 15 s', async () => {
  const m = poser();
  const r = await route.POST(requete({ gpx: '<gpx></gpx>' }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), APERCU()); // telle quelle
  assert.equal(m.envoyes.length, 1);
  const { url, init } = m.envoyes[0];
  assert.ok(url.endsWith('/v1/apercu'), url);
  assert.equal(init.method, 'POST');
  assert.ok(init.body instanceof FormData);
  const intake = JSON.parse(init.body.get('intake'));
  for (const cle of ['email', 'nom', 'prenom', 'nolio_email']) assert.equal(cle in intake, false, cle);
  assert.equal(intake.course_nom, 'Trail de la Côte sauvage');
  assert.equal(init.body.get('gpx').name, 'trace.gpx');
  assert.equal(init.body.has('execution_immediate'), false);
  assert.equal(init.body.has('cgv_acceptees'), false);
  assert.equal(init.headers['X-CTS-Cle'], 'cle-moteur-de-test');
  assert.deepEqual(Object.keys(init.headers).filter((h) => /coach|simulation/i.test(h)), []);
  assert.ok(init.signal instanceof AbortSignal, 'un délai');
  assert.equal(A.DELAI_MOTEUR_MS, 15_000);
});

test('la route : sans trace, pas de gpx ; une intake illisible, 400 sans appeler le moteur', async () => {
  const m = poser();
  await route.POST(requete());
  assert.equal(m.envoyes[0].init.body.has('gpx'), false);
  const m2 = poser();
  const r = await route.POST(requete({ brut: '{pas du json' }));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'intake');
  assert.equal(m2.envoyes.length, 0);
});

test('les erreurs du moteur (404, 422, 500 qualité) traversent la route avec leur statut ; le délai et le réseau : 504, « pas disponible »', async () => {
  for (const [statut, corps] of [[404, { detail: 'Not Found' }], [422, { error: 'refus_metier', raison: 'course_trop_proche', message: 'trop proche' }], [500, { error: 'qualite', message: 'linter' }]]) {
    poser({ moteur: { statut, corps } });
    const r = await route.POST(requete());
    assert.equal(r.status, statut);
    assert.deepEqual(await r.json(), corps);
  }
  poser({ moteur: { statut: 404 } }); // un 404 sans corps
  assert.equal((await route.POST(requete())).status, 404);
  for (const erreur of [Object.assign(new Error('délai'), { name: 'TimeoutError' }), new TypeError('fetch failed')]) {
    poser({ moteur: erreur });
    const r = await route.POST(requete());
    assert.equal(r.status, 504);
    assert.equal((await r.json()).message, 'L’aperçu n’est pas disponible pour l’instant.');
  }
});

test('la limite : 10 aperçus par visiteur et par heure ; le 11e, 429 sans appeler le moteur ; un autre visiteur passe ; l’heure d’après aussi', async () => {
  const m = poser();
  for (let i = 0; i < 10; i++) assert.equal((await route.POST(requete())).status, 200, `aperçu ${i + 1}`);
  const r = await route.POST(requete());
  assert.equal(r.status, 429);
  assert.equal((await r.json()).message, A.MESSAGE_APERCU_LIMITE);
  assert.equal(m.envoyes.length, 10);
  assert.equal((await route.POST(requete({ ip: '198.51.100.9' }))).status, 200);
  // Une heure plus tard, la table se purge et le visiteur repart.
  const plus = new Date(Date.now() + 61 * 60 * 1000);
  assert.equal(await limite.apercuPermis(new Headers({ 'x-real-ip': '203.0.113.7' }), plus), true);
  assert.ok(m.table.every((l) => l.appele_le >= new Date(plus.getTime() - 3600_000).toISOString()), 'les lignes de plus d’une heure sont purgées');
});

test('la limite : l’adresse IP n’est jamais gardée en clair, seulement son empreinte HMAC (qui dépend du secret du serveur)', async () => {
  const m = poser();
  await route.POST(requete({ ip: '203.0.113.7' }));
  assert.equal(m.table.length, 1);
  const ligne = JSON.stringify(m.table[0]);
  assert.equal(ligne.includes('203.0.113.7'), false);
  assert.equal(m.table[0].empreinte, limite.empreinteVisiteur('203.0.113.7', 'secret-de-test'));
  assert.notEqual(limite.empreinteVisiteur('203.0.113.7', 'autre-secret'), limite.empreinteVisiteur('203.0.113.7', 'secret-de-test'));
  assert.notEqual(limite.empreinteVisiteur('203.0.113.8', 'secret-de-test'), m.table[0].empreinte);
});

test('sans la table (migration pas collée) : l’aperçu passe quand même, avec un console.warn', async () => {
  const m = poser({ tableAbsente: true });
  const avertissements = [];
  const avant = console.warn;
  console.warn = (...a) => avertissements.push(a.join(' '));
  try {
    for (let i = 0; i < 12; i++) assert.equal((await route.POST(requete())).status, 200);
  } finally {
    console.warn = avant;
  }
  assert.equal(m.envoyes.length, 12);
  assert.equal(avertissements.length, 12);
  assert.match(avertissements[0], /apercus_appels/);
  assert.equal(avertissements.join('').includes('203.0.113.7'), false);
});

// ─── Le périmètre : seulement un achat ──────────────────────────────────────────────────────────────────────────────
test('le périmètre : un achat seulement, jamais le coach, la demande d’un coaché ni l’objectif modifié', () => {
  assert.equal(A.apercuPourCeParcours({ coach: false, demande: false, modification: false }), true);
  for (const p of [{ coach: true, demande: false, modification: false }, { coach: false, demande: true, modification: false }, { coach: true, demande: true, modification: false }, { coach: false, demande: false, modification: true }]) {
    assert.equal(A.apercuPourCeParcours(p), false, JSON.stringify(p));
  }
});

test('le périmètre dans le code : le questionnaire n’appelle l’aperçu que pour un achat ; la simulation du coach (X-CTS-Coach) et le coaching n’y passent pas', () => {
  const q = lire('components/plan/Questionnaire.tsx');
  assert.match(q, /const avecApercu = apercuPourCeParcours\(\{ coach, demande, modification: Boolean\(modification\) \}\)/);
  assert.match(q, /avecApercu \? voirApercu\(\) : generer\(\)/);
  // La simulation du coach part directement, sans aperçu.
  assert.match(q, /onClick=\{\(\) => generer\(true\)\}/);
  // L'aperçu n'est appelé que par chercherApercu, lui-même appelé par voirApercu et payerDepuisApercu seulement.
  assert.equal((q.match(/chercherApercu\(/g) ?? []).length, 3); // la définition et les deux usages
  assert.equal((q.match(/'\/plan\/apercu'/g) ?? []).length, 1);
  // La route ne porte jamais l'en-tête du coach ; personne d'autre n'appelle /plan/apercu ni /v1/apercu.
  assert.equal(/X-CTS-Coach|CTS_CLE_COACH|coachConnecte/.test(sansCommentaires(lire('app/plan/apercu/route.ts'))), false);
  for (const f of ['app/plan/simuler/route.ts', 'app/app/coach/athletes/route.ts', 'app/app/objectif/demande/route.ts', 'components/app/FormulaireCoaching.tsx', 'lib/app/ecriture.ts']) {
    let src = '';
    try { src = lire(f); } catch { continue; }
    assert.equal(/plan\/apercu|v1\/apercu/.test(src), false, f);
  }
});

test('aucun texte de l’écran d’aperçu n’invite à échanger avec le coach', () => {
  const ecran = sansCommentaires(lire('components/plan/ApercuPlan.tsx'));
  assert.equal(/coach|échang|écris-|contacte|discute|rendez-vous|appel/i.test(ecran), false);
  for (const t of [A.MESSAGE_APERCU_INDISPONIBLE, A.MESSAGE_APERCU_LIMITE, A.PHRASE_TRACE_IGNOREE, A.PHRASE_AUTRE_JOUR]) {
    assert.equal(/coach|échang|écris-|contacte|discute|rendez-vous|appel/i.test(t), false, t);
  }
  assert.equal(A.MESSAGE_APERCU_INDISPONIBLE, 'L’aperçu n’est pas disponible pour l’instant.');
  assert.match(A.PHRASE_TRACE_IGNOREE, /D\+ et le D−/);
});

test('l’écran n’écrit aucun nom de séance ni de texte de bloc : « but » et les séances viennent du moteur', () => {
  const ecran = lire('components/plan/ApercuPlan.tsx');
  assert.match(ecran, /\{b\.but\}/);
  assert.match(ecran, /dateEnLettres\(apercu\.calcule_le\)/);
  assert.equal(/Fondations|Spécifique|Affûtage|Seuil|Sortie longue|VMA/.test(sansCommentaires(ecran)), false);
});
