#!/usr/bin/env node
/**
 * La passe du lundi, l'espace coach et le rappel du dimanche (lot 0 du 16/11/2026 ; lib/app/passeDuLundi.ts,
 * lib/app/rappelDimanche.ts, lib/app/journalEnClair.ts), sans réseau ni base : ce qui est « nouveau » depuis l'écriture, quand le
 * moteur n'est pas rappelé, la semaine telle qu'elle est dans Nolio, « demandé / écrit » en clair, les points d'« À regarder »,
 * les messages d'échec distincts par cause, et le rappel (coupé par défaut, textes validés, heure). Des cas fictifs.
 *
 *   node --test scripts/test-lundi.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Les imports du site n'ont pas d'extension (« ./plan ») : on la leur donne.
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
const l = await import('../lib/app/passeDuLundi.ts');
const rappel = await import('../lib/app/rappelDimanche.ts');
const { reponsesDuSamedi, enClair } = await import('../lib/app/journalEnClair.ts');

// ─── ce qui est nouveau depuis l'écriture ───────────────────────────────────────────────────────────────────────────

test('la signature de ce qui est lu : triée, sans doublon', () => {
  assert.deepEqual(l.signatureDesLectures([{ id: 'b' }, { id: 'a' }, { id: 'a' }], 'r1'), { reels: ['a', 'b'], reponse: 'r1' });
  assert.deepEqual(l.signatureDesLectures([], undefined), { reels: [], reponse: null });
});

test('rien de nouveau : le moteur n’est pas rappelé', () => {
  const avant = { reels: ['a', 'b'], reponse: 'r1' };
  assert.equal(l.quelqueChoseDeNouveau(avant, { reels: ['b', 'a'], reponse: 'r1' }), false);
  assert.equal(l.quelqueChoseDeNouveau(avant, { reels: ['a'], reponse: 'r1' }), false, 'une séance de moins n’est pas du nouveau');
  assert.equal(l.quelqueChoseDeNouveau({ reels: [], reponse: null }, { reels: [], reponse: null }), false);
});

test('une séance remontée depuis l’écriture, n’importe quel jour de la semaine : du nouveau', () => {
  const avant = { reels: ['lundi', 'mardi', 'mercredi'], reponse: 'r1' };
  assert.equal(l.quelqueChoseDeNouveau(avant, { reels: ['lundi', 'mardi', 'mercredi', 'jeudi'], reponse: 'r1' }), true);
  assert.equal(l.quelqueChoseDeNouveau(avant, { reels: ['lundi', 'mardi', 'mercredi', 'dimanche'], reponse: 'r1' }), true);
});

test('une réponse arrivée tard : du nouveau ; la même réponse : rien', () => {
  assert.equal(l.quelqueChoseDeNouveau({ reels: ['a'], reponse: null }, { reels: ['a'], reponse: 'r2' }), true);
  assert.equal(l.quelqueChoseDeNouveau({ reels: ['a'], reponse: 'r1' }, { reels: ['a'], reponse: 'r2' }), true);
  assert.equal(l.quelqueChoseDeNouveau({ reels: ['a'], reponse: 'r1' }, { reels: ['a'], reponse: null }), false);
});

test('sans ce que le dimanche avait lu : tout est à relire', () => {
  assert.equal(l.quelqueChoseDeNouveau(undefined, { reels: [], reponse: null }), true);
});

// ─── quand le moteur est rappelé ────────────────────────────────────────────────────────────────────────────────────

const ok = { quoi: 'Semaine', premiere: false, sansAjustement: false, aLaMain: false, noteDejaPosee: false, aLeContexte: true };
test('le moteur est rappelé sur une semaine du dimanche que le coach n’a pas touchée', () => {
  assert.equal(l.peutAppelerLeMoteur(ok), null);
});
test('jamais sur une semaine annulée par le coach, laissée, à la main, récupération, première de saison, déjà passée', () => {
  assert.match(l.peutAppelerLeMoteur({ ...ok, sansAjustement: true }), /annulés/);
  assert.match(l.peutAppelerLeMoteur({ ...ok, aLaMain: true }), /main/);
  assert.match(l.peutAppelerLeMoteur({ ...ok, quoi: 'Semaine de récupération' }), /récupération/);
  assert.match(l.peutAppelerLeMoteur({ ...ok, premiere: true }), /première/);
  assert.match(l.peutAppelerLeMoteur({ ...ok, noteDejaPosee: true }), /déjà/);
  assert.match(l.peutAppelerLeMoteur({ ...ok, aLeContexte: false }), /pas gardé/);
  assert.match(l.peutAppelerLeMoteur({ ...ok, quoi: undefined }), /revue/);
});

// ─── la semaine telle qu'elle est dans Nolio ce lundi ───────────────────────────────────────────────────────────────

const SPORTS = ['RUN', 'TRAIL'];
test('semaine_dans_nolio : les séances du moteur encore là, leur date, la famille retouchée ; celles du coach en plus', () => {
  const parNolio = new Map([['n1', 'S14-mardi'], ['n2', 'S14-jeudi'], ['n0', 'S13-dimanche']]);
  const planifiees = [
    { id: 'n1', date_start: '2026-11-17', sport: 'RUN', duration: { value: 3600 }, rpe: 3 },
    { id: 'n2', date_start: '2026-11-19', sport: 'RUN', duration: { value: 2700 }, rpe: 7 },
    { id: 'n0', date_start: '2026-11-15', sport: 'RUN', duration: { value: 3600 }, rpe: 3 },
    { id: 'coach', date_start: '2026-11-21', sport: 'TRAIL', duration: { value: 5400 }, rpe: 4 },
    { id: 'velo', date_start: '2026-11-18', sport: 'BIKE', duration: { value: 3600 } },
  ];
  const reels = [{ id: 'a1', date_start: '2026-11-18', sport: 'RUN', duration: { value: 2400 }, debrief: { rpe: 5, feeling: 3 } }];
  const r = l.semaineDansNolio({ lundi: '2026-11-16', numero: 'S14', planifiees, reels, parNolio, familles: new Map([['n2', 'seuil1']]),
    sports: SPORTS, accordLecture: true });
  assert.deepEqual(r.prevues, {
    'S14-mardi': { duree_min: 60, rpe: 3, date: '2026-11-17' },
    'S14-jeudi': { duree_min: 45, rpe: 7, date: '2026-11-19', famille: 'seuil1' },
  });
  assert.deepEqual(r.ajoutees, [
    { date: '2026-11-18', prevue_min: null, rpe_prevu: null, faite: true, duree_min: 40, rpe: 5, ressenti: 3, dplus_m: null },
    { date: '2026-11-21', prevue_min: 90, rpe_prevu: 4, faite: false },
  ]);
});

test('semaine_dans_nolio : sans accord de lecture, ni RPE ni ressenti ; hors jours de course', () => {
  const reels = [{ id: 'a1', date_start: '2026-11-18', sport: 'RUN', duration: { value: 2400 }, debrief: { rpe: 5, feeling: 3 } },
    { id: 'a2', date_start: '2026-11-21', sport: 'RUN', duration: { value: 3000 } }];
  const r = l.semaineDansNolio({ lundi: '2026-11-16', numero: 'S14', planifiees: [], reels, parNolio: new Map(), sports: SPORTS,
    joursDeCourse: new Set(['2026-11-21']), accordLecture: false });
  assert.equal(r.ajoutees.length, 1);
  assert.equal(r.ajoutees[0].rpe, null);
  assert.equal(r.ajoutees[0].ressenti, null);
});

test('semaine_dans_nolio : une séance du coach faite est une séance ajoutée, avec sa durée prévue', () => {
  const planifiees = [{ id: 'coach', date_start: '2026-11-21', sport: 'RUN', duration: { value: 5400 }, rpe: 4 }];
  const reels = [{ id: 'a1', date_start: '2026-11-21', sport: 'RUN', duration: { value: 5100 }, planned: 'coach' }];
  const r = l.semaineDansNolio({ lundi: '2026-11-16', numero: 'S14', planifiees, reels, parNolio: new Map(), sports: SPORTS, accordLecture: false });
  assert.deepEqual(r.ajoutees, [{ date: '2026-11-21', prevue_min: 90, rpe_prevu: 4, faite: true, duree_min: 85, rpe: null, ressenti: null, dplus_m: null }]);
});

// ─── « demandé / écrit » en clair ───────────────────────────────────────────────────────────────────────────────────

const demande = {
  reponse: { jours: ['mardi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 4, source: 'fraiche', du: '2026-11-14' },
  ecrit: { jours: ['mardi', 'samedi', 'dimanche'], jour_sl: 'dimanche', nb_seances: 3 },
  ecarts: [{ type: 'moins', detail: '1 séance de moins', note: 'Semaine allégée : 3 séances, pas tes 4.' }, { type: 'jour', detail: 'jeudi non écrit', note: null }],
};
test('« demandé / écrit » : les phrases de la consigne', () => {
  const c = l.demandeEnClair(demande);
  assert.equal(c.demande, 'Demandé : mar, jeu, sam, dim ; sortie longue dim ; 4 séances (réponse du samedi 14/11, lue)');
  assert.equal(c.ecrit, 'Écrit : 3 séances, mar, sam, dim ; sortie longue dim');
  assert.deepEqual(c.ecarts, [{ texte: '1 séance de moins — Semaine allégée : 3 séances, pas tes 4.', sansPhrase: false },
    { texte: 'jeudi non écrit', sansPhrase: true }]);
});
test('« demandé » quand le moteur suit sa dernière réponse', () => {
  const c = l.demandeEnClair({ ...demande, reponse: { ...demande.reponse, source: 'derniere', du: '2026-11-07' } });
  assert.equal(c.demande, 'Demandé : mar, jeu, sam, dim ; sortie longue dim ; 4 séances (sa dernière réponse, du 07/11 : la réponse de samedi n’a pas été lue)');
});
test('« demandé / écrit » : rien avant toute réponse', () => {
  assert.deepEqual(l.demandeEnClair(null), { demande: null, ecrit: null, ecarts: [] });
  assert.equal(l.demandeEnClair({ reponse: null, ecrit: demande.ecrit, ecarts: [] }).demande, null);
});

// ─── « À regarder » ─────────────────────────────────────────────────────────────────────────────────────────────────

test('« À regarder » : un repli, une réponse illisible, un écart sans phrase, une passe du lundi qui n’a pas réécrit', () => {
  const genres = (p) => l.pointsDeLaReponse(p).map((x) => x.genre);
  assert.deepEqual(genres({ journal: [], revue: null }), []);
  assert.deepEqual(genres({ journal: [{ regle: 'R1' }], revue: { demande } }), ['ecart']);
  assert.deepEqual(genres({ journal: [{ regle: 'REPONSE', du: '2026-11-07' }], revue: null }), ['reponse']);
  const illisible = l.pointsDeLaReponse({ journal: [{ regle: 'REPONSE' }], revue: { lu: { questionnaire_etat: 'illisible', reponse: { illisibles: ['jours'] } } } });
  assert.deepEqual(illisible.map((x) => x.genre), ['illisible'], 'un seul point : illisible l’emporte sur le repli');
  assert.match(illisible[0].texte, /la question des jours/);
  const partielle = l.pointsDeLaReponse({ journal: [{ regle: 'REPONSE' }], revue: { lu: { questionnaire_etat: 'partielle', reponse: { illisibles: ['jours'] } } } });
  assert.deepEqual(partielle.map((x) => x.genre), ['illisible']);
  assert.match(partielle[0].texte, /en partie lue \(la question des jours est illisible\)/);
  assert.deepEqual(genres({ journal: [], revue: { lundi: { etat: 'non_reecrite', changements: ['a', 'b'] } } }), ['lundi']);
  assert.deepEqual(genres({ journal: [], revue: { lundi: { etat: 'reecrite' } } }), []);
  // Moteur 8.468 : la semaine standard (rien de lu de sa semaine passée), en premier.
  const standard = l.pointsDeLaReponse({ journal: [{ regle: 'STANDARD' }, { regle: 'REPONSE', du: '2026-11-07' }], revue: null });
  assert.deepEqual(standard.map((x) => x.genre), ['standard', 'reponse']);
  assert.equal(standard[0].texte, 'rien n’est remonté de sa semaine (ni séance, ni réponse, ni Hooper) : semaine de maintien.');
  assert.deepEqual(genres({ journal: [{ regle: 'NONLU' }, { regle: 'SYNCHRO' }], revue: null }), [], 'une séance non lue n’est pas un point');
});

test('« Appliquer » : la note « Ta semaine » du dimanche est remplacée par le bilan du moteur', () => {
  const envois = [{ semaine: 'S14', seances: [{ nolio_id: 'a' }] }, { semaine: 'S14:bilan', seances: [{ nolio_id: 'note1' }] }, { semaine: 'S13:bilan', seances: [{ nolio_id: 'old' }] }];
  assert.equal(l.noteARemplacer(envois, 'S14', 'Ta semaine a été réécrite.'), 'note1');
  assert.equal(l.noteARemplacer(envois, 'S13', 'Un autre bilan'), 'old');
  // sans bilan, la note ne se touche pas
  assert.equal(l.noteARemplacer(envois, 'S14', undefined), null);
  assert.equal(l.noteARemplacer(envois, 'S14', null), null);
  assert.equal(l.noteARemplacer(envois, 'S14', '  '), null);
  // pas de note posée pour cette semaine (ou sans identifiant) : rien à remplacer
  assert.equal(l.noteARemplacer(envois, 'S15', 'Bilan'), null);
  assert.equal(l.noteARemplacer([{ semaine: 'S14:bilan', seances: [{ nolio_id: null }] }], 'S14', 'Bilan'), null);
});

test('un changement ou une retouche du moteur, en une ligne', () => {
  assert.equal(l.ligneDe('Mardi : EF 45 min'), 'Mardi : EF 45 min');
  assert.equal(l.ligneDe({ jour: 'mardi', detail: 'EF de 60 à 45 min' }), 'mardi : EF de 60 à 45 min');
  assert.equal(l.ligneDe({ date: '2026-11-17', avant: '60 min', apres: '45 min' }), '2026-11-17 : 60 min → 45 min');
  assert.equal(l.ligneDe(null), '');
  // La forme fixée par le contrat 8.468 : detail sans le jour, le jour en tête.
  assert.equal(l.ligneDe({ jour: 'mardi', avant: 'EF plate (0h45)', apres: 'Seuil 2 court vallonné · 15 min — 5 × 3 min (0h44)',
    detail: 'EF plate (0h45) devient Seuil 2 court vallonné · 15 min — 5 × 3 min (0h44)' }),
    'mardi : EF plate (0h45) devient Seuil 2 court vallonné · 15 min — 5 × 3 min (0h44)');
  assert.equal(l.ligneDe({ jour: 'jeudi', type: 'deplacee', detail: 'Seuil 2 court vallonné (0h44), déplacée au jeudi 19/11' }),
    'jeudi : Seuil 2 court vallonné (0h44), déplacée au jeudi 19/11');
  assert.equal(l.ligneDe({ jour: 'samedi', type: 'posee', detail: 'une séance posée par le coach' }), 'samedi : une séance posée par le coach');
});

// ─── un message d'échec distinct par cause (point 1.6) ──────────────────────────────────────────────────────────────

const lue = { jours: ['mardi', 'jeudi'], jour_sl: 'jeudi', nb_seances: 3 };
test('absente : « Pas de réponse au questionnaire du samedi »', () => {
  assert.equal(reponsesDuSamedi(undefined, undefined, false, { etat: 'absente' }), 'Pas de réponse au questionnaire du samedi : le moteur reprend ses jours habituels.');
  assert.equal(reponsesDuSamedi(undefined), 'Pas de réponse au questionnaire du samedi : le moteur reprend ses jours habituels.');
});
test('illisible : la question en cause', () => {
  assert.equal(reponsesDuSamedi({ ...lue, jours: null }, '2026-11-14', false, { etat: 'illisible', illisibles: ['jours'] }),
    'Réponse illisible : la question des jours (un format inattendu). Ses réponses du samedi : sortie longue le jeudi ; 3 séances.');
  const t = reponsesDuSamedi(undefined, undefined, false, { etat: 'illisible', illisibles: ['jours', 'nb_seances'] });
  assert.match(t, /^Réponse illisible : la question des jours et la question du nombre de séances/);
});
test('partielle : « Réponse en partie lue », la question en cause, les champs lus gardés', () => {
  assert.equal(reponsesDuSamedi({ ...lue, jours: null }, '2026-11-14', false, { etat: 'partielle', illisibles: ['jours'] }),
    'Réponse en partie lue : la question des jours illisible (un format inattendu). Ses réponses du samedi : sortie longue le jeudi ; 3 séances.');
  assert.match(reponsesDuSamedi({ jours: null, jour_sl: null, nb_seances: 4 }, '2026-11-14', false, { etat: 'partielle', illisibles: ['jours', 'jour_sl'] }),
    /^Réponse en partie lue : la question des jours et la question du jour de sortie longue illisible/);
});
test('ouverte mais pas envoyée', () => {
  assert.match(reponsesDuSamedi(undefined, undefined, false, { etat: 'absente', cause: 'non_envoyee' }), /^Réponse ouverte mais pas envoyée\./);
});
test('lecture de Nolio en échec : avec l’erreur', () => {
  assert.match(reponsesDuSamedi(undefined, undefined, false, { etat: 'echec', erreur: 'Nolio 503' }), /^Lecture de Nolio en échec \(Nolio 503\)/);
});
test('réponse d’une semaine d’avant : ses jours du JJ/MM', () => {
  const t = reponsesDuSamedi(lue, '2026-11-07', true, { etat: 'absente', cause: 'ancienne' });
  assert.match(t, /Réponse d’une semaine d’avant : ses jours du 07\/11/);
  assert.match(t, /^Pas de réponse au questionnaire du samedi\./);
});
test('arrivée après l’écriture', () => {
  assert.match(reponsesDuSamedi(lue, '2026-11-15', false, { etat: 'lue', tardive: true }), /Réponse arrivée après l’écriture\./);
});
test('lue : comme avant', () => {
  assert.equal(reponsesDuSamedi(lue, '2026-11-14'), 'Ses réponses du samedi : Mardi, Jeudi ; sortie longue le jeudi ; 3 séances.');
});

test('journal en clair : REPONSE et LUNDI', () => {
  assert.deepEqual(enClair({ regle: 'REPONSE', source: 'derniere', du: '2026-11-07' }),
    ['Réponse du samedi non lue : la semaine suit sa réponse du 07/11.']);
  assert.deepEqual(enClair({ regle: 'REPONSE', source: 'derniere', du: '2026-11-07', etat_lecture: 'echec' }),
    ['Réponse du samedi non lue (la lecture de Nolio a échoué) : la semaine suit sa réponse du 07/11.']);
  assert.match(enClair({ regle: 'REPONSE', source: 'fraiche', champs: ['jours'] })[0], /lue en partie/);
  assert.match(enClair({ regle: 'REPONSE', source: 'profil' })[0], /jours de son profil/);
  assert.deepEqual(enClair({ regle: 'LUNDI', cause: 'reponse' }), ['Semaine réécrite le lundi matin : sa réponse arrivée après l’écriture.']);
  assert.match(enClair({ regle: 'LUNDI', effet: 'une séance du dimanche remontée' })[0], /une séance du dimanche remontée/);
});

// ─── le rappel du dimanche ──────────────────────────────────────────────────────────────────────────────────────────

test('le rappel est coupé par défaut ; « oui » seulement l’allume', () => {
  assert.equal(rappel.rappelActif({}), false);
  assert.equal(rappel.rappelActif({ CTS_RAPPEL_DIMANCHE: '' }), false);
  assert.equal(rappel.rappelActif({ CTS_RAPPEL_DIMANCHE: 'non' }), false);
  assert.equal(rappel.rappelActif({ CTS_RAPPEL_DIMANCHE: 'true' }), false);
  assert.equal(rappel.rappelActif({ CTS_RAPPEL_DIMANCHE: ' Oui ' }), true);
});
test('son texte est validé (16/11/2026) ; aucun texte n’invite à échanger avec le coach', () => {
  assert.equal(rappel.TEXTE_RAPPEL_VALIDE, true);
  for (const cas of [{ sansReponse: true, nonRemontee: false }, { sansReponse: false, nonRemontee: true }, { sansReponse: true, nonRemontee: true }]) {
    const t = rappel.texteDuRappel(cas);
    assert.ok(t.length > 0);
    assert.doesNotMatch(t, /coach|écris-moi|réponds à ce message|contacte|échange|discute/i);
  }
  assert.equal(rappel.texteDuRappel({ sansReponse: false, nonRemontee: false }), null);
  assert.match(rappel.texteDuRappel({ sansReponse: true, nonRemontee: false }), /questionnaire/);
  assert.doesNotMatch(rappel.texteDuRappel({ sansReponse: true, nonRemontee: false }), /remonter tes séances/);
  assert.match(rappel.texteDuRappel({ sansReponse: false, nonRemontee: true }), /fais remonter tes séances/);
  assert.doesNotMatch(rappel.texteDuRappel({ sansReponse: false, nonRemontee: true }), /questionnaire/);
  // les trois textes validés, mot pour mot
  const debut = 'Petit rappel : ta semaine prochaine s’écrit ce soir. Pour qu’elle colle à ce que tu as vraiment fait, ';
  const fin = ' Sinon, elle reste au même niveau, puis se recale dès que tout est à jour.';
  assert.equal(rappel.texteDuRappel({ sansReponse: true, nonRemontee: true }), `${debut}réponds au questionnaire du samedi et fais remonter tes séances dans Nolio (synchronise ta montre).${fin}`);
  assert.equal(rappel.texteDuRappel({ sansReponse: true, nonRemontee: false }), `${debut}réponds au questionnaire du samedi.${fin}`);
  assert.equal(rappel.texteDuRappel({ sansReponse: false, nonRemontee: true }), `${debut}fais remonter tes séances dans Nolio (synchronise ta montre).${fin}`);
});
test('l’heure du message : 15 h, ou dans dix minutes si la tâche est lancée plus tard ; jamais après 17 h', () => {
  // Hiver (UTC+1) : 14:05 UTC = 15:05 Paris -> 15:15 ; 13:30 UTC = 14:30 Paris -> 15:00
  assert.equal(rappel.heureDuRappel(new Date('2026-11-22T13:30:00Z')), '15:00');
  assert.equal(rappel.heureDuRappel(new Date('2026-11-22T14:05:00Z')), '15:15');
  assert.equal(rappel.heureDuRappel(new Date('2026-11-22T14:50:00Z')), '16:00');
  assert.equal(rappel.heureDuRappel(new Date('2026-11-22T16:00:00Z')), null);
  // Été (UTC+2) : 14:00 UTC = 16:00 Paris -> 16:10 (15 h est passée)
  assert.equal(rappel.heureDuRappel(new Date('2027-07-04T14:00:00Z')), '16:10');
});
test('une séance de la semaine pas remontée : prévue au plus tard aujourd’hui, du moteur, sans activité reliée', () => {
  const parNolio = new Map([['n1', 'S14-mardi'], ['n2', 'S14-jeudi'], ['n3', 'S14-dimanche'], ['n4', 'S14-vendredi']]);
  const planifiees = [
    { id: 'n1', date_start: '2026-11-17' }, { id: 'n2', date_start: '2026-11-19' }, { id: 'n3', date_start: '2026-11-22' }, { id: 'n4', date_start: '2026-11-27' },
    { id: 'coach', date_start: '2026-11-18' }, { id: 'avant', date_start: '2026-11-15' },
  ];
  assert.deepEqual(rappel.seancesNonRemontees({ lundi: '2026-11-16', jour: '2026-11-22', planifiees, parNolio, reliees: new Set(['n1']) }), ['S14-jeudi', 'S14-dimanche']);
  assert.deepEqual(rappel.seancesNonRemontees({ lundi: '2026-11-16', jour: '2026-11-22', planifiees, parNolio, reliees: new Set(['n1', 'n2', 'n3']) }), []);
});
