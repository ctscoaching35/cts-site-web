#!/usr/bin/env node
/**
 * LA RELECTURE DE L'APP COACH (25/11/2026, « je te laisse tout corriger ») : les petites fautes d'affichage, la pastille qui compte les lignes qui attendent, la carte complète repliée, et les deux phrases
 * lues par l'athlète qui disaient autre chose que ce que fait le moteur v1. Des athlètes fictifs, sans réseau ni base. Sous la 8.x, rien ne change.
 *
 *   node --test scripts/test-relecture-app-coach.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const MONDE = pathToFileURL(`${RACINE}scripts/_monde-app-gratuite.mjs`).href;
const REMPLACES = ['/lib/app/contexte.ts', '/lib/app/demandes.ts', '/lib/app/demonstrationPorte.ts', '/lib/app/nolio.ts', '/lib/app/supabase.ts'];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(next\/(headers|navigation|cache)|react)$/.test(specifier)) return { url: MONDE, shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    let r;
    try {
      r = nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) r = nextResolve(`${specifier}.ts`, context);
      else throw e;
    }
    return REMPLACES.some((f) => r.url.endsWith(f)) ? { url: MONDE, shortCircuit: true } : r;
  },
});
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const { deQui } = await charge('elision');
const { motsDuCoach } = await charge('motsDuCoach');
const { attendLeCoach, unMot } = await charge('unMot');
const zones = await charge('zones');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

test('« d’Antoine » et « de Marie » : « de » s’élide devant une voyelle ou un h', () => {
  for (const nom of ['Antoine Martin', 'Élodie', 'Inès', 'Hugo', 'Yves', 'Océane']) assert.equal(deQui(nom), `d’${nom}`);
  for (const nom of ['Marie', 'Chloé Garnier', 'Yann', 'Yohann']) assert.equal(deQui(nom), `de ${nom}`);
  const page = source('app/app/coach/athlete/[id]/page.tsx');
  assert.ok(page.includes('Retirer l’accord {v9 ? deQui(a.nom) : `de ${a.nom}`}'), 'sous la 8.x, la phrase d’avant');
  assert.ok(source('components/app/ActionsDemande.tsx').includes('Accepter la demande {deQui(nom)} ?'));
});

test('les cibles de l’objectif : « FC seuil 1 à 152 », qui ne se lit plus « 1 152 » ; sous la 8.x, les mots d’avant', () => {
  assert.equal(motsDuCoach(true).cibles.fc1('152'), 'FC seuil 1 à 152');
  assert.equal(motsDuCoach(true).cibles.fc2('172'), 'FC seuil 2 à 172');
  assert.equal(motsDuCoach(false).cibles.fc1('152'), 'FC seuil 1 152');
});

test('une ligne attend le coach tant que son mot est un geste, « Il manque » compris ; ni « Rien à faire », ni « À la main », ni « Partie »', () => {
  const BASE = {
    id: 'a1', nolio: true, accord: true, aLaMain: false, objectif: { plan_id: 'p', demarre: true, prevu: null, partie: true },
    points: [], manque: null, gesteDuManque: null, test: null, sansReponse: false,
  };
  const attend = (x) => attendLeCoach(unMot({ ...BASE, ...x }));
  for (const x of [{ manque: 'son tapis' }, { objectif: null }, { objectif: { ...BASE.objectif, demarre: false } }, { sansReponse: true }, { nolio: false }]) assert.equal(attend(x), true, JSON.stringify(x));
  for (const x of [{}, { aLaMain: true }, { objectif: { ...BASE.objectif, partie: null } }]) assert.equal(attend(x), false, JSON.stringify(x));
});

test('sur sa page, « Rien à faire pour lui » ne s’affiche plus quand sa ligne attend un geste', () => {
  assert.match(source('components/app/PointsPourLui.tsx'), /if \(n === 0 && attend\) return null;/);
  assert.ok(source('app/app/coach/athlete/[id]/page.tsx').includes('attend={espace.mots.some((m) => m.id === a.id && attendLeCoach(m.un))}'));
});

test('sous la v1, le style de coureur dit ce que le moteur en fait : tour à tour le point faible et le point fort loin de la course, la course près d’elle', () => {
  const rapide = zones.conseilsV1(true);
  const endurant = zones.conseilsV1(false);
  assert.equal(rapide.loin, 'Ta préparation travaille tour à tour ton point faible, les efforts longs et soutenus, et ton point fort, les efforts courts et rapides.');
  assert.equal(endurant.loin, 'Ta préparation travaille tour à tour ton point faible, les efforts courts et rapides, et ton point fort, les efforts longs et soutenus.');
  assert.equal(rapide.pres, endurant.pres);
  assert.ok(!/point fort|point faible/.test(rapide.pres), 'près de la course, le profil ne décide plus');
  // Sans préparation que le moteur écrit (un acheteur, un coaché à la main) : pas un mot d'une préparation.
  assert.ok(!/préparation/.test(zones.STYLE_SANS_TEST_V1.sans));
  const c = source('components/app/ZonesEtStyle.tsx');
  assert.match(c, /const conseils = !coureur \|\| v1 === 'sans' \? null : v1 \? conseilsV1\(coureur\.coefficient < 0\.9\) : coureur;/);
  assert.ok(source('app/app/profil/page.tsx').includes("v1={v9 ? (ctx.coache && !ctx.aLaMain ? 'ecrite' : 'sans') : null}"), 'sous la 8.x, les textes d’avant');
});

test('après l’enregistrement de son profil, sous la 9.x : sa côte et son tapis comptent tout de suite ; sous la 8.x, le message d’avant', () => {
  const a = source('lib/app/actionsObjectifs.ts');
  const geste = a.slice(a.indexOf('export async function modifierMonProfil'));
  assert.ok(geste.includes("? 'C’est enregistré : ta plus longue côte et ton tapis comptent dès la prochaine semaine écrite ; le reste servira à ton prochain objectif.'"));
  assert.ok(geste.includes(": 'C’est enregistré : ton prochain objectif partira de ce profil ; ta préparation en cours garde le sien.'"));
});
