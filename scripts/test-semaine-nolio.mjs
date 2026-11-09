#!/usr/bin/env node
/**
 * « Sa semaine qui arrive » telle qu'elle est dans Nolio, chaque retouche marquée pour le coach (lib/app/semaineDansNolio.ts ;
 * décision 11 du coach du 09/11/2026) : la semaine écrite comparée à ce qui est dans Nolio, marque par marque (remplacée,
 * modifiée, raccourcie, allongée, ajoutée, retirée par toi ; déplacée, sans auteur), le volume et les séances de Nolio, et
 * les sept réponses de « Pourquoi cette semaine » sous leurs deux formes. Sans réseau ni base, sur la semaine fictive de la
 * maquette (Lucas Garnier, l'exemple de la doctrine).
 *
 *   node --test scripts/test-semaine-nolio.mjs
 *
 * Node 22.18 ou plus (les fichiers .ts se lisent sans compilation).
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

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
const { comparerLaSemaine, familleDuNom, jourDe, septReponses } = await import('../lib/app/semaineDansNolio.ts');
const { empreinteSeance } = await import('../lib/app/trameNolio.ts');

const COURSE = 'spt_course';
const RENFO_SPORT = 'spt_renfo';
const SPORTS = [COURSE];

// La semaine que le moteur a écrite dimanche 15 novembre 2026 pour Lucas (fictif) : 3h55, 4 séances.
const jour = (id, jourTexte, date_iso, seance, duree, rpe, famille) => ({
  id: `S7-${id}`, jour: jourTexte, date: `${jourTexte.slice(0, 3)}. ${date_iso.slice(8, 10)}/11`, date_iso, seance, terrain: '', duree, rpe,
  famille, lignes: [], terrain_detail: null, carte: null, definition: null,
});
const SEMAINE = {
  lundi: '2026-11-16', seances: '4 séances', volume: '3h55',
  jours: [
    jour('lundi', 'Lundi', '2026-11-16', 'Repos', '—', '—', 'repos'),
    jour('mardi', 'Mardi', '2026-11-17', 'Seuil 2 vallonné · 32 min — 4 × 8 min', '1h10', '7', 'qualite'),
    jour('mercredi', 'Mercredi', '2026-11-18', 'Repos', '—', '—', 'repos'),
    jour('jeudi', 'Jeudi', '2026-11-19', 'EF + sprints en côte', '25 min', '3', 'ef'),
    jour('vendredi', 'Vendredi', '2026-11-20', 'Repos', '—', '—', 'repos'),
    jour('samedi', 'Samedi', '2026-11-21', 'EF vallonnée', '20 min', '3', 'ef'),
    jour('dimanche', 'Dimanche', '2026-11-22', 'SL up & down', '2h', '4', 'sl'),
  ],
};
// Ce que l'app a posé dans Nolio dimanche : chaque séance, sa révision et l'empreinte de son contenu.
const contenu = (nom, minutes, rpe) => empreinteSeance({ name: nom, duration: { value: minutes * 60 }, rpe, workout: [] });
const ENVOI = [
  { jour_id: 'S7-mardi', nolio_id: 'p-mardi', revision: 'r1', contenu: contenu('Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7) },
  { jour_id: 'S7-jeudi', nolio_id: 'p-jeudi', revision: 'r1', contenu: contenu('EF + sprints en côte', 25, 3) },
  { jour_id: 'S7-samedi', nolio_id: 'p-samedi', revision: 'r1', contenu: contenu('EF vallonnée', 20, 3) },
  { jour_id: 'S7-dimanche', nolio_id: 'p-dimanche', revision: 'r1', contenu: contenu('SL up & down', 120, 4) },
  // Ce qui n'est pas une séance à comparer : les notes de repos, le bandeau, une séance que Nolio a refusée.
  { jour_id: 'S7-lundi', nolio_id: 'n-lundi', genre: 'note', revision: '["Repos"]' },
  { jour_id: 'semaine', nolio_id: 'c-semaine', genre: 'cycle', revision: '["Développement"]' },
];
// Une séance telle que Nolio la rend.
const prevue = (id, date, name, minutes, rpe, revision = 'r1', sport = COURSE) =>
  ({ id, date_start: date, name, sport, rpe, revision, duration: { value: minutes * 60 } });
const TELLE_QUELLE = [
  prevue('p-mardi', '2026-11-17', 'Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7),
  prevue('p-jeudi', '2026-11-19', 'EF + sprints en côte', 25, 3),
  prevue('p-samedi', '2026-11-21', 'EF vallonnée', 20, 3),
  prevue('p-dimanche', '2026-11-22', 'SL up & down', 120, 4),
];
const comparer = (nolio, extra = {}) => comparerLaSemaine({ semaine: SEMAINE, envoyees: ENVOI, nolio, sports: SPORTS, ...extra });
const marques = (c) => c.lignes.map((l) => [l.date.slice(8), l.nom, l.barree, l.marques.map((m) => [m.texte, m.avant])]);

test('dimanche soir, juste après l’écriture : la semaine sans marque, le volume et les séances du moteur', () => {
  const c = comparer(TELLE_QUELLE);
  assert.equal(c.retouchee, false);
  assert.equal(c.retirees, 0);
  assert.ok(c.lignes.every((l) => l.marques.length === 0 && !l.barree));
  assert.equal(c.volume_min, 235); // 3h55
  assert.equal(c.seances, 4);
  assert.equal(c.seances_texte, '4 séances');
  // Les notes et le bandeau n'y sont pas ; l'ordre est celui des jours.
  assert.deepEqual(c.lignes.map((l) => l.date.slice(8)), ['17', '19', '21', '22']);
});

test('la semaine de la maquette, retouchée lundi : remplacée, ajoutée, retirée, raccourcie (4h10, 3 séances de course)', () => {
  const c = comparer([
    prevue('p-mardi', '2026-11-17', 'Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7),
    // Le renfo du mercredi, ajouté par le coach : pas une séance de course.
    prevue('n-renfo', '2026-11-18', 'Renfo gainage', 25, null, 'x1', RENFO_SPORT),
    // L'EF de jeudi retirée, sa séance de club posée à la place, le même jour.
    prevue('n-club', '2026-11-19', 'Séance piste club', 75, null, 'x1'),
    // L'EF de samedi retirée sans rien à la place ; la sortie longue raccourcie de 2h à 1h45.
    prevue('p-dimanche', '2026-11-22', 'SL up & down', 105, 4, 'r2'),
  ], { empreintes: new Map([['p-dimanche', contenu('SL up & down', 105, 4)]]) });
  assert.deepEqual(marques(c), [
    ['17', 'Seuil 2 vallonné · 32 min — 4 × 8 min', false, []],
    ['18', 'Renfo gainage', false, [['ajoutée par toi', null]]],
    ['19', 'Séance piste club', false, [['remplacée par toi', 'à la place de : EF + sprints en côte · 25 min · RPE 3']]],
    ['21', 'EF vallonnée', true, [['retirée par toi', null]]],
    ['22', 'SL up & down', false, [['raccourcie par toi', 'écrite : 2h']]],
  ]);
  assert.equal(c.volume_min, 250); // 1h10 + 1h15 + 1h45 : 4h10, sans le renfo
  assert.equal(c.seances, 3);
  assert.equal(c.retouchee, true);
  assert.equal(c.retirees, 1);
});

test('remplacée par toi : la même séance de Nolio, renommée d’une autre famille', () => {
  const c = comparer([...TELLE_QUELLE.filter((x) => x.id !== 'p-jeudi'), prevue('p-jeudi', '2026-11-19', 'Séance piste club', 75, 7, 'r2')]);
  const l = c.lignes.find((x) => x.cle === 'p-jeudi');
  assert.deepEqual(l.marques.map((m) => [m.quoi, m.texte, m.avant]),
    [['remplacee', 'remplacée par toi', 'à la place de : EF + sprints en côte · 25 min · RPE 3']]);
  assert.equal(l.nom, 'Séance piste club');
  assert.equal(l.minutes, 75);
});

test('modifiée par toi : renommée dans la même famille (« écrite : 4 × 8 min »), ou ses étapes et cibles seules', () => {
  const renommee = comparer([prevue('p-mardi', '2026-11-17', 'Seuil 2 vallonné · 30 min — 5 × 6 min', 70, 7, 'r2'), ...TELLE_QUELLE.slice(1)]);
  assert.deepEqual(renommee.lignes[0].marques.map((m) => [m.quoi, m.texte, m.avant]), [['modifiee', 'modifiée par toi', 'écrite : 4 × 8 min']]);
  // Même nom, même durée, mais l'empreinte lue dans Nolio a changé (ses cibles) : modifiée, sans sous-ligne.
  const cibles = comparer([prevue('p-mardi', '2026-11-17', 'Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7, 'r2'), ...TELLE_QUELLE.slice(1)],
    { empreintes: new Map([['p-mardi', '["autre contenu"]']]) });
  assert.deepEqual(cibles.lignes[0].marques.map((m) => [m.quoi, m.avant]), [['modifiee', null]]);
  // Sans empreinte (un envoi d'avant le 04/11/2026) : la révision changée, le même jour, suffit.
  const sansEmpreinte = comparerLaSemaine({ semaine: SEMAINE, sports: SPORTS, envoyees: ENVOI.map(({ contenu: _c, ...s }) => s),
    nolio: [prevue('p-mardi', '2026-11-17', 'Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7, 'r2'), ...TELLE_QUELLE.slice(1)] });
  assert.deepEqual(sansEmpreinte.lignes[0].marques.map((m) => m.quoi), ['modifiee']);
});

test('raccourcie et allongée par toi, avec la durée écrite', () => {
  const c = comparer([
    prevue('p-mardi', '2026-11-17', 'Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7),
    prevue('p-jeudi', '2026-11-19', 'EF + sprints en côte', 45, 3, 'r2'),
    prevue('p-samedi', '2026-11-21', 'EF vallonnée', 20, 3),
    prevue('p-dimanche', '2026-11-22', 'SL up & down', 105, 4, 'r2'),
  ]);
  assert.deepEqual(c.lignes.filter((l) => l.marques.length).map((l) => l.marques.map((m) => [m.texte, m.avant])),
    [[['allongée par toi', 'écrite : 25 min']], [['raccourcie par toi', 'écrite : 2h']]]);
  assert.equal(c.volume_min, 70 + 45 + 20 + 105);
});

test('ajoutée par toi : une séance que l’app n’a pas posée ; ce que l’app a posé pour un autre objectif ne l’est pas', () => {
  const c = comparer([...TELLE_QUELLE, prevue('n-ef', '2026-11-20', 'Footing souple', 30, 3, 'x1'), prevue('autre-objectif', '2026-11-18', 'EF plate', 40, 3)],
    { posees: new Set(['autre-objectif']) });
  const ajoutees = c.lignes.filter((l) => l.marques.some((m) => m.quoi === 'ajoutee'));
  assert.deepEqual(ajoutees.map((l) => l.nom), ['Footing souple']);
  assert.deepEqual(c.lignes.find((l) => l.cle === 'autre-objectif').marques, []);
  // Les deux comptent dans le volume de Nolio.
  assert.equal(c.volume_min, 235 + 30 + 40);
  assert.equal(c.seances, 6);
});

test('retirée par toi : son nom barré à son jour écrit, hors du volume ; « une séance retirée compte comme non faite »', () => {
  const c = comparer(TELLE_QUELLE.filter((x) => x.id !== 'p-samedi'));
  const l = c.lignes.find((x) => x.date === '2026-11-21');
  assert.equal(l.barree, true);
  assert.equal(l.nom, 'EF vallonnée');
  assert.deepEqual(l.marques.map((m) => [m.quoi, m.texte]), [['retiree', 'retirée par toi']]);
  assert.equal(c.volume_min, 215);
  assert.equal(c.seances, 3);
  assert.equal(c.retirees, 1);
  assert.equal(c.retouchee, true);
});

test('déplacée au jeudi, sans auteur : la révision change, le contenu non ; ce n’est pas une retouche du coach', () => {
  const c = comparer([...TELLE_QUELLE.filter((x) => x.id !== 'p-mardi'), prevue('p-mardi', '2026-11-19', 'Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7, 'r2')],
    { empreintes: new Map([['p-mardi', contenu('Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7)]]) });
  const l = c.lignes.find((x) => x.cle === 'p-mardi');
  assert.equal(l.date, '2026-11-19');
  assert.deepEqual(l.marques.map((m) => [m.quoi, m.texte, m.avant]), [['deplacee', 'déplacée au jeudi', 'écrite mardi']]);
  assert.equal(c.retouchee, false);
  // Sans empreinte non plus : un changement de jour seul ne dit pas de modification.
  const sans = comparerLaSemaine({ semaine: SEMAINE, sports: SPORTS, envoyees: ENVOI.map(({ contenu: _c, ...s }) => s),
    nolio: [...TELLE_QUELLE.filter((x) => x.id !== 'p-mardi'), prevue('p-mardi', '2026-11-19', 'Seuil 2 vallonné · 32 min — 4 × 8 min', 70, 7, 'r2')] });
  assert.deepEqual(sans.lignes.find((x) => x.cle === 'p-mardi').marques.map((m) => m.quoi), ['deplacee']);
  // Déplacée et raccourcie : les deux marques.
  const deux = comparer([...TELLE_QUELLE.filter((x) => x.id !== 'p-dimanche'), prevue('p-dimanche', '2026-11-21', 'SL up & down', 100, 4, 'r2')]);
  assert.deepEqual(deux.lignes.find((x) => x.cle === 'p-dimanche').marques.map((m) => m.texte), ['raccourcie par toi', 'déplacée au samedi']);
});

test('déplacée hors de la semaine : barrée à son jour écrit, avec son nouveau jour', () => {
  const c = comparer([...TELLE_QUELLE.filter((x) => x.id !== 'p-dimanche'), prevue('p-dimanche', '2026-11-23', 'SL up & down', 120, 4, 'r2')]);
  const l = c.lignes.find((x) => x.date === '2026-11-22');
  assert.equal(l.barree, true);
  assert.deepEqual(l.marques.map((m) => m.texte), ['déplacée au lundi 23/11']);
  assert.equal(c.volume_min, 115);
});

test('une séance retirée puis reposée à l’identique le même jour : pas de marque', () => {
  const c = comparer([...TELLE_QUELLE.filter((x) => x.id !== 'p-samedi'), prevue('n-samedi', '2026-11-21', 'EF vallonnée', 20, 3, 'x1')]);
  assert.deepEqual(c.lignes.find((x) => x.date === '2026-11-21').marques, []);
  assert.equal(c.retouchee, false);
});

test('une séance de course posée le jour d’une EF et d’un renfo retirés remplace l’EF, pas le renfo', () => {
  const avecRenfo = [...ENVOI, { jour_id: 'S7-samedi:renfo', nolio_id: 'p-renfo', revision: 'r1', contenu: contenu('Renfo — gainage', 25, null) }];
  const c = comparerLaSemaine({ semaine: SEMAINE, envoyees: avecRenfo, sports: SPORTS,
    nolio: [...TELLE_QUELLE.filter((x) => x.id !== 'p-samedi'), prevue('n-club', '2026-11-21', 'Séance piste club', 60, null, 'x1')] });
  const samedi = c.lignes.filter((x) => x.date === '2026-11-21').map((l) => [l.nom, l.barree, l.marques.map((m) => m.quoi)]);
  assert.deepEqual(samedi, [
    ['Séance piste club', false, ['remplacee']],
    ['Renfo — gainage', true, ['retiree']],
  ]);
});

test('la semaine de la course : « + la course », le jour de course tel que le moteur l’a écrit', () => {
  const semaine = { ...SEMAINE, seances: '3 séances + la course',
    jours: SEMAINE.jours.map((j) => (j.id === 'S7-samedi' ? { ...j, seance: 'Compétition — GRF18', duree: '1h40', rpe: 'Course', famille: 'course' } : j)) };
  const c = comparerLaSemaine({ semaine, envoyees: ENVOI.filter((s) => s.jour_id !== 'S7-samedi'), sports: SPORTS,
    nolio: TELLE_QUELLE.filter((x) => x.id !== 'p-samedi') });
  const course = c.lignes.find((x) => x.date === '2026-11-21');
  assert.equal(course.nom, 'Compétition — GRF18');
  assert.equal(course.ecrite, true);
  assert.deepEqual(course.marques, []);
  assert.equal(c.seances_texte, '3 séances + la course');
  assert.equal(c.volume_min, 215);
});

test('la famille d’un nom et le jour d’une date', () => {
  assert.equal(familleDuNom('SL finie au Seuil 1'), 'sl');
  assert.equal(familleDuNom('EF + sprints en côte'), 'ef');
  assert.equal(familleDuNom('Seuil 1 vallonné · 15 min — 3 × 5 min'), 'seuil1');
  assert.equal(familleDuNom('VO2 long · 15 min — 2 × 4′, 4 × 1′, 6 × 30″ · vallonné'), 'vo2max');
  assert.equal(familleDuNom('Navettes descentes actives'), 'mecanique');
  assert.equal(familleDuNom('Séance piste club'), null);
  assert.equal(jourDe('2026-11-19'), 'jeudi');
  assert.equal(jourDe('2026-11-22'), 'dimanche');
});

test('les sept réponses : le contrat du moteur 8.461, ou pourquoi.sept_questions de doctrine-d1 ; sinon rien', () => {
  const contrat = [
    { n: 1, libelle: 'Qui', texte: 'intermédiaire, trail en vallonné, 4 jours par semaine.' },
    { n: 6, libelle: 'Séances clés', texte: 'Seuil 2 fait au bon effort.', manque: 'son Hooper de dimanche, pas de réponse ; sa fatigue n’est lue que sur ses RPE.' },
    { n: 7, libelle: 'Donc', texte: 'Seuil 2 à la marche suivante.' },
  ];
  assert.deepEqual(septReponses(contrat).map((r) => [r.n, r.libelle, r.manque]), [
    [1, 'Qui', []],
    [6, 'Séances clés', ['Manque : son Hooper de dimanche, pas de réponse ; sa fatigue n’est lue que sur ses RPE.']],
    [7, 'Donc', []],
  ]);
  // La forme de la branche doctrine-d1 du moteur, rangée dans le pourquoi d'avant ; « Manque : » pas doublé.
  const d1 = { profil: [], ou: '', seances: [], placement: '', sept_questions: [
    { question: 'Qui', reponse: 'confirmé.' }, { question: 'Objectif', reponse: 'OCC.' }, { libelle: 'Prévu', texte: 'x.', manque: ['Manque : sa réponse du samedi.'] },
  ] };
  assert.deepEqual(septReponses(null, d1).map((r) => [r.n, r.libelle, r.texte, r.manque]),
    [[1, 'Qui', 'confirmé.', []], [2, 'Objectif', 'OCC.', []], [3, 'Prévu', 'x.', ['Manque : sa réponse du samedi.']]]);
  // Le pourquoi d'avant, sans les sept réponses : rien (« Pourquoi cette semaine » reste replié dessous).
  assert.equal(septReponses({ profil: ['Niveau : confirmé.'], ou: '', seances: [], placement: '' }), null);
  assert.equal(septReponses(null, undefined, []), null);
  assert.equal(septReponses([{ libelle: '', texte: 'x' }]), null);
});
