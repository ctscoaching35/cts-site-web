#!/usr/bin/env node
/**
 * LE SITE ALIGNÉ SUR LA DOCTRINE REFONDUE (consigne App du 21/11/2026, doctrine revalidée du 18 au 23/11) : les quatre classes de
 * course et leurs seuils, la lecture d'une classe d'avant ou d'un autre nom, le temps minimum par format (seules les formules qui
 * tiennent avant la course, plus de plan rejoint à l'achat, la phrase quand aucune ne tient), l'attestation sur l'honneur par
 * format (sans refus, sans invitation à échanger avec le coach), et les deux questions des critères, préparées mais PAS
 * branchées (l'intake reste celui d'aujourd'hui). Des cas fictifs, sans réseau ; la configuration reprend /v1/config du moteur
 * 8.474 en ligne (relevée le 23/11/2026).
 *
 *   node --test scripts/test-doctrine-21-11.mjs
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
const plan = await import(`${RACINE}lib/plan.ts`);
const attestation = await import(`${RACINE}lib/attestation.ts`);
const criteres = await import(`${RACINE}lib/criteres.ts`);
const courseLibre = await import(`${RACINE}lib/app/courseLibre.ts`);
const liste = await import(`${RACINE}lib/app/listeEmail.ts`);
const carte = await import(`${RACINE}lib/app/carteStory.ts`);

const lire = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');
const SANS_TRACE = JSON.parse(lire('scripts/fixtures/course-libre-sans-trace.json'));

// ─── Les quatre classes ─────────────────────────────────────────────────────────────────────────────

test('classes : quatre, dans l’ordre de la doctrine', () => {
  assert.deepEqual(courseLibre.CLASSES, ['roulant', 'vallonne', 'montagne', 'montagne_raide']);
  assert.deepEqual(Object.keys(carte.CLASSE_COURTE), courseLibre.CLASSES);
  assert.equal(carte.CLASSE_COURTE.montagne_raide, 'de montagne raide');
});

test('classes : une clé d’avant ou d’un autre nom se ramène aux quatre ; une clé inconnue reste inconnue', () => {
  const { lireClasse } = courseLibre;
  for (const [brut, attendu] of [
    ['roulant', 'roulant'], ['roulante', 'roulant'], ['vallonne', 'vallonne'], ['vallonnee', 'vallonne'], ['Vallonné', 'vallonne'],
    ['montagne', 'montagne'], ['montagne_raide', 'montagne_raide'], ['Montagne raide', 'montagne_raide'], ['montagne-raide', 'montagne_raide'],
    ['raide', 'montagne_raide'], ['très raide', 'montagne_raide'],
  ]) assert.equal(lireClasse(brut), attendu, String(brut));
  for (const inconnu of ['plate', '', null, undefined, 3, {}]) assert.equal(lireClasse(inconnu), null, String(inconnu));
});

test('classes : une réponse du moteur se range sous la clé d’aujourd’hui, une classe inconnue la fait refuser', () => {
  const avec = (classe) => ({ ...SANS_TRACE, course: { ...SANS_TRACE.course, classe } });
  assert.equal(courseLibre.reponseSure(avec('vallonnee')).course.classe, 'vallonne', 'une réponse d’avant le changement de noms');
  assert.equal(courseLibre.reponseSure(avec('montagne_raide')).course.classe, 'montagne_raide');
  assert.equal(courseLibre.reponseSure(avec('raide')).course.classe, 'montagne_raide');
  assert.equal(courseLibre.reponseSure(avec('inconnue')), null);
});

test('classes : l’attribut Brevo suit les seuils 10, 30 et 50 m/km, bornes basses incluses', () => {
  const type = (densite) => liste.typeDeCourse(10, densite * 10);
  assert.equal(type(0), 'roulant');
  assert.equal(type(9.9), 'roulant');
  assert.equal(type(10), 'vallonne');
  assert.equal(type(29.9), 'vallonne');
  assert.equal(type(30), 'montagne');
  assert.equal(type(49.9), 'montagne');
  assert.equal(type(50), 'montagne_raide');
  assert.equal(type(120), 'montagne_raide');
  assert.equal(liste.typeDeCourse(0, 100), null);
  assert.equal(liste.typeDeCourse(10, -1), null);
});

test('classes : l’échelle de la carte de course dit les quatre noms et leurs seuils', () => {
  const source = lire('components/app/courses/BlocsCourse.tsx');
  for (const phrase of ['Roulant', 'moins de 10 m/km', 'Vallonné', '10 à 30 m/km', 'Montagne', '30 à 50 m/km', 'Montagne raide', '50 m/km et plus'])
    assert.ok(source.includes(phrase), phrase);
  assert.ok(!/moins de 20 m\/km|20 à 40 m\/km|plus de 40 m\/km/.test(source), 'plus aucun seuil d’avant');
});

// ─── Le temps minimum par format ────────────────────────────────────────────────────────────────────

// /v1/config du moteur 8.474, les clés dont le temps minimum se sert.
const CONFIG = {
  formats: [
    { code: 'TC', nom: 'Trail Court', bornes: 'moins de 30 km' }, { code: 'TM', nom: 'Trail Marathon', bornes: '30 à 60 km' },
    { code: 'TL', nom: 'Trail Long', bornes: '60 à 100 km' }, { code: 'UT', nom: 'Ultra-Trail', bornes: 'plus de 100 km' },
  ],
  durees_par_format: { TC: [3, 4], TL: [4, 6], TM: [3, 4, 6], UT: [6] },
  semaines_par_formule: { 'TC-3': 12, 'TC-4': 16, 'TL-4': 16, 'TL-6': 24, 'TM-3': 12, 'TM-4': 16, 'TM-6': 24, 'UT-6': 24 },
  bandes_temps_cible: { bornes_h: [2, 4, 8], libelles: [], phrases_bornes: [], marge_min: 15 },
  mois_par_bande: [[3, 4], [3, 4, 6], [4, 6], [6]],
  quatre_mois_jusqua_h: 10,
  prix_eur_par_mois: { 3: 39, 4: 49, 6: 59 },
};
// Lundi 23/11/2026, 11 h à Paris.
const AUJOURDHUI = new Date('2026-11-23T10:00:00Z');
const course = (format, temps_cible, date_course) => ({ ...plan.champsVides, format, temps_cible, date_course });
const proposees = (c) => plan.dureesProposees(c, CONFIG, AUJOURDHUI);

test('temps minimum : les semaines minimales de la doctrine viennent de la configuration (12, 12, 16, 24)', () => {
  assert.equal(plan.semainesMinimum(course('TC', '1h30', ''), CONFIG), 12);
  assert.equal(plan.semainesMinimum(course('TM', '5h', ''), CONFIG), 12, 'un trail marathon de 4 à 8 h : le 3 mois reste admis quand le 4 mois ne tient plus');
  assert.equal(plan.semainesMinimum(course('TL', '5h', ''), CONFIG), 16);
  assert.equal(plan.semainesMinimum(course('UT', '20h', ''), CONFIG), 24);
});

test('temps minimum : seules les formules qui tiennent avant la course sont proposées', () => {
  // Trail Court de moins de 2 h : 3 et 4 mois. Course loin (19 semaines) : les deux tiennent.
  assert.deepEqual(proposees(course('TC', '1h30', '2027-04-04')), [3, 4]);
  // 15 semaines : le 4 mois (16) a déjà commencé, le 3 mois (12) tient.
  assert.deepEqual(proposees(course('TC', '1h30', '2027-03-07')), [3]);
  // 16 semaines pile : le 4 mois commence aujourd'hui même (première séance demain), il tient encore.
  assert.deepEqual(proposees(course('TC', '1h30', '2027-03-14')), [3, 4]);
  // Une formule qui commence aujourd'hui même tient (première séance demain), comme avant.
  assert.deepEqual(proposees(course('TC', '1h30', '2027-02-14')), [3]);
  // 10 semaines : plus rien ne tient.
  assert.deepEqual(proposees(course('TC', '1h30', '2027-02-07')), []);
  // Un ultra demande 24 semaines : à 20 semaines, rien ; à 32, le 6 mois.
  assert.deepEqual(proposees(course('UT', '20h', '2027-04-18')), []);
  assert.deepEqual(proposees(course('UT', '20h', '2027-07-04')), [6]);
  // Un Trail Long de 4 à 8 h (4 et 6 mois) : le 4 mois à 18 semaines, le 6 mois en plus à 26.
  assert.deepEqual(proposees(course('TL', '5h', '2027-03-28')), [4]);
  assert.deepEqual(proposees(course('TL', '5h', '2027-06-06')), [4, 6]);
});

test('temps minimum : plus de plan rejoint à l’achat, plus de plafond « la formule qui colle à la date »', () => {
  // Avant le 21/11/2026, une course à 20 semaines proposait aussi le 6 mois, rejoint en route : il ne tient pas, il n'est plus proposé.
  assert.deepEqual(proposees(course('TM', '6h', '2027-04-11')), [4], 'le 6 mois (24 semaines) a déjà commencé');
  for (const c of [course('TC', '1h30', '2027-03-07'), course('TC', '1h30', '2027-03-14'), course('TM', '6h', '2027-04-11'), course('UT', '20h', '2027-07-04')]) {
    for (const mois of proposees(c)) {
      const f = plan.debutFormule(c, CONFIG, mois, AUJOURDHUI);
      assert.equal(f.rejointe, null, `${c.format} ${mois} mois : une formule proposée commence entière`);
      assert.ok(f.debut >= '2026-11-23', 'son lundi de départ n’est pas passé');
    }
  }
});

test('temps minimum : le 3 mois d’une course de 4 à 8 h remplace le 4 mois quand celui-ci ne tient plus', () => {
  // Trail Marathon de 4 à 8 h : 4 et 6 mois seulement. À 14 semaines, le 4 mois (16) ne tient pas, le 3 mois (12) tient.
  assert.deepEqual(proposees(course('TM', '7h30', '2027-02-28')), [3]);
  // À 19 semaines, le 4 mois tient : pas de 3 mois (une course de 4 à 8 h ne se prépare pas en 3 mois quand on peut mieux).
  assert.deepEqual(proposees(course('TM', '7h30', '2027-04-04')), [4]);
  assert.equal(plan.troisMoisEnPlus(course('TM', '7h30', '2027-02-28'), CONFIG, AUJOURDHUI), true);
  assert.equal(plan.troisMoisEnPlus(course('TM', '7h30', '2027-04-04'), CONFIG, AUJOURDHUI), false);
  // Sous 12 semaines, le 3 mois ne tient pas non plus.
  assert.deepEqual(proposees(course('TM', '7h30', '2027-02-07')), []);
});

test('temps minimum : sans date de course lisible, rien ne se juge', () => {
  assert.deepEqual(proposees(course('TC', '1h30', '')), [3, 4]);
  assert.equal(plan.messageTempsMinimum(course('TC', '1h30', ''), CONFIG, AUJOURDHUI), null);
});

test('temps minimum : la phrase quand aucune formule ne tient — course plus lointaine ou coaching, avant le paiement', () => {
  const m = (c) => plan.messageTempsMinimum(c, CONFIG, AUJOURDHUI);
  assert.equal(m(course('TC', '1h30', '2027-02-07')),
    'Pour un Trail Court de ce temps, la préparation dure au moins 12 semaines : ta course est dans 10 semaines. Choisis une course plus lointaine, ou regarde le coaching individualisé.');
  assert.match(m(course('UT', '20h', '2027-04-18')), /Ultra-Trail.*au moins 24 semaines.*dans 20 semaines/);
  assert.match(m(course('TL', '5h', '2027-03-07')), /Trail Long.*au moins 16 semaines/);
  // Pas de phrase quand une formule tient, ni sans format.
  assert.equal(m(course('TC', '1h30', '2027-04-04')), null);
  assert.equal(m(course('', '1h30', '2027-02-07')), null);
  // Aucune invitation à échanger avec le coach : le coaching est un renvoi avant l'achat, pas un échange sur l'entraînement.
  for (const c of [course('TC', '1h30', '2027-02-07'), course('UT', '20h', '2027-04-18')])
    assert.ok(!/écris-nous|parle|échang|contacte|appelle|réponds/i.test(m(c)), m(c));
});

test('temps minimum : « moins d’une semaine » et le pluriel', () => {
  // Course dans 6 jours : plus rien ne tient, et le temps restant s'accorde.
  const dit = plan.messageTempsMinimum(course('TC', '1h30', '2026-11-29'), CONFIG, AUJOURDHUI);
  assert.match(dit, /dans moins d’une semaine/);
  assert.match(plan.messageTempsMinimum(course('TC', '1h30', '2026-12-06'), CONFIG, AUJOURDHUI), /dans 1 semaine\./);
});

test('temps minimum : l’avertissement d’un plan « commencé il y a… » n’existe plus', () => {
  const c = { ...course('TM', '6h', '2027-02-28'), duree_mois: '6', niveau: 'intermediaire', freq_hebdo: '4', distance_km: '45', dplus_m: '2000' };
  assert.deepEqual(plan.avertissements(c, { ...CONFIG, semaines_par_formule: CONFIG.semaines_par_formule }, AUJOURDHUI), []);
  const source = lire('components/plan/Questionnaire.tsx');
  assert.ok(!/Déjà commencée|rejoins en semaine|Formule déjà commencée|se rejoint en route/.test(source), 'le questionnaire ne parle plus de formule rejointe');
  assert.ok(!/plan de \$\{c\.duree_mois\} mois a commencé/.test(lire('lib/plan.ts')));
});

test('temps minimum : la page des plans dit les semaines minimales et plus les règles retirées', () => {
  const contenu = lire('lib/content.ts');
  assert.match(contenu, /12 semaines pour un Trail Court ou un Trail Marathon, 16 pour un Trail Long, 24 pour un ultra/);
  assert.ok(!/formats ouverts dépendent de ton niveau|moitié de sa taille|commence en entier dans les 14 jours|ses semaines passées sont sautées/.test(contenu));
});

// ─── L'attestation sur l'honneur ────────────────────────────────────────────────────────────────────

test('attestation : rien pour le Trail Court, la route ou un format inconnu ; une case pour les trois autres', () => {
  for (const f of ['TC', 'R10', 'R21', 'R42', '', 'XX']) assert.equal(attestation.attestationDuFormat(f), null, f);
  assert.match(attestation.attestationDuFormat('TM').texte, /déjà couru des trails courts.*au moins 3 fois par semaine/);
  assert.match(attestation.attestationDuFormat('TL').texte, /déjà couru un trail marathon.*au moins 4 fois par semaine/);
  assert.match(attestation.attestationDuFormat('UT').texte, /déjà couru un trail long.*au moins 4 fois par semaine/);
});

test('attestation : sur l’honneur, sans refus, et aucune invitation à échanger avec le coach', () => {
  for (const f of ['TM', 'TL', 'UT']) {
    const a = attestation.attestationDuFormat(f);
    assert.match(a.texte, /^J’atteste sur l’honneur/);
    const phrase = attestation.phraseCaseNonCochee(a);
    assert.ok(phrase.includes(a.pluscourt), 'une course plus courte, nommée');
    assert.ok(/coaching/.test(phrase), 'ou le coaching, avant l’achat');
    for (const t of [a.texte, phrase]) assert.ok(!/écris-nous|parle|échang|contacte|appelle|réponds|refus/i.test(t), t);
  }
  // Le questionnaire ne l'envoie pas au moteur et ne la garde pas dans le brouillon : elle n'est pas un champ.
  assert.ok(!('attestation' in plan.champsVides));
  assert.ok(!('attestation' in plan.intakePourApi(plan.champsVides)));
});

test('attestation : le questionnaire la pose sous la distance, pour l’acheteur seulement, et l’exige avant le récapitulatif', () => {
  const source = lire('components/plan/Questionnaire.tsx');
  assert.match(source, /const attestation = !coach && !route \? attestationDuFormat\(c\.format\) : null;/);
  assert.match(source, /attestation && !attestee \? 'coche l’attestation sous ta course' : null/);
  assert.ok(source.indexOf('{attestation && (') > source.indexOf(') : blocDistance}'), 'sous la distance');
});

// ─── Les deux critères, préparés pas branchés ───────────────────────────────────────────────────────

test('critères : les questions du coach, trois réponses, le commutateur est coupé', () => {
  assert.equal(criteres.CRITERES_BRANCHES, false, 'branché seulement avec le nouveau moteur');
  assert.deepEqual(criteres.CRITERES.map((q) => q.question), [
    'Ces 3 derniers mois, as-tu fait des séances de fractionné ou de seuil ?',
    'Ces 3 derniers mois, as-tu couru avec du dénivelé (côtes, trails) ?',
  ]);
  assert.deepEqual(criteres.REPONSES_CRITERE.map((r) => r.valeur), ['jamais', 'parfois', 'regulier']);
  assert.equal(criteres.REPONSES_CRITERE[1].precision, 'moins d’une fois par semaine');
  assert.equal(criteres.REPONSES_CRITERE[2].precision, 'au moins une fois par semaine');
  assert.equal(criteres.titreReponse('parfois'), 'De temps en temps');
  assert.equal(criteres.titreReponse('x'), '');
  // Deux critères seulement : l'endurance est retirée.
  assert.equal(criteres.CRITERES.length, 2);
  assert.deepEqual(criteres.CHAMPS_CRITERES.every((k) => k in plan.champsVides), true);
});

test('critères : tant qu’ils ne sont pas branchés, l’intake est celui d’aujourd’hui (le niveau part, les critères non)', () => {
  const c = { ...plan.champsVides, nom: 'Essai', niveau: 'intermediaire', critere_intensite: 'parfois', critere_denivele: 'regulier', blessure: 'non', coeur: 'non' };
  const intake = plan.intakePourApi(c);
  assert.equal(intake.niveau, 'intermediaire');
  assert.ok(!('critere_intensite' in intake) && !('critere_denivele' in intake));
  assert.ok(!('blessure' in intake) && !('coeur' in intake));
  // Le questionnaire demande toujours le niveau, et affiche les critères seulement branchés.
  const source = lire('components/plan/Questionnaire.tsx');
  assert.match(source, /\{!court && CRITERES_BRANCHES && <CriteresEntree c=\{c\} maj=\{maj\} \/>\}/);
  assert.match(source, /\{!court && !CRITERES_BRANCHES && \(/);
});

test('portes : aucune porte de plus au questionnaire — le temps minimum est celui du coach, l’attestation ne refuse rien', () => {
  const source = lire('components/plan/Questionnaire.tsx');
  // Ni compteur de porte ni refus propre à l'attestation (aucune porte sans raison de sécurité, socle règle 8).
  assert.ok(!/compterEtape\('porte_attestation'\)/.test(source));
  const mesure = lire('lib/mesure.ts');
  assert.ok(!/porte_attestation/.test(mesure));
});
