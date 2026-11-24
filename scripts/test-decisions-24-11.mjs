#!/usr/bin/env node
/**
 * DEUX DÉCISIONS DU COACH DU 24/11/2026 (entrées 207 et 208) :
 *   - 207 : la question du nombre de séances devient « Combien de séances peux-tu faire par semaine ? », à l'achat comme sur la fiche du coaché ; elle remplace « Séances par
 *     semaine » (et, dans le point du dimanche, « Combien de séances veux-tu faire ? » : scripts/test-dimanche-v9.mjs). Le moteur la lit comme un maximum ;
 *   - 208 : après « Ajouter la trace », sous la 9.x, le message est « Trace ajoutée : tes prochaines semaines tiendront compte de ses montées. ».
 * Les libellés vivent dans des composants d'écran : l'essai lit leur source. Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-decisions-24-11.mjs
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
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const { textes } = await import(pathToFileURL(`${RACINE}lib/plan.ts`).href);

const QUESTION = 'Combien de séances peux-tu faire par semaine ?';

test('207 : la question du nombre de séances est la même à l’achat et sur la fiche, et remplace « Séances par semaine »', () => {
  assert.equal(textes.disponibilite.seances, QUESTION);
  const achat = source('components/plan/Questionnaire.tsx');
  assert.match(achat, /<span id="freq-titre" className=\{labelCls\}>\{textes\.disponibilite\.seances\}<\/span>/);
  assert.ok(!/>Séances par semaine</.test(achat), 'l’ancien libellé a quitté l’achat');
  const fiche = source('components/app/ProfilAthlete.tsx');
  assert.match(fiche, /<label className="block text-xs font-semibold text-indigo">\{textes\.disponibilite\.seances\}\n\s+<input name="freq_hebdo"/);
  assert.ok(!/>Séances par semaine\n/.test(fiche), 'ni de la fiche');
  // Le point du dimanche pose la même (scripts/test-dimanche-v9.mjs), le contrat dit « au plus » : le champ envoyé est toujours `freq_hebdo`.
  assert.match(source('lib/app/dimancheV9.ts'), /export const QUESTION_SEANCES = 'Combien de séances peux-tu faire par semaine \?';/);
  assert.ok(!/Combien de séances veux-tu faire/.test(achat + fiche), 'l’ancienne question n’est plus posée ni à l’achat ni sur la fiche');
});

test('207 : le questionnaire du samedi de la 8.x garde sa question, mot pour mot ; les lignes de lecture du coach aussi', () => {
  const samedi = source('lib/app/questionnaireSamedi.ts');
  assert.match(samedi, /export const QUESTION_NB = 'Combien de séances veux-tu faire \?';/);
  assert.match(source('lib/app/coachingRegles.ts'), /seances: 'Séances par semaine',/);
});

test('208 : après « Ajouter la trace », sous la 9.x le message dit les montées ; sans profil gardé, ou sous la 8.x, celui d’avant', () => {
  const e = source('lib/app/actionsEcriture.ts');
  assert.match(e, /const MESSAGE_TRACE_AJOUTEE_V9 = 'Trace ajoutée : tes prochaines semaines tiendront compte de ses montées\.';/);
  const geste = e.slice(e.indexOf('export async function ajouterTraceObjectif'), e.indexOf('// Retirer une course de préparation à venir'));
  assert.match(geste, /if \(profilGarde\) return \{ ok: true, message: MESSAGE_TRACE_AJOUTEE_V9 \};\n\s+return \{ ok: true, message: 'C’est fait : le profil et les tronçons de ta course sont dans ta fiche\. Ta préparation, elle, ne change pas\.' \};/);
  assert.equal((e.match(/MESSAGE_TRACE_AJOUTEE_V9/g) ?? []).length, 2, 'défini une fois, dit une fois');
  // Le message est celui du coach : à la première personne du coaché, sans mot d'automatisation.
  assert.ok(!/moteur|automat|calcul|lue?\b|écrit/i.test('Trace ajoutée : tes prochaines semaines tiendront compte de ses montées.'));
});
