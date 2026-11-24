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
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
// Une fausse pièce : chaque fonction note son appel (nom et premier argument) et rend la valeur donnée.
const fonctions = (module, valeurs) => Object.entries(valeurs).map(([nom, v]) =>
  `export const ${nom} = async (...a) => { globalThis.__appels.push(['${module}.${nom}', a[0]]); return ${JSON.stringify(v)}; };`).join('\n');
const FAUX = {
  '/lib/app/ecriture.ts': `${fonctions('ecriture', { passageDuDimanche: [{ plan: 'a', quoi: 'avant' }], passageDuLundi: [{ plan: 'a', quoi: 'avant' }],
    passageQuotidienLeger: [], passageQuotidienLong: [], retirerLaTrameAuDela: [], prevenirCoach: null })}
export const nomsDesPlans = async () => new Map(); export const REMIS = 'remis';`,
  '/lib/app/passagesV9.ts': fonctions('passagesV9', { passageDuDimancheV9: [{ plan: 'b', quoi: 'v1' }], passageDuLundiV9: [{ plan: 'b', quoi: 'v1' }],
    questionnaireDuMatinV9: [{ plan: 'b', quoi: 'v1' }] }),
  '/lib/app/fond.ts': fonctions('fond', { saisonsDuJour: [{ plan: 's', quoi: 'saison' }] }),
  '/lib/app/dimanchesCoaches.ts': fonctions('dimanchesCoaches', { programmerLesDimanches: [{ plan: 'd', quoi: 'dimanches' }] }),
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
const appeler = async (chemin, { v9, secret = 'secret-d-essai' }) => {
  globalThis.__appels = [];
  globalThis.__v9 = v9;
  const reponse = await (await route(chemin))(new Request('https://exemple.test/api', { headers: secret ? { authorization: `Bearer ${secret}` } : {} }));
  return { reponse, corps: reponse.status === 200 ? await reponse.json() : null, appels: globalThis.__appels.map(([nom]) => nom), brut: globalThis.__appels };
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

test('le passage quotidien : sous la 8.x, les saisons de fond et les dimanches du samedi comme avant ; sous la 9.x, ni l’un ni l’autre, le reste inchangé', async () => {
  const avant = await appeler('relance/envoyer', { v9: false });
  for (const nom of ['relance.envoyerRelancesDues', 'ecriture.passageQuotidienLeger', 'fond.saisonsDuJour', 'dimanchesCoaches.programmerLesDimanches', 'ecriture.retirerLaTrameAuDela', 'ecriture.passageQuotidienLong'])
    assert.ok(avant.appels.includes(nom), nom);
  const v1 = await appeler('relance/envoyer', { v9: true });
  assert.ok(!v1.appels.includes('fond.saisonsDuJour') && !v1.appels.includes('dimanchesCoaches.programmerLesDimanches'));
  for (const nom of ['relance.envoyerRelancesDues', 'ecriture.passageQuotidienLeger', 'ecriture.retirerLaTrameAuDela', 'ecriture.passageQuotidienLong', 'comptesInactifs.passerComptesInactifs'])
    assert.ok(v1.appels.includes(nom), nom);
  assert.deepEqual(v1.appels.filter((n) => n.startsWith('passagesV9')), [], 'le passage quotidien n’écrit rien par la chaîne du moteur v1');
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
  assert.equal(crons.length, 19);
});

test('rien ne peut appeler les passages du moteur v1 sans l’aiguillage : chaque route qui les lit passe par selonLeMoteur, et personne d’autre ne les lit', async () => {
  const { execFileSync } = await import('node:child_process');
  const lecteurs = execFileSync('grep', ['-rlE', `from ['"][^'"]*passagesV9['"]|import\\([^)]*passagesV9`, 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort();
  assert.deepEqual(lecteurs, ['app/api/ecriture/dimanche/route.ts', 'app/api/ecriture/lundi/route.ts', 'app/api/ecriture/questionnaire/route.ts']);
  for (const f of lecteurs) {
    const source = readFileSync(`${RACINE}${f}`, 'utf8');
    assert.match(source, /selonLeMoteur\(\{[\s\S]*v1: /, f);
    assert.ok(!/passage\w*V9\(/.test(source.replace(/v1: \(\) => \w+V9\(\d+_?\d*\)/, '')), `${f} : la chaîne v1 n'est appelée que par la branche « v1 »`);
  }
});

test('sous le moteur v1, ce que la chaîne d’avant ferait ne part plus en 400 : un départ, « Réessayer », « Annuler », l’aperçu, le rattrapage disent pourquoi', () => {
  const e = readFileSync(`${RACINE}lib/app/ecriture.ts`, 'utf8');
  assert.match(e, /await refuserSousLeMoteurV1\(`La semaine \$\{numero\}`\);\n\s+const corps = await corpsDeLaSemaine/);
  assert.match(e, /await refuserSousLeMoteurV1\(`La récupération \$\{numero\}`\);/);
  assert.match(e, /export async function passageDuLundi\([^\n]*\n[^\n]*\n\s+if \(await moteurEstV9\(\)\) return \[\];/);
  assert.match(e, /export async function reprendreLesSemainesDues\([^\n]*\n[^\n]*\n\s+if \(await moteurEstV9\(\)\) return \[\];/);
});
