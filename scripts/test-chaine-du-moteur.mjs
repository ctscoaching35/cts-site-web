#!/usr/bin/env node
/**
 * L'AIGUILLAGE SELON LE MOTEUR (lib/app/chaineDuMoteur.ts ; décisions du coach du 24/11/2026, entrée 191) : les tâches planifiées du site (le passage du
 * dimanche, la passe du lundi, le questionnaire du dimanche matin, le passage quotidien) font ce qu'elles faisaient AVANT tant que le moteur en ligne est
 * une 8.x, et la chaîne du moteur v1 (lib/app/passagesV9.ts) dès qu'il est une 9.x. Les vraies routes (app/api/…) sont chargées ; ce qu'elles appellent
 * (la base, Nolio, le moteur) est remplacé par des fausses pièces qui notent chaque appel. Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-chaine-du-moteur.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test, { mock } from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
// Une fausse pièce : chaque fonction note son appel (nom et premier argument) et rend la valeur donnée.
const fonctions = (module, valeurs) => Object.entries(valeurs).map(([nom, v]) =>
  `export const ${nom} = async (...a) => { globalThis.__appels.push(['${module}.${nom}', a[0]]); return ${JSON.stringify(v)}; };`).join('\n');
const FAUX = {
  '/lib/app/ecriture.ts': `${fonctions('ecriture', { passageDuDimanche: [{ plan: 'a', quoi: 'avant' }], passageDuLundi: [{ plan: 'a', quoi: 'avant' }],
    passageQuotidienLeger: [], passageQuotidienLong: [], retirerLaTrameAuDela: [], prevenirCoach: null })}
export const nomsDesPlans = async () => new Map(); export const REMIS = 'remis';`,
  '/lib/app/passagesV9.ts': `export const passageDuDimancheV9 = async (...a) => { globalThis.__appels.push(['passagesV9.passageDuDimancheV9', a[0]]); return [{ plan: 'b', quoi: 'v1', ...(globalThis.__echec ? { erreur: 'boum' } : {}) }]; };
${fonctions('passagesV9', { passageDuLundiV9: [{ plan: 'b', quoi: 'v1' }], questionnaireDuMatinV9: [{ plan: 'b', quoi: 'v1' }], rappelDuDimancheV9: { actif: true, texteValide: true, comptes: [{ plan: 'b', quoi: 'rappel v1' }] } })}`,
  '/lib/app/rappelDuDimanche.ts': fonctions('rappelDuDimanche', { rappelerLeDimanche: { actif: true, texteValide: true, comptes: [{ plan: 'a', quoi: 'rappel avant' }] } }),
  '/lib/app/fond.ts': fonctions('fond', { saisonsDuJour: [{ plan: 's', quoi: 'saison' }] }),
  // Les dimanches notent aussi leurs options (le Hooper seul sous la 9.x) : globalThis.__options, le deuxième argument.
  '/lib/app/dimanchesCoaches.ts': `export const programmerLesDimanches = async (...a) => { globalThis.__appels.push(['dimanchesCoaches.programmerLesDimanches', a[0]]); globalThis.__options = a[1] ?? null; return [{ plan: 'd', quoi: 'dimanches' }]; };`,
  '/lib/app/comptesInactifs.ts': fonctions('comptesInactifs', { passerComptesInactifs: [] }),
  '/lib/app/demandesCoaching.ts': fonctions('demandesCoaching', { effacerLesDemandesEchues: 0 }),
  '/lib/app/relance.ts': fonctions('relance', { envoyerRelancesDues: 0 }),
  '/lib/app/rangement.ts': fonctions('rangement', { effacerLesAchatsEchus: [], renvoyerLesConfirmations: [] }),
  '/lib/app/supabase.ts': 'export const supabaseConfigure = () => true;',
  '/lib/content.ts': "export const site = { url: 'https://exemple.test' };",
  '/lib/app/moteurEnLigne.ts': 'export const moteurEstV9 = async () => globalThis.__v9;',
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    let r;
    try {
      r = nextResolve(specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href : specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    const cle = Object.keys(FAUX).find((f) => r.url.endsWith(f));
    return cle ? { url: `data:text/javascript,${encodeURIComponent(FAUX[cle])}`, shortCircuit: true } : r;
  },
});
process.env.CRON_SECRET = 'secret-d-essai';
const route = async (chemin) => (await import(pathToFileURL(`${RACINE}app/api/${chemin}/route.ts`).href)).GET;
// planif : l'en-tête de la planification de Vercel (absent d'un appel à la main) ; maintenant : l'instant simulé (ISO, UTC) ; echec : les passages rendent une erreur.
const appeler = async (chemin, { v9, secret = 'secret-d-essai', planif = null, maintenant = null, echec = false }) => {
  globalThis.__appels = [];
  globalThis.__options = null;
  globalThis.__v9 = v9;
  globalThis.__echec = echec;
  if (maintenant) mock.timers.enable({ apis: ['Date'], now: new Date(maintenant) });
  let reponse;
  try {
    reponse = await (await route(chemin))(new Request('https://exemple.test/api', { headers: { ...(secret ? { authorization: `Bearer ${secret}` } : {}), ...(planif ? { 'x-vercel-cron-schedule': planif } : {}) } }));
  } finally {
    if (maintenant) mock.timers.reset();
  }
  return { reponse, corps: reponse.status === 200 ? await reponse.json() : null, appels: globalThis.__appels.map(([nom]) => nom), brut: globalThis.__appels, options: globalThis.__options };
};

test('le passage du dimanche soir : sous la 8.x, les saisons de fond puis le passage d’avant, jamais la chaîne du moteur v1 ; sous la 9.x, seulement la chaîne v1', async () => {
  const avant = await appeler('ecriture/dimanche', { v9: false });
  assert.deepEqual(avant.appels, ['fond.saisonsDuJour', 'ecriture.passageDuDimanche']);
  const budget = avant.brut.find(([n]) => n === 'ecriture.passageDuDimanche')[1];
  assert.ok(budget >= 180_000 && budget <= 240_000, `le temps qui reste, comme avant (${budget})`);
  assert.deepEqual(avant.corps.semaines, [{ plan: 'a', quoi: 'avant', erreur: null }]);
  const v1 = await appeler('ecriture/dimanche', { v9: true });
  assert.deepEqual(v1.appels, ['passagesV9.passageDuDimancheV9']);
  assert.deepEqual(v1.corps.semaines, [{ plan: 'b', quoi: 'v1', erreur: null }]);
});

test('la passe du lundi : sous la 8.x, celle d’avant (240 s) ; sous la 9.x, celle du moteur v1', async () => {
  const avant = await appeler('ecriture/lundi', { v9: false });
  assert.deepEqual(avant.brut.map(([n, a]) => [n, a]), [['ecriture.passageDuLundi', 240_000]]);
  const v1 = await appeler('ecriture/lundi', { v9: true });
  assert.deepEqual(v1.brut, [['passagesV9.passageDuLundiV9', 240_000]]);
});

test('le questionnaire du dimanche matin : sous la 8.x, RIEN (le questionnaire du samedi est celui de la fiche) ; sous la 9.x, la chaîne du moteur v1', async () => {
  const avant = await appeler('ecriture/questionnaire', { v9: false });
  assert.deepEqual(avant.appels, []);
  assert.deepEqual(avant.corps, { questionnaires: [] });
  const v1 = await appeler('ecriture/questionnaire', { v9: true });
  assert.deepEqual(v1.appels, ['passagesV9.questionnaireDuMatinV9']);
});

test('le passage quotidien : sous la 8.x, les saisons de fond et les dimanches du samedi comme avant ; sous la 9.x, ni saison de fond ni questionnaire du samedi, mais le Hooper du dimanche (décision 52), le reste inchangé', async () => {
  const avant = await appeler('relance/envoyer', { v9: false });
  for (const nom of ['relance.envoyerRelancesDues', 'ecriture.passageQuotidienLeger', 'fond.saisonsDuJour', 'dimanchesCoaches.programmerLesDimanches', 'ecriture.retirerLaTrameAuDela', 'ecriture.passageQuotidienLong'])
    assert.ok(avant.appels.includes(nom), nom);
  assert.deepEqual(avant.brut.find(([n]) => n === 'dimanchesCoaches.programmerLesDimanches'), ['dimanchesCoaches.programmerLesDimanches', undefined], 'sous la 8.x, appelé comme avant : sans argument');
  assert.equal(avant.options, null, 'sous la 8.x, aucune option : le questionnaire du samedi et le Hooper, comme avant');
  const v1 = await appeler('relance/envoyer', { v9: true });
  assert.ok(!v1.appels.includes('fond.saisonsDuJour'));
  assert.ok(v1.appels.includes('dimanchesCoaches.programmerLesDimanches'), 'le Hooper du dimanche reste posé sous la 9.x');
  assert.deepEqual(v1.options, { seulementLeHooper: true }, 'le Hooper seul : le questionnaire du samedi n’est ni posé ni retiré');
  for (const nom of ['relance.envoyerRelancesDues', 'ecriture.passageQuotidienLeger', 'ecriture.retirerLaTrameAuDela', 'ecriture.passageQuotidienLong', 'comptesInactifs.passerComptesInactifs'])
    assert.ok(v1.appels.includes(nom), nom);
  assert.deepEqual(v1.appels.filter((n) => n.startsWith('passagesV9')), [], 'le passage quotidien n’écrit rien par la chaîne du moteur v1');
});

test('le rappel du dimanche : sous la 8.x, celui d’avant (240 s) ; sous la 9.x, celui du point du dimanche (décision 206), jamais l’un pour l’autre', async () => {
  const avant = await appeler('ecriture/rappel', { v9: false });
  assert.deepEqual(avant.brut, [['rappelDuDimanche.rappelerLeDimanche', 240_000]]);
  assert.deepEqual(avant.corps.rappels, [{ plan: 'a', quoi: 'rappel avant', erreur: null }]);
  const v1 = await appeler('ecriture/rappel', { v9: true });
  assert.deepEqual(v1.brut, [['passagesV9.rappelDuDimancheV9', 240_000]]);
  assert.deepEqual(v1.corps.rappels, [{ plan: 'b', quoi: 'rappel v1', erreur: null }]);
  for (const v9 of [false, true]) {
    const sans = await appeler('ecriture/rappel', { v9, secret: 'autre' });
    assert.equal(sans.reponse.status, 401);
    assert.deepEqual(sans.appels, []);
  }
});

// ─── Les heures du dimanche (décision 211) : chaque moteur n'agit que sur ses lancements, à l'heure de Paris toute l'année ───────────────────────────────

const DIM_HIVER = '2026-12-06';
const DIM_ETE = '2027-06-06';
const lance = (route, v9, jour, utc, planif, extra = {}) => appeler(route, { v9, planif, maintenant: `${jour}T${utc}:00Z`, ...extra });

test('l’écriture du dimanche sous la 9.x : à 21 h et 22 h de Paris, l’hiver comme l’été ; les autres lancements de vercel.json ne font rien', async () => {
  const resultats = {};
  for (const [saison, jour] of [['hiver', DIM_HIVER], ['été', DIM_ETE]]) {
    resultats[saison] = [];
    for (const heureUtc of [17, 19, 20, 21]) {
      const r = await lance('ecriture/dimanche', true, jour, `${heureUtc}:10`, `0 ${heureUtc} * * 0`);
      assert.equal(r.reponse.status, 200);
      resultats[saison].push([heureUtc, r.appels.includes('passagesV9.passageDuDimancheV9')]);
      assert.ok(!r.appels.includes('ecriture.passageDuDimanche') && !r.appels.includes('fond.saisonsDuJour'), 'jamais la chaîne de la 8.x');
    }
  }
  assert.deepEqual(resultats.hiver, [[17, false], [19, false], [20, true], [21, true]], 'l’hiver : 21 h et 22 h de Paris = 20 h et 21 h UTC');
  assert.deepEqual(resultats.été, [[17, false], [19, true], [20, true], [21, false]], 'l’été : 21 h et 22 h de Paris = 19 h et 20 h UTC');
  // Un lancement à la main (sans en-tête de planification) n'est jamais écarté.
  const main = await lance('ecriture/dimanche', true, DIM_HIVER, '14:00', null);
  assert.ok(main.appels.includes('passagesV9.passageDuDimancheV9'));
});

test('l’écriture du dimanche sous la 8.x : ses trois lancements d’avant comme avant, celui de 20 h UTC (de la v1) ne fait rien', async () => {
  for (const jour of [DIM_HIVER, DIM_ETE]) {
    for (const heureUtc of [17, 19, 21]) {
      const r = await lance('ecriture/dimanche', false, jour, `${heureUtc}:10`, `0 ${heureUtc} * * 0`);
      assert.deepEqual(r.appels, ['fond.saisonsDuJour', 'ecriture.passageDuDimanche'], `${jour} ${heureUtc} h UTC : comme avant`);
    }
    const v1seul = await lance('ecriture/dimanche', false, jour, '20:10', '0 20 * * 0');
    assert.deepEqual(v1seul.appels, [], 'la 8.x ignore le lancement de la v1');
    assert.deepEqual(v1seul.corps, { semaines: [] });
  }
  assert.deepEqual((await lance('ecriture/dimanche', false, DIM_HIVER, '14:00', null)).appels, ['fond.saisonsDuJour', 'ecriture.passageDuDimanche'], 'à la main : comme avant');
});

test('le coach n’est prévenu qu’après la dernière reprise : 22 h de Paris sous la 9.x, 21 h UTC sous la 8.x', async () => {
  const prevenu = (r) => r.appels.includes('ecriture.prevenirCoach');
  // Sous la 9.x : 21 h de Paris (reprise de 22 h à venir) : pas encore ; 22 h : oui. L'hiver et l'été.
  assert.equal(prevenu(await lance('ecriture/dimanche', true, DIM_HIVER, '20:10', '0 20 * * 0', { echec: true })), false);
  assert.equal(prevenu(await lance('ecriture/dimanche', true, DIM_HIVER, '21:10', '0 21 * * 0', { echec: true })), true);
  assert.equal(prevenu(await lance('ecriture/dimanche', true, DIM_ETE, '19:10', '0 19 * * 0', { echec: true })), false);
  assert.equal(prevenu(await lance('ecriture/dimanche', true, DIM_ETE, '20:10', '0 20 * * 0', { echec: true })), true);
  // Rien d'en échec : personne à prévenir. À la main : le coach apprend ce qui reste.
  assert.equal(prevenu(await lance('ecriture/dimanche', true, DIM_HIVER, '21:10', '0 21 * * 0')), false);
  assert.equal(prevenu(await lance('ecriture/dimanche', true, DIM_HIVER, '14:00', null, { echec: true })), true);
});

test('le rappel du dimanche : sous la 9.x un seul lancement agit, à 19 h de Paris, l’hiver comme l’été ; sous la 8.x seulement celui de 14 h UTC', async () => {
  const agit = async (v9, jour, heureUtc) => (await lance('ecriture/rappel', v9, jour, `${heureUtc}:10`, `0 ${heureUtc} * * 0`)).appels;
  for (const [jour, bonne] of [[DIM_HIVER, 18], [DIM_ETE, 17]]) {
    assert.deepEqual(await agit(true, jour, bonne), ['passagesV9.rappelDuDimancheV9'], `${jour} : 19 h de Paris = ${bonne} h UTC`);
    for (const autre of [14, 17, 18].filter((x) => x !== bonne)) assert.deepEqual(await agit(true, jour, autre), [], `${jour} : ${autre} h UTC ne fait rien sous la v1`);
    assert.deepEqual(await agit(false, jour, 14), ['rappelDuDimanche.rappelerLeDimanche'], 'la 8.x garde le sien');
    for (const heureUtc of [17, 18]) assert.deepEqual(await agit(false, jour, heureUtc), [], `la 8.x ignore le lancement de ${heureUtc} h UTC`);
  }
  assert.deepEqual((await lance('ecriture/rappel', true, DIM_HIVER, '14:00', null)).appels, ['passagesV9.rappelDuDimancheV9'], 'à la main : celui du moteur en ligne');
  assert.deepEqual((await lance('ecriture/rappel', false, DIM_HIVER, '14:00', null)).appels, ['rappelDuDimanche.rappelerLeDimanche']);
});

test('sans le secret des tâches planifiées : refusé, rien n’est appelé, sous les deux moteurs', async () => {
  for (const chemin of ['ecriture/dimanche', 'ecriture/lundi', 'ecriture/questionnaire']) {
    for (const v9 of [false, true]) {
      const r = await appeler(chemin, { v9, secret: 'autre' });
      assert.equal(r.reponse.status, 401, chemin);
      assert.deepEqual(r.appels, [], chemin);
    }
  }
});

test('l’aiguillage rend la chaîne d’avant sans une 9.x, y compris quand la version ne se lit pas', async () => {
  const { selonLeMoteur } = await import(pathToFileURL(`${RACINE}lib/app/chaineDuMoteur.ts`).href);
  const chaines = { avant: async () => 'avant', v1: async () => 'v1' };
  assert.equal(await selonLeMoteur(chaines, async () => false), 'avant');
  assert.equal(await selonLeMoteur(chaines, async () => true), 'v1');
  // La vraie garde (lib/app/moteurEnLigne.ts) ne rend « v1 » que pour une 9.x lue : une version illisible reste « avant » (essayé dans test-routes-retirees.mjs).
  assert.match(readFileSync(`${RACINE}lib/app/moteurEnLigne.ts`, 'utf8'), /return gardee\?\.v9 \?\? false/);
});

test('les tâches du site : le questionnaire du dimanche matin a sa ligne dans vercel.json, hors de la fenêtre d’écriture du moteur', () => {
  const crons = JSON.parse(readFileSync(`${RACINE}vercel.json`, 'utf8')).crons;
  assert.deepEqual(crons.filter((c) => c.path === '/api/ecriture/questionnaire'), [{ path: '/api/ecriture/questionnaire', schedule: '0 8 * * 0' }]);
  assert.equal(crons.length, 22, '19 d’avant, plus le passage de 20 h UTC du dimanche et les deux lancements du rappel (17 h et 18 h UTC) de la décision 211');
});

test('rien ne peut appeler les passages du moteur v1 sans l’aiguillage : chaque route qui les lit passe par selonLeMoteur, et personne d’autre ne les lit', async () => {
  const { execFileSync } = await import('node:child_process');
  const lecteurs = execFileSync('grep', ['-rlE', `from ['"][^'"]*passagesV9['"]|import\\([^)]*passagesV9`, 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort();
  // Les routes passent par selonLeMoteur ; ecriture.ts (« Réessayer ») et departV9.ts (le départ d'un objectif) ne s'importent qu'APRÈS un `if (await moteurEstV9())`.
  assert.deepEqual(lecteurs, ['app/api/ecriture/dimanche/route.ts', 'app/api/ecriture/lundi/route.ts', 'app/api/ecriture/questionnaire/route.ts', 'app/api/ecriture/rappel/route.ts', 'lib/app/departV9.ts', 'lib/app/ecriture.ts']);
  const e = readFileSync(`${RACINE}lib/app/ecriture.ts`, 'utf8');
  assert.match(e, /if \(await moteurEstV9\(\)\) \{\n(?:[^\n]*\n)*?\s+const \{ ecrireLaSemaineDemandee \} = await import\('\.\/passagesV9'\);/, '« Réessayer » : derrière la garde');
  for (const f of lecteurs.filter((x) => x.startsWith('app/'))) {
    const source = readFileSync(`${RACINE}${f}`, 'utf8');
    assert.match(source, /selonLeMoteur(<[^(]*>)?\(\{[\s\S]*v1: /, f);
    // La chaîne v1 n'est appelée que dans la branche « v1 » : de `v1:` jusqu'à `avant:` quand elle vient la première, jusqu'à la fin sinon.
    const iV1 = source.indexOf('v1:');
    const iAvant = source.indexOf('avant:');
    const finV1 = iAvant > iV1 ? iAvant : source.length;
    const appels = [...source.matchAll(/\b(passageDuDimancheV9|passageDuLundiV9|questionnaireDuMatinV9|rappelDuDimancheV9)\(/g)].filter((m) => !source.slice(Math.max(0, m.index - 20), m.index).includes('import'));
    assert.ok(appels.length >= 1 && appels.every((m) => m.index > iV1 && m.index < finV1), `${f} : la chaîne v1 n'est appelée que par la branche « v1 »`);
  }
});

test('sous le moteur v1, ce que la chaîne d’avant ferait ne part plus en 400 : un départ, « Réessayer », « Annuler », l’aperçu, le rattrapage disent pourquoi', () => {
  const e = readFileSync(`${RACINE}lib/app/ecriture.ts`, 'utf8');
  assert.match(e, /await refuserSousLeMoteurV1\(`La semaine \$\{numero\}`\);\n\s+const corps = await corpsDeLaSemaine/);
  assert.match(e, /await refuserSousLeMoteurV1\(`La récupération \$\{numero\}`\);/);
  assert.match(e, /export async function passageDuLundi\([^\n]*\n[^\n]*\n\s+if \(await moteurEstV9\(\)\) return \[\];/);
  assert.match(e, /export async function reprendreLesSemainesDues\([^\n]*\n[^\n]*\n\s+if \(await moteurEstV9\(\)\) return \[\];/);
});

test('le départ d’un objectif et « Réessayer » sous le moteur v1 : derrière la garde, après les règles de départ d’avant ; sous la 8.x, le départ et le rattrapage d’avant restent', () => {
  const e = readFileSync(`${RACINE}lib/app/ecriture.ts`, 'utf8');
  const depart = e.slice(e.indexOf('export async function demarrerObjectif'), e.indexOf('// OM4 (décision coach du 21/10/2026) : un objectif qui démarre juste après'));
  // Les règles du calendrier (à la main, Nolio relié, course passée, objectif en route, doublons, départ programmé) passent avant la branche du moteur v1.
  const iBranche = depart.indexOf('if (await moteurEstV9()) {\n      const { demarrerSousLeMoteurV1 }');
  assert.ok(iBranche > 0, 'la branche du moteur v1 est là');
  for (const avant of ['Tu programmes cet athlète à la main', 'La course est passée.', 'objectifQuiCouvre(premiere.lundi, autres)', "update({ demarre_le: new Date().toISOString() })", 'arreterLaSaison(']) {
    assert.ok(depart.indexOf(avant) > 0 && depart.indexOf(avant) < iBranche, `« ${avant} » passe avant la branche du moteur v1`);
  }
  // Et la 8.x garde tout après : le recalage, le départ individualisé, le rythme, et la première semaine de la 8.x.
  for (const apres of ['recalerSurLePrecedent(', 'deciderLeDepart(', 'poserLeRythme(', 'await ecrireEtEnvoyer(o, premiere.numero, retoursDepart']) {
    assert.ok(depart.indexOf(apres) > iBranche, `« ${apres} » reste pour la 8.x`);
  }
  const rattrapage = e.slice(e.indexOf('export async function rattraperLaSemaine'), e.indexOf('// Une séance d\'une semaine écrite, sous la forme de l\'app'));
  assert.match(rattrapage, /if \(await moteurEstV9\(\)\) \{[\s\S]*ecrireLaSemaineDemandee[\s\S]*\}\n\s+const s = semaineDu\(o\.plan, lundi\);/);
  assert.ok(rattrapage.includes('await ecrireEtEnvoyer(o, s.numero, retours,'), 'le rattrapage de la 8.x reste');
});

test('le Hooper d’un acheteur : le départ sous la 9.x et l’accord de lecture ne posent que lui ; sous la 8.x, le dimanche posé comme avant', () => {
  const e = readFileSync(`${RACINE}lib/app/ecriture.ts`, 'utf8');
  // La seule différence est l'option, lue sur la version du moteur en ligne : sans 9.x, `seulementLeHooper` est faux et dimancheDuPlan fait ce qu'il faisait.
  assert.match(e, /accord_lecture_le: \(p\?\.accord_lecture_le as string \| null\) \?\? null \}, \{ seulementLeHooper: await moteurEstV9\(\) \}\);/);
  // Le départ sous la 9.x pose le Hooper du dimanche qui vient (décision 52), comme celui de la 8.x, après la première semaine et avant le rangement de l'acheteur.
  assert.match(e, /const ecrite = await demarrerSousLeMoteurV1\([^\n]*\n\s+await dimancheDeLAcheteur\(o\);[^\n]*\n\s+if \(!o\.coache\) await rangerAcheteur\(o\);/);
  // Et la route du passage quotidien ne passe l'option qu'à la chaîne v1.
  const r = readFileSync(`${RACINE}app/api/relance/envoyer/route.ts`, 'utf8');
  assert.match(r, /selonLeMoteur\(\{ avant: \(\) => programmerLesDimanches\(\), v1: \(\) => programmerLesDimanches\(120_000, \{ seulementLeHooper: true \}\) \}\)/);
});

test('« Annuler » et l’aperçu du dimanche, que le contrat du moteur v1 ne permet pas, le disent au lieu d’échouer en 400', () => {
  const e = readFileSync(`${RACINE}lib/app/ecriture.ts`, 'utf8');
  assert.match(e, /export async function annulerAjustements\([^\n]*\n[^\n]*\n\s+if \(await moteurEstV9\(\)\) throw new Error\('« Annuler » n’existe pas encore sous le moteur v1/);
  assert.match(e, /export async function apercuDuDimanche\([^\n]*\n[^\n]*\n\s+if \(await moteurEstV9\(\)\) throw new Error\('L’aperçu du dimanche n’est pas encore porté sous le moteur v1/);
});
