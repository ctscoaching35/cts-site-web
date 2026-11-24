#!/usr/bin/env node
/**
 * LES PASSAGES DU LUNDI (décisions du coach du 24/11/2026, entrée 191) : les lectures des réponses s'arrêtaient lundi 5 h UTC ; la passe
 * du lundi repasse toutes les deux heures jusqu'à 21 h UTC. Une réponse nouvelle avant la première séance de la semaine la réécrit
 * (POST /v1/semaine), après une séance faite c'est POST /v1/reponse-tardive, rien de nouveau ou Nolio illisible : rien. Des cas
 * fictifs, sans réseau.
 *
 *   node --test scripts/test-lundi-v9.mjs
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
const l = await import(pathToFileURL(`${RACINE}lib/app/lundiV9.ts`).href);
const lire = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');

const seance = (faite = null, duree_faite_min = null) => ({ faite, duree_faite_min });
const SANS_SEANCE_FAITE = { seances: [seance(), seance(), seance(null, 0)], activites_vues: 0 };

test('une séance faite : l’athlète l’a faite, ou une activité est montrée cette semaine-là', () => {
  assert.equal(l.uneSeanceEstFaite(SANS_SEANCE_FAITE), false);
  assert.equal(l.uneSeanceEstFaite({ seances: [seance(true)], activites_vues: 0 }), true);
  assert.equal(l.uneSeanceEstFaite({ seances: [seance(null, 45)], activites_vues: 0 }), true, 'une durée faite');
  assert.equal(l.uneSeanceEstFaite({ seances: [seance(), seance()], activites_vues: 1 }), true, 'une activité de Nolio, reliée ou non');
  // « pas faite » cochée n'est pas une séance faite.
  assert.equal(l.uneSeanceEstFaite({ seances: [seance(false)], activites_vues: 0 }), false);
  assert.equal(l.uneSeanceEstFaite({ seances: [], activites_vues: 0 }), false);
});

test('une réponse nouvelle avant la première séance réécrit la semaine, après une séance faite c’est la réponse tardive', () => {
  assert.equal(l.actionDuLundi({ reponseNouvelle: true, semaine: SANS_SEANCE_FAITE }), 'reecrire');
  assert.equal(l.actionDuLundi({ reponseNouvelle: true, semaine: { seances: [seance(true)], activites_vues: 1 } }), 'reponse_tardive');
});

test('rien de nouveau, ou Nolio illisible : rien (le passage de deux heures plus tard reprend)', () => {
  assert.equal(l.actionDuLundi({ reponseNouvelle: false, semaine: SANS_SEANCE_FAITE }), 'rien');
  assert.equal(l.actionDuLundi({ reponseNouvelle: false, semaine: { seances: [seance(true)], activites_vues: 2 } }), 'rien');
  assert.equal(l.actionDuLundi({ reponseNouvelle: true, semaine: null }), 'rien', 'jamais de réécriture sur une lecture manquée');
});

test('vercel.json : la passe du lundi, toutes les deux heures de 5 h à 21 h UTC, et aucun passage de plus ailleurs', () => {
  assert.deepEqual(l.HEURES_DES_PASSAGES_DU_LUNDI, [5, 7, 9, 11, 13, 15, 17, 19, 21]);
  const crons = JSON.parse(lire('vercel.json')).crons;
  const lundi = crons.filter((c) => c.path === '/api/ecriture/lundi').map((c) => c.schedule);
  assert.deepEqual(lundi, l.HEURES_DES_PASSAGES_DU_LUNDI.map((h) => `0 ${h} * * 1`), 'le lundi seulement, à l’heure juste');
  // La fenêtre d'écriture du moteur (dimanche 16 h 45 au lundi 5 h 30 UTC) : aucun nouveau passage dedans (le 5 h existait).
  for (const h of l.HEURES_DES_PASSAGES_DU_LUNDI.filter((x) => x !== 5)) assert.ok(h >= 6 && h <= 23, `${h} h`);
  // Les autres tâches n'ont pas bougé.
  assert.equal(crons.filter((c) => c.path === '/api/ecriture/dimanche').length, 4, 'les trois de la 8.x (17, 19, 21 h UTC) et celui de 20 h UTC de la v1 (décision 211, scripts/test-heures-v9.mjs)');
  assert.equal(crons.length, 22, '10 tâches d’avant, les 8 passages du lundi de 7 h à 21 h, le questionnaire du dimanche matin, et pour la décision 211 le passage de 20 h UTC du dimanche et deux lancements de plus du rappel');
});

test('sous la 8.x, les passages de plus ne changent rien : une semaine déjà passée (sa note du lundi posée) est sautée', () => {
  const e = lire('lib/app/ecriture.ts');
  assert.match(e, /\/\/ Déjà passée : sa note du lundi est posée\.\n\s+if \(o\.envois\.some\(\(e\) => e\.semaine === `\$\{l\.numero\}:bilan`\)\) continue;/);
  // Le lundi seulement : un appel un autre jour ne fait rien.
  assert.match(e, /if \(\(new Date\(`\$\{jour\}T12:00:00Z`\)\.getUTCDay\(\) \+ 6\) % 7 !== 0\) return \[\];/);
});

test('la décision du lundi n’est lue par personne (préparée, pas branchée)', async () => {
  const { execFileSync } = await import('node:child_process');
  let lecteurs = [];
  try {
    lecteurs = execFileSync('grep', ['-rlE', 'from [\'"][^\'"]*lundiV9[\'"]|import\\([^)]*lundiV9', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch { /* grep ne trouve rien : code 1 */ }
  assert.deepEqual(lecteurs.filter((f) => f !== 'lib/app/ecritureV9.ts'), [], 'seule la chaîne du moteur v1 le lit');
});
