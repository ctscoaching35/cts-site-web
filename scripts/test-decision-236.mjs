#!/usr/bin/env node
/**
 * DÉCISION 236 (le coach, 25/11/2026, « Tout A ») : la version A de chaque point du lot de textes du site, mot pour mot, sous les deux
 * moteurs (la 8.x est remplacée ce week-end) : S3, S52, S73, S17, S49, S12 à S16, S36, S51, S77, R1, R2, L1 à L3. La bibliothèque garde
 * les prénoms. Les phrases d'écran vivent dans des composants : l'essai lit leur source (espaces d'indentation ramenés à un seul) ; les
 * messages de saisie, eux, sortent des vraies fonctions. Des cas fictifs, sans réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-decision-236.mjs
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
const cote = await import(`${RACINE}lib/cote.ts`);
const profil = await import(`${RACINE}lib/app/profilEntrainement.ts`);
const regles = await import(`${RACINE}lib/app/coachingRegles.ts`);
const dossier = await import(`${RACINE}lib/app/rangerDossier.ts`);

// Le source d'un fichier, espaces ramenés à un seul : une phrase coupée sur deux lignes se retrouve d'un tenant.
const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const aplati = (f) => lire(f).replace(/\s+/g, ' ');
const SANS_COMMENTAIRES = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const une = (texte, phrase, quoi) => assert.equal(texte.split(phrase).length - 1, 1, `${quoi} : « ${phrase.slice(0, 70)}… » une fois, mot pour mot`);
const absente = (texte, phrase, quoi) => assert.ok(!texte.includes(phrase), `${quoi} : « ${phrase.slice(0, 70)} » n’y est plus`);

// Ce qui sonne comme une machine, ou comme un formulaire qui parle à la place du coach (la règle du lot).
const MACHINE = /moteur|calculé|s’écrit|\blu\b|\blue\b|ne se lit|ne se lisent|je ne comprends pas|n’est pas valide|ne sont pas valides/i;

// ─── S3 ─────────────────────────────────────────────────────────────────────────────────────────

test('S3 : « D’où vient ce chiffre ? » pour tout le monde, à la place de « Comment c’est calculé ? »', () => {
  const t = lire('components/app/TableauDeBord.tsx');
  une(t, 'D’où vient ce chiffre&nbsp;?', 'Accueil, sous le chiffre de la montée');
  absente(t, 'Comment c’est calculé', 'Accueil');
});

// ─── S52 ────────────────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  temps_max_par_format: { TC: 7, TM: 15, TL: 24, UT: 70, R10: 2, R21: 3.5, R42: 7 },
  freq_min_par_format: { TC: 3, TM: 3, TL: 3, UT: 4, R10: 3, R21: 3, R42: 3 },
  freq_min_km_effort_seuil: 100, freq_min_au_dela_du_seuil: 4, freq_max_par_niveau: { debutant: 7, intermediaire: 7, confirme: 7 },
};
const trailCourt = { ...plan.champsVides, format: 'TC', distance_km: '29', dplus_m: '2500', niveau: 'intermediaire' };

test('S52 : sous le temps visé, le coach et le coaché lisent « Ce cas sort du parcours habituel : il se prépare à la main. » ; l’acheteur garde sa phrase', () => {
  const fin = plan.reperesChrono(trailCourt, CONFIG, true).fin;
  assert.equal(fin, 'Au-delà de 7h, c’est hors du plafond de ce plan. Ce cas sort du parcours habituel : il se prépare à la main.');
  assert.ok(!MACHINE.test(fin) && !/toi-même|automatique/.test(fin));
  assert.equal(plan.reperesChrono(trailCourt, CONFIG).fin, 'Au-delà de 7h, c’est hors du plafond de ce plan : un coaching individualisé est plus adapté.');
  const t = lire('lib/plan.ts');
  une(t, "const HORS_DU_PARCOURS = 'Ce cas sort du parcours habituel : il se prépare à la main.';", 'lib/plan.ts');
  assert.ok(!t.includes('HORS_DU_MOTEUR'), 'plus de constante « moteur »');
});

// ─── S73 ────────────────────────────────────────────────────────────────────────────────────────

test('S73 : sous « Tes tests », la phrase du coaché dit « Entre-le ici », en « je » ; à la main ou sinon', () => {
  const t = lire('app/app/profil/page.tsx');
  const alamain = 'Tu as refait un test de ton côté ? Entre-le ici. Tes zones changent tout de suite, je le vois sur ta fiche et j’en tiens compte pour ta semaine suivante.';
  const sinon = 'Tu as refait un test de ton côté ? Entre-le ici. Tes zones changent tout de suite, tes séances à partir de la semaine que je te prépare dimanche, et je le vois sur ta fiche.';
  une(t, `'${alamain}'`, 'Profil, à la main');
  une(t, `'${sinon}'`, 'Profil, sinon');
  absente(t, 's’entre ici', 'Profil');
  absente(t, 'semaine écrite dimanche', 'Profil');
  assert.ok(!MACHINE.test(alamain) && !MACHINE.test(sinon));
});

// ─── S17 ────────────────────────────────────────────────────────────────────────────────────────

test('S17 : la carte « Ton coach » parle d’un bout à l’autre en « je » (le coach), qu’il écrive à la main ou non', () => {
  const t = lire('app/app/compte/page.tsx');
  une(t, "'J’écris tes séances dans Nolio.'", 'Compte, à la main');
  une(t, "'Je relis ta préparation et je peux changer une semaine à tout moment.'", 'Compte, sinon');
  une(aplati('app/app/compte/page.tsx'), 'Écris-moi sur WhatsApp ou dans ton appli Nolio. Mes mots sur ta semaine sont dans Nolio.', 'Compte, la suite');
  absente(t, 'Écris-lui', 'Compte');
  absente(t, 'Ses mots sur ta semaine', 'Compte');
  absente(t, 'écrit tes séances dans Nolio', 'Compte (« ${coach.prenom} écrit »)');
  // La carte garde son surtitre, le prénom du coach et ce qui se dit de lui (une carte de visite).
  assert.ok(t.includes('<Surtitre ton="clair">Ton coach</Surtitre>') && t.includes('{coach.prenom}</p>') && t.includes('{coach.texte}'));
});

// ─── S49 ────────────────────────────────────────────────────────────────────────────────────────

test('S49 : « dis-le-moi : j’adapte ta préparation avec toi », sans « lui » ni « vous »', () => {
  const t = aplati('components/plan/Questionnaire.tsx');
  une(t, 'Je relis tes réponses avant de lancer ta préparation. Si une douleur ou une blessure t’empêche de courir normalement, dis-le-moi : j’adapte ta préparation avec toi. Ce plan ne remplace pas un avis médical.', 'Questionnaire, « À lire avant d’envoyer »');
  absente(t, 'dis-le-lui', 'Questionnaire');
  absente(t, 'vous adapterez', 'Questionnaire');
});

// ─── S12 à S16 : ce qu’il faut écrire ───────────────────────────────────────────────────────────

const ENVOI = () => ({
  nom: 'Clara Test', naissance: '1988', ville: 'Rennes', course_depuis: '3_5', experience_trail: 'intermediaire', courses_marquantes: '',
  seances: '4', heures: '5,5', longue: '2 h 30', terrain: ['chemins', 'escaliers'], dplus_pres: '300 m', montagne: 'quelques_we',
  objectif: { kind: 'aucune' }, vise: 'chrono', vise_autre: '', jours: ['mar', 'jeu', 'sam'], temps_seance: '45_60', jour_sl: 'sam', montre: 'gps_fc',
  nolio: 'sais_pas', attentes: '', telephone: '06 12 34 56 78', moments: ['lun_soir'], mot: '', consentement_sante: false, sante: '',
});
const OPTIONS = { experienceConnue: null, anneeCourante: 2026, coursesDuCompte: [] };
const demande = (changement) => regles.lireDemande({ ...ENVOI(), ...changement }, OPTIONS);
const libre = (extra) => ({ objectif: { kind: 'libre', nom: 'Trail du test', date: '2027-06-12', distance_km: '42', dplus_m: '2500', ...extra } });

test('S12 à S16 : chaque message dit quoi écrire, sans « ne se lit pas », « je ne comprends pas » ni « n’est pas valide »', () => {
  assert.equal(demande({}).ok, true, 'la demande de départ est bonne');
  assert.equal(demande(libre({})).ok, true, 'la course libre de départ est bonne');
  const cas = [
    ['S12', { naissance: 'abc' }, 'Écris ton année de naissance en quatre chiffres, par exemple 1988.'],
    ['S13', { heures: 'beaucoup' }, 'Écris tes heures par semaine en nombre, par exemple 5 ou 5,5.'],
    ['S13', { heures: '55' }, 'Écris tes heures par semaine en nombre, par exemple 5 ou 5,5.'],
    ['S14', libre({ date: 'demain' }), 'Choisis la date de ta course dans le calendrier.'],
    ['S15', libre({ distance_km: '-5' }), 'Écris la distance de ta course en km et son D+ en mètres, avec des chiffres.'],
    ['S15', libre({ dplus_m: '999999' }), 'Écris la distance de ta course en km et son D+ en mètres, avec des chiffres.'],
    ['S16', { telephone: '12' }, 'Écris ton numéro de téléphone avec ses 10 chiffres, par exemple 06 12 34 56 78.'],
  ];
  for (const [n, changement, message] of cas) {
    const r = demande(changement);
    assert.equal(r.ok, false, n);
    assert.equal(r.message, message, n);
    assert.ok(!MACHINE.test(r.message), `${n} : ni machine ni formulaire qui parle`);
  }
});

// ─── S36 ────────────────────────────────────────────────────────────────────────────────────────

test('S36 : un dossier mal formé dit qu’il n’a pas pu être gardé, et quoi faire dans le calculateur', async () => {
  const r = await dossier.rangerDossier('compte-fictif', undefined, {});
  assert.deepEqual(r, { ok: false, message: 'Ce dossier n’a pas pu être gardé : refais-le dans le calculateur, puis garde-le.' });
  assert.ok(!MACHINE.test(r.message));
});

// ─── S51 ────────────────────────────────────────────────────────────────────────────────────────

test('S51 : « Écris ta plus longue côte en minutes, par exemple 12. » pour la demande et le coaché, « Écris sa plus longue côte… » pour le coach', () => {
  assert.equal(cote.TEXTES_COTE.illisible, 'Écris ta plus longue côte en minutes, par exemple 12.');
  assert.equal(cote.TEXTES_COTE.illisibleSa, 'Écris sa plus longue côte en minutes, par exemple 12.');
  assert.ok(!('illisibleCoache' in cote.TEXTES_COTE), 'une clé de moins : la voix du coach n’est plus nécessaire');
  assert.ok(!MACHINE.test(cote.TEXTES_COTE.illisible) && !MACHINE.test(cote.TEXTES_COTE.illisibleSa));
  // Où elles sortent : la demande de coaching, le profil du coaché (« ton »), la fiche vue par le coach (« son »).
  assert.equal(demande({ cote_min: 'douze' }).message, 'Écris ta plus longue côte en minutes, par exemple 12.');
  const f = new FormData();
  for (const [k, v] of Object.entries({ anciennete: '2_5', entrainement: 'plan', jours_disponibles: ['mardi', 'jeudi', 'dimanche'], jour_sl: 'dimanche', freq_hebdo: '3' })) for (const x of [].concat(v)) f.append(k, x);
  assert.equal(profil.lireProfil(f, 'ton', null, {}).erreur, 'Écris ta plus longue côte en minutes, par exemple 12.');
  assert.equal(profil.lireProfil(f, 'son', null, {}).erreur, 'Écris sa plus longue côte en minutes, par exemple 12.');
});

// ─── S77, R1, R2, L1 à L3 : la page de confidentialité ──────────────────────────────────────────

test('S77 : la case de la fréquence cardiaque ne change pas, la page de confidentialité dit la même chose qu’elle', () => {
  une(lire('components/app/ProfilGratuit.tsx'), "'J’accepte que City to Summit garde ces valeurs dans mon compte, seulement pour établir mes zones et mes repères. Je peux les effacer à tout moment.'", 'case de consentement');
  const page = aplati('app/confidentialite/page.tsx');
  une(page, 'Elles servent seulement à établir tes zones et tes repères, et à régler tes séances.', 'Confidentialité, « Dans l’app : tes zones »');
  absente(page, 'Elles servent seulement à régler tes séances', 'Confidentialité');
});

test('R1, R2, L1 à L3 : la page de confidentialité dit « nous » et « l’un de nous », sans prénom seul ni « ton coach »', () => {
  const page = aplati('app/confidentialite/page.tsx');
  une(page, 'Elle va à l’un de nous, qui t’appelle.', 'R1');
  une(page, 'Nous la suivons et la corrigeons dans Nolio.', 'R2');
  une(page, 'et elle l’est tout de suite si nous la classons sans suite.', 'L1');
  une(page, 'celles que nous écrivons à la main comprises, relevées chaque nuit', 'L2');
  une(page, 'si nous t’ouvrons un espace dans l’app, nous gardons ton adresse e-mail', 'L2');
  une(page, 'arrive dans notre espace coach ;', 'L2');
  une(page, 'Personne d’autre que nous et toi ne voit ces données.', 'L3');
  for (const vieille of ['Elle va à Romain', 'Romain la suit', 'si le coach la classe', 'ton coach écrit', 'si ton coach t’ouvre', 'l’espace de ton coach', 'que ton coach et toi'])
    absente(page, vieille, 'Confidentialité');
  // Dans ce qu’on lit à l’écran (les commentaires de code retirés), plus de « ton coach » ; « Romain » n’y est plus que dans « Juliette et Romain ».
  const visible = SANS_COMMENTAIRES(lire('app/confidentialite/page.tsx'));
  assert.ok(!/ton coach/i.test(visible), 'plus de « ton coach »');
  const romains = [...visible.matchAll(/Romain/g)].length;
  assert.equal(romains, 2, 'Romain : seulement les deux fois où la page nomme l’équipe');
  assert.equal([...visible.replace(/\s+/g, ' ').matchAll(/Juliette et Romain/g)].length, 2);
});

test('la bibliothèque et la carte « Lire la bibliothèque » gardent les prénoms (décision 236)', () => {
  const phrase = 'Les fiches de Juliette et Romain, kinés du sport, fondées sur la littérature.';
  assert.equal(lire('app/app/bibliotheque/page.tsx').split(phrase).length - 1, 2);
  une(lire('components/app/AccueilGratuit.tsx'), phrase, 'Accueil gratuit');
});
