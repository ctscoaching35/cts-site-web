#!/usr/bin/env node
/**
 * CE QUE FAIT UN PASSAGE SUR UN PLAN, SOUS LE MOTEUR v1 (lib/app/passeUnPlanV9.ts ; décisions du coach du 24/11/2026, entrée 191) : le questionnaire du
 * dimanche matin, la semaine du dimanche soir, la passe du lundi (filet, réécriture avant la première séance, réponse tardive, semaine retouchée par le
 * coach). Le moteur est celui du RÉEL, enregistré en local pour un athlète fictif (scripts/fixtures/moteur-v9/) : il ne répond que si le site envoie
 * exactement le corps enregistré. Nolio, la base et l'envoi sont de fausses pièces. Aucun appel à l'API en ligne, à Nolio ni à la base.
 *
 *   node --test scripts/test-passes-v9.mjs
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
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const passes = await charge('passeUnPlanV9');
const chaine = await charge('ecritureV9');
const etatMod = await charge('etatMoteur');

const fixture = (nom) => JSON.parse(readFileSync(`${RACINE}scripts/fixtures/moteur-v9/${nom}.json`, 'utf8'));
const F = Object.fromEntries(['trame', 'semaine-1', 'semaine-2', 'semaine-2-reecrite-le-lundi', 'questionnaire', 'reponse-tardive'].map((n) => [n, fixture(n)]));
const PARAMETRES = F['semaine-1'].requete.corps.parametres;
const [LUNDI_1, LUNDI_2, LUNDI_3] = F.trame.reponse.semaines.slice(0, 3).map((s) => s.lundi);
const DIMANCHE = new Date(Date.parse(`${LUNDI_3}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const NOLIO_1 = F['semaine-2'].requete.corps.nolio;
const REPONSES = F['semaine-2'].requete.corps.reponses;
const SEMAINE_1 = F['semaine-1'].reponse.semaine;
const SEMAINE_2 = F['semaine-2'].reponse.semaine;

function moteurRejoue(...echanges) {
  const appels = [];
  return {
    appelsChemins: appels,
    appeler: async (chemin, corps) => {
      appels.push(chemin);
      const trouve = echanges.find((e) => e.requete.chemin === chemin && JSON.stringify(e.requete.corps) === JSON.stringify(corps));
      if (!trouve) throw new Error(`Aucun échange enregistré pour ${chemin} avec ce corps : ${JSON.stringify(corps).slice(0, 300)}`);
      return structuredClone(trouve.reponse);
    },
  };
}
const apres1 = () => etatMod.apresUneEcriture(etatMod.ETAT_VIDE, 1, null, F['semaine-1'].reponse.etat);
const apres2 = () => etatMod.apresUneEcriture(apres1(), 2, F['semaine-1'].reponse.etat, F['semaine-2'].reponse.etat);
const SEMAINE_UNE = { numero: 1, lundi: LUNDI_1, semaine: SEMAINE_1, reponsesLues: null, questionnaire: null };
const SEMAINE_DEUX = (extra = {}) => ({ numero: 2, lundi: LUNDI_2, semaine: SEMAINE_2, reponsesLues: REPONSES, questionnaire: null, ...extra });

// Le contexte d'un plan, de fausses pièces qui notent ce qu'on leur demande.
// `lu` et `gpx` ne sont pas dans les échanges enregistrés : ils sont écartés pour chercher l'échange. `lu` : ce que le lecteur du départ rend (null : rien lu, le déclaré) ; `panne` : le lecteur échoue. Les corps envoyés au moteur sont notés (j.corps) ; l'échange enregistré est
// cherché sans `lu` (le moteur réel a été enregistré sans lui) : ce qu'on prouve ici, c'est que `lu` part avec la semaine, pas ce que le moteur en fait.
function contexte({ echanges = [], etat = etatMod.ETAT_VIDE, derniere = null, nolio = null, reponses = null, pose = null, retouchee = false, coache = true, lu = null, panne = false,
  parametres = PARAMETRES } = {}) {
  const j = { nolio: [], lectures: [], envoyees: [], ecritures: [], etats: [], reponsesGardees: [], notes: [], quiz: [], questionnaires: [], depart: [], lusGardes: [], corps: [] };
  const rejoue = moteurRejoue(...echanges);
  const ports = { appelsChemins: rejoue.appelsChemins, appeler: async (chemin, corps) => {
    j.corps.push([chemin, corps]);
    const { lu: _lu, gpx: _gpx, ...sansLu } = corps?.parametres ?? {};
    return rejoue.appeler(chemin, corps?.parametres ? { ...corps, parametres: sansLu } : corps);
  } };
  const c = {
    planId: 'p1', coache, parametres, ports, etat, derniere,
    lireLeDepart: async (lundi) => { j.depart.push(lundi); if (panne) throw new Error('Nolio ne répond pas'); return lu; },
    garderLu: async (x) => { j.lusGardes.push(x); },
    lireNolio: async (lundi, avec) => { j.nolio.push([lundi, avec]); return nolio; },
    lireLesReponses: async (numero, p) => { j.lectures.push([numero, p]); return reponses ? { reponses, illisibles: [] } : null; },
    questionnaireDe: async () => pose,
    envoyer: async (e) => { j.envoyees.push(e.numero); },
    garderEcriture: async (e, apres) => { j.ecritures.push([e.numero, apres]); },
    garderEtat: async (x) => { j.etats.push(x); },
    garderReponsesLues: async (n, r) => { j.reponsesGardees.push([n, r]); },
    retouchee: async () => retouchee,
    poserLaNote: async (n, l, lignes) => { j.notes.push([n, l, lignes]); },
    poserLeQuiz: async (q, jour) => { j.quiz.push([q, jour]); return 'pqz_1'; },
    garderLeQuestionnaire: async (n, q) => { j.questionnaires.push([n, q]); },
  };
  return { c, j, ports };
}

// ─── Le dimanche soir ───────────────────────────────────────────────────────────────────────────────

test('dimanche soir, la première semaine : sans état ni Nolio ; les réponses d’avant la première se cherchent par leur nom', async () => {
  const { c, j, ports } = contexte({ echanges: [F.trame, F['semaine-1']] });
  const r = await passes.ecrireLaSemaineDuLundi(c, LUNDI_1);
  assert.deepEqual(r, { quoi: 'S1 écrite' });
  assert.deepEqual(ports.appelsChemins, ['/v1/trame', '/v1/semaine'], 'la trame est lue une fois par plan');
  assert.deepEqual(j.envoyees, [1]);
  assert.equal(j.ecritures[0][0], 1);
  assert.deepEqual(j.ecritures[0][1].ecrites, [{ numero: 1, etatAvant: null }]);
  assert.deepEqual(j.lectures, [[0, null]]);
  assert.deepEqual(j.nolio, [], 'rien à lire de Nolio avant la première semaine');
});

test('dimanche soir, la deuxième : Nolio lu jusqu’à la semaine écoulée, la réponse du dimanche, l’état rendu ; envoyée puis gardée, dans cet ordre', async () => {
  const ordre = [];
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-2']], etat: apres1(), derniere: SEMAINE_UNE, nolio: NOLIO_1, reponses: REPONSES });
  const envoyer = c.envoyer; const garder = c.garderEcriture;
  c.envoyer = async (e) => { ordre.push('nolio'); await envoyer(e); };
  c.garderEcriture = async (e, a) => { ordre.push('base'); await garder(e, a); };
  const r = await passes.ecrireLaSemaineDuLundi(c, LUNDI_2);
  assert.deepEqual(r, { quoi: 'S2 écrite' });
  assert.deepEqual(ordre, ['nolio', 'base'], 'Nolio d’abord : une écriture coupée se reprend, la semaine n’est gardée qu’une fois envoyée');
  assert.deepEqual(j.lectures, [[1, null]]);
  assert.deepEqual(j.nolio, [[LUNDI_2, false]]);
  assert.deepEqual(j.ecritures[0][1].ecrites.map((w) => w.numero), [1, 2]);
});

test('dimanche soir : une semaine déjà écrite est sautée (trois passages le soir), un lundi hors de la trame aussi', async () => {
  const dejaEcrite = contexte({ echanges: [F.trame], etat: apres2(), derniere: SEMAINE_DEUX() });
  assert.equal(await passes.ecrireLaSemaineDuLundi(dejaEcrite.c, LUNDI_2), null);
  assert.deepEqual(dejaEcrite.ports.appelsChemins, ['/v1/trame']);
  assert.deepEqual([dejaEcrite.j.envoyees, dejaEcrite.j.ecritures], [[], []]);
  const horsTrame = contexte({ echanges: [F.trame] });
  assert.equal(await passes.ecrireLaSemaineDuLundi(horsTrame.c, '2030-01-07'), null);
});

test('des réponses où seule la version est lue valent « pas de réponse lue » ; une réponse lue passe', () => {
  assert.equal(passes.reponsesOuRien(null), null);
  assert.equal(passes.reponsesOuRien({ reponses: { version: 'normale' } }), null);
  assert.deepEqual(passes.reponsesOuRien({ reponses: { version: 'normale', nb_seances: 4 } }), { version: 'normale', nb_seances: 4 });
});

// ─── Le lundi ───────────────────────────────────────────────────────────────────────────────────────

test('lundi, une semaine pas écrite (un dimanche manqué) : le filet l’écrit', async () => {
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-1']] });
  assert.deepEqual(await passes.passeDuLundiSurUnPlan(c, LUNDI_1), { quoi: 'S1 écrite' });
  assert.deepEqual(j.envoyees, [1]);
});

test('lundi, une réponse nouvelle avant la première séance : la semaine se réécrit, envoyée sur place puis gardée avec l’état d’avant', async () => {
  const { nolio, reponses } = F['semaine-2-reecrite-le-lundi'].requete.corps;
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-2-reecrite-le-lundi']], etat: apres2(), derniere: SEMAINE_DEUX(), nolio, reponses });
  assert.deepEqual(await passes.passeDuLundiSurUnPlan(c, LUNDI_2), { quoi: 'S2 réécrite' });
  assert.deepEqual(j.nolio, [[LUNDI_2, true]], 'Nolio lu avec la semaine en cours');
  assert.deepEqual(j.lectures, [[1, null]], 'les réponses au questionnaire de la fin de la semaine 1');
  assert.deepEqual(j.envoyees, [2]);
  const [numero, apres] = j.ecritures[0];
  assert.equal(numero, 2);
  assert.deepEqual(apres.ecrites[1].etatAvant, F['semaine-1'].reponse.etat);
  assert.deepEqual(j.etats, []);
});

test('lundi : la même réponse que celle qui a écrit la semaine, ou aucune réponse : rien, sans lire Nolio ni appeler le moteur', async () => {
  for (const reponses of [REPONSES, null]) {
    const { c, j, ports } = contexte({ etat: apres2(), derniere: SEMAINE_DEUX(), reponses });
    assert.equal(await passes.passeDuLundiSurUnPlan(c, LUNDI_2), null);
    assert.deepEqual([j.nolio, j.envoyees, ports.appelsChemins], [[], [], []]);
  }
  // Même réponse, clés dans un autre ordre : la même.
  const memeAutrement = Object.fromEntries(Object.entries(REPONSES).reverse());
  assert.equal(chaine.signatureDesReponses(memeAutrement), chaine.signatureDesReponses(REPONSES));
  assert.notEqual(chaine.signatureDesReponses({ ...REPONSES, nb_seances: 3 }), chaine.signatureDesReponses(REPONSES));
});

test('lundi : une semaine que le coach a retouchée dans Nolio n’est pas réécrite ; la réponse est notée comme vue', async () => {
  const { nolio, reponses } = F['semaine-2-reecrite-le-lundi'].requete.corps;
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-2-reecrite-le-lundi']], etat: apres2(), derniere: SEMAINE_DEUX(), nolio, reponses, retouchee: true });
  const r = await passes.passeDuLundiSurUnPlan(c, LUNDI_2);
  assert.match(r.quoi, /S2 pas réécrite : retouchée dans Nolio/);
  assert.deepEqual([j.envoyees, j.ecritures], [[], []]);
  assert.deepEqual(j.reponsesGardees, [[2, reponses]]);
});

test('lundi, une séance est déjà faite : la réponse tardive ; l’état rendu et la note de santé sont gardés, la semaine n’est pas réécrite', async () => {
  const { nolio, reponses } = F['reponse-tardive'].requete.corps;
  const { c, j } = contexte({ echanges: [F.trame, F['reponse-tardive']], etat: apres2(), derniere: SEMAINE_DEUX(), nolio, reponses });
  assert.deepEqual(await passes.passeDuLundiSurUnPlan(c, LUNDI_2), { quoi: 'S2 : réponse tardive gardée' });
  assert.deepEqual(j.etats, [F['reponse-tardive'].reponse.etat]);
  assert.deepEqual(j.notes, [[2, LUNDI_2, F['reponse-tardive'].reponse.note]]);
  assert.deepEqual(j.reponsesGardees, [[2, reponses]], 'la même réponse ne se rejoue pas au passage suivant');
  assert.deepEqual([j.envoyees, j.ecritures], [[], []]);
});

// ─── Le dimanche matin ──────────────────────────────────────────────────────────────────────────────

test('dimanche matin : la version vient du moteur, le questionnaire se pose pour le jour même et se garde avec la semaine qu’il interroge', async () => {
  const { nolio } = F.questionnaire.requete.corps;
  const { c, j } = contexte({ echanges: [F.trame, F.questionnaire], etat: apres2(), derniere: SEMAINE_DEUX(), nolio });
  const r = await passes.poserLeQuestionnaireDuDimanche(c, DIMANCHE);
  assert.equal(r.quoi, 'questionnaire normale posé');
  assert.deepEqual(j.nolio, [[LUNDI_3, false]]);
  assert.equal(j.quiz[0][1], DIMANCHE);
  assert.equal(j.quiz[0][0].name, 'Ton point du dimanche');
  const [numero, q] = j.questionnaires[0];
  assert.equal(numero, 2);
  assert.equal(q.version, 'normale');
  assert.equal(q.nolio_id, 'pqz_1');
  assert.ok(q.cles.length >= 1 && q.cles.every((x) => /^S2-/.test(x.id)), 'les séances clés de la semaine 2, par leur identifiant');
});

test('dimanche matin : posé une seule fois ; ni une semaine d’avant, ni un plan qui n’a pas encore de semaine : rien', async () => {
  const dejaPose = contexte({ etat: apres2(), derniere: SEMAINE_DEUX({ questionnaire: { version: 'normale', cles: [], nolio_id: 'pqz_0', pose_le: '2026-12-06T08:00:00Z' } }) });
  assert.equal(await passes.poserLeQuestionnaireDuDimanche(dejaPose.c, DIMANCHE), null);
  assert.deepEqual([dejaPose.ports.appelsChemins, dejaPose.j.quiz], [[], []]);
  const ancienne = contexte({ etat: apres2(), derniere: SEMAINE_DEUX({ lundi: LUNDI_1 }) });
  assert.equal(await passes.poserLeQuestionnaireDuDimanche(ancienne.c, DIMANCHE), null);
  const sansSemaine = contexte({ echanges: [F.trame], etat: apres2(), derniere: null });
  assert.equal(await passes.poserLeQuestionnaireDuDimanche(sansSemaine.c, DIMANCHE), null);
});

test('dimanche matin, avant la première semaine : le questionnaire court, sans appel à /v1/questionnaire et sans rien à garder avec une semaine', async () => {
  const veille = new Date(Date.parse(`${LUNDI_1}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const { c, j, ports } = contexte({ echanges: [F.trame], coache: false });
  const r = await passes.poserLeQuestionnaireDuDimanche(c, veille);
  assert.equal(r.quoi, 'questionnaire normale posé');
  assert.deepEqual(ports.appelsChemins, ['/v1/trame'], 'la trame seule, lue une fois : jamais /v1/questionnaire sans semaine écoulée');
  assert.equal(j.quiz[0][0].items.length, 3, 'les jours, le nombre de séances, le jour de la sortie longue');
  assert.deepEqual(j.questionnaires, []);
  const coache = contexte({ echanges: [F.trame], coache: true });
  await passes.poserLeQuestionnaireDuDimanche(coache.c, veille);
  assert.equal(coache.j.quiz[0][0].items.length, 4, 'un coaché a la question ouverte de plus');
});

// ─── Les paramètres du moteur ───────────────────────────────────────────────────────────────────────

const CHAMPS = (() => {
  const { criteres, cote_min, tapis, accord_lecture, ...reste } = PARAMETRES; // eslint-disable-line no-unused-vars
  return { ...reste, niveau: 'intermediaire', terrain: 'intermediaire' };
})();
const FICHE = { niveau: 'intermediaire', terrain: 'intermediaire', cote_min: '8', tapis: 'non', critere_intensite: 'parfois', critere_denivele: 'jamais' };

test('paramètres d’un acheteur : ses réponses d’achat et ses tests ; pas de critères (le moteur lit « jamais »), la côte vient de l’ancien terrain (la tranche)', () => {
  const p = passes.parametresDuPlanV9({ parametres: { champs: { ...CHAMPS, tapis: 'oui' } }, profil: { vc_ms: 3.6, fc_seuil1: 150, fc_seuil2: null }, coache: false,
    accordLecture: true, premierLundi: LUNDI_1, glucides: 55 }, null);
  assert.ok(!('criteres' in p) && !('cote_min' in p) && !('niveau' in p) && !('terrain' in p) && !('coaching' in p));
  assert.equal(p.cote_max, '2-5');
  assert.equal(p.tapis, 'oui');
  assert.equal(p.vc_ms, 3.6);
  assert.equal(p.fc_seuil1, 150);
  assert.ok(!('fc_seuil2' in p), 'un test absent n’est pas envoyé');
  assert.equal(p.glucides_cible, 55);
  assert.equal(p.accord_lecture, true);
});

test('paramètres d’un coaché : ce que son coach a rempli sur sa fiche (critères, côte en minutes, tapis), son entrée au premier lundi de son plan', () => {
  const p = passes.parametresDuPlanV9({ parametres: { champs: CHAMPS }, profil: {}, coache: true, accordLecture: true, premierLundi: LUNDI_1 }, FICHE);
  assert.deepEqual({ ...p, coaching: undefined, entree: undefined }, { ...PARAMETRES, coaching: undefined, entree: undefined }, 'les mêmes paramètres que ceux du moteur réel enregistré');
  assert.equal(p.coaching, 'oui');
  assert.equal(p.entree, LUNDI_1);
  assert.deepEqual(p.criteres, { intensite: 'parfois', mecanique: 'jamais' });
  assert.strictEqual(p.cote_min, 8);
  assert.ok(!('cote_max' in p));
  const sansCritere = passes.parametresDuPlanV9({ parametres: { champs: CHAMPS }, profil: {}, coache: true, accordLecture: false, premierLundi: null }, { ...FICHE, critere_intensite: 'toujours', critere_denivele: '' });
  assert.ok(!('criteres' in sansCritere), 'une valeur inconnue ou vide ne part pas');
  assert.ok(!('entree' in sansCritere), 'sans premier lundi, pas d’entrée devinée');
  assert.equal(sansCritere.accord_lecture, false);
});

// ─── Le départ d'un objectif et « Réessayer » ───────────────────────────────────────────────────────

test('le départ garde pour le moteur son entrée et la course d’avant ; ce qu’il court (`lu`) n’est plus lu ici, mais au premier passage du plan', () => {
  assert.deepEqual(passes.entreesDuDepart({ premiere: LUNDI_2, apres: { course_date: '2026-11-22', temps_h: 4.5 } }),
    { entree: LUNDI_2, course_precedente: { date: '2026-11-22', duree_h: 4.5 } });
  assert.deepEqual(passes.entreesDuDepart({ premiere: LUNDI_1, apres: null }), { entree: LUNDI_1 });
  assert.deepEqual(passes.entreesDuDepart({ premiere: LUNDI_1, apres: { course_date: '2026-11-22', temps_h: 0 } }), { entree: LUNDI_1 }, 'une course sans durée lisible n’est pas gardée');
  // Un seul lecteur, un seul endroit : le départ d'un objectif n'a plus son propre calcul de la charge (chargeDepuisNolio reste celui de la 8.x).
  const depart = readFileSync(`${RACINE}lib/app/departV9.ts`, 'utf8');
  assert.ok(!/chargeDepuisNolio|volume_hebdo_actuel|sortie_longue_actuelle/.test(depart.replace(/\/\*[\s\S]*?\*\//, '')), 'le départ ne lit plus la charge lui-même');
  const passages = readFileSync(`${RACINE}lib/app/passagesV9.ts`, 'utf8');
  assert.match(passages, /import \{ lireLuAuDepart \} from '\.\/luAuDepart';/);
  assert.equal((passages.match(/lireLuAuDepart\(/g) ?? []).length, 1, 'un seul appel du lecteur');
});

test('un coaché qui entre : son entrée et sa course d’avant passent dans les paramètres du moteur ; sans elles, rien d’inventé', () => {
  const champs = { ...CHAMPS, entree: LUNDI_2, course_precedente: { date: '2026-11-22', duree_h: 4.5 }, lu: { volume_min: 330 } };
  const p = passes.parametresDuPlanV9({ parametres: { champs }, profil: {}, coache: true, accordLecture: true, premierLundi: LUNDI_1 }, FICHE);
  assert.equal(p.coaching, 'oui');
  assert.equal(p.entree, LUNDI_2, 'l’entrée gardée au départ l’emporte sur le premier lundi du plan d’achat');
  assert.deepEqual(p.course_precedente, { date: '2026-11-22', duree_h: 4.5 });
  assert.deepEqual(p.lu, { volume_min: 330 });
});

test('la semaine demandée (départ, « Réessayer ») : écrite avec ses jours à partir de `depuis`, déjà écrite = reprise sans doublon, hors de la trame = une erreur dite', async () => {
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-1']] });
  const envoyer = c.envoyer;
  const vus = [];
  c.envoyer = async (e, options) => { vus.push(options); await envoyer(e, options); };
  assert.deepEqual(await passes.ecrireOuReprendre(c, LUNDI_1, { depuis: '2026-11-25' }), { statut: 'ecrite', numero: 1 });
  assert.deepEqual(vus, [{ depuis: '2026-11-25' }]);
  assert.deepEqual(j.envoyees, [1]);
  const deja = contexte({ echanges: [F.trame], etat: apres1(), derniere: SEMAINE_UNE });
  assert.deepEqual(await passes.ecrireOuReprendre(deja.c, LUNDI_1), { statut: 'deja', numero: 1 });
  assert.deepEqual(deja.j.envoyees, []);
  assert.deepEqual(await passes.ecrireOuReprendre(contexte({ echanges: [F.trame] }).c, '2030-01-07'), { statut: 'hors_trame' });
});

// ─── Ce qu'il court au départ : lu une fois, au premier passage d'un plan sans état (entrée 203) ────────────────

const LU = { volume_min: 413, sl_min: 90 };
const corpsDe = (j, chemin) => j.corps.filter(([c]) => c === chemin).map(([, corps]) => corps);

test('le premier passage d’un plan sans état lit ce qu’il court au départ, le garde avec le plan et l’envoie au moteur ; la trame, elle, ne dépend pas de lui', async () => {
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-1']], lu: LU });
  assert.deepEqual(await passes.ecrireLaSemaineDuLundi(c, LUNDI_1), { quoi: 'S1 écrite' });
  assert.deepEqual(j.depart, [LUNDI_1], 'lu pour le lundi que le moteur écrit, une fois');
  assert.deepEqual(j.lusGardes, [LU]);
  assert.deepEqual(corpsDe(j, '/v1/semaine')[0].parametres.lu, LU);
  assert.ok(!('lu' in corpsDe(j, '/v1/trame')[0].parametres), 'la trame du numéro est lue avant : elle ne dépend pas de `lu`');
  assert.deepEqual(c.parametres.lu, LU, 'le contexte le garde pour la suite du passage');
});

test('sans activité lue, rien n’est gardé et le moteur lit le déclaré du questionnaire', async () => {
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-1']], lu: null });
  await passes.ecrireLaSemaineDuLundi(c, LUNDI_1);
  assert.deepEqual(j.depart, [LUNDI_1]);
  assert.deepEqual(j.lusGardes, []);
  assert.ok(!('lu' in corpsDe(j, '/v1/semaine')[0].parametres));
});

test('jamais relu : un plan qui a déjà son `lu`, un plan qui a un état, une semaine hors de la trame ne lisent rien', async () => {
  const deja = contexte({ echanges: [F.trame, F['semaine-1']], lu: { volume_min: 1 }, parametres: { ...PARAMETRES, lu: LU } });
  await passes.ecrireLaSemaineDuLundi(deja.c, LUNDI_1);
  assert.deepEqual([deja.j.depart, deja.j.lusGardes], [[], []]);
  assert.deepEqual(corpsDe(deja.j, '/v1/semaine')[0].parametres.lu, LU, 'celui du plan part avec la semaine');
  const avecEtat = contexte({ echanges: [F.trame, F['semaine-2']], etat: apres1(), derniere: SEMAINE_UNE, nolio: NOLIO_1, reponses: REPONSES, lu: LU });
  await passes.ecrireLaSemaineDuLundi(avecEtat.c, LUNDI_2);
  assert.deepEqual([avecEtat.j.depart, avecEtat.j.lusGardes], [[], []]);
  const horsTrame = contexte({ echanges: [F.trame], lu: LU });
  assert.equal(await passes.ecrireLaSemaineDuLundi(horsTrame.c, '2030-01-07'), null);
  assert.deepEqual([horsTrame.j.depart, horsTrame.j.lusGardes], [[], []]);
});

test('le filet du lundi et la semaine demandée (départ, « Réessayer ») passent par le même lecteur', async () => {
  const filet = contexte({ echanges: [F.trame, F['semaine-1']], lu: LU });
  await passes.passeDuLundiSurUnPlan(filet.c, LUNDI_1);
  assert.deepEqual([filet.j.depart, filet.j.lusGardes], [[LUNDI_1], [LU]]);
  const depart = contexte({ echanges: [F.trame, F['semaine-1']], lu: LU });
  assert.deepEqual(await passes.ecrireOuReprendre(depart.c, LUNDI_1, { depuis: '2026-11-25' }), { statut: 'ecrite', numero: 1 });
  assert.deepEqual([depart.j.depart, depart.j.lusGardes], [[LUNDI_1], [LU]]);
});

test('un acheteur : le lecteur ne lit que les coachés reliés, le moteur garde le déclaré de son achat', async () => {
  assert.match(readFileSync(`${RACINE}lib/app/passagesV9.ts`, 'utf8'), /lireLeDepart: async \(lundi\) => \(o\.coache \? lireLuAuDepart\(o\.coachId, o\.nolioAthlete, lundi\) : null\)/);
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-1']], coache: false, lu: null });
  await passes.ecrireLaSemaineDuLundi(c, LUNDI_1);
  assert.deepEqual(j.lusGardes, []);
  assert.ok(!('lu' in corpsDe(j, '/v1/semaine')[0].parametres));
});

test('une lecture de Nolio qui échoue : la semaine n’est ni écrite ni envoyée ni gardée, l’erreur remonte (le passage suivant reprend)', async () => {
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-1']], panne: true });
  await assert.rejects(() => passes.ecrireLaSemaineDuLundi(c, LUNDI_1), /Nolio ne répond pas/);
  assert.deepEqual([j.envoyees, j.ecritures, j.lusGardes], [[], [], []]);
  assert.deepEqual(corpsDe(j, '/v1/semaine'), [], 'le moteur n’est pas appelé sans ce qu’il court');
});

// ─── Le GPX et la durée courue (24/11/2026) ─────────────────────────────────────────────────────────

const GPX_FICTIF = fixture('trace').reponse.gpx;

test('le profil de la trace gardé avec le plan part à chaque appel du moteur dans `parametres.gpx` ; sans trace, rien ne part', async () => {
  // Les paramètres d'un plan portent le `gpx` de ses réponses (essayé dans test-gpx-v9.mjs) ; ici, ce que le passage envoie avec eux.
  const p = passes.parametresDuPlanV9({ parametres: { champs: { ...CHAMPS, gpx: GPX_FICTIF } }, profil: {}, coache: true, accordLecture: true, premierLundi: LUNDI_1 }, FICHE);
  assert.deepEqual(p.gpx, GPX_FICTIF);
  const { c, j } = contexte({ echanges: [F.trame, F['semaine-1']], parametres: { ...PARAMETRES, gpx: GPX_FICTIF } });
  await passes.ecrireLaSemaineDuLundi(c, LUNDI_1);
  assert.deepEqual(corpsDe(j, '/v1/trame')[0].parametres.gpx, GPX_FICTIF, 'la trame le reçoit aussi');
  assert.deepEqual(corpsDe(j, '/v1/semaine')[0].parametres.gpx, GPX_FICTIF);
  const sans = contexte({ echanges: [F.trame, F['semaine-1']] });
  await passes.ecrireLaSemaineDuLundi(sans.c, LUNDI_1);
  assert.ok(!('gpx' in corpsDe(sans.j, '/v1/semaine')[0].parametres));
});

test('la durée de la course d’avant : celle qu’il a COURUE, sinon le temps visé de l’objectif', () => {
  const apres = { course_date: '2026-11-22', temps_h: 5.5 };
  assert.deepEqual(passes.entreesDuDepart({ premiere: LUNDI_2, apres, dureeCourue: 6.5 }).course_precedente, { date: '2026-11-22', duree_h: 6.5 });
  assert.equal(passes.entreesDuDepart({ premiere: LUNDI_2, apres, dureeCourue: 1.17 }).course_precedente.duree_h, 1.17, 'une course abandonnée compte comme courue');
  for (const illisible of [null, undefined, 0, -1, Number.NaN]) {
    assert.equal(passes.entreesDuDepart({ premiere: LUNDI_2, apres, dureeCourue: illisible }).course_precedente.duree_h, 5.5, `non lisible (${illisible}) : le temps visé`);
  }
  assert.deepEqual(passes.entreesDuDepart({ premiere: LUNDI_2, apres, dureeCourue: undefined }), passes.entreesDuDepart({ premiere: LUNDI_2, apres }), 'sans lecture, comme avant');
  assert.deepEqual(passes.entreesDuDepart({ premiere: LUNDI_2, apres: null, dureeCourue: 6.5 }), { entree: LUNDI_2 }, 'pas de course d’avant : rien à garder');
  assert.deepEqual(passes.entreesDuDepart({ premiere: LUNDI_2, apres: { course_date: '2026-11-22', temps_h: 0 }, dureeCourue: 6.5 }).course_precedente, { date: '2026-11-22', duree_h: 6.5 }, 'sans temps visé lisible, la durée courue suffit');
  const depart = readFileSync(`${RACINE}lib/app/departV9.ts`, 'utf8');
  assert.match(depart, /const dureeCourue = apres && o\.coache \? await lireLaDureeCourue\(o\.coachId, o\.nolioAthlete, apres\.course_date\)\.catch\(\(\) => null\) : null;/);
  assert.match(depart, /entreesDuDepart\(\{ premiere, apres, dureeCourue \}\)/);
});
