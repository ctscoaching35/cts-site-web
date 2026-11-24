#!/usr/bin/env node
/**
 * LES SIX ROUTES QUE LE MOTEUR v1 RETIRE (décisions du coach du 24/11/2026, entrée 191, « A, valider ») : `/v1/semaine/lundi`,
 * `/v1/realise`, `/v1/fatigue`, `/v1/veto`, `/v1/recuperation`, `/v1/course-secondaire`. Le site lit la version du moteur (`GET
 * /v1/config`, `version_moteur`) et, tant qu'il est une 8.x, rappelle ces routes comme avant ; sous une 9.x il ne rappelle plus
 * `/v1/realise`, `/v1/fatigue`, `/v1/veto` ni `/v1/course-secondaire`. `/v1/recuperation` et `/v1/semaine/lundi` sont remplacés par la
 * chaîne de `POST /v1/semaine` : ils restent à porter, et ce test liste chaque appel qui reste. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-routes-retirees.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const version = await import(pathToFileURL(`${RACINE}lib/app/versionDuMoteur.ts`).href);
const ligne = await import(pathToFileURL(`${RACINE}lib/app/moteurEnLigne.ts`).href);
const moteurV9 = await import(pathToFileURL(`${RACINE}lib/app/moteurV9.ts`).href);
const lire = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');

test('version : une 9.x se reconnaît, une 8.x et le reste non ; moteurV9 rend la même fonction', () => {
  for (const v of ['9.0', '9.1', '9', ' 9.0 ']) assert.equal(version.estMoteurV9(v), true, v);
  for (const v of ['8.474', '8.9', '19.0', '', null, undefined, 9, '90.1']) assert.equal(version.estMoteurV9(v), false, String(v));
  assert.equal(moteurV9.estMoteurV9, version.estMoteurV9);
});

test('la garde lit la version du moteur, la retient 5 minutes, et reste sur une 8.x sans réponse lisible', async () => {
  const t0 = 1_000_000;
  const lecteur = (valeur) => { const f = async () => { f.appels += 1; if (valeur instanceof Error) throw valeur; return valeur; }; f.appels = 0; return f; };
  ligne.oublierLaVersionDuMoteur();
  assert.equal(await ligne.moteurEstV9(lecteur('8.474'), t0), false);
  // Retenue : une autre version lue dans les 5 minutes ne change rien et n'est même pas lue.
  const neuf = lecteur('9.0');
  assert.equal(await ligne.moteurEstV9(neuf, t0 + 4 * 60_000), false);
  assert.equal(neuf.appels, 0);
  // Au-delà, elle est relue.
  assert.equal(await ligne.moteurEstV9(neuf, t0 + 5 * 60_000), true);
  assert.equal(neuf.appels, 1);
  // Une lecture qui échoue garde la dernière.
  assert.equal(await ligne.moteurEstV9(lecteur(new Error('réseau')), t0 + 11 * 60_000), true);
  // Sans lecture avant elle, une 8.x ; et rien n'est retenu de l'échec.
  ligne.oublierLaVersionDuMoteur();
  assert.equal(await ligne.moteurEstV9(lecteur(new Error('réseau')), t0), false);
  assert.equal(await ligne.moteurEstV9(lecteur(undefined), t0), false, 'une version illisible n’est pas une 9.x');
  assert.equal(await ligne.moteurEstV9(lecteur('9.1'), t0 + 1), true);
  ligne.oublierLaVersionDuMoteur();
});

test('sous une 9.x, le site ne rappelle plus /v1/realise, /v1/fatigue, /v1/veto ni /v1/course-secondaire', () => {
  const e = lire('lib/app/ecriture.ts');
  assert.match(e, /export async function refaireLesResumes\(budgetMs = 120_000\): Promise<Compte\[\]> \{\n[^\n]*\n\s*if \(await moteurEstV9\(\)\) return \[\];/);
  assert.match(e, /if \(await moteurEstV9\(\)\) return null;\n\s*const r = await moteur<\{ remplacer: string \| null;/);
  assert.match(e, /export async function garderSeanceOrigine\([^\n]*\n[^\n]*\n\s*if \(await moteurEstV9\(\)\) return false;\n\s*const o = await objectifEcrit/);
  // Les signaux du coach (lus avant la garde de la fatigue) se gardent comme avant.
  assert.ok(e.indexOf('await garderLesSignauxDuSoir(o, lecture.lu, aujourdhui)') < e.indexOf('if (await moteurEstV9()) return null;'));
  const a = lire('lib/app/actionsEcriture.ts');
  assert.match(a, /if \(await moteurEstV9\(\)\) return \{ ok: false, message: MESSAGE_COURSE_DE_PREPARATION_FERMEE \};\n\s*const reelles/);
  assert.ok(a.indexOf('MESSAGE_COURSE_DE_PREPARATION_FERMEE };') < a.indexOf('/v1/course-secondaire`'), 'la garde passe avant l’appel');
  // Un fichier « use server » n'exporte que des fonctions : le message n'est pas exporté.
  assert.ok(!/export const MESSAGE_COURSE_DE_PREPARATION_FERMEE/.test(a));
});

test('chaque appel qui reste à une route retirée est listé ici : un nouvel appel casse ce test', () => {
  const sortie = execFileSync('grep', ['-rnE', '/v1/(semaine/lundi|realise|fatigue|veto|recuperation|course-secondaire)', 'app', 'components', 'lib'],
    { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
  // Du code, pas des commentaires ni des textes de documentation.
  const appels = sortie.map((x) => {
    const m = /^([^:]+):(\d+):(.*)$/.exec(x);
    return { fichier: m[1], texte: m[3].trim(), route: /\/v1\/(semaine\/lundi|realise|fatigue|veto|recuperation|course-secondaire)/.exec(m[3])[1] };
  }).filter((x) => !/^(\/\/|\*|\/\*)/.test(x.texte));
  const liste = appels.map((x) => `${x.fichier} ${x.route}`).sort();
  assert.deepEqual(liste, [
    // Gardés par la version du moteur (ci-dessus) : rien d'appelé sous une 9.x.
    'lib/app/actionsEcriture.ts course-secondaire',
    'lib/app/ecriture.ts fatigue',
    'lib/app/ecriture.ts realise',
    'lib/app/ecriture.ts veto',
    // À PORTER sur la chaîne de POST /v1/semaine (corps, réponse et `etat` d'une 9.0) : la récupération est une semaine
    // `type: "recuperation"`, la passe du lundi une réponse avant la première séance qui réécrit la semaine (POST /v1/semaine),
    // ou, après une séance faite, POST /v1/reponse-tardive (lib/app/lundiV9.ts).
    'lib/app/ecriture.ts recuperation',
    'lib/app/ecriture.ts semaine/lundi',
    // La démonstration rejoue les réponses du moteur : un faux appel, pas un appel.
    'lib/app/demonstrationCoachDonnees.ts recuperation',
  ].sort());
});
