#!/usr/bin/env node
/**
 * LE QUESTIONNAIRE DU DIMANCHE DU MOTEUR 9.0 (lib/app/dimancheV9.ts ; contrat « MOTEUR v1 », rapport Nolio du 23/11/2026, décisions
 * du coach « A partout ») : la construction des trois versions, la liste des séances clés d'une semaine réelle, la lecture des
 * réponses telles que Nolio les rend (rangs, listes de rangs, nombre, vide), et le fait que rien ne lit encore le module (préparé,
 * pas branché). Des cas fictifs, sans réseau ni Nolio.
 *
 *   node --test scripts/test-dimanche-v9.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const d = await import(`${RACINE}lib/app/dimancheV9.ts`);
const samedi = await import(`${RACINE}lib/app/questionnaireSamedi.ts`);

// Une semaine telle que POST /v1/semaine la rend (contrat 9.0) : les jours, leur séance (id « S9-mardi », famille), le renfo à part.
const SEMAINE = {
  numero: 9,
  jours: [
    { jour: 'lundi', seance: null },
    { jour: 'mardi', seance: { id: 'S9-mardi', famille: 'seuil1' }, renfo: { id: 'S9-mardi-renfo', famille: 'renfo' } },
    { jour: 'mercredi', seance: { id: 'S9-mercredi', famille: 'endurance' } },
    { jour: 'jeudi', seance: { id: 'S9-jeudi', famille: 'mecanique' } },
    { jour: 'vendredi', seance: { id: 'S9-vendredi', famille: 'recuperation' } },
    { jour: 'samedi', seance: { id: 'S9-samedi', famille: 'sl' } },
    { jour: 'dimanche', seance: { id: 'S9-dimanche', famille: 'course' } },
  ],
};
const CLES = d.seancesCles(SEMAINE);
const questions = (q) => q.items.map((i) => i.question);

test('séances clés : les familles du moteur, dans l’ordre des jours, avec leur identifiant', () => {
  assert.deepEqual(CLES.map((c) => [c.id, c.libelle]), [
    ['S9-mardi', 'Mardi · Seuil 1'], ['S9-jeudi', 'Jeudi · Mécanique'], ['S9-samedi', 'Samedi · Sortie longue'],
  ]);
  assert.deepEqual(d.seancesCles(null), []);
  assert.deepEqual(d.seancesCles({ jours: [{ jour: 'mardi', seance: { famille: 'seuil2' } }] }), [], 'sans identifiant, sa réponse ne se retrouverait pas');
  assert.deepEqual(d.seancesCles({ jours: [{ jour: 'mardi', seance: { id: 'S1-mardi', famille: 'vo2max' } }, { jour: 'lundi', seance: { id: 'S1-lundi', famille: 'tempo' } }] })
    .map((c) => c.id), ['S1-lundi', 'S1-mardi'], 'rangées dans l’ordre de la semaine');
});

test('versions : sept questions en normale et en aucune séance vue, huit en fatigue (rapport Nolio du 23/11)', () => {
  assert.equal(d.questionnaireDuDimanche({ version: 'normale', cles: CLES, accord: true }).items.length, 7);
  assert.equal(d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES, accord: true }).items.length, 7);
  assert.equal(d.questionnaireDuDimanche({ version: 'fatigue', cles: CLES, accord: true }).items.length, 8);
  // Sans séance clé écrite, la question est omise.
  assert.ok(!questions(d.questionnaireDuDimanche({ version: 'normale', cles: [] })).includes(d.QUESTION_CLES));
  assert.equal(d.questionnaireDuDimanche({ version: 'normale', accord: true }).items.length, 6);
});

test('versions : le mot d’ouverture de chacune, en tête de la description, et la phrase de la fatigue validée par le coach', () => {
  // Décision 211 (qui remplace « Pense à synchroniser ta montre avant de répondre. », décision 206) : la phrase d'accueil est la première ligne de toutes les versions, dite par le coach
  // au coaché (« je ») et d'une voix neutre à l'acheteur.
  const sync = 'Réponds après ta dernière sortie de la semaine, une fois ta montre synchronisée : ta semaine suivante tiendra compte de tout ce que tu as fait.';
  const syncCoache = 'Réponds après ta dernière sortie de la semaine, une fois ta montre synchronisée : je vois ainsi toute ta semaine.';
  assert.equal(d.ACCUEIL_ACHETEUR, sync);
  assert.equal(d.ACCUEIL_COACHE, syncCoache);
  assert.equal(d.accueilDuPoint(true), syncCoache);
  assert.equal(d.accueilDuPoint(false), sync);
  assert.equal(d.PENSE_A_SYNCHRONISER, undefined, 'l’ancienne phrase n’existe plus');
  assert.ok(!/je\b|coach/i.test(sync), 'celle de l’acheteur n’invite à aucun échange avec le coach');
  const base = `${sync}\n\n${d.DESCRIPTION_DE_BASE}`;
  for (const version of d.VERSIONS_DIMANCHE) {
    assert.equal(d.questionnaireDuDimanche({ version, cles: CLES, coache: true }).description.split('\n\n')[0], syncCoache, `coaché, ${version}`);
    assert.equal(d.questionnaireDuDimanche({ version, cles: CLES }).description.split('\n\n')[0], sync, `acheteur, ${version}`);
  }
  assert.equal(d.questionnaireDuDimanche({ version: 'normale', cles: CLES }).description, base);
  // « Deux voix » (24/11/2026) : l'invitation à dire l'arrêt est « indique-le » pour l'acheteur (une forme sans invitation à échanger) et « dis-le-moi » pour le coaché ; le reste ne change pas.
  assert.equal(d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES, accord: true }).description,
    `${sync}\n\nOn n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, indique-le : depuis combien de temps et pourquoi.\n\n${d.DESCRIPTION_DE_BASE}`);
  assert.equal(d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES, accord: true, coache: true }).description,
    `${syncCoache}\n\nOn n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, dis-le-moi : depuis combien de temps et pourquoi.\n\n${d.DESCRIPTION_DE_BASE_COACHE}`);
  // Décision 209 : sans l'accord de lecture, « et pourquoi » part, « depuis combien de temps » reste ; l'invitation (« indique-le » / « dis-le-moi ») n'est pas touchée.
  assert.equal(d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES }).description,
    `${sync}\n\nOn n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, indique-le : depuis combien de temps.\n\n${d.DESCRIPTION_DE_BASE}`);
  assert.equal(d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES, coache: true }).description,
    `${syncCoache}\n\nOn n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, dis-le-moi : depuis combien de temps.\n\n${d.DESCRIPTION_DE_BASE_COACHE}`);
  assert.equal(d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES, accord: false, coache: true }).description, d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES, coache: true }).description);
  assert.ok(!/pourquoi/.test(d.questionnaireDuDimanche({ version: 'aucune_seance_vue', cles: CLES }).description), 'aucun « pourquoi » sans accord');
  // Les autres versions n'ont pas cette phrase : leur ouverture ne change pas avec l'accord.
  for (const version of ['normale', 'fatigue']) {
    assert.equal(d.ouvertureDe(version, true), d.ouvertureDe(version, false), version);
    assert.equal(d.questionnaireDuDimanche({ version, cles: CLES }).description, d.questionnaireDuDimanche({ version, cles: CLES, accord: true }).description, version);
  }
  assert.equal(d.OUVERTURES.aucune_seance_vue, 'On n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, indique-le : depuis combien de temps et pourquoi.', 'avec l’accord, la phrase d’avant, sauf l’invitation (acheteur)');
  assert.equal(d.OUVERTURES_COACHE.aucune_seance_vue, 'On n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, dis-le-moi : depuis combien de temps et pourquoi.', 'avec l’accord, la phrase d’avant, sauf l’invitation (coaché)');
  assert.ok(!/dis-le-nous/.test(JSON.stringify([d.OUVERTURES, d.OUVERTURES_COACHE])), 'plus de « dis-le-nous »');
  for (const version of ['normale', 'fatigue']) assert.equal(d.OUVERTURES_COACHE[version], d.OUVERTURES[version], `${version} : la même pour les deux voix`);
  assert.equal(d.DESCRIPTION_DE_BASE, 'Une minute, d’ici dimanche 21 h : tes séances de la semaine prochaine sont préparées dimanche soir à partir de tes réponses.');
  assert.equal(d.DESCRIPTION_DE_BASE_COACHE, 'Une minute, d’ici dimanche 21 h : je prépare tes séances de la semaine prochaine dimanche soir à partir de tes réponses.');
  assert.equal(d.descriptionDeBase(true), d.DESCRIPTION_DE_BASE_COACHE);
  assert.equal(d.descriptionDeBase(false), d.DESCRIPTION_DE_BASE);
  const fatigue = d.questionnaireDuDimanche({ version: 'fatigue', cles: CLES });
  assert.equal(fatigue.description.split('\n\n')[0], sync);
  assert.equal(fatigue.description.split('\n\n')[1],
    'Cette semaine, ton ressenti, ton RPE ou ton Hooper sortent de tes habitudes. Ça peut traduire de la fatigue. Pour que tu récupères et repartes bien, on peut alléger ta semaine prochaine.');
  assert.equal(fatigue.items[0].question, 'Veux-tu une semaine plus légère ?');
  assert.deepEqual(fatigue.items[0].choices.choices, ['Oui', 'Non']);
  // La ligne d'effet, quand le coach l'a donnée, suit l'ouverture de la fatigue et d'elle seule.
  assert.equal(d.questionnaireDuDimanche({ version: 'fatigue', cles: CLES, ligneEffet: 'Ligne d’effet.' }).description.split('\n\n')[2], 'Ligne d’effet.');
  assert.ok(!d.questionnaireDuDimanche({ version: 'normale', cles: CLES, ligneEffet: 'Ligne d’effet.' }).description.includes('Ligne d’effet.'));
  assert.equal(d.NOM_DU_QUESTIONNAIRE, 'Ton point du dimanche');
  assert.equal(d.HEURE_D_ENVOI, '12:00', 'vers midi, heure de Paris');
});

test('questions : l’arrêt, les deux facultatives préfixées, la liste réelle sans « Aucune », les trois d’aujourd’hui', () => {
  const q = d.questionnaireDuDimanche({ version: 'normale', cles: CLES, accord: true });
  const par = Object.fromEntries(q.items.map((i) => [i.question, i]));
  assert.deepEqual(questions(q), [
    'As-tu arrêté de courir cette semaine ?',
    'Si tu as arrêté toute la semaine : depuis combien de semaines as-tu arrêté, en tout ?',
    'Si tu as arrêté toute la semaine : pourquoi ?',
    'Une séance clé pas faite comme prévu ?',
    'Quels jours peux-tu courir la semaine prochaine ?',
    'Combien de séances peux-tu faire par semaine ?',
    'Quel jour pour ta sortie longue ?',
  ]);
  assert.deepEqual(par['As-tu arrêté de courir cette semaine ?'].choices.choices, ['Non', 'Quelques jours', 'Oui, toute la semaine']);
  assert.equal(par['As-tu arrêté de courir cette semaine ?'].is_mandatory, true);
  const semaines = par['Si tu as arrêté toute la semaine : depuis combien de semaines as-tu arrêté, en tout ?'];
  assert.deepEqual(semaines.choices.choices, ['1', '2', '3', '4', 'Plus de 4']);
  assert.equal(semaines.is_mandatory, false, 'facultative : une réponse oubliée ne bloque pas l’envoi');
  assert.deepEqual(par['Si tu as arrêté toute la semaine : pourquoi ?'].choices.choices, ['Blessure', 'Maladie', 'Autre']);
  assert.equal(par['Si tu as arrêté toute la semaine : pourquoi ?'].is_mandatory, false);
  const cles = par['Une séance clé pas faite comme prévu ?'];
  assert.equal(cles.type, 'multiple_choices');
  assert.deepEqual(cles.choices.choices, ['Mardi · Seuil 1', 'Jeudi · Mécanique', 'Samedi · Sortie longue']);
  assert.equal(cles.is_mandatory, false, 'une réponse vide vaut aucune');
  assert.ok(!cles.choices.choices.some((c) => /aucune/i.test(c)), '« Aucune » est retiré');
  assert.equal(par['Quels jours peux-tu courir la semaine prochaine ?'].choices.choices.length, 7);
  assert.equal(par['Quel jour pour ta sortie longue ?'].choices.choices.length, 7, 'la sortie longue parmi les sept jours');
  assert.equal(par['Combien de séances peux-tu faire par semaine ?'].unit, 'séances');
});

test('le dimanche d’avant la semaine 1 : les jours, le nombre de séances et la sortie longue, rien d’autre', () => {
  for (const version of d.VERSIONS_DIMANCHE) {
    const q = d.questionnaireDuDimanche({ version, cles: CLES, premiere: true });
    assert.deepEqual(questions(q), ['Quels jours peux-tu courir la semaine prochaine ?', 'Combien de séances peux-tu faire par semaine ?', 'Quel jour pour ta sortie longue ?'], version);
    assert.equal(q.description, `${d.ACCUEIL_ACHETEUR}\n\n${d.DESCRIPTION_DE_BASE}`, 'pas de mot d’ouverture : aucune semaine écoulée, mais la phrase d’accueil est là');
    assert.equal(d.questionnaireDuDimanche({ version, cles: CLES, premiere: true, coache: true }).description, `${d.ACCUEIL_COACHE}\n\n${d.DESCRIPTION_DE_BASE_COACHE}`);
  }
});

test('un coaché garde sa question ouverte, facultative, au bout ; un acheteur ne l’a pas', () => {
  const coache = d.questionnaireDuDimanche({ version: 'normale', cles: CLES, coache: true });
  const derniere = coache.items.at(-1);
  assert.equal(derniere.question, 'Une information à remonter à ton coach ?');
  assert.equal(derniere.is_mandatory, false);
  assert.ok(!questions(d.questionnaireDuDimanche({ version: 'normale', cles: CLES })).includes(derniere.question));
});

test('« Ton point du dimanche » n’a plus le nom du samedi (entrée 198) : le lecteur du samedi ne le prend pas par son nom, mais lit les mêmes questions (jours, nombre, sortie longue)', () => {
  assert.notEqual(d.NOM_DU_QUESTIONNAIRE, 'Ta semaine prochaine');
  assert.equal(samedi.estLeQuestionnaire({ name: d.NOM_DU_QUESTIONNAIRE, date_start: '2026-11-29' }), false);
  assert.equal(samedi.estLeQuestionnaire({ name: 'Ta semaine prochaine', date_start: '2026-11-29' }), true);
  const lu = samedi.lireQuestionnaire([
    { question: 'Quels jours peux-tu courir la semaine prochaine ?', value: [1, 3, 6] },
    { question: 'Combien de séances veux-tu faire ?', value: 4 },
    { question: 'Quel jour pour ta sortie longue ?', value: 6 },
  ]);
  assert.deepEqual(lu.questionnaire.jours, ['mardi', 'jeudi', 'dimanche']);
  assert.equal(lu.questionnaire.jour_sl, 'dimanche');
  assert.equal(lu.questionnaire.nb_seances, 4);
});

// Ce que Nolio rend : le rang du choix, une liste de rangs, un nombre ; une question facultative laissée vide : null.
const item = (question, value) => ({ question, value });
const Q = { arret: 'As-tu arrêté de courir cette semaine ?', sem: 'Si tu as arrêté toute la semaine : depuis combien de semaines as-tu arrêté, en tout ?',
  cause: 'Si tu as arrêté toute la semaine : pourquoi ?', cles: 'Une séance clé pas faite comme écrite ?', jours: 'Quels jours peux-tu courir la semaine prochaine ?',
  nb: 'Combien de séances peux-tu faire par semaine ?', nbAvant: 'Combien de séances veux-tu faire ?', sl: 'Quel jour pour ta sortie longue ?', fatigue: 'Veux-tu une semaine plus légère ?' };

test('lecture : un arrêt de la semaine entière, ses semaines et sa cause, les séances clés retrouvées par leur identifiant', () => {
  const { reponses, illisibles } = d.lireReponsesDimanche([
    item(Q.arret, 2), item(Q.sem, 4), item(Q.cause, 0), item(Q.cles, [0, 2]), item(Q.jours, [1, 3, 5, 6]), item(Q.nb, 4), item(Q.sl, 6),
  ], { version: 'normale', cles: CLES, accord: true });
  assert.deepEqual(reponses, {
    version: 'normale', arret: 'semaine', semaines_arret: 5, cause: 'blessure', cles_pas_faites: ['S9-mardi', 'S9-samedi'],
    jours: ['mardi', 'jeudi', 'samedi', 'dimanche'], nb_seances: 4, jour_sl: 'dimanche',
  });
  assert.deepEqual(illisibles, []);
});

test('lecture : sans arrêt, ni semaines ni cause ne partent ; quelques jours garde la cause seule', () => {
  const sans = d.lireReponsesDimanche([item(Q.arret, 0), item(Q.sem, 1), item(Q.cause, 1), item(Q.jours, [0, 2]), item(Q.nb, 3), item(Q.sl, 2)], { version: 'normale', accord: true });
  assert.equal(sans.reponses.arret, 'non');
  assert.ok(!('semaines_arret' in sans.reponses) && !('cause' in sans.reponses));
  const quelques = d.lireReponsesDimanche([item(Q.arret, 1), item(Q.sem, 1), item(Q.cause, 1)], { version: 'normale', accord: true });
  assert.equal(quelques.reponses.arret, 'quelques_jours');
  assert.equal(quelques.reponses.cause, 'maladie');
  assert.ok(!('semaines_arret' in quelques.reponses));
  // Une cause sans arrêt répondu ne part pas non plus.
  assert.ok(!('cause' in d.lireReponsesDimanche([item(Q.cause, 0)], { version: 'normale', accord: true }).reponses));
});

test('lecture : une question facultative vide n’est ni lue ni illisible ; « aucune » séance clé se lit comme une liste vide ou rien', () => {
  const { reponses, illisibles } = d.lireReponsesDimanche([item(Q.arret, 0), item(Q.sem, null), item(Q.cause, null), item(Q.cles, null), item(Q.jours, [0]), item(Q.nb, 3), item(Q.sl, 0)], { version: 'normale', cles: CLES, accord: true });
  assert.deepEqual(illisibles, []);
  assert.ok(!('cles_pas_faites' in reponses));
  assert.ok(!('cles_pas_faites' in d.lireReponsesDimanche([item(Q.cles, [])], { version: 'normale', cles: CLES, accord: true }).reponses));
});

test('lecture : un champ illisible ne fait pas perdre les autres, et il est dit', () => {
  const { reponses, illisibles } = d.lireReponsesDimanche([
    item(Q.arret, 9), item(Q.cles, [0, 7]), item(Q.jours, [1, 3]), item(Q.nb, 'beaucoup'), item(Q.sl, 'jamais'),
  ], { version: 'normale', cles: CLES });
  assert.deepEqual(illisibles.sort(), ['arret', 'cles_pas_faites', 'jour_sl', 'nb_seances']);
  assert.deepEqual(reponses, { version: 'normale', jours: ['mardi', 'jeudi'] });
  // Sans la liste posée, une réponse aux séances clés ne se retrouve pas : illisible, jamais devinée.
  assert.deepEqual(d.lireReponsesDimanche([item(Q.cles, [0])], { version: 'normale' }).illisibles, ['cles_pas_faites']);
});

test('lecture : la fatigue, oui ou non, seulement dans sa version ; le libellé écrit se lit comme le rang', () => {
  assert.equal(d.lireReponsesDimanche([item(Q.fatigue, 0)], { version: 'fatigue' }).reponses.fatigue_oui, true);
  assert.equal(d.lireReponsesDimanche([item(Q.fatigue, 1)], { version: 'fatigue' }).reponses.fatigue_oui, false);
  assert.equal(d.lireReponsesDimanche([item(Q.fatigue, 'Oui')], { version: 'fatigue' }).reponses.fatigue_oui, true);
  assert.ok(!('fatigue_oui' in d.lireReponsesDimanche([item(Q.fatigue, 0)], { version: 'normale' }).reponses), 'une version sans la question l’ignore');
  const ecrit = d.lireReponsesDimanche([item(Q.arret, 'Oui, toute la semaine'), item(Q.sem, 'Plus de 4'), item(Q.cause, 'Autre'), item(Q.cles, ['Samedi · Sortie longue'])], { version: 'aucune_seance_vue', cles: CLES, accord: true });
  assert.deepEqual(ecrit.reponses, { version: 'aucune_seance_vue', arret: 'semaine', semaines_arret: 5, cause: 'autre', cles_pas_faites: ['S9-samedi'] });
});

test('lecture : le dimanche d’avant la semaine 1 ne rend que les jours, le nombre et la sortie longue', () => {
  const q = d.questionnaireDuDimanche({ version: 'normale', premiere: true });
  assert.deepEqual(q.items.map((i) => i.question), [Q.jours, Q.nb, Q.sl]);
  const { reponses } = d.lireReponsesDimanche([item(Q.jours, [0, 2, 5]), item(Q.nb, 3), item(Q.sl, 5)], { version: 'normale' });
  assert.deepEqual(reponses, { version: 'normale', jours: ['lundi', 'mercredi', 'samedi'], nb_seances: 3, jour_sl: 'samedi' });
});

test('préparé, pas branché : aucun fichier du site ne lit encore le questionnaire du dimanche du moteur 9.0', () => {
  let lecteurs = [];
  try {
    // Les imports seulement : un commentaire qui nomme le fichier (lib/app/prepareNouveauMoteur.ts) ne le lit pas.
    lecteurs = execFileSync('grep', ['-rlE', 'from [\'"][^\'"]*dimancheV9[\'"]|import\\([^)]*dimancheV9', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    if (e.status !== 1) throw e;
  }
  // lib/app/moteurV9.ts n'en prend que les types (il est préparé, pas branché non plus : scripts/test-moteur-v9.mjs). lib/app/realiseV9.ts n'en prend que la liste des familles clés (198, 199), pour le résumé des semaines de la v1. lib/app/pointALaMain.ts : le point du dimanche des coachés à la main ; lib/app/lectureDuPoint.ts : ce que le coach en lit.
  assert.deepEqual(lecteurs.filter((f) => !['lib/app/moteurV9.ts', 'lib/app/ecritureV9.ts', 'lib/app/stockageV9.ts', 'lib/app/passeUnPlanV9.ts', 'lib/app/passagesV9.ts', 'lib/app/realiseV9.ts', 'lib/app/pointALaMain.ts', 'lib/app/lectureDuPoint.ts'].includes(f)), []);
});

test('les réponses du dimanche se prennent par l’identifiant posé ; avant la semaine 1, par le nom « Ton point du dimanche », jamais par une série du samedi encore dans Nolio', () => {
  const dimanche = { name: 'Ton point du dimanche', quiz_planned: 'pqz_9' };
  const samediRestant = { name: 'Ta semaine prochaine', quiz_planned: 'pqz_8' };
  // Posé : l'identifiant seul décide (le nom ne compte pas).
  assert.equal(d.repondAuDimanche(dimanche, 2, { nolio_id: 'pqz_9' }), true);
  assert.equal(d.repondAuDimanche(samediRestant, 2, { nolio_id: 'pqz_9' }), false);
  assert.equal(d.repondAuDimanche({ name: 'Ton point du dimanche', quiz_planned: 'pqz_7' }, 2, { nolio_id: 'pqz_9' }), false);
  // Avant la semaine 1, rien n'est posé : le nom, sans casse ni espace autour ; ni le nom du samedi, ni une autre semaine.
  assert.equal(d.repondAuDimanche({ name: '  ton point du DIMANCHE ' }, 0, null), true);
  assert.equal(d.repondAuDimanche(samediRestant, 0, null), false, 'une série « Ta semaine prochaine » du samedi n’est pas lue comme le point du dimanche');
  assert.equal(d.repondAuDimanche({ name: 'Ton point du dimanche' }, 2, null), false, 'passé la semaine 0, seul l’identifiant posé compte');
});

test('le nombre de séances (décision 207) : la nouvelle question est lue, l’ancienne aussi (un point déjà posé), la nouvelle l’emportant', () => {
  assert.equal(d.QUESTION_SEANCES, 'Combien de séances peux-tu faire par semaine ?');
  const lire = (...items) => d.lireReponsesDimanche(items, { version: 'normale' }).reponses.nb_seances;
  assert.equal(lire(item(Q.nb, 4)), 4);
  assert.equal(lire(item(Q.nbAvant, 3)), 3, 'un point posé avec « veux-tu faire » est encore lu');
  assert.equal(lire(item(Q.nbAvant, 3), item(Q.nb, 5)), 5);
  assert.equal(lire(item(Q.jours, [0])), undefined, 'sans réponse, rien');
  assert.equal(d.lireReponsesDimanche([item(Q.nb, 'beaucoup')], { version: 'normale' }).illisibles.join(), 'nb_seances');
});

test('les séances clés pas faites (« Deux voix », 24/11/2026) : la nouvelle question « comme prévu » est posée et lue, l’ancienne « comme écrite » (un point déjà posé) est encore lue', () => {
  assert.equal(d.QUESTION_CLES, 'Une séance clé pas faite comme prévu ?');
  assert.equal(d.QUESTION_CLES_AVANT, 'Une séance clé pas faite comme écrite ?');
  assert.equal(d.QUESTION_CLES_AVANT, Q.cles, 'les points posés avant gardent leur texte');
  const lues = (question) => d.lireReponsesDimanche([item(question, [0, 2])], { version: 'normale', cles: CLES }).reponses.cles_pas_faites;
  assert.deepEqual(lues(d.QUESTION_CLES), ['S9-mardi', 'S9-samedi'], 'la nouvelle question');
  assert.deepEqual(lues(Q.cles), ['S9-mardi', 'S9-samedi'], 'l’ancienne question, déjà posée');
  assert.equal(d.lireReponsesDimanche([item(d.QUESTION_CLES, 'beaucoup')], { version: 'normale', cles: CLES }).illisibles.join(), 'cles_pas_faites');
});

// ─── La cause d'un arrêt : une donnée de santé, avec l'accord de lecture seulement (décision 209, 24/11/2026) ───────────────────────

test('209 : sans accord de lecture, la question de la cause n’est pas posée ; l’arrêt et sa durée le sont toujours', () => {
  const sans = d.questionnaireDuDimanche({ version: 'normale', cles: CLES });
  assert.ok(!questions(sans).includes(d.QUESTION_CAUSE), 'pas de « pourquoi »');
  assert.deepEqual(questions(sans), [
    'As-tu arrêté de courir cette semaine ?',
    'Si tu as arrêté toute la semaine : depuis combien de semaines as-tu arrêté, en tout ?',
    'Une séance clé pas faite comme prévu ?',
    'Quels jours peux-tu courir la semaine prochaine ?',
    'Combien de séances peux-tu faire par semaine ?',
    'Quel jour pour ta sortie longue ?',
  ]);
  for (const version of d.VERSIONS_DIMANCHE) {
    assert.ok(!questions(d.questionnaireDuDimanche({ version, cles: CLES, coache: true })).includes(d.QUESTION_CAUSE), version);
    assert.ok(!questions(d.questionnaireDuDimanche({ version, cles: CLES, accord: false })).includes(d.QUESTION_CAUSE), version);
  }
  // Avec l'accord : la question est là, facultative, juste après la durée.
  const avec = d.questionnaireDuDimanche({ version: 'normale', cles: CLES, accord: true });
  assert.equal(questions(avec).indexOf(d.QUESTION_CAUSE), questions(avec).indexOf('Si tu as arrêté toute la semaine : depuis combien de semaines as-tu arrêté, en tout ?') + 1);
  assert.equal(avec.items.length, sans.items.length + 1, 'une seule question de plus : la cause');
  assert.equal(avec.items.find((i) => i.question === d.QUESTION_CAUSE).is_mandatory, false);
});

test('209 : sans accord, aucune cause n’est lue ni envoyée, même si la réponse en porte une ; le reste se lit comme avant, sans rien d’illisible', () => {
  const items = [item(Q.arret, 2), item(Q.sem, 4), item(Q.cause, 0), item(Q.cles, [0]), item(Q.jours, [1, 3]), item(Q.nb, 4), item(Q.sl, 6)];
  const sans = d.lireReponsesDimanche(items, { version: 'normale', cles: CLES });
  assert.deepEqual(sans.reponses, { version: 'normale', arret: 'semaine', semaines_arret: 5, cles_pas_faites: ['S9-mardi'], jours: ['mardi', 'jeudi'], nb_seances: 4, jour_sl: 'dimanche' });
  assert.ok(!('cause' in sans.reponses));
  assert.deepEqual(sans.illisibles, []);
  assert.ok(!('cause' in d.lireReponsesDimanche(items, { version: 'normale', cles: CLES, accord: false }).reponses));
  // Une cause illisible sans accord n'est pas même dite : la question n'existe pas pour lui.
  assert.deepEqual(d.lireReponsesDimanche([item(Q.arret, 1), item(Q.cause, 'plein de choses')], { version: 'normale' }).illisibles, []);
  // Avec l'accord : lue, comme avant.
  const avec = d.lireReponsesDimanche(items, { version: 'normale', cles: CLES, accord: true });
  assert.equal(avec.reponses.cause, 'blessure');
  assert.deepEqual(d.lireReponsesDimanche([item(Q.arret, 1), item(Q.cause, 1)], { version: 'normale', accord: true }).reponses, { version: 'normale', arret: 'quelques_jours', cause: 'maladie' });
});
