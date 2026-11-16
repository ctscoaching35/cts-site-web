#!/usr/bin/env node
/**
 * L'APP GRATUITE, lot A2 (décisions du coach du 16/11/2026) : la demande de coaching (le contrôle des réponses, la santé
 * seulement avec le consentement, le prénom et la ville au coach, accepter, sans suite, l'effacement à 3 mois), la liste
 * e-mail Brevo (rien sans clé ni liste, jamais de clé dans un journal, un échec ne bloque rien, la désinscription), le
 * consentement FC changé, « Aller plus loin » (aucun texte du plan n'invite à échanger), et la preuve qu'en mode « coupe » rien
 * de visible ne change. Sans réseau ni base : une base en mémoire et des espions (scripts/_monde-coaching.mjs), des cas
 * fictifs en @cts-coaching.test.
 *
 *   node --test scripts/test-app-gratuite-a2.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const MONDE = pathToFileURL(`${RACINE}scripts/_monde-coaching.mjs`).href;
const REMPLACES = ['/lib/app/contexte.ts', '/lib/app/demandes.ts', '/lib/app/demonstrationPorte.ts', '/lib/app/nolio.ts', '/lib/app/supabase.ts',
  '/lib/app/ecriture.ts', '/lib/app/espaceAthlete.ts'];
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
const { creerBase, Redirection, Introuvable } = await import(MONDE);
let n = 0;
const frais = (nom) => import(`${RACINE}lib/app/${nom}.ts?cas=${++n}`);
const regles = await import(`${RACINE}lib/app/coachingRegles.ts`);
const liste = await import(`${RACINE}lib/app/listeEmail.ts`);

const ROMAIN = 'romain@cts-coaching.test';
const COMPTE = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'clara@cts-coaching.test';

// Le monde d'un test : l'environnement, la session, la base, les espions.
function poser({ mode = 'ouvert', session = { sub: COMPTE, email: EMAIL }, coach = null, tables = {}, fiche = true } = {}) {
  if (mode === null) delete process.env.APP_GRATUITE;
  else process.env.APP_GRATUITE = mode;
  process.env.APP_GRATUITE_SECRET = 'mot-secret';
  process.env.CTS_COACHS = `${ROMAIN},juliette@cts-coaching.test`;
  const m = {
    cookies: {}, supabase: true, session, coach, base: creerBase(tables), appels: [], mails: [], ouverts: [], revalidations: [],
    emails: { [COMPTE]: EMAIL }, erreurs: {}, plans: [],
  };
  globalThis.__monde2 = m;
  return m;
}
const ROMAIN_COACH = { compteId: 'coach-romain', email: ROMAIN };

// Une demande valide, telle que le navigateur l'envoie.
const ENVOI = () => ({
  nom: 'Clara Test', naissance: '1988', ville: 'Rennes', course_depuis: '3_5', experience_trail: 'intermediaire', courses_marquantes: 'Trail de 42 km, 1 800 m D+, 5 h 40',
  seances: '4', heures: '5,5', longue: '2 h 30', terrain: ['chemins', 'cotes_courtes'], dplus_pres: '300 m', montagne: 'quelques_we',
  objectif: { kind: 'libre', nom: 'Trail de la Côte sauvage', date: '2027-03-14', distance_km: '18', dplus_m: '540' }, vise: 'chrono', vise_autre: '',
  jours: ['mar', 'jeu', 'sam'], temps_seance: '45_60', jour_sl: 'sam', montre: 'gps_fc', nolio: 'sais_pas', attentes: 'Un cadre.',
  telephone: '06 12 34 56 78', moments: ['lun_soir', 'mer_midi'], mot: '', consentement_sante: false, sante: 'Tendinite du genou en 2026',
});
const OPTIONS = { experienceConnue: null, anneeCourante: 2026, coursesDuCompte: [] };

// ─── Le contrôle des réponses ────────────────────────────────────────────────────────────────────────────────────────
test('QUESTIONS_COACHING : tous les textes du formulaire sont dans une seule constante, avec les dix blocs du coach', () => {
  const q = regles.QUESTIONS_COACHING;
  for (const bloc of ['toi', 'vecu', 'semaine', 'terrain', 'objectif', 'dispos', 'montre', 'attentes', 'sante', 'appel']) assert.ok(q[bloc]?.titre, bloc);
  assert.equal(q.sante.consentement, 'J’accepte que City to Summit garde ces informations de santé pour préparer notre appel et mon coaching. Sans suite, elles sont effacées 3 mois après ma demande.');
  assert.equal(q.apres, 'C’est envoyé. Je t’appelle dans la semaine, à l’un des moments que tu as choisis.');
  assert.deepEqual(q.vecu.depuisChoix.map((c) => c.titre), ['Moins d’un an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans']);
  assert.equal(regles.CLES_MOMENTS.length, 21);
});

test('une demande complète est lue ; la santé sans la case n’est ni lue ni gardée', () => {
  const r = regles.lireDemande(ENVOI(), OPTIONS);
  assert.ok(r.ok, r.message);
  const d = r.demande;
  assert.equal(d.reponses.nom, 'Clara Test');
  assert.equal(d.reponses.heures, 5.5);
  assert.equal(d.reponses.experience_trail, 'intermediaire');
  assert.deepEqual(d.reponses.objectif, { kind: 'libre', nom: 'Trail de la Côte sauvage', date: '2027-03-14', distance_km: 18, dplus_m: 540 });
  assert.equal(d.telephone, '0612345678');
  assert.deepEqual(d.moments, ['lun_soir', 'mer_midi']);
  assert.equal(d.sante, null);
  assert.equal(d.consentementSante, false);
  assert.ok(!JSON.stringify(d.reponses).includes('Tendinite'), 'le texte de santé ne doit pas se glisser dans les réponses');
});

test('la santé avec la case : le texte et le consentement ; la case sans texte : rien', () => {
  const avec = regles.lireDemande({ ...ENVOI(), consentement_sante: true }, OPTIONS);
  assert.equal(avec.demande.sante, 'Tendinite du genou en 2026');
  assert.equal(avec.demande.consentementSante, true);
  const vide = regles.lireDemande({ ...ENVOI(), consentement_sante: true, sante: '   ' }, OPTIONS);
  assert.equal(vide.demande.sante, null);
  assert.equal(vide.demande.consentementSante, false);
  // « true » seulement : une chaîne « true » ne vaut pas accord.
  assert.equal(regles.lireDemande({ ...ENVOI(), consentement_sante: 'true' }, OPTIONS).demande.sante, null);
});

test('l’expérience du profil n’est pas redemandée ni redonnée ; sans profil, elle est exigée', () => {
  const sans = { ...ENVOI(), experience_trail: '' };
  assert.equal(regles.lireDemande(sans, OPTIONS).ok, false);
  const connue = regles.lireDemande(sans, { ...OPTIONS, experienceConnue: 'confirme' });
  assert.ok(connue.ok);
  assert.equal(connue.demande.reponses.experience_trail, null);
});

test('les refus : nom, année, téléphone, moments, jours, course d’un autre compte, objectif', () => {
  const refus = (changement, options = OPTIONS) => regles.lireDemande({ ...ENVOI(), ...changement }, options);
  assert.equal(refus({ nom: 'C' }).ok, false);
  assert.equal(refus({ naissance: '88' }).ok, false);
  assert.equal(refus({ naissance: '2025' }).ok, false);
  assert.equal(refus({ telephone: 'abc' }).ok, false);
  assert.equal(refus({ telephone: '0612' }).ok, false);
  assert.equal(refus({ moments: [] }).ok, false);
  assert.equal(refus({ moments: ['dim_nuit'] }).ok, false);
  assert.equal(refus({ jours: [] }).ok, false);
  assert.equal(refus({ montagne: 'toujours' }).ok, false);
  assert.equal(refus({ objectif: {} }).ok, false);
  assert.equal(refus({ objectif: { kind: 'libre', nom: '' } }).ok, false);
  assert.equal(refus({ objectif: { kind: 'libre', nom: 'X', date: '2027-02-30' } }).ok, false);
  assert.equal(refus({ objectif: { kind: 'app', course_id: 'celle-d-un-autre' } }).ok, false);
  assert.ok(refus({ objectif: { kind: 'aucune' } }).ok);
});

test('une course de l’app : le nom et la date viennent de la base, pas du navigateur', () => {
  const courses = [{ id: 'c1', nom: 'Course du compte', date: '2027-05-01', distance_km: 42, dplus_m: 1800 }];
  const r = regles.lireDemande({ ...ENVOI(), objectif: { kind: 'app', course_id: 'c1', nom: 'Faux nom' } }, { ...OPTIONS, coursesDuCompte: courses });
  assert.deepEqual(r.demande.reponses.objectif, { kind: 'app', course_id: 'c1', nom: 'Course du compte', date: '2027-05-01', distance_km: 42, dplus_m: 1800 });
});

test('le téléphone et les moments, à l’écran', () => {
  assert.equal(regles.lireTelephone('06.12.34.56.78'), '0612345678');
  assert.equal(regles.lireTelephone('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(regles.telephoneEnClair('0612345678'), '06 12 34 56 78');
  assert.equal(regles.telephoneEnClair('+33612345678'), '06 12 34 56 78');
  assert.equal(regles.momentsEnClair(['mer_soir', 'lun_matin']), 'lundi matin, mercredi soir');
});

test('l’effacement à 3 mois : la borne et la date, le jour du mois gardé', () => {
  assert.equal(regles.bornePourEffacer(new Date('2026-11-16T12:00:00Z')), '2026-08-16T12:00:00.000Z');
  // Le 31 mai moins 3 mois : le 28 février, pas le 3 mars.
  assert.equal(regles.bornePourEffacer(new Date('2027-05-31T05:00:00Z')).slice(0, 10), '2027-02-28');
  assert.equal(regles.effaceeLe('2026-11-30T09:00:00Z').slice(0, 10), '2027-02-28');
  assert.equal(regles.effaceeLe('2026-11-16T09:00:00Z').slice(0, 10), '2027-02-16');
});

// ─── Envoyer sa demande ──────────────────────────────────────────────────────────────────────────────────────────────
test('envoyer : la demande est posée, le coach reçoit le prénom et la ville, jamais la santé ni le téléphone', async () => {
  const m = poser({ tables: { profils_gratuits: [{ compte_id: COMPTE, experience: 'confirme' }] } });
  const a = await frais('actionsDemandesCoaching');
  const r = await a.envoyerDemandeCoaching({ ...ENVOI(), consentement_sante: true });
  assert.equal(r.ok, true);
  assert.equal(r.message, regles.QUESTIONS_COACHING.apres);
  const [ligne] = m.base.tables.demandes_coaching;
  assert.equal(ligne.compte_id, COMPTE);
  assert.equal(ligne.statut, 'ouverte');
  assert.equal(ligne.sante, 'Tendinite du genou en 2026');
  assert.ok(ligne.consentement_sante_le);
  // L'expérience est celle du profil : elle n'est pas dans la demande.
  assert.equal(ligne.reponses.experience_trail, null);
  assert.equal(m.mails.length, 1);
  assert.match(m.mails[0].sujet, /Clara, Rennes/);
  assert.ok(!/Tendinite|0612345678|06 12/.test(m.mails[0].sujet + m.mails[0].texte));
  assert.ok(m.appels.every((x) => x !== 'appelNolio'));
});

test('envoyer sans la case : ni le texte de santé ni sa date ne sont gardés ; la renvoyer met la demande à jour (une seule)', async () => {
  const m = poser();
  const a = await frais('actionsDemandesCoaching');
  await a.envoyerDemandeCoaching(ENVOI());
  const [ligne] = m.base.tables.demandes_coaching;
  assert.equal(ligne.sante, null);
  assert.equal(ligne.consentement_sante_le, null);
  await a.envoyerDemandeCoaching({ ...ENVOI(), ville: 'Nantes' });
  assert.equal(m.base.tables.demandes_coaching.length, 1);
  assert.equal(m.base.tables.demandes_coaching[0].reponses.ville, 'Nantes');
  assert.match(m.mails[1].sujet, /mise à jour/);
});

test('envoyer : un visiteur, un coaché ou un compte « normal » n’ont pas ce geste, rien n’est écrit', async () => {
  for (const cas of ['visiteur', 'coache', 'coupe']) {
    const m = poser(cas === 'visiteur' ? { session: null } : cas === 'coupe' ? { mode: null } : {
      tables: { athletes_coaches: [{ id: 'f1', coach_id: 'coach-romain', nom: 'Clara Test', compte_id: COMPTE }] } });
    const a = await frais('actionsDemandesCoaching');
    const r = await a.envoyerDemandeCoaching(ENVOI());
    assert.equal(r.ok, false, cas);
    assert.equal((m.base.tables.demandes_coaching ?? []).length, 0, cas);
    assert.equal(m.mails.length, 0, cas);
  }
});

test('envoyer : une réponse refusée par le contrôle n’écrit rien', async () => {
  const m = poser();
  const a = await frais('actionsDemandesCoaching');
  const r = await a.envoyerDemandeCoaching({ ...ENVOI(), moments: [] });
  assert.equal(r.ok, false);
  assert.match(r.message, /moment/);
  assert.equal((m.base.tables.demandes_coaching ?? []).length, 0);
});

test('effacer ma demande : la sienne seulement', async () => {
  const m = poser();
  const a = await frais('actionsDemandesCoaching');
  await a.envoyerDemandeCoaching(ENVOI());
  m.base.tables.demandes_coaching.push({ id: 'autre', compte_id: 'un-autre-compte', statut: 'ouverte' });
  const r = await a.effacerMaDemande();
  assert.equal(r.ok, true);
  assert.deepEqual(m.base.tables.demandes_coaching.map((x) => x.id), ['autre']);
});

// ─── Le coach : accepter, sans suite ──────────────────────────────────────────────────────────────────────────────────
const DEMANDE = (extra = {}) => ({
  id: 'd1000000-0000-4000-8000-000000000001', compte_id: COMPTE, reponses: { nom: 'Clara Test', ville: 'Rennes' }, sante: null, consentement_sante_le: null,
  moments: ['lun_soir'], telephone: '0612345678', envoyee_le: '2026-11-16T09:00:00.000Z', statut: 'ouverte', traitee_le: null, athlete_id: null, ...extra,
});
const PROFIL = (extra = {}) => ({ compte_id: COMPTE, experience: 'intermediaire', consentement_fc_le: '2026-11-15T10:00:00Z',
  tests: { vc: { efforts: [{ duree_s: 180, distance_m: 900 }, { duree_s: 720, distance_m: 3300 }], vc_ms: 4.1, d_prime_m: 160, le: '2026-11-15' },
    parole: { fc_seuil1: 152, v_seuil1_ms: 2.8, le: '2026-11-15' }, fc2: { fc_seuil2: 171, le: '2026-11-15' } }, ...extra });

test('accepter : la fiche (nom, FC et VC avec le consentement FC), l’espace ouvert, la demande acceptée, la page de l’athlète, rien dans Nolio', async () => {
  const m = poser({ coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE()], profils_gratuits: [PROFIL()] } });
  const a = await frais('actionsDemandesCoaching');
  await assert.rejects(a.accepterDemande('d1000000-0000-4000-8000-000000000001'), (e) => e instanceof Redirection && /^redirect \/app\/coach\/athlete\//.test(e.message));
  const [fiche] = m.base.tables.athletes_coaches;
  assert.equal(fiche.nom, 'Clara Test');
  assert.equal(fiche.coach_id, 'coach-romain');
  assert.equal(fiche.fc_seuil1, 152);
  assert.equal(fiche.v_seuil1_ms, 2.8, 'l’allure du test de la parole suit sa FC');
  assert.equal(fiche.fc_seuil2, 171);
  assert.equal(fiche.vc_ms, 4.1);
  assert.equal(fiche.d_prime_m, 160);
  assert.equal(fiche.reperes_sources.vc_ms.source, 'athlete');
  assert.equal(fiche.compte_id, COMPTE, 'l’espace relie le compte gratuit à la fiche');
  assert.deepEqual(m.ouverts.map((o) => o.email), [EMAIL]);
  const d = m.base.tables.demandes_coaching[0];
  assert.equal(d.statut, 'acceptee');
  assert.equal(d.athlete_id, fiche.id);
  assert.ok(d.traitee_le);
  assert.ok(!m.appels.includes('appelNolio'), 'rien n’est écrit dans Nolio');
});

test('accepter sans le consentement FC : la fiche garde le nom et la vitesse critique, aucune FC', async () => {
  const m = poser({ coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE()], profils_gratuits: [PROFIL({ consentement_fc_le: null })] } });
  const a = await frais('actionsDemandesCoaching');
  await assert.rejects(a.accepterDemande('d1000000-0000-4000-8000-000000000001'), Redirection);
  const [fiche] = m.base.tables.athletes_coaches;
  assert.equal(fiche.nom, 'Clara Test');
  assert.equal(fiche.vc_ms, 4.1, 'la vitesse critique n’est pas une FC : le profil gratuit la garde sans consentement');
  assert.equal(fiche.d_prime_m, 160);
  for (const cle of ['fc_seuil1', 'v_seuil1_ms', 'fc_seuil2']) assert.equal(fiche[cle], undefined, cle);
});

test('accepter : un autre coach (Juliette), une demande déjà traitée, un compte déjà coaché : refusé, rien n’est écrit', async () => {
  const cas = [
    { coach: { compteId: 'coach-juliette', email: 'juliette@cts-coaching.test' }, demande: DEMANDE() },
    { coach: ROMAIN_COACH, demande: DEMANDE({ statut: 'acceptee' }) },
    { coach: null, demande: DEMANDE() },
  ];
  for (const c of cas) {
    const m = poser({ coach: c.coach, tables: { demandes_coaching: [c.demande] } });
    const a = await frais('actionsDemandesCoaching');
    const r = await a.accepterDemande('d1000000-0000-4000-8000-000000000001');
    assert.equal(r.ok, false);
    assert.equal((m.base.tables.athletes_coaches ?? []).length, 0);
  }
  const m = poser({ coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE()], athletes_coaches: [{ id: 'f9', coach_id: 'coach-romain', nom: 'Déjà', compte_id: COMPTE }] } });
  const a = await frais('actionsDemandesCoaching');
  assert.equal((await a.accepterDemande('d1000000-0000-4000-8000-000000000001')).ok, false);
  assert.equal(m.base.tables.athletes_coaches.length, 1);
});

test('accepter : si l’espace ne s’ouvre pas, la fiche créée repart et la demande reste ouverte', async () => {
  const m = poser({ coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE()], profils_gratuits: [PROFIL()] } });
  m.ouvrirEspaceEchoue = true;
  const a = await frais('actionsDemandesCoaching');
  const r = await a.accepterDemande('d1000000-0000-4000-8000-000000000001');
  assert.equal(r.ok, false);
  assert.equal(m.base.tables.athletes_coaches.length, 0);
  assert.equal(m.base.tables.demandes_coaching[0].statut, 'ouverte');
});

test('après l’acceptation, l’ancien compte gratuit est vu comme coaché (lireAcces : « normal »), ses données gratuites restent', async () => {
  const m = poser({ coach: null, tables: { demandes_coaching: [DEMANDE()], profils_gratuits: [PROFIL()] } });
  const acces = await frais('acces');
  assert.equal((await acces.lireAcces()).cas, 'gratuit');
  // Le coach accepte.
  m.coach = ROMAIN_COACH;
  const a = await frais('actionsDemandesCoaching');
  await assert.rejects(a.accepterDemande('d1000000-0000-4000-8000-000000000001'), Redirection);
  // La même personne, une nouvelle visite.
  m.coach = null;
  const acces2 = await frais('acces');
  assert.equal((await acces2.lireAcces()).cas, 'normal');
  assert.equal(m.base.tables.profils_gratuits.length, 1);
  // Et le formulaire n'est plus pour lui : le geste est refusé.
  const a2 = await frais('actionsDemandesCoaching');
  assert.equal((await a2.envoyerDemandeCoaching(ENVOI())).ok, false);
});

test('sans suite : la demande est effacée tout de suite, aucun e-mail ne part', async () => {
  const m = poser({ coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE(), DEMANDE({ id: 'd2', compte_id: 'autre' })] } });
  const a = await frais('actionsDemandesCoaching');
  await assert.rejects(a.demandeSansSuite('d1000000-0000-4000-8000-000000000001'), (e) => e instanceof Redirection && e.vers === '/app/coach/demandes');
  assert.deepEqual(m.base.tables.demandes_coaching.map((x) => x.id), ['d2']);
  assert.equal(m.mails.length, 0);
  assert.equal(m.ouverts.length, 0);
});

test('sans suite : réservé au premier coach, et à une demande ouverte', async () => {
  const m = poser({ coach: { compteId: 'coach-juliette', email: 'juliette@cts-coaching.test' }, tables: { demandes_coaching: [DEMANDE()] } });
  const a = await frais('actionsDemandesCoaching');
  assert.equal((await a.demandeSansSuite('d1000000-0000-4000-8000-000000000001')).ok, false);
  assert.equal(m.base.tables.demandes_coaching.length, 1);
  const m2 = poser({ coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE({ statut: 'acceptee' })] } });
  const a2 = await frais('actionsDemandesCoaching');
  await assert.rejects(a2.demandeSansSuite('d1000000-0000-4000-8000-000000000001'), Redirection);
  assert.equal(m2.base.tables.demandes_coaching.length, 1, 'une demande acceptée ne s’efface pas par « Sans suite »');
});

test('les demandes vont au seul premier compte de CTS_COACHS', async () => {
  poser();
  const d = await frais('demandesCoaching');
  assert.equal(d.coachDesDemandes({ email: ROMAIN }), true);
  assert.equal(d.coachDesDemandes({ email: 'ROMAIN@cts-coaching.test ' }), true);
  assert.equal(d.coachDesDemandes({ email: 'juliette@cts-coaching.test' }), false);
});

test('l’effacement à 3 mois : une demande non acceptée de plus de 3 mois part, une récente ou acceptée reste', async () => {
  const m = poser({ tables: { demandes_coaching: [
    DEMANDE({ id: 'vieille', compte_id: 'a', envoyee_le: '2026-08-01T00:00:00.000Z' }),
    DEMANDE({ id: 'recente', compte_id: 'b', envoyee_le: '2026-10-20T00:00:00.000Z' }),
    DEMANDE({ id: 'acceptee', compte_id: 'c', envoyee_le: '2026-01-01T00:00:00.000Z', statut: 'acceptee' }),
  ] } });
  const d = await frais('demandesCoaching');
  assert.equal(await d.effacerLesDemandesEchues(new Date('2026-11-16T12:00:00Z')), 1);
  assert.deepEqual(m.base.tables.demandes_coaching.map((x) => x.id).sort(), ['acceptee', 'recente']);
});

test('le passage quotidien existant efface les demandes échues (sans nouveau cron)', () => {
  const route = readFileSync(`${RACINE}app/api/relance/envoyer/route.ts`, 'utf8');
  assert.match(route, /effacerLesDemandesEchues/);
  // Aucun cron propre aux demandes : leur effacement passe par le passage quotidien existant (le lot 0 a ses deux crons).
  const crons = JSON.parse(readFileSync(`${RACINE}vercel.json`, 'utf8')).crons;
  assert.ok(!crons.some((c) => /demande|coaching|gratuit/i.test(c.path)), 'aucun cron ajouté pour les demandes');
});

// ─── La liste e-mail (Brevo) ─────────────────────────────────────────────────────────────────────────────────────────────
// Un fetch d'espion : garde les appels, répond ce que le test règle.
function brevo({ cle = 'cle-de-test-brevo', listeId = '12', statut = 200 } = {}) {
  if (cle === null) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = cle;
  if (listeId === null) delete process.env.BREVO_LISTE_APP; else process.env.BREVO_LISTE_APP = listeId;
  const appels = [];
  const journal = [];
  globalThis.fetch = async (url, options) => { appels.push({ url, options }); if (statut === 'panne') throw new Error(`panne ${cle}`); return { ok: statut < 400, status: statut }; };
  const garde = [console.warn, console.error];
  console.warn = (...x) => journal.push(x.join(' '));
  console.error = (...x) => journal.push(x.join(' '));
  return { appels, journal, fin: () => { [console.warn, console.error] = garde; } };
}

test('Brevo : l’inscription envoie le contact à la liste, updateEnabled, avec les attributs connus', async () => {
  const b = brevo();
  try {
    assert.equal(await liste.inscrireAListe('Clara@cts-coaching.test', { EXPERIENCE: 'confirme', STYLE: 'endurant' }), true);
    const [x] = b.appels;
    assert.equal(x.url, 'https://api.brevo.com/v3/contacts');
    assert.equal(x.options.method, 'POST');
    assert.equal(x.options.headers['api-key'], 'cle-de-test-brevo');
    assert.deepEqual(JSON.parse(x.options.body), { email: 'clara@cts-coaching.test', listIds: [12], updateEnabled: true, attributes: { EXPERIENCE: 'confirme', STYLE: 'endurant' } });
  } finally { b.fin(); }
});

test('Brevo : sans clé ou sans numéro de liste, rien ne part (un avertissement)', async () => {
  for (const options of [{ cle: null }, { listeId: null }, { listeId: 'abc' }]) {
    const b = brevo(options);
    try {
      assert.equal(await liste.inscrireAListe('clara@cts-coaching.test', {}), false);
      assert.equal(await liste.retirerDeLaListe('clara@cts-coaching.test'), false);
      assert.equal(b.appels.length, 0);
      assert.ok(b.journal.length >= 1);
    } finally { b.fin(); }
  }
});

test('Brevo : un échec ne lève jamais et ne montre jamais la clé', async () => {
  for (const statut of [500, 'panne']) {
    const b = brevo({ statut });
    try {
      assert.equal(await liste.inscrireAListe('clara@cts-coaching.test', {}), false);
      assert.ok(b.journal.length >= 1);
      assert.ok(b.journal.every((l) => !l.includes('cle-de-test-brevo')), 'la clé ne doit jamais être journalisée');
    } finally { b.fin(); }
  }
});

test('Brevo : se désinscrire retire de la liste ; l’effacement du compte supprime le contact', async () => {
  const b = brevo();
  try {
    assert.equal(await liste.retirerDeLaListe('clara@cts-coaching.test'), true);
    assert.equal(b.appels[0].url, 'https://api.brevo.com/v3/contacts/lists/12/contacts/remove');
    assert.deepEqual(JSON.parse(b.appels[0].options.body), { emails: ['clara@cts-coaching.test'] });
    assert.equal(await liste.supprimerDuCarnet('clara@cts-coaching.test'), true);
    assert.equal(b.appels[1].url, 'https://api.brevo.com/v3/contacts/clara%40cts-coaching.test?identifierType=email_id');
    assert.equal(b.appels[1].options.method, 'DELETE');
  } finally { b.fin(); }
});

test('Brevo : les quatre attributs (expérience, style, type de course, date de la course)', () => {
  assert.deepEqual(liste.attributsListe({ experience: 'debutant', vc_ms: null, d_prime_m: null, prochaineCourse: null }), { EXPERIENCE: 'debutant' });
  assert.equal(liste.typeDeCourse(20, 300), 'roulante');
  assert.equal(liste.typeDeCourse(20, 400), 'vallonnee');
  assert.equal(liste.typeDeCourse(20, 800), 'vallonnee');
  assert.equal(liste.typeDeCourse(20, 801), 'montagne');
  assert.equal(liste.typeDeCourse(null, 800), null);
  const a = liste.attributsListe({ experience: 'confirme', vc_ms: 4.1, d_prime_m: 160, prochaineCourse: { date: '2027-03-14', distance_km: 18, dplus_m: 540 } });
  assert.deepEqual(Object.keys(a).sort(), ['DATE_COURSE', 'EXPERIENCE', 'STYLE', 'TYPE_COURSE']);
  assert.equal(a.DATE_COURSE, '2027-03-14');
  assert.equal(a.TYPE_COURSE, 'vallonnee');
  assert.ok(['endurant', 'rapide'].includes(a.STYLE));
});

test('Compte : s’inscrire date l’accord et inscrit ; se désinscrire retire et efface la date', async () => {
  const m = poser({ tables: { profils_gratuits: [{ compte_id: COMPTE, experience: 'intermediaire', tests: {}, liste_email_le: null }] } });
  const b = brevo();
  try {
    const a = await frais('actionsGratuit');
    const r = await a.changerListeEmail(true);
    assert.equal(r.ok, true);
    assert.ok(m.base.tables.profils_gratuits[0].liste_email_le);
    assert.ok(b.appels.some((x) => x.url.endsWith('/v3/contacts')));
    const r2 = await a.changerListeEmail(false);
    assert.equal(r2.ok, true);
    assert.equal(m.base.tables.profils_gratuits[0].liste_email_le, null);
    assert.ok(b.appels.some((x) => x.url.endsWith('/contacts/remove')));
  } finally { b.fin(); }
});

test('Compte : une désinscription que Brevo refuse ne passe jamais pour faite (la date reste)', async () => {
  const m = poser({ tables: { profils_gratuits: [{ compte_id: COMPTE, experience: null, tests: {}, liste_email_le: '2026-11-16T10:00:00Z' }] } });
  const b = brevo({ statut: 500 });
  try {
    const a = await frais('actionsGratuit');
    const r = await a.changerListeEmail(false);
    assert.equal(r.ok, false);
    assert.equal(r.inscrit, true);
    assert.equal(m.base.tables.profils_gratuits[0].liste_email_le, '2026-11-16T10:00:00Z');
  } finally { b.fin(); }
});

test('Connexion : un échec de Brevo ne bloque pas le profil gardé', async () => {
  const m = poser({ tables: { profils_gratuits: [] } });
  const b = brevo({ statut: 500 });
  try {
    const a = await frais('actionsGratuit');
    const r = await a.garderApresConnexion({ saisie: { experience: 'confirme' }, liste: true, consentementFc: false });
    assert.equal(r.ok, true);
    assert.equal(r.gratuit, true);
    assert.equal(m.base.tables.profils_gratuits[0].experience, 'confirme');
    assert.ok(m.base.tables.profils_gratuits[0].liste_email_le);
  } finally { b.fin(); }
});

test('Connexion : la case non cochée n’appelle pas Brevo', async () => {
  poser({ tables: { profils_gratuits: [] } });
  const b = brevo();
  try {
    const a = await frais('actionsGratuit');
    await a.garderApresConnexion({ saisie: { experience: 'confirme' }, liste: false, consentementFc: false });
    assert.equal(b.appels.length, 0);
  } finally { b.fin(); }
});

test('Effacer le compte : le contact est supprimé chez Brevo, puis le compte', async () => {
  const m = poser();
  const b = brevo();
  try {
    const e = await frais('effacement');
    await e.effacerCompte(globalThis.__monde2 && (await import(MONDE)).clientService(), COMPTE);
    assert.ok(b.appels.some((x) => x.options.method === 'DELETE' && x.url.includes('clara%40cts-coaching.test')));
    assert.ok(m.appels.includes(`deleteUser:${COMPTE}`));
  } finally { b.fin(); }
});

// ─── Le consentement FC, « Aller plus loin », le mode « coupe » ──────────────────────────────────────────────────────────
test('le consentement FC du lot A1 a la phrase du coach, partout', () => {
  const profil = readFileSync(`${RACINE}components/app/ProfilGratuit.tsx`, 'utf8');
  assert.ok(profil.includes('J’accepte que City to Summit garde ces valeurs dans mon compte, seulement pour calculer mes zones et mes repères. Je peux les effacer à tout moment.'));
  assert.ok(!profil.includes('calibrer mes séances'));
  assert.ok(readFileSync(`${RACINE}components/app/FormulaireMeConnecter.tsx`, 'utf8').includes('CONSENTEMENT_FC'));
});

test('« Aller plus loin » : aucun texte du plan n’invite à échanger avec le coach ; le coaching a sa carte à part', () => {
  const page = readFileSync(`${RACINE}app/app/aller-plus-loin/page.tsx`, 'utf8');
  const debut = page.indexOf('{/* Le plan, en tête');
  const fin = page.indexOf('{/* Le coaching, plus discret');
  assert.ok(debut > 0 && fin > debut);
  const plan = page.slice(debut, fin);
  assert.ok(!/échang|coach|appel|discut|contact|écris|ecris/i.test(plan), 'le plan ne parle ni d’échange ni de coach');
  assert.ok(page.slice(fin).includes('89'), 'le coaching : 89 € par mois');
  // L'encadré de l'accueil mène à la nouvelle page, plus à /plans.
  const encadre = readFileSync(`${RACINE}components/app/AllerPlusLoin.tsx`, 'utf8');
  assert.ok(encadre.includes('href="/app/aller-plus-loin"') && !encadre.includes('"/plans"'));
});

test('« Aller plus loin » : les prix viennent de l’API, jamais écrits ; le plan reste fermé par planOuvert()', () => {
  const page = readFileSync(`${RACINE}app/app/aller-plus-loin/page.tsx`, 'utf8');
  assert.match(page, /prixDesFormules\(\)/);
  assert.match(page, /planOuvert\(\)/);
  assert.match(page, /Les plans ouvrent bientôt/);
  assert.ok(!/\b(39|49|59|79)\s*(€|&nbsp;€)/.test(page), 'aucun prix du plan écrit en dur');
});

test('en coupe : les pages nouvelles sont introuvables, la pastille est vide, la liste ne part pas, rien de visible ne change', async () => {
  // Les pages passent par pageGratuite (404 en coupe) ou par la garde de la rubrique des demandes.
  for (const f of ['app/app/aller-plus-loin/page.tsx', 'app/app/coaching/page.tsx']) assert.match(readFileSync(`${RACINE}${f}`, 'utf8'), /pageGratuite\(/, f);
  for (const f of ['app/app/coach/demandes/page.tsx', 'app/app/coach/demandes/[id]/page.tsx'])
    assert.match(readFileSync(`${RACINE}${f}`, 'utf8'), /modeAppGratuite\(\) === 'coupe'\) notFound\(\)/, f);
  const lien = readFileSync(`${RACINE}components/app/LienDemandes.tsx`, 'utf8');
  assert.match(lien, /modeAppGratuite\(\) === 'coupe'.*return null/);
  // Pour un visiteur, un acheteur et un coaché : 404 ou l'app de toujours, comme avant.
  for (const session of [null, { sub: COMPTE, email: EMAIL }]) {
    poser({ mode: null, session });
    const g = await frais('accesGratuit');
    await assert.rejects(g.pageGratuite(), Introuvable);
  }
  // La pastille : zéro, sans lire la base.
  const m = poser({ mode: null, coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE()] } });
  const d = await frais('demandesCoaching');
  assert.equal(await d.nombreDeDemandesOuvertes(), 0);
  assert.equal(m.base.journal.length, 0);
  // La liste e-mail et le formulaire : fermés, rien n'est écrit.
  const a = await frais('actionsDemandesCoaching');
  assert.equal((await a.envoyerDemandeCoaching(ENVOI())).ok, false);
  const g2 = await frais('actionsGratuit');
  assert.equal((await g2.changerListeEmail(true)).ok, false);
  assert.equal(m.base.journal.length, 0);
});

test('ouvert : la pastille compte les demandes ouvertes seulement', async () => {
  poser({ coach: ROMAIN_COACH, tables: { demandes_coaching: [DEMANDE(), DEMANDE({ id: 'd2', compte_id: 'b' }), DEMANDE({ id: 'd3', compte_id: 'c', statut: 'acceptee' })] } });
  const d = await frais('demandesCoaching');
  assert.equal(await d.nombreDeDemandesOuvertes(), 2);
});

test('la migration : une demande par compte, la santé jamais sans consentement, le compte lit et efface seulement', () => {
  const sql = readFileSync(`${RACINE}supabase/migrations/20261116120000_demandes_coaching.sql`, 'utf8');
  assert.match(sql, /compte_id uuid not null unique references public\.comptes \(id\) on delete cascade/);
  assert.match(sql, /check \(sante is null or consentement_sante_le is not null\)/);
  assert.match(sql, /for select to authenticated using \(compte_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql, /for delete to authenticated using/);
  assert.ok(!/for (insert|update)/.test(sql), 'le compte n’écrit pas : le serveur seul');
  assert.match(sql, /statut in \('ouverte', 'acceptee', 'sans_suite'\)/);
});

// ─── Les textes validés par le coach le 16/11/2026 ────────────────────────────────────────────────────────────────────────
// La voix « je » (les demandes ne vont qu'à Romain), « City to Summit » en toutes lettres, et en mode « coupe » aucun titre
// d'onglet des pages cachées.
test('les textes validés : la voix « je », City to Summit en toutes lettres', () => {
  const regles = readFileSync(`${RACINE}lib/app/coachingRegles.ts`, 'utf8');
  const plusLoin = readFileSync(`${RACINE}app/app/aller-plus-loin/page.tsx`, 'utf8');
  assert.match(regles, /pour que je comprenne où tu en es, puis je t’appelle/);
  assert.match(regles, /mot: 'Un mot pour moi'/);
  for (const source of [regles, plusLoin]) assert.doesNotMatch(source, /vous pouvez travailler|le coach comprenne|Un mot pour le coach/);
  for (const f of ['lib/app/actionsGratuit.ts', 'lib/app/actionsZones.ts'])
    assert.doesNotMatch(readFileSync(`${RACINE}${f}`, 'utf8'), /pour que CTS garde/, f);
});

test('en coupe : le titre des pages cachées ne transparaît pas (generateMetadata derrière gratuitOuvert)', () => {
  for (const page of ['app/app/me-connecter/page.tsx', 'app/app/coaching/page.tsx', 'app/app/aller-plus-loin/page.tsx']) {
    const source = readFileSync(`${RACINE}${page}`, 'utf8');
    assert.doesNotMatch(source, /export const metadata/, page);
    assert.match(source, /export async function generateMetadata\(\)[\s\S]*await gratuitOuvert\(\)\) \? \{ title: '[^']+' \} : \{\}/, page);
  }
  // Les pages des dossiers de course (lot B) passent par titreCourses (lib/app/accesCourses.ts), qui ne donne le titre que si la
  // page est ouverte pour la visite : le test de son comportement est dans test-app-gratuite-b.mjs.
  for (const page of ['app/app/courses/page.tsx', 'app/app/courses/nouvelle/page.tsx', 'app/app/courses/[id]/page.tsx', 'app/app/courses/[id]/nutrition/page.tsx']) {
    const source = readFileSync(`${RACINE}${page}`, 'utf8');
    assert.doesNotMatch(source, /export const metadata/, page);
    assert.match(source, /export async function generateMetadata\(\)[\s\S]*return titreCourses\('[^']+'\)/, page);
  }
});
