#!/usr/bin/env node
/**
 * LES PRÉREQUIS D'UN PLAN, DITS À L'ACHETEUR (entrée 234 du coach, 25/11/2026 ; textes de la section 4 de « Lot de textes à valider — moteur, 25-11 », validés « Tout A » ; contrat de `POST /v1/prerequis`,
 * branche du moteur claude/moteur-v1-540ea4) : les phrases mot pour mot (lib/prerequis.ts), la route serveur qui relaie au moteur (app/plan/prerequis/route.ts : porte, 9.x seulement, paramètres sans identité
 * ni santé, X-CTS-Cle, délai, erreurs) et ce que le récapitulatif en fait. La route du moteur n'est pas encore en ligne : sa réponse est simulée à la forme du contrat. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-prerequis-achat.mjs
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
const P = await import(`${RACINE}lib/prerequis.ts`);
const route = await import(`${RACINE}app/plan/prerequis/route.ts`);
const { oublierLaVersionDuMoteur } = await import(`${RACINE}lib/app/moteurEnLigne.ts`);
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// ─── Les phrases, mot pour mot ──────────────────────────────────────────────────────────────────────

// Ce que rend `POST /v1/prerequis` pour un plan où la sortie longue et les séances manquent (tous les champs du contrat).
const PREREQUIS = {
  applicable: true, vendable: false, pic_atteint_pct: 58, pic_table_min: 240, sl_atteinte_min: 139, seuil_pct: 70, seances_min: 3, seances_declarees: 2,
  sl_depart_min: 100, sl_depart_min_min: 148, sl_depart_min_min_5: 150, semaines_pour_s_y_preparer: 4, raisons: ['sl', 'seances'], alerte_coach: null,
};
const SL = 'Pour démarrer ce plan, il faut pouvoir courir 2h30 d’affilée lors de ta sortie longue. Aujourd’hui, ta plus longue sortie est de 1h40. '
  + 'En l’allongeant d’environ 10 % chaque semaine, tu y seras dans 4 semaines environ : c’est le bon moment pour commencer. Tu peux aussi choisir un plan plus long ou une course plus courte.';
const SEANCES = 'Pour une course de cette durée, il faut t’entraîner au moins 3 fois par semaine : en dessous, ta sortie longue porterait presque toute ta semaine, '
  + 'et le risque de te blesser monte. Tu peux prévoir 3 séances, ou choisir une course plus courte.';
const CHOIX = 'Tu peux aussi choisir un plan plus long ou une course plus courte.';

test('les deux prérequis manquent : la phrase de la sortie longue, puis celle des séances, mot pour mot', () => {
  assert.deepEqual(P.messagesDesPrerequis(PREREQUIS), [SL, SEANCES]);
});

test('la sortie longue seule, les séances seules ; le minimum d’une semaine ; une sortie longue de départ qui ne tient pas du tout', () => {
  const avec = (changement) => P.messagesDesPrerequis({ ...PREREQUIS, ...changement });
  assert.deepEqual(avec({ raisons: ['sl'] }), [SL]);
  assert.deepEqual(avec({ raisons: ['seances'] }), [SEANCES]);
  assert.match(avec({ raisons: ['sl'], semaines_pour_s_y_preparer: 1 })[0], /dans 1 semaine environ/);
  assert.deepEqual(avec({ raisons: ['sl'], sl_depart_min_min_5: 120, sl_depart_min: 60 }).map((m) => m.slice(0, 80)),
    ['Pour démarrer ce plan, il faut pouvoir courir 2h d’affilée lors de ta sortie longue. Aujour'.slice(0, 80)]);
  // `sl_depart_min_min` à null (même un départ au pic n'y arrive pas) : seulement la phrase du choix.
  assert.deepEqual(avec({ raisons: ['sl'], sl_depart_min_min: null, sl_depart_min_min_5: null, semaines_pour_s_y_preparer: null }), [CHOIX]);
  assert.deepEqual(avec({ sl_depart_min_min: null, sl_depart_min_min_5: null, semaines_pour_s_y_preparer: null }), [CHOIX, SEANCES]);
  assert.equal(P.TEXTES_PREREQUIS.choix, CHOIX);
});

test('rien à dire : un plan vendable, une saison de fond sans date, une réponse sans la forme du contrat, un nombre qui manque', () => {
  assert.deepEqual(P.messagesDesPrerequis({ ...PREREQUIS, vendable: true, raisons: [] }), []);
  assert.deepEqual(P.messagesDesPrerequis({ ...PREREQUIS, vendable: undefined }), [], 'sans « vendable » lu, rien');
  assert.deepEqual(P.messagesDesPrerequis({ ...PREREQUIS, applicable: false, vendable: true }), []);
  assert.deepEqual(P.messagesDesPrerequis({ ...PREREQUIS, raisons: [] }), [], 'non vendable sans raison lue : rien d’inventé');
  assert.deepEqual(P.messagesDesPrerequis({ ...PREREQUIS, raisons: ['seances'], seances_min: null }), []);
  for (const mal of [null, undefined, {}, 'x']) assert.deepEqual(P.messagesDesPrerequis(mal), [], JSON.stringify(mal));
  assert.equal(P.prerequisDeLaReponse({ prerequis: PREREQUIS, version_moteur: '9.0' }), PREREQUIS);
  for (const mal of [null, undefined, {}, { prerequis: null }, { prerequis: [1] }, { prerequis: 'oui' }]) assert.equal(P.prerequisDeLaReponse(mal), null, JSON.stringify(mal));
});

test('les durées se disent comme sur le reste du site, et les phrases ne parlent ni de moteur ni de calcul', () => {
  assert.deepEqual([45, 60, 90, 125, 150, 240].map(P.enDuree), ['45 min', '1h', '1h30', '2h05', '2h30', '4h']);
  for (const m of P.messagesDesPrerequis(PREREQUIS)) assert.ok(!/moteur|calcul|automat|\blu\b|coach/i.test(m), m);
  // Ni invitation à parler au coach, ni « vous ».
  for (const m of P.messagesDesPrerequis(PREREQUIS)) assert.ok(!/\bvous\b|écris-nous|contacte/i.test(m), m);
});

test('ce que le navigateur reçoit : seulement de quoi dire les phrases (pas l’alerte du coach, pas le reste)', () => {
  const garde = P.prerequisPourLAchat({ ...PREREQUIS, alerte_coach: { active: true, raisons: ['sl'] }, pic_table_min: 240, inconnu: 'x' });
  assert.deepEqual(Object.keys(garde).sort(), ['applicable', 'raisons', 'seances_min', 'semaines_pour_s_y_preparer', 'sl_depart_min', 'sl_depart_min_min', 'sl_depart_min_min_5', 'vendable']);
  assert.deepEqual(P.messagesDesPrerequis(garde), [SL, SEANCES], 'les phrases sont les mêmes avant et après');
  assert.equal(P.prerequisPourLAchat(null), null);
  assert.equal(P.prerequisPourLAchat({ vendable: 'oui', raisons: 'sl', seances_min: 'trois' }).vendable, undefined);
  assert.deepEqual(P.prerequisPourLAchat({ vendable: false, raisons: 'sl' }).raisons, []);
});

// ─── La route serveur ────────────────────────────────────────────────────────────────────────────────

// Ce que le navigateur envoie : le questionnaire de l'acheteur sans nom ni e-mail ni santé (intakePourApi), avec la côte en minutes.
const REPONSES = {
  nom: 'Alix Fictive', email: 'alix@cts-coaching.test', prenom: 'Alix', nolio_email: 'a@cts-coaching.test',
  format: 'TC', date_course: '2027-06-27', distance_km: '42', dplus_m: '2400', temps_cible: '7h00', duree_mois: 6,
  volume_hebdo_actuel: '4h', sortie_longue_actuelle: '1h40', jours_disponibles: ['mardi', 'samedi'], jour_sl: 'samedi', freq_hebdo: 2,
  niveau: 'intermediaire', terrain: 'pentu', critere_intensite: 'regulier', critere_denivele: 'parfois', tapis: 'non', cote_min: '12', glucides_cible: [60, 80],
};

function poser({ ouvert = true, version = '9.0', moteur = { statut: 200, corps: { prerequis: PREREQUIS, version_moteur: '9.0' } } } = {}) {
  process.env.CTS_PLAN_OUVERT = ouvert ? '1' : '0';
  delete process.env.CTS_INVITATION;
  process.env.CTS_API_CLE = 'cle-moteur-de-test';
  oublierLaVersionDuMoteur();
  const m = { cookies: {}, envoyes: [] };
  globalThis.__apercu = m;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/v1/config')) return new Response(JSON.stringify({ version_moteur: version }), { status: 200 });
    m.envoyes.push({ url: String(url), init });
    if (moteur instanceof Error) throw moteur;
    return new Response(moteur.corps === undefined ? null : JSON.stringify(moteur.corps), { status: moteur.statut });
  };
  return m;
}
const requete = ({ corps = REPONSES, brut } = {}) => new Request('https://cts-coaching.test/plan/prerequis', { method: 'POST', body: brut ?? JSON.stringify(corps), headers: { 'content-type': 'application/json' } });

test('la route : sous la 9.x, POST /v1/prerequis avec { parametres } à la forme du moteur v1, sans identité, X-CTS-Cle, un délai ; ce qui revient sert aux phrases', async () => {
  const m = poser();
  const r = await route.POST(requete());
  assert.equal(r.status, 200);
  const { prerequis } = await r.json();
  assert.deepEqual(P.messagesDesPrerequis(prerequis), [SL, SEANCES]);
  assert.ok(!('alerte_coach' in prerequis) && !('pic_table_min' in prerequis), 'seulement de quoi dire les phrases');
  assert.equal(m.envoyes.length, 1);
  const { url, init } = m.envoyes[0];
  assert.ok(url.endsWith('/v1/prerequis'), url);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-CTS-Cle'], 'cle-moteur-de-test');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(Object.keys(init.headers).filter((h) => /coach|simulation/i.test(h)), []);
  assert.ok(init.signal instanceof AbortSignal, 'un délai');
  const { parametres } = JSON.parse(init.body);
  // Sans identité.
  for (const cle of ['nom', 'email', 'prenom', 'nolio_email']) assert.ok(!(cle in parametres), cle);
  // La forme du moteur v1 : la côte en minutes, les deux critères ensemble ; ni niveau ni terrain à quatre valeurs ; la cible de glucides en un nombre.
  assert.equal(parametres.cote_min, 12);
  assert.deepEqual(parametres.criteres, { intensite: 'regulier', mecanique: 'parfois' });
  for (const cle of ['niveau', 'terrain', 'critere_intensite', 'critere_denivele']) assert.ok(!(cle in parametres), cle);
  assert.equal(parametres.glucides_cible, 70);
  for (const cle of ['format', 'date_course', 'distance_km', 'dplus_m', 'temps_cible', 'duree_mois', 'volume_hebdo_actuel', 'sortie_longue_actuelle', 'jours_disponibles', 'jour_sl', 'freq_hebdo', 'tapis']) assert.deepEqual(parametres[cle], REPONSES[cle], cle);
  assert.ok(!('coaching' in parametres), 'un acheteur n’est pas un coaché');
});

test('la route : fermée, 404 sans rien appeler ; sous la 8.x, rien à dire et le moteur n’est pas appelé ; réponses illisibles, 400', async () => {
  const m = poser({ ouvert: false });
  const r = await route.POST(requete());
  assert.equal(r.status, 404);
  assert.equal(m.envoyes.length, 0);
  const m8 = poser({ version: '8.474' });
  const r8 = await route.POST(requete());
  assert.equal(r8.status, 200);
  assert.deepEqual(await r8.json(), { prerequis: null });
  assert.equal(m8.envoyes.length, 0, 'sous la 8.x, la route du moteur n’est pas appelée');
  for (const brut of ['{pas du json', '[1,2]', 'null', JSON.stringify({ x: 'a'.repeat(21_000) })]) {
    const m2 = poser();
    const r2 = await route.POST(requete({ brut }));
    assert.equal(r2.status, 400, brut.slice(0, 20));
    assert.equal(m2.envoyes.length, 0);
  }
});

test('la route : le moteur absent (404), en erreur, muet ou sans la forme du contrat : { prerequis: null } et jamais d’erreur à l’acheteur', async () => {
  for (const moteur of [{ statut: 404, corps: { detail: 'Not Found' } }, { statut: 500, corps: { error: 'qualite' } }, { statut: 400, corps: { message: 'x' } }, { statut: 200, corps: { autre: 1 } }, { statut: 200, corps: undefined },
    Object.assign(new Error('délai'), { name: 'TimeoutError' }), new TypeError('fetch failed')]) {
    poser({ moteur });
    const r = await route.POST(requete());
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { prerequis: null });
  }
});

// ─── Le récapitulatif ─────────────────────────────────────────────────────────────────────────────────

test('le récapitulatif dit les prérequis, pour l’acheteur seul, après la vérification, sans jamais bloquer ; le bouton revient aux réponses', () => {
  const q = sansCommentaires(lire('components/plan/Questionnaire.tsx'));
  assert.match(q, /import \{ messagesDesPrerequis, type PrerequisAchat \} from '@\/lib\/prerequis';/);
  // Lus après la vérification, une fois le récapitulatif ouvert (rien n'attend le moteur), jamais pour le coach ni pour la demande d'un coaché.
  assert.ok(q.indexOf("setEtape('recap');\n    window.scrollTo") < q.indexOf("fetch('/plan/prerequis'"), 'après la vérification');
  assert.match(q, /if \(!coach && !demande\) \{\n\s+const lecture = \+\+prerequisDemandes\.current;/);
  assert.match(q, /const reponses = \{ \.\.\.retirerIdentite\(avecReference\(intakePourApi\(c\)\)\), cote_min: c\.cote_min \};/, 'sans identité ni santé, avec la côte en minutes');
  assert.match(q, /if \(lecture === prerequisDemandes\.current\) setPrerequis\(/, 'une lecture plus ancienne ne remplace pas la nouvelle');
  assert.match(q, /setPrerequis\(null\);\n    setEnvoi\(true\);/, 'chaque passage au récapitulatif repart de rien');
  // Dits avec les autres points à lire, puis le bouton ; le paiement n'en dépend pas.
  assert.match(q, /const prerequisDits = !coach && !demande \? messagesDesPrerequis\(prerequis\) : \[\];/);
  assert.match(q, /const aLire = \[\.\.\.alertes, \.\.\.prerequisDits\];/);
  assert.match(q, /\{aLire\.map\(\(a\) => <li key=\{a\}>\{a\}<\/li>\)\}/);
  assert.match(q, /\{prerequisDits\.length > 0 && \(\n\s+<button type="button" onClick=\{\(\) => setEtape\('formulaire'\)\} className=\{`\$\{boutonSecondaireCls\} mb-6`\}>\n\s+← Modifier mes réponses/);
  const bloque = q.slice(q.indexOf('const bloque ='), q.indexOf('const bloque =') + 140);
  assert.ok(!/prerequis/i.test(bloque), 'le bouton de paiement ne dépend pas des prérequis');
});
