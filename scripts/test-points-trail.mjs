#!/usr/bin/env node
/**
 * L'INDICE D'ENDURANCE ET LES POINTS FORTS ET FAIBLES EN TRAIL (demande du coach du 25/11/2026) : dans la vue d'ensemble d'un athlète sous la 9.x ; les points se saisissent sur la carte du coach et sur le profil
 * de l'athlète, sur la même fiche ; rien n'en part au moteur. Des athlètes fictifs, sans réseau ni base.
 *
 *   node --test scripts/test-points-trail.mjs
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
const T = await charge('pointsTrail');
const S = await charge('sesCourses');
const C = await charge('carteSavoir');
const profil = await charge('profilEntrainement');
const zones = await charge('zones');
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');

const SANS = { trail_montees: '', trail_descentes: '', trail_technique: '', trail_fin: '' };
const formulaire = (champs) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) for (const x of [].concat(v)) f.append(k, x);
  return f;
};
// La carte envoie des paires (champ, valeur).
const paires = (l) => {
  const f = new FormData();
  for (const [k, v] of l) f.append(k, v);
  return f;
};
const FICHE = { anciennete: '2_5', entrainement: 'plan', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3', cote_min: '12' };

test('les quatre points sont ceux de la question d’avant, qui vaut un point faible tant qu’aucun point n’est donné', async () => {
  const { ACCENTS } = await charge('accentFond');
  assert.deepEqual(T.POINTS_TRAIL.map((p) => p.accent), ACCENTS.map(([cle]) => cle));
  assert.deepEqual(T.pointsTrail(null), SANS);
  assert.deepEqual(T.pointsTrail({ cout_trail: 'descentes' }), { ...SANS, trail_descentes: 'faible' });
  // Un point donné : la réponse d'avant ne compte plus ; une valeur inconnue n'est pas une réponse.
  assert.deepEqual(T.pointsTrail({ cout_trail: 'descentes', trail_montees: 'fort' }), { ...SANS, trail_montees: 'fort' });
  assert.deepEqual(T.pointsTrail({ cout_trail: 'descentes', trail_montees: 'moyen' }), { ...SANS, trail_descentes: 'faible' });
  assert.equal(T.listeDesPoints({ trail_montees: 'faible', trail_technique: 'faible', trail_descentes: 'fort' }, 'faible'), 'Montées, technique');
  assert.equal(T.listeDesPoints({ trail_montees: 'neutre' }, 'fort'), '');
});

test('l’indice d’endurance : celui du style de coureur, coupé à deux chiffres, du même côté de 0,90 que son mot ; rien sans les deux efforts', () => {
  assert.equal(S.indiceDEndurance(null), null);
  assert.equal(S.indiceDEndurance({ coefficient: 0.896, nom: 'Plutôt rapide' }), '0,89 · plutôt rapide');
  assert.equal(S.indiceDEndurance({ coefficient: 0.9, nom: 'Plutôt endurant' }), '0,90 · plutôt endurant');
  assert.equal(S.indiceDEndurance({ coefficient: 0.93, nom: 'Plutôt endurant' }), '0,93 · plutôt endurant');
  const style = zones.profilCoureur({ vc_ms: 3.7, d_prime_m: 180 });
  assert.match(S.indiceDEndurance(style), /^0,\d\d · plutôt (endurant|rapide)$/);
  assert.equal(zones.profilCoureur({ vc_ms: 3.7, d_prime_m: null }), null);
});

test('la vue d’ensemble : l’indice et les deux listes après les repères, « — » sans réponse', () => {
  const v = { cote_min: '12', tapis: 'oui', critere_intensite: '', critere_denivele: '', trail_montees: 'faible', trail_descentes: 'fort', trail_technique: '', trail_fin: 'neutre' };
  assert.deepEqual(S.vueDuCoureur(v, [], { coefficient: 0.93, nom: 'Plutôt endurant' }).slice(4), [
    ['Indice d’endurance', '0,93 · plutôt endurant'], ['Points forts trail', 'Descentes'], ['Points faibles trail', 'Montées'],
  ]);
  assert.deepEqual(S.vueDuCoureur({ ...v, ...SANS }, [], null).slice(4).map(([, x]) => x), ['—', '—', '—']);
  assert.equal(S.vueDuCoureur(v, []).length, 4);
  assert.match(source('app/app/coach/athlete/[id]/page.tsx'), /vueDuCoureur\(carte\.savoir\.valeurs, reperes, profilCoureur\(profilZones\)\)/);
});

test('la carte du coach : les points se lisent sur sa fiche, s’enregistrent, « Neutre » compris ; un point non touché ne s’efface pas', () => {
  const avant = C.valeursDeLaCarte({ fiche: { cout_trail: 'montees' }, intake: { trail_fin: 'fort' }, champs: { trail_technique: 'fort' }, courseDate: '', fc1: null, fc2: null });
  assert.deepEqual([avant.trail_montees, avant.trail_technique, avant.trail_fin], ['faible', '', ''], 'de sa fiche seule');
  const apres = C.completer(avant, { trail_montees: 'neutre', trail_descentes: 'fort' });
  const lu = C.profilAvecLaCarte({ cout_trail: 'montees' }, C.lireSaisieCoureur(paires(C.champsDuCoureur(apres, false))));
  assert.deepEqual([lu.profil.trail_montees, lu.profil.trail_descentes, lu.profil.trail_technique, lu.profil.cout_trail], ['neutre', 'fort', undefined, 'montees']);
  assert.deepEqual(T.pointsTrail(lu.profil), { ...SANS, trail_montees: 'neutre', trail_descentes: 'fort' });
  const rien = C.profilAvecLaCarte({ trail_fin: 'faible' }, C.lireSaisieCoureur(paires([])));
  assert.equal(rien.profil.trail_fin, 'faible');
  assert.match(source('components/app/CarteSavoir.tsx'), /<ChoixPointsTrail titre=\{TEXTES_TRAIL\.son\} valeurs=\{v\} onChange=\{maj\} \/>/);
});

test('le profil de l’athlète et la fiche : les points sont gardés ; un formulaire qui ne les pose pas (8.x) garde ceux d’avant', () => {
  const lu = profil.lireProfil(formulaire({ ...FICHE, trail_montees: 'faible', trail_descentes: 'fort', trail_fin: 'rien' }), 'ton', null, {});
  assert.ok(lu.profil, lu.erreur);
  assert.deepEqual([lu.profil.trail_montees, lu.profil.trail_descentes, lu.profil.trail_fin], ['faible', 'fort', undefined]);
  const huit = profil.lireProfil(formulaire({ ...FICHE, cout_trail: 'fin' }), 'ton', { trail_descentes: 'fort' }, {});
  assert.deepEqual([huit.profil.trail_descentes, huit.profil.cout_trail], ['fort', 'fin']);
  assert.ok(!Object.keys(profil.lireProfil(formulaire(FICHE), 'son', null, {}).profil).some((k) => k.startsWith('trail_')), 'rien de donné, rien de gardé');
});

test('ses lignes en clair : les deux listes remplacent « ce qui coûte le plus » dès qu’un point est donné, et lui seul sinon', () => {
  const titres = (lignes) => lignes.map(([t]) => t).filter((t) => /Points|coûte/.test(t));
  assert.deepEqual(titres(profil.lignesDeLaCarte({ cout_trail: 'montees' })), ['Ce qui te coûte le plus']);
  assert.deepEqual(titres(profil.lignesDeLaCarte({ cout_trail: 'montees', trail_descentes: 'fort', trail_montees: 'faible' })), ['Points forts trail', 'Points faibles trail']);
  assert.deepEqual(titres(profil.lignesDuProfil({ trail_descentes: 'fort' }, true)), ['Points forts trail']);
  assert.deepEqual(titres(profil.lignesDuProfil({ cout_trail: 'montees' }, true)), ['Ce qui coûte le plus']);
});

test('sous la 9.x seulement le formulaire change ; sous la 8.x, la question d’avant ; rien des points ne part au moteur', () => {
  const f = source('components/app/ProfilAthlete.tsx');
  assert.match(f, /\{pointDuDimanche \? \(\s*<>\s*<ChoixPointsTrail titre=\{moi \? TEXTES_TRAIL\.ton : TEXTES_TRAIL\.son\} valeurs=\{pointsTrail\(profil\)\} \/>\s*<input type="hidden" name="cout_trail"/);
  assert.match(f, /\) : \(\s*<label[^>]*>\{moi \? 'Ce qui te coûte le plus en trail' : 'Ce qui lui coûte le plus en trail'\}/);
  for (const envoi of ['lib/app/passeUnPlanV9.ts', 'lib/app/parametresPlanV9.ts', 'lib/app/moteurV9.ts']) assert.ok(!/trail_(montees|descentes|technique|fin)|pointsTrail/.test(source(envoi)), envoi);
});
