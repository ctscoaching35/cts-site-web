#!/usr/bin/env node
/**
 * LA PLUS LONGUE CÔTE, EN MINUTES (décision du coach du 23/11/2026, entrée 188 ; « pas de côte » retiré et plancher de 1 min le 24/11,
 * entrée 191) : la côte de l'athlète se dit toujours en minutes, à la place des quatre cases du terrain ; le tapis qui monte est posé à
 * tous. Les minutes se lisent (une réponse sous 1 min vaut 1 min ; ce qui ne se lit pas est refusé, jamais deviné), se rangent dans la
 * tranche du moteur (`1m30`, `2-5`, `5-10`, `10+`) et donnent l'ancien terrain que lit encore le moteur en ligne ; à l'achat les minutes
 * ne partent pas (il reste sur la 8.474), la 9.0 les lit en `cote_min`. L'achat, la fiche du coaché et la demande de coaching disent la
 * même question, avec la même aide. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-cote.mjs
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
const cote = await import(`${RACINE}lib/cote.ts`);
const plan = await import(`${RACINE}lib/plan.ts`);
const profil = await import(`${RACINE}lib/app/profilEntrainement.ts`);
const regles = await import(`${RACINE}lib/app/coachingRegles.ts`);
const moteurV9 = await import(`${RACINE}lib/app/moteurV9.ts`);

const lire = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');

// ─── La lecture ─────────────────────────────────────────────────────────────────────────────────────

test('lireCote : « 12 », « 12,5 », « 12 min », un nombre ; arrondi au dixième', () => {
  for (const [brut, attendu] of [['12', 12], ['12,5', 12.5], ['12.5', 12.5], [' 12 min ', 12], ['12 minutes', 12], [12, 12], [1.5, 1.5], ['1', 1],
    ['12,34', 12.3], ['240', 240]]) assert.equal(cote.lireCote(brut), attendu, String(brut));
});

test('lireCote : le plancher est 1 min, comme le moteur (24/11/2026) : une réponse plus courte, 0 compris, vaut 1 min, elle n’est pas refusée', () => {
  assert.equal(cote.COTE_PLANCHER_MIN, 1);
  for (const brut of ['0,5', '0.75', '0', 0, 0.5, '0,9', '0,04']) assert.equal(cote.lireCote(brut), 1, String(brut));
});

test('lireCote : ce qui ne se lit pas n’est pas deviné, et « pas de côte » n’est plus une réponse', () => {
  for (const brut of ['', '   ', null, undefined, 'abc', 'douze', '-3', -3, '241', 241, NaN, Infinity, '1,2,3', '12 h', '12 km', '1m30', 'aucune', 'Aucune', 'pas de côte', {}, [], true])
    assert.equal(cote.lireCote(brut), null, JSON.stringify(brut));
});

// ─── Les tranches et l'ancien terrain ───────────────────────────────────────────────────────────────

test('coteMaxDe : jusqu’à 1 min 30, moins de 5, moins de 10, 10 et plus ; sous 1 min, la plus courte', () => {
  for (const [minutes, tranche] of [[0.5, '1m30'], [0, '1m30'], [1, '1m30'], [1.5, '1m30'], [1.6, '2-5'], [2, '2-5'], [4.9, '2-5'], [5, '5-10'], [9.9, '5-10'], [10, '10+'],
    [45, '10+'], [240, '10+'], ['12', '10+'], ['4,5', '2-5']]) assert.equal(cote.coteMaxDe(minutes), tranche, String(minutes));
  for (const brut of ['', null, 'abc', 'aucune', 241]) assert.equal(cote.coteMaxDe(brut), null, String(brut));
});

test('terrainDeLaCote : les quatre valeurs que lit le moteur en ligne, et rien quand la réponse ne se lit pas', () => {
  assert.deepEqual(cote.TERRAIN_DE_COTE, { '1m30': 'vallonne', '2-5': 'intermediaire', '5-10': 'pentu', '10+': 'tres_pentu' });
  for (const [minutes, terrain] of [[0.5, 'vallonne'], [1, 'vallonne'], [3, 'intermediaire'], [7, 'pentu'], [12, 'tres_pentu']]) assert.equal(cote.terrainDeLaCote(minutes), terrain, String(minutes));
  assert.equal(cote.terrainDeLaCote(''), null);
  assert.equal(cote.terrainDeLaCote('douze'), null);
  // Les quatre valeurs sont celles des anciennes cases : un profil d'avant se relit.
  assert.deepEqual(plan.textes.terrain.options.map((o) => o.valeur), Object.values(cote.TERRAIN_DE_COTE));
});

test('coteEnClair : « 12 min », « 1,5 min », « 1 min » sous le plancher ; rien quand elle manque', () => {
  assert.equal(cote.coteEnClair('12'), '12 min');
  assert.equal(cote.coteEnClair(1.5), '1,5 min');
  assert.equal(cote.coteEnClair('0,5'), '1 min', 'ce que lit le moteur');
  assert.equal(cote.coteEnClair('aucune'), null);
  assert.equal(cote.coteEnClair(''), null);
  assert.equal(cote.coteEnClair(undefined), null);
});

test('la 9.0 lit les minutes (cote_min, d’au moins 1) ; leur tranche (cote_max) reste celle de la transition', () => {
  const base = { format: 'TM', distance_km: '45', dplus_m: '2000' };
  for (const [minutes, tranche] of [[1, '1m30'], [3, '2-5'], [7, '5-10'], [12, '10+']]) {
    assert.equal(moteurV9.parametresV9(base, { cote_max: cote.coteMaxDe(minutes) }).cote_max, tranche, String(minutes));
    assert.strictEqual(moteurV9.parametresV9({ ...base, cote_min: String(minutes) }).cote_min, minutes, String(minutes));
  }
  assert.strictEqual(moteurV9.parametresV9({ ...base, cote_min: '0,5' }).cote_min, 1, 'sous 1 min, 1 : le plancher du moteur');
});

// ─── Le texte ───────────────────────────────────────────────────────────────────────────────────────

test('la question est celle du coach (23/11/2026), mot pour mot, la même partout', () => {
  assert.equal(cote.TEXTES_COTE.question,
    'Ta plus longue côte près de chez toi : combien de minutes pour la monter de bas en haut, en trottinant à ton allure d’endurance (tu peux parler), sans t’arrêter ? Si elle est trop raide pour trottiner, compte en marchant vite. Si tu ne sais pas, chronomètre-la à ta prochaine sortie.');
  assert.equal(cote.TEXTES_COTE.aide, 'Pas de vraie côte ? Pense à un pont, une rampe de parking ou des escaliers.');
  assert.ok(!('aucune' in cote.TEXTES_COTE) && !('sansCoteSon' in cote.TEXTES_COTE), '« je n’ai pas de côte » n’est plus une réponse (24/11/2026)');
  assert.ok(!('SANS_COTE' in cote));
  assert.equal(cote.TEXTES_COTE.tapis, 'As-tu accès à un tapis de course qui monte ?');
  assert.equal(plan.textes.cote, cote.TEXTES_COTE, 'l’achat');
  assert.equal(regles.QUESTIONS_COACHING.terrain.cote, cote.TEXTES_COTE, 'la demande de coaching');
});

// ─── L'achat ────────────────────────────────────────────────────────────────────────────────────────

const ACHAT = { ...plan.champsVides, nom: 'Essai', niveau: 'intermediaire', format: 'TM', distance_km: '45', dplus_m: '2000', blessure: 'non', coeur: 'non' };

test('achat : la côte en minutes donne l’ancien terrain, et les minutes ne partent pas au moteur', () => {
  assert.equal(plan.champsVides.cote_min, '');
  for (const [minutes, terrain] of [['1', 'vallonne'], ['0,5', 'vallonne'], ['3', 'intermediaire'], ['7', 'pentu'], ['12', 'tres_pentu']]) {
    for (const criteres of [false, true]) {
      const intake = plan.intakeSelon({ ...ACHAT, cote_min: minutes }, criteres);
      assert.equal(intake.terrain, terrain, `${minutes} min`);
      assert.ok(!('cote_min' in intake), 'la clé des minutes ne part pas tant que le contrat ne l’a pas écrite');
    }
  }
  assert.equal(plan.intakePourApi({ ...ACHAT, cote_min: '12' }).terrain, 'tres_pentu');
});

test('achat : sans minutes lues, le terrain d’avant reste (un profil d’avant, la route) ; les minutes l’emportent sinon', () => {
  assert.equal(plan.intakeSelon({ ...ACHAT, terrain: 'pentu' }, false).terrain, 'pentu');
  assert.equal(plan.intakeSelon({ ...ACHAT, terrain: 'pentu', cote_min: 'douze' }, false).terrain, 'pentu');
  assert.equal(plan.intakeSelon({ ...ACHAT, terrain: 'pentu', cote_min: '2' }, false).terrain, 'intermediaire');
  assert.equal(plan.intakeSelon({ ...ACHAT, format: 'R10', terrain: 'vallonne' }, false).terrain, 'vallonne', 'la route garde son terrain par défaut');
  assert.equal(plan.intakeSelon(ACHAT, false).terrain, '', 'rien : le moteur dit qu’il manque le terrain');
});

test('achat : le tapis part comme avant, posé à tous', () => {
  assert.equal(plan.intakeSelon({ ...ACHAT, cote_min: '12', tapis: 'oui' }, false).tapis, 'oui');
  assert.equal(plan.intakeSelon({ ...ACHAT, cote_min: '1', tapis: 'non' }, false).tapis, 'non');
});

test('achat : le formulaire pose la côte en minutes et le tapis à tous (plus de quatre cases ni de tapis sous 5 min)', () => {
  const q = lire('components/plan/Questionnaire.tsx');
  assert.ok(q.includes('textes.cote.question'));
  assert.ok(q.includes('name="tapis"') && q.includes('textes.cote.tapis'));
  assert.ok(!q.includes('name="terrain"'), 'les quatre cases du terrain ne sont plus posées');
  assert.ok(!/c\.terrain === 'vallonne'/.test(q), 'le tapis ne dépend plus de la côte courte');
  assert.ok(/id="cote"[^>]*\n?[^>]*required value=\{c\.cote_min\}/.test(q), 'toujours un nombre : le champ est obligatoire');
  assert.ok(q.includes('textes.cote.aide'), 'l’aide sous la question');
  assert.ok(!q.includes('SANS_COTE') && !q.includes('textes.cote.aucune') && !q.includes('type="checkbox" checked={c.cote_min'), 'plus de « Je n’ai pas de côte »');
  assert.ok(q.includes("coteEnClair(c.cote_min)"), 'le récapitulatif dit la côte');
  assert.ok(!plan.textes.terrain.tapis, 'le tapis n’est plus un texte du terrain');
});

// ─── La fiche du coaché et le profil ────────────────────────────────────────────────────────────────

const formulaire = (champs) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) for (const x of [].concat(v)) f.append(k, x);
  return f;
};
const BASE_FORM = { anciennete: '2_5', entrainement: 'plan', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3' };
const profilLu = (extra, pour = 'son') => profil.lireProfil(formulaire({ ...BASE_FORM, ...extra }), pour, null, {});

test('fiche : sa côte en minutes est gardée, avec l’ancien terrain qu’elle donne', () => {
  const r = profilLu({ cote_min: '12' });
  assert.ok(r.profil, r.erreur);
  assert.equal(r.profil.cote_min, '12');
  assert.equal(r.profil.terrain, 'tres_pentu');
  const virgule = profilLu({ cote_min: '4,5' });
  assert.equal(virgule.profil.cote_min, '4.5');
  assert.equal(virgule.profil.terrain, 'intermediaire');
});

test('fiche : sous 1 min, le profil garde 1 min (le plancher du moteur) ; « pas de côte » n’est plus une réponse', () => {
  for (const brut of ['0,5', '0']) {
    const r = profilLu({ cote_min: brut });
    assert.equal(r.profil.cote_min, '1', brut);
    assert.equal(r.profil.terrain, 'vallonne', brut);
  }
  assert.ok(profilLu({ sans_cote: 'oui' }).erreur, 'la case n’existe plus : sans nombre, la phrase de ce qui manque');
  assert.equal(profilLu({ sans_cote: 'oui', cote_min: '12' }).profil.cote_min, '12', 'l’ancien champ de la case est ignoré');
});

test('fiche : sans nombre lu, la phrase de ce qui manque ; les quatre cases d’avant ne sont plus lues', () => {
  const son = profilLu({});
  assert.equal(son.erreur, cote.TEXTES_COTE.illisibleSa);
  assert.equal(profilLu({}, 'ton').erreur, cote.TEXTES_COTE.illisibleCoache);
  assert.ok(!/pas de côte/i.test(cote.TEXTES_COTE.illisible + cote.TEXTES_COTE.illisibleCoache + cote.TEXTES_COTE.illisibleSa), 'la phrase ne renvoie plus à une case « pas de côte »');
  for (const brut of ['douze', '-2', '300', 'aucune']) assert.ok(profilLu({ cote_min: brut }).erreur, brut);
  assert.ok(profilLu({ terrain: 'pentu' }).erreur, 'l’ancien champ seul ne suffit plus');
});

test('fiche : le tapis reste facultatif', () => {
  assert.equal(profilLu({ cote_min: '12', tapis: 'oui' }).profil.tapis, 'oui');
  assert.equal(profilLu({ cote_min: '12' }).profil.tapis, 'non');
});

test('fiche : le profil se relit en clair, ses minutes ou, à défaut, sa réponse d’avant', () => {
  const nouveau = { niveau: 'intermediaire', terrain: 'tres_pentu', cote_min: '12', tapis: 'oui', jours_disponibles: ['mardi'], jour_sl: 'mardi', freq_hebdo: '1' };
  const dAvant = { niveau: 'intermediaire', terrain: 'pentu', tapis: 'non', jours_disponibles: ['mardi'], jour_sl: 'mardi', freq_hebdo: '1' };
  const ligne = (lignes, titre) => lignes.find(([t]) => t === titre)?.[1];
  assert.equal(ligne(profil.lignesDuProfil(nouveau, true), 'Plus longue côte'), '12 min · un tapis qui monte');
  assert.equal(ligne(profil.lignesDuProfil(dAvant, true), 'Terrain'), 'Pentu');
  assert.equal(ligne(profil.lignesDeLaCarte(nouveau), 'Plus longue côte'), '12 min · un tapis qui monte');
  assert.equal(ligne(profil.lignesDeLaCarte({ ...nouveau, cote_min: '0,5', tapis: 'non' }), 'Plus longue côte'), '1 min', 'ce que lit le moteur');
  assert.equal(ligne(profil.lignesDeLaCarte(dAvant), 'Terrain'), 'Pentu');
  assert.equal(ligne(profil.lignesDeLaCarte({ niveau: 'intermediaire' }), 'Terrain'), undefined, 'ni minutes ni ancien terrain : pas de ligne');
});

test('fiche : le profil du questionnaire reprend les minutes avec le terrain', () => {
  const repris = profil.profilPourLeQuestionnaire({ niveau: 'intermediaire', terrain: 'pentu', cote_min: '7', tapis: 'oui', cout_trail: 'montees' });
  assert.equal(repris.cote_min, '7');
  assert.equal(repris.terrain, 'pentu');
  assert.ok(!('cout_trail' in repris));
});

test('fiche : le formulaire demande les minutes, pas les quatre cases', () => {
  const f = lire('components/app/ProfilAthlete.tsx');
  assert.ok(f.includes('name="cote_min"') && f.includes('textes.cote.aide'));
  assert.ok(!f.includes('name="sans_cote"') && !f.includes('SANS_COTE') && !f.includes('textes.cote.aucune'), 'plus de « pas de côte »');
  assert.ok(!f.includes('name="terrain"'));
  assert.ok(f.includes('textes.cote.sa'), 'le coach lit « Sa plus longue côte, en minutes »');
  assert.ok(!/moins de 5 min/.test(f), 'le tapis n’est plus lié à une côte de moins de 5 min');
});

// ─── La demande de coaching ─────────────────────────────────────────────────────────────────────────

const ENVOI = () => ({
  nom: 'Clara Test', naissance: '1988', ville: 'Rennes', course_depuis: '3_5', experience_trail: 'intermediaire', courses_marquantes: '',
  seances: '4', heures: '5,5', longue: '2 h 30', terrain: ['chemins', 'escaliers'], dplus_pres: '300 m', montagne: 'quelques_we',
  objectif: { kind: 'aucune' }, vise: 'chrono', vise_autre: '', jours: ['mar', 'jeu', 'sam'], temps_seance: '45_60', jour_sl: 'sam', montre: 'gps_fc',
  nolio: 'sais_pas', attentes: '', telephone: '06 12 34 56 78', moments: ['lun_soir'], mot: '', consentement_sante: false, sante: '',
});
const OPTIONS = { experienceConnue: null, anneeCourante: 2026, coursesDuCompte: [] };
const demande = (changement) => regles.lireDemande({ ...ENVOI(), ...changement }, OPTIONS);

test('coaching : « Montées de plus de 10 minutes » et « Côtes courtes » ne sont plus des cases ; la côte en minutes se lit', () => {
  const titres = regles.QUESTIONS_COACHING.terrain.presChoix.map((c) => c.titre);
  assert.deepEqual(titres, ['Route ou plat', 'Chemins', 'Escaliers', 'Tapis de course'], 'la rubrique « Ton terrain » du coach (24/11/2026)');
  assert.equal(demande({ cote_min: '12' }).demande.reponses.cote_min, '12');
  assert.equal(demande({ cote_min: '12,5' }).demande.reponses.cote_min, '12.5');
  assert.equal(demande({ cote_min: 7 }).demande.reponses.cote_min, '7');
  assert.equal(demande({ cote_min: '0,5' }).demande.reponses.cote_min, '1', 'sous 1 min, 1 : le plancher du moteur');
});

test('coaching : la côte est facultative, mais jamais devinée', () => {
  for (const vide of [undefined, '', '  ', null]) {
    const r = demande({ cote_min: vide });
    assert.ok(r.ok, String(vide));
    assert.equal(r.demande.reponses.cote_min, '');
  }
  for (const brut of ['douze', '-1', '999', 'aucune', 'pas de côte']) {
    const r = demande({ cote_min: brut });
    assert.equal(r.ok, false, brut);
    assert.equal(r.message, cote.TEXTES_COTE.illisible);
  }
});

test('coaching : les anciennes cases ne sont plus acceptées à l’envoi, mais une demande d’avant se relit sous leur titre', () => {
  const r = demande({ terrain: ['chemins', 'montees_longues', 'cotes_courtes', 'escaliers'], cote_min: '12' });
  assert.deepEqual(r.demande.reponses.terrain, ['chemins', 'escaliers']);
  assert.equal(regles.enClair.terrain('montees_longues'), 'Montées de plus de 10 minutes');
  assert.equal(regles.enClair.terrain('cotes_courtes'), 'Côtes courtes', 'une demande déjà envoyée la garde en lecture');
  assert.equal(regles.enClair.terrain('chemins'), 'Chemins');
  assert.equal(regles.enClair.cote('12'), '12 min');
  assert.equal(regles.enClair.cote(undefined), null, 'une demande d’avant ne donne pas la côte');
});

test('coaching : le formulaire pose la côte, le coach la lit', () => {
  assert.ok(lire('components/app/FormulaireCoaching.tsx').includes('<Cote valeur={v.cote_min}'));
  assert.ok(lire('components/app/FormulaireCoaching.tsx').includes('Q.terrain.cote.aide'), 'l’aide sous la question');
  assert.ok(!lire('components/app/FormulaireCoaching.tsx').includes('SANS_COTE'), 'plus de « Je n’ai pas de côte »');
  assert.ok(lire('components/app/FormulaireCoaching.tsx').includes('cote_min: v.cote_min'), 'elle part avec la demande');
  assert.ok(lire('components/app/DemandeLue.tsx').includes('enClair.cote(r.cote_min)'));
});
