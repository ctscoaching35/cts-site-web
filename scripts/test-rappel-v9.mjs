#!/usr/bin/env node
/**
 * LE RAPPEL DU DIMANCHE SOUS LE MOTEUR v1 (décision 206 du coach, 24/11/2026 ; lib/app/rappelDimancheV9.ts, lib/app/passeUnPlanV9.ts `pointSansReponse`, lib/app/passagesV9.ts
 * `rappelDuDimancheV9`) : un seul rappel vers 19 h (Paris, décision 211), à qui n'a pas répondu à son « point du dimanche » et, sous le 9.1 seulement (261, 270), à qui a une séance de course non remontée ; le même
 * interrupteur `CTS_RAPPEL_DIMANCHE` qu'avant. Nolio et la base sont de fausses pièces qui notent chaque appel ; la trame est celle du moteur enregistré (athlète fictif).
 * Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-rappel-v9.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const FAUX = {
  '/lib/app/supabase.ts': `
export const clientService = () => ({ from: (table) => ({
  upsert: (row) => ({ select: async () => { globalThis.__bd.push(['cle', row.plan_id, row.semaine]); const k = row.plan_id + '|' + row.semaine;
    if (globalThis.__prises.has(k)) return { data: [] }; globalThis.__prises.add(k); return { data: [{ plan_id: row.plan_id }] }; } }),
  delete: () => ({ eq: () => ({ eq: async (_c, semaine) => { globalThis.__bd.push(['cle libérée', semaine]); return {}; } }) }),
}) });`,
  '/lib/app/nolio.ts': `
export const SPORTS_COURSE = ['spt_course'];
export const refusNolio = (r, quoi) => 'refus de Nolio : ' + quoi;
export const listeNolio = async (chemin) => {
  globalThis.__lectures.push(chemin);
  const usr = /athlete=(usr_\\w+)/.exec(chemin)?.[1];
  if (globalThis.__panne === usr) throw new Error('Nolio ne répond pas');
  if (chemin.startsWith('planned/trainings/')) return structuredClone(globalThis.__prevues?.[usr] ?? []);
  if (chemin.startsWith('real/trainings/')) return structuredClone(globalThis.__reelles?.[usr] ?? []);
  return chemin.startsWith('real/quiz_results/') ? structuredClone(globalThis.__resultats[usr] ?? []) : [];
};
export const appelNolio = async (methode, chemin, corps) => { globalThis.__appels.push([methode, chemin, corps]); return { statut: globalThis.__statut ?? 201, corps: { id: 'msg_1' } }; };`,
  '/lib/app/coaching.ts': 'export const destinataire = async (usr) => ({ moi: false, usr }); export const envoyerSemaineCible = async () => {}; export const mettreAJourSemaineCible = async () => {};',
  '/lib/app/luAuDepart.ts': 'export const lireLuAuDepart = async () => null;',
  '/lib/app/ecriture.ts': `
export const aujourdhuiParis = () => globalThis.__jour; export const garderNote = async () => {}; export const indiceHooper = async () => null;
export const moteur = async (chemin) => { if (chemin !== '/v1/trame') throw new Error('appel inattendu : ' + chemin); return structuredClone(globalThis.__trame); };
export const noteDeLaSemaine = async () => {}; export const objectifEcrit = async (planId) => globalThis.__objectifs[planId] ?? null;
export const plansActifs = async () => Object.keys(globalThis.__objectifs); export const plansEnRecuperation = async () => [];`,
  '/lib/app/stockageV9.ts': `
export const lireEtatDuPlan = async (_s, planId) => structuredClone(globalThis.__etats[planId] ?? { courant: null, ecrites: [] });
export const lireLaDerniereSemaine = async (_s, planId) => structuredClone(globalThis.__dernieres[planId] ?? null);
export const garderLEtat = async () => {}; export const garderLeQuestionnairePose = async () => {}; export const garderLesReponsesLues = async () => {};
export const garderUneEcriture = async () => {}; export const lireLeQuestionnairePose = async () => null;`,
  '/lib/app/parametresPlanV9.ts': 'export const parametresDuObjectifV9 = async () => globalThis.__parametres;',
  '/lib/app/moteurEnLigne.ts': 'export const moteurEstV9 = async () => true; export const moteurAuMoins91 = async () => globalThis.__v91 === true;',
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
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const texts = await charge('rappelDimancheV9');
const passes = await charge('passeUnPlanV9');
const passages = await charge('passagesV9');
const fixture = (nom) => JSON.parse(readFileSync(`${RACINE}scripts/fixtures/moteur-v9/${nom}.json`, 'utf8'));
const TRAME = fixture('trame').reponse;
const PARAMETRES = fixture('semaine-1').requete.corps.parametres;
const [LUNDI_1, LUNDI_2] = TRAME.semaines.map((s) => s.lundi);
const jour = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const DIMANCHE = jour(LUNDI_1, 6); // le dimanche de la semaine 1 : la semaine 2 s'écrit ce soir
const A_13H = new Date(`${DIMANCHE}T13:00:00Z`); // 14 h à Paris en novembre : le message est programmé à 19 h (décision 211)

const COACHE = 'Petit rappel : réponds à ton point du dimanche avant ce soir, pour que je prépare ta semaine au plus juste.';
const ACHETEUR = 'Petit rappel : réponds à ton point du dimanche avant ce soir, pour que ta semaine colle à ce que tu as fait.';

// Un plan : coaché ou acheteur, sa semaine 1 écrite avec son point du dimanche posé (identifiant `pqz_<usr>`), ou rien d'écrit (le dimanche d'avant la première).
const objectif = (planId, usr, coache) => ({ planId, coache, coachId: 'c1', nolioAthlete: usr, accordLecture: true, parametres: {}, envois: [],
  plan: { semaines: [{ lundi: LUNDI_1 }], course: { date: '2027-03-14' } } });
const SEMAINE_1 = (usr, nolio = true) => ({ numero: 1, lundi: LUNDI_1, semaine: { numero: 1, lundi: LUNDI_1, jours: [] }, reponsesLues: null,
  questionnaire: nolio ? { version: 'normale', cles: [], nolio_id: `pqz_${usr}`, pose_le: `${DIMANCHE}T08:00:00Z` } : null });
const situation = ({ plans = [], resultats = {}, panne = null, prises = [], statut = 201 } = {}) => {
  Object.assign(globalThis, { __bd: [], __prises: new Set(prises), __lectures: [], __appels: [], __resultats: resultats, __panne: panne, __statut: statut, __jour: DIMANCHE, __v91: false, __prevues: {}, __reelles: {},
    __trame: TRAME, __parametres: PARAMETRES, __objectifs: {}, __etats: {}, __dernieres: {} });
  for (const { planId, usr, coache = true, ecrite = true, etat = ecrite, nolio = true } of plans) {
    globalThis.__objectifs[planId] = objectif(planId, usr, coache);
    if (ecrite) globalThis.__dernieres[planId] = SEMAINE_1(usr, nolio);
    if (etat) globalThis.__etats[planId] = { courant: { version: '9.0', semaines: [] }, ecrites: [{ numero: 1, etatAvant: null }] };
  }
};
const reponse = (usr) => ({ id: `r_${usr}`, name: 'Ton point du dimanche', date_start: `${DIMANCHE}T11:00:00`, quiz_planned: `pqz_${usr}`, items: [] });
const messages = () => globalThis.__appels.filter(([m, c]) => m === 'POST' && c === 'planned/messages/').map(([, , corps]) => corps);
const avecInterrupteur = async (valeur, f) => {
  const avant = process.env.CTS_RAPPEL_DIMANCHE;
  if (valeur === undefined) delete process.env.CTS_RAPPEL_DIMANCHE; else process.env.CTS_RAPPEL_DIMANCHE = valeur;
  try { return await f(); } finally { if (avant === undefined) delete process.env.CTS_RAPPEL_DIMANCHE; else process.env.CTS_RAPPEL_DIMANCHE = avant; }
};

test('les deux textes sont ceux du coach, mot pour mot ; celui de l’acheteur n’invite à aucun échange avec le coach', () => {
  assert.equal(texts.texteDuRappelV9(true), COACHE);
  assert.equal(texts.texteDuRappelV9(false), ACHETEUR);
  assert.ok(/\bje\b/.test(COACHE), 'le coaché lit la voix du coach');
  assert.ok(!/coach|moteur|automat|calcul|lu\b|s’écrit/i.test(`${COACHE} ${ACHETEUR}`), 'aucun mot qui montre une automatisation');
  assert.ok(!/coach|écris|contacte|échange|réponds-moi|dis-moi/i.test(ACHETEUR), 'rien ne l’invite à échanger avec le coach');
  assert.equal(texts.TEXTE_RAPPEL_V9_VALIDE, true);
});

test('qui rappeler : le point du dimanche posé ce matin n’a pas de réponse (la semaine écrite cette semaine, ou le dimanche d’avant la première)', async () => {
  const demande = async (plan, repondu) => {
    situation({ plans: [plan] });
    const appels = [];
    const c = { derniere: globalThis.__dernieres.p1 ?? null, etat: globalThis.__etats.p1 ?? { courant: null, ecrites: [] }, parametres: PARAMETRES,
      ports: { appeler: async (chemin) => { appels.push(chemin); return structuredClone(TRAME); } },
      reponduAuPoint: async (numero, pose) => { appels.push([numero, pose?.nolio_id ?? null]); if (repondu instanceof Error) throw repondu; return repondu; } };
    return { rappeler: await passes.pointSansReponse(c, DIMANCHE), appels };
  };
  const sans = await demande({ planId: 'p1', usr: 'usr_1' }, false);
  assert.equal(sans.rappeler, true);
  assert.deepEqual(sans.appels, ['/v1/trame', [1, 'pqz_usr_1']], 'la réponse se cherche par l’identifiant du point posé pour la semaine 1');
  assert.equal((await demande({ planId: 'p1', usr: 'usr_1' }, true)).rappeler, false, 'répondu : pas de rappel');
  assert.equal((await demande({ planId: 'p1', usr: 'usr_1', nolio: false }, false)).rappeler, false, 'un point qu’on n’a pas pu poser ne se rappelle pas');
  // Le dimanche d'avant la première semaine : rien d'écrit, la semaine 1 commence demain ; la réponse se cherche par le nom.
  const premiere = async (repondu) => {
    situation({ plans: [{ planId: 'p1', usr: 'usr_1', ecrite: false, etat: false }] });
    const appels = [];
    const c = { derniere: null, etat: { courant: null, ecrites: [] }, parametres: PARAMETRES,
      ports: { appeler: async () => structuredClone({ ...TRAME, semaines: TRAME.semaines.map((s, i) => (i === 0 ? { ...s, lundi: jour(DIMANCHE, 1) } : s)) }) },
      reponduAuPoint: async (numero, pose) => { appels.push([numero, pose]); return repondu; } };
    return { rappeler: await passes.pointSansReponse(c, DIMANCHE), appels };
  };
  assert.deepEqual(await premiere(false), { rappeler: true, appels: [[0, null]] });
  assert.equal((await premiere(true)).rappeler, false);
  // Hors de ces deux cas : une semaine écrite d'une autre semaine, une trame qui ne commence rien lundi : rien.
  const autre = { derniere: { ...SEMAINE_1('usr_1'), lundi: jour(LUNDI_1, -7) }, etat: { courant: {}, ecrites: [{ numero: 1, etatAvant: null }] }, parametres: PARAMETRES,
    ports: { appeler: async () => structuredClone(TRAME) }, reponduAuPoint: async () => { throw new Error('ne doit pas se lire'); } };
  assert.equal(await passes.pointSansReponse(autre, DIMANCHE), false);
  const finie = { derniere: SEMAINE_1('usr_1'), etat: { courant: {}, ecrites: [{ numero: 1, etatAvant: null }] }, parametres: PARAMETRES,
    ports: { appeler: async () => structuredClone({ ...TRAME, semaines: TRAME.semaines.slice(0, 1) }) }, reponduAuPoint: async () => { throw new Error('ne doit pas se lire'); } };
  assert.equal(await passes.pointSansReponse(finie, DIMANCHE), false, 'plus de semaine à écrire lundi : rien à rappeler');
  // Une lecture de Nolio qui échoue remonte : jamais « sans réponse » sur une lecture manquée.
  await assert.rejects(() => demande({ planId: 'p1', usr: 'usr_1' }, new Error('Nolio ne répond pas')), /Nolio ne répond pas/);
});

test('l’interrupteur d’avant, tel quel : coupé, rien n’est lu ni envoyé ; ni un autre jour que le dimanche, ni trop tard le soir (après 20 h 30)', async () => {
  situation({ plans: [{ planId: 'p1', usr: 'usr_1' }] });
  for (const valeur of [undefined, '', 'non']) {
    const r = await avecInterrupteur(valeur, () => passages.rappelDuDimancheV9(240_000, A_13H));
    assert.deepEqual(r, { actif: false, texteValide: true, comptes: [] }, String(valeur));
  }
  assert.deepEqual([globalThis.__lectures, globalThis.__appels, globalThis.__bd], [[], [], []], 'coupé : aucune lecture, aucun appel, aucune clé');
  const lundi = await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, new Date(`${LUNDI_2}T13:00:00Z`)));
  assert.deepEqual(lundi.comptes, []);
  const tard = await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, new Date(`${DIMANCHE}T19:45:00Z`))); // 20 h 45 à Paris
  assert.match(tard.comptes[0].quoi, /trop tard/);
  assert.deepEqual([globalThis.__lectures, globalThis.__appels], [[], []]);
});

test('un coaché et un acheteur sans réponse : chacun son texte, un message programmé à 19 h pour lui seul ; qui a répondu n’est pas rappelé', async () => {
  situation({ plans: [{ planId: 'p1', usr: 'usr_1', coache: true }, { planId: 'p2', usr: 'usr_2', coache: false }, { planId: 'p3', usr: 'usr_3', coache: true }],
    resultats: { usr_3: [reponse('usr_3')] } });
  const r = await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, A_13H));
  assert.equal(r.actif, true);
  assert.ok(r.comptes.every((c) => !c.erreur), JSON.stringify(r.comptes));
  assert.deepEqual(messages(), [
    { description: COACHE, date_start: DIMANCHE, hour_start: '19:00', show_to_the_athlete: false, athletes: ['usr_1'] },
    { description: ACHETEUR, date_start: DIMANCHE, hour_start: '19:00', show_to_the_athlete: false, athletes: ['usr_2'] },
  ]);
  assert.deepEqual(r.comptes.map((c) => [c.plan, c.quoi, c.coache]), [['p1', 'rappel programmé à 19:00', true], ['p2', 'rappel programmé à 19:00', false]]);
  assert.ok(globalThis.__lectures.every((l) => l.startsWith('real/quiz_results/')), 'sous le 9.0, seules les réponses du point sont lues');
});

test('un seul rappel par dimanche : une clé prise avant l’envoi ; un nouvel appel du même dimanche n’envoie rien de plus', async () => {
  situation({ plans: [{ planId: 'p1', usr: 'usr_1' }] });
  await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, A_13H));
  assert.equal(messages().length, 1);
  assert.deepEqual(globalThis.__bd.filter(([quoi]) => quoi === 'cle'), [['cle', 'p1', `rappel:${DIMANCHE}`]]);
  const encore = await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, new Date(`${DIMANCHE}T13:30:00Z`)));
  assert.equal(messages().length, 1, 'rien de plus');
  assert.deepEqual(encore.comptes, []);
});

test('une lecture de Nolio qui échoue ne rappelle personne ; un message que Nolio refuse libère la clé et le dit', async () => {
  situation({ plans: [{ planId: 'p1', usr: 'usr_1' }, { planId: 'p2', usr: 'usr_2' }], panne: 'usr_1' });
  const r = await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, A_13H));
  assert.equal(r.comptes.find((c) => c.plan === 'p1').erreur, 'Nolio ne répond pas');
  assert.deepEqual(messages().map((m) => m.athletes), [['usr_2']], 'l’autre part');
  assert.ok(!globalThis.__bd.some(([quoi, plan]) => quoi === 'cle' && plan === 'p1'), 'aucune clé prise pour celui dont la lecture a manqué');
  situation({ plans: [{ planId: 'p1', usr: 'usr_1' }], statut: 400 });
  const refus = await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, A_13H));
  assert.match(refus.comptes[0].erreur, /refus de Nolio/);
  assert.equal(refus.comptes[0].quoi, 'rappel non programmé');
  assert.deepEqual(globalThis.__bd.filter(([quoi]) => quoi === 'cle libérée'), [['cle libérée', `rappel:${DIMANCHE}`]], 'un nouvel appel pourra le refaire');
});

test('sous le 9.1 : une séance de course non remontée rappelle aussi, avec la phrase du coach ; les deux manques font les deux phrases ; le renfo et une activité saisie à la main ne comptent pas', async () => {
  const MARDI = jour(LUNDI_1, 1);
  const seance = (id, sport = 'spt_course') => ({ id, date_start: MARDI, sport, duration: { value: 3600 } });
  const phrase = (j) => `Ta séance de ${j} n’est pas remontée : si tu l’as faite, synchronise ta montre ou ajoute-la à la main dans Nolio, avant ce soir.`;
  situation({ plans: [{ planId: 'p1', usr: 'usr_1' }, { planId: 'p2', usr: 'usr_2', coache: false }, { planId: 'p3', usr: 'usr_3' }, { planId: 'p4', usr: 'usr_4' }],
    resultats: { usr_1: [reponse('usr_1')], usr_3: [reponse('usr_3')], usr_4: [reponse('usr_4')] } });
  globalThis.__v91 = true;
  globalThis.__prevues = { usr_1: [seance('a')], usr_2: [seance('b')], usr_3: [seance('c')], usr_4: [seance('d', 'spt_renfo')] };
  // usr_3 : saisie à la main, reliée à rien, à 10 % de la durée prévue.
  globalThis.__reelles = { usr_3: [{ id: 'r', date_start: jour(LUNDI_1, 2), sport: 'spt_course', duration: { value: 3300 }, planned: null }] };
  const r = await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, A_13H));
  assert.ok(r.comptes.every((c) => !c.erreur), JSON.stringify(r.comptes));
  assert.deepEqual(messages().map((m) => [m.athletes[0], m.description]), [['usr_1', phrase('mardi')], ['usr_2', `${ACHETEUR}\n${phrase('mardi')}`]]);
  assert.ok(!/coach|écris|contacte|échange|réponds-moi|dis-moi/i.test(phrase('mardi')), 'rien n’invite à échanger avec le coach');
  // Sous le 9.0, la même semaine : rien pour une séance non remontée.
  situation({ plans: [{ planId: 'p1', usr: 'usr_1' }], resultats: { usr_1: [reponse('usr_1')] } });
  globalThis.__prevues = { usr_1: [seance('a')] };
  assert.deepEqual((await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, A_13H))).comptes, []);
});

test('un seul rappel par athlète, même avec deux plans', async () => {
  situation({ plans: [{ planId: 'p1', usr: 'usr_1' }, { planId: 'p2', usr: 'usr_1' }] });
  await avecInterrupteur('oui', () => passages.rappelDuDimancheV9(240_000, A_13H));
  assert.equal(messages().length, 1);
});

test('le rappel de la 8.x ne bouge pas : ses trois textes et son calcul sont ceux d’avant, la 9.x ne les lit pas', () => {
  const avant = readFileSync(`${RACINE}lib/app/rappelDimanche.ts`, 'utf8');
  for (const mot of ['les_deux:', 'reponse:', 'seances:', 'texteDuRappel(cas', 'seancesNonRemontees', 'Petit rappel : ta semaine prochaine s’écrit ce soir.']) assert.ok(avant.includes(mot), mot);
  const v9 = readFileSync(`${RACINE}lib/app/passagesV9.ts`, 'utf8');
  const envoi = v9.slice(v9.indexOf('export async function rappelDuDimancheV9'), v9.indexOf('// La première semaine d\'un objectif qui démarre'));
  assert.ok(!/texteDuRappel\(|TEXTES_RAPPEL\b|seancesNonRemontees|lectureDuRappel|real\/trainings/.test(envoi), 'ni textes, ni calcul, ni lecture de la 8.x');
});
