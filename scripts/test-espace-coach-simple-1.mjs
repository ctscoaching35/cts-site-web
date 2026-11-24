#!/usr/bin/env node
/**
 * L'ESPACE COACH SIMPLE SOUS LA 9.x, PREMIÈRE SIMPLIFICATION (décision 220 du coach, 24/11/2026 ; reports/Application coach — revue de simplicité, 24-11.md) :
 * « un seul endroit pour ce qui est à faire » (« Urgent » est fondu dans « Mes athlètes », une section « À faire » en haut, un seul « Réglé ») et, de la cinquième,
 * les messages d'infrastructure (la clé de l'API Nolio, la migration de Supabase) qui ne sont plus lus par le coach sous la 9.x. Sous la 8.x, RIEN ne change.
 * Les écrans ne se rendent pas ici : le calcul est essayé (lib/app/espaceCoachSimple.ts) et la garde `v9` est lue dans le source des pages.
 * Aucun réseau, aucune donnée d'athlète.
 *
 *   node --test scripts/test-espace-coach-simple-1.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const source = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');
const lib = await import(`${RACINE}lib/app/espaceCoachSimple.ts`);
const { SIGNAL, etiquettes, groupeUrgent, texteBilan, urgentDe, ordonner } = await import(`${RACINE}lib/app/espaceParAthlete.ts`);
const { entreeDe } = await import(`${RACINE}lib/app/entree.ts`);
const {
  TEXTES_A_FAIRE, aFaireDe, etiquettesSansAFaire, lesSeriesAFaire, liensDuMenu, manqueDeLaLigne, montrerLInfra, nombreAFaire, pointsDeSaPage,
  rubriqueActive, rubriqueDeLaPastille, semainesDansSesPoints, texteBilanV9, texteDesSeries,
} = lib;

const point = (niveau, genre, extra = {}) => ({ niveau, genre, athlete: 'x', texte: `${genre}.`, action: '', href: '', cle: `${genre}:${Math.random()}`, ...extra });
// Les athlètes du lundi : de quoi remplir « À faire » (les quatre groupes d'« Urgent ») et ce qui n'y va jamais (« À venir »).
const ATHLETES = [
  { id: 'hugo', nom: 'Hugo', points: [point('sante', 'commentaire'), point('arrive', 'preparation')], moteur: null },
  { id: 'ines', nom: 'Inès', points: [point('sante', 'rpe')], moteur: { texte: 'Semaine ajustée' } },
  { id: 'camille', nom: 'Camille', points: [point('bloque', 'semaine', { planId: 'p-camille', action: 'Réessayer ›' })], moteur: null },
  { id: 'julien', nom: 'Julien', points: [point('sante', 'silence')], moteur: null },
  { id: 'manon', nom: 'Manon', points: [point('bloque', 'demarrer'), point('bloque', 'accord')], moteur: null },
  { id: 'lea', nom: 'Léa', points: [], moteur: null },
  { id: 'nicolas', nom: 'Nicolas', points: [point('arrive', 'course_nolio')], moteur: null },
];
const lignes = ordonner(ATHLETES.map((a) => ({ ...a, groupe: 0 })));

// ─── Le menu de gauche ──────────────────────────────────────────────────────────────────────────────────────────────

test('le menu : sous la 8.x les trois entrées d’avant, ligne pour ligne ; sous la 9.x, plus d’« Urgent »', () => {
  assert.deepEqual(liensDuMenu(false), [['athletes', 'Mes athlètes', '/app/coach'], ['urgent', 'Urgent', '/app/coach/urgent'], ['chiffres', 'Chiffres', '/app/coach/chiffres']]);
  assert.deepEqual(liensDuMenu(true), [['athletes', 'Mes athlètes', '/app/coach'], ['chiffres', 'Chiffres', '/app/coach/chiffres']]);
  assert.ok(!JSON.stringify(liensDuMenu(true)).includes('rgent'));
});

test('la pastille des athlètes qui attendent : sur « Urgent » sous la 8.x, sur « Mes athlètes » sous la 9.x (qui est bien dans le menu)', () => {
  assert.equal(rubriqueDeLaPastille(false), 'urgent');
  assert.equal(rubriqueDeLaPastille(true), 'athletes');
  assert.ok(liensDuMenu(false).some(([cle]) => cle === rubriqueDeLaPastille(false)));
  assert.ok(liensDuMenu(true).some(([cle]) => cle === rubriqueDeLaPastille(true)));
});

test('la page « Séries du samedi » allume « Mes athlètes » sous la 9.x ; rien d’autre ne change de rubrique', () => {
  assert.equal(rubriqueActive('urgent', true), 'athletes');
  for (const r of ['athletes', 'chiffres', 'demandes']) assert.equal(rubriqueActive(r, true), r);
  for (const r of ['athletes', 'urgent', 'chiffres', 'demandes']) assert.equal(rubriqueActive(r, false), r);
});

test('le cadre lit le moteur lui-même (async, comme les autres composants serveur) et n’écrit plus ses entrées en dur', () => {
  const c = source('components/app/CadreCoach.tsx');
  assert.match(c, /export default async function CadreCoach\(/);
  assert.match(c, /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/);
  assert.match(c, /const liens = liensDuMenu\(v9\);/);
  assert.match(c, /\{cle === pastille && urgents > 0 && \(/);
  assert.ok(!/'\/app\/coach\/urgent'/.test(c), 'le lien d’« Urgent » n’est plus qu’au menu de la 8.x (lib/app/espaceCoachSimple.ts)');
  assert.match(source('lib/app/espaceCoachSimple.ts'), /\['urgent', 'Urgent', '\/app\/coach\/urgent'\]/);
});

// ─── « À faire » : les points d'« Urgent », une seule fois ──────────────────────────────────────────────────────────────

test('« À faire » reprend les points d’« Urgent » : une ligne par point, dans l’ordre des quatre groupes, jamais « À venir »', () => {
  const urgent = urgentDe(lignes);
  const afaire = aFaireDe(urgent);
  // Les mêmes données : chaque ligne d'« Urgent » est dans « À faire », une seule fois, et rien d'autre.
  assert.deepEqual(afaire, urgent.flatMap((g) => g.lignes));
  assert.equal(afaire.length, 6, 'commentaire, rpe, silence, semaine, démarrer, accord');
  assert.deepEqual(afaire.map((l) => l.point.genre), ['commentaire', 'rpe', 'silence', 'semaine', 'demarrer', 'accord']);
  assert.ok(afaire.every((l) => l.point.niveau !== 'arrive'));
  assert.equal(new Set(afaire.map((l) => l.point.cle)).size, afaire.length, 'jamais deux fois le même point');
  assert.deepEqual(aFaireDe([]), []);
});

test('« À faire » compte ses lignes : les points, plus la ligne des séries du samedi quand il y en a', () => {
  const afaire = aFaireDe(urgentDe(lignes));
  assert.equal(nombreAFaire(afaire, 0), 6);
  assert.equal(nombreAFaire(afaire, 3), 7);
  assert.equal(nombreAFaire([], 0), 0);
  assert.equal(nombreAFaire([], 2), 1);
  assert.equal(TEXTES_A_FAIRE.rien, 'Rien à faire aujourd’hui.');
  assert.equal(texteDesSeries(1), '1 série du samedi à retirer dans Nolio');
  assert.equal(texteDesSeries(3), '3 séries du samedi à retirer dans Nolio');
});

test('les séries du samedi : lues sous la 9.x seulement, dans la base du site ; 0 sous la 8.x et quand la lecture échoue', async () => {
  let appels = 0;
  const lire = async (coach, jour) => { appels += 1; assert.equal(coach, 'coach-1'); assert.match(jour, /^\d{4}-\d{2}-\d{2}$/); return [{}, {}]; };
  assert.equal(await lesSeriesAFaire('coach-1', false, lire), 0);
  assert.equal(appels, 0, 'sous la 8.x, la base n’est pas lue');
  assert.equal(await lesSeriesAFaire('coach-1', true, lire), 2);
  assert.equal(await lesSeriesAFaire('coach-1', true, async () => null), 0);
  assert.equal(await lesSeriesAFaire('coach-1', true, async () => { throw new Error('base muette'); }), 0);
  assert.equal(await lesSeriesAFaire('coach-1', true, async () => [], '2026-11-28'), 0);
});

test('« À faire » garde le geste et le « Réglé » d’« Urgent » : les mêmes composants, un seul « Réglé » par ligne, aucun pour une ligne sans geste', () => {
  const c = source('components/app/AFaire.tsx');
  assert.match(c, /import \{ BOUTON_POINT, Geste, Regle \} from '\.\/PointsCoach';/);
  assert.equal((c.match(/<Geste r=\{point\} \/>/g) ?? []).length, 1);
  assert.equal((c.match(/<Regle cles=\{\[point\.cle\]\} \/>/g) ?? []).length, 1);
  assert.match(c, /\{!point\.sansGeste && \(\s*<div className="flex items-center gap-2">\s*<Geste r=\{point\} \/>\s*<Regle cles=\{\[point\.cle\]\} \/>/);
  assert.match(c, /<Link href=\{`\/app\/coach\/athlete\/\$\{athleteId\}`\}/, 'le nom ouvre la page de l’athlète');
  assert.match(c, /\{point\.sous && /);
  // La ligne des séries du samedi : un lien vers l'écran des séries, sans « Réglé » (elle s'en va d'elle-même).
  assert.match(c, /href="\/app\/coach\/series-du-samedi"/);
  assert.ok(!/Réglé/.test(c.split('\n').filter((l) => !l.startsWith('//')).join('\n')), 'aucun « Réglé » écrit à la main : celui de PointsCoach.tsx');
  // Les quatre groupes d'« Urgent » ne sont plus des titres ; un seul titre, « À faire ».
  for (const titre of ['A besoin de toi', 'Ne court plus', 'Semaine pas partie', 'Objectif bloqué']) assert.ok(!c.includes(titre), titre);
  assert.ok(!/\bUrgent\b/.test(c.split('\n').filter((l) => !l.startsWith('//')).join('\n')));
});

test('« Mes athlètes » sous la 9.x : « À faire » est avant la liste, sur les mêmes données qu’« Urgent » ; sous la 8.x, rien ne s’y ajoute', () => {
  const p = source('app/app/coach/page.tsx');
  assert.match(p, /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/);
  assert.match(p, /\{v9 && <AFaire lignes=\{aFaireDe\(espace\.urgent\)\} series=\{series\} \/>\}/);
  assert.ok(p.indexOf('<AFaire') > -1 && p.indexOf('<AFaire') < p.indexOf('<TableauAthletes'), '« À faire » est avant la liste des athlètes');
  assert.ok(p.indexOf('<CarteDemandes />') < p.indexOf('<AFaire'), 'en tête, juste après la demande de coaching qui attend');
  assert.match(p, /const series = await lesSeriesAFaire\(coach\.compteId, v9\);/);
  assert.equal((p.match(/<AFaire/g) ?? []).length, 1);
  // Le lien des séries du samedi passe par « À faire » : la page ne lit pas le module des séries elle-même (scripts/test-series-du-samedi.mjs).
  assert.ok(!p.includes('seriesDuSamedi'));
  assert.ok(source('lib/app/espaceCoachSimple.ts').includes('./seriesDuSamedi'));
  assert.ok(!source('components/app/AFaire.tsx').includes('seriesDuSamedi'));
});

// ─── Un même point ne s'affiche jamais deux fois ────────────────────────────────────────────────────────────────────────

test('la colonne « Ce qui l’attend » ne redit plus ce que « À faire » dit : il reste ce qui arrive et ce que le moteur a réglé seul', () => {
  const [hugo, ines, camille, , , lea, nicolas] = ATHLETES.map((a) => a);
  // Un point d'« À faire » et un « À venir » : l'« À venir » seul, en gris.
  assert.deepEqual(etiquettesSansAFaire(hugo.points, hugo.moteur), [{ texte: SIGNAL.preparation, ton: 'neutre', detail: 'Preparation' }]);
  // Un point d'« À faire » et une décision du moteur : la décision seule.
  assert.deepEqual(etiquettesSansAFaire(ines.points, ines.moteur).map((e) => e.texte), ['Semaine ajustée']);
  // Un point d'« À faire » et rien d'autre : aucune étiquette (la colonne dit un tiret), jamais « Rien à signaler ».
  assert.deepEqual(etiquettesSansAFaire(camille.points, camille.moteur), []);
  // Rien du tout : « Rien à signaler », comme avant. Un « À venir » seul : comme avant.
  assert.deepEqual(etiquettesSansAFaire(lea.points, lea.moteur), [{ texte: 'Rien à signaler', ton: 'ok' }]);
  assert.deepEqual(etiquettesSansAFaire(nicolas.points, nicolas.moteur), etiquettes(nicolas.points, nicolas.moteur));
});

test('aucun point d’« À faire » n’a d’étiquette dans la colonne : chaque point est dit une fois', () => {
  const afaire = aFaireDe(urgentDe(lignes));
  for (const l of lignes) {
    const textes = etiquettesSansAFaire(l.points, l.moteur).map((e) => e.texte);
    for (const { athleteId, point } of afaire.filter((x) => x.athleteId === l.id)) {
      assert.ok(!textes.includes(SIGNAL[point.genre]), `${l.nom} : « ${SIGNAL[point.genre]} » est dans « À faire », pas dans la colonne`);
    }
  }
  // Et ce qui n'est pas dans « À faire » (« À venir ») n'en est pas retiré.
  for (const l of lignes) {
    for (const p of l.points.filter((x) => groupeUrgent(x) === null)) assert.ok(etiquettesSansAFaire(l.points, l.moteur).some((e) => e.texte === SIGNAL[p.genre]), p.genre);
  }
});

test('sous la 8.x la colonne est celle d’avant : la page n’y touche pas, et un tiret ne s’y ajoute que sans aucune étiquette', () => {
  const p = source('app/app/coach/page.tsx');
  assert.match(p, /const lignes = v9 \? espace\.lignes\.map\(\(e\) => \(\{ \.\.\.e, etiquettes: etiquettesSansAFaire\(e\.points, e\.moteur\) \}\)\) : espace\.lignes;/);
  const t = source('components/app/TableauAthletes.tsx');
  assert.match(t, /\{e\.etiquettes\.map\(\(x\) => <EtiquetteAthlete key=\{x\.texte\} e=\{x\} \/>\)\}\s*\{e\.etiquettes\.length === 0 && <span className="text-\[#5E5C78\]">—<\/span>\}/);
  // Sous la 8.x, etiquettes() rend toujours au moins une étiquette : le tiret ne s'y montre jamais.
  for (const l of lignes) assert.ok(etiquettes(l.points, l.moteur).length >= 1);
});

test('sous son nom, « Nolio à associer » et « sans accord » ne sont pas redits quand « À faire » les dit ; sous la 8.x, la règle d’avant', () => {
  const avant = (a) => [!a.nolio && 'Nolio à associer', a.nolio && !a.accord && 'sans accord'].filter(Boolean);
  for (const nolio of [true, false]) {
    for (const accord of [true, false]) {
      const a = { nolio, accord };
      for (const points of [[], [{ genre: 'nolio' }], [{ genre: 'accord' }], [{ genre: 'nolio' }, { genre: 'accord' }]]) {
        assert.deepEqual(manqueDeLaLigne(a, points, false), avant(a), `8.x : ${JSON.stringify(a)} ${JSON.stringify(points)}`);
      }
    }
  }
  assert.deepEqual(manqueDeLaLigne({ nolio: false, accord: false }, [{ genre: 'nolio' }], true), []);
  assert.deepEqual(manqueDeLaLigne({ nolio: true, accord: false }, [{ genre: 'accord' }], true), []);
  // Sans le point (rien à démarrer, ou point marqué « Réglé »), la pastille reste : l'état ne se perd pas.
  assert.deepEqual(manqueDeLaLigne({ nolio: false, accord: false }, [], true), ['Nolio à associer']);
  assert.deepEqual(manqueDeLaLigne({ nolio: true, accord: false }, [{ genre: 'nolio' }], true), ['sans accord']);
  assert.match(source('components/app/TableauAthletes.tsx'), /const manque = manqueDeLaLigne\(a, e\.points, v9\);/);
});

test('le bandeau du dimanche : sous la 9.x, ce qui est parti seulement ; ni les semaines pas parties ni les athlètes qui attendent (ce sont des points d’« À faire »)', () => {
  assert.equal(texteBilanV9(8), '8 semaines parties.');
  assert.equal(texteBilanV9(1), '1 semaine partie.');
  assert.equal(texteBilanV9(0), null);
  assert.ok(!/pas partie|attend/.test(texteBilanV9(8)));
  // Sous la 8.x, la phrase d'avant, telle quelle.
  assert.equal(texteBilan(8, 1, 7), '8 semaines parties, 1 pas partie · 7 athlètes attendent quelque chose de toi.');
  const p = source('app/app/coach/page.tsx');
  assert.match(p, /\{bilan && !v9 && \(\s*<Link href="\/app\/coach\/urgent" className="flex items-center justify-between gap-3 bg-indigo text-white rounded-\[14px\] p-4">/);
  assert.match(p, /texteBilan\(bilan\.parties, bilan\.pasParties, espace\.urgents\)/);
  assert.match(p, /<span className="text-xs text-\[#D6D5E6\] whitespace-nowrap">Urgent ›<\/span>/);
  assert.match(p, /const bilanV9 = v9 && bilan \? texteBilanV9\(bilan\.parties\) : null;/);
  assert.match(p, /\{bilanV9 && bilan && \(\s*<div className="bg-indigo text-white rounded-\[14px\] p-4 text-sm">/, 'sous la 9.x, un bandeau qui n’est pas un lien');
});

test('le sous-titre de « Mes athlètes » : celui d’avant sous la 8.x, « ce qui t’attend, puis tes athlètes » sous la 9.x', () => {
  assert.match(source('app/app/coach/page.tsx'), /\{v9 \? TEXTES_A_FAIRE\.sousTitre : 'tes athlètes un par un, ceux qui t’attendent en tête'\}/);
  assert.equal(TEXTES_A_FAIRE.sousTitre, 'ce qui t’attend, puis tes athlètes');
});

// ─── La page de l'athlète : ses points, une seule fois sur la page ────────────────────────────────────────────────────────

test('« À faire pour lui » : ce que « Son entrée » porte déjà (associer Nolio, « Accord reçu », démarrer) n’est pas redit ; le reste reste', () => {
  const entree = entreeDe({ athleteId: 'a1', nolio: true, accord: false, programmation: 'auto',
    objectif: { plan_id: 'p1', ecrit: true, demarre: false, prevu: null }, dimanchesJusqua: null, aujourdhui: '2026-11-24' });
  assert.equal(entree.complete, false);
  const points = [point('bloque', 'accord'), point('bloque', 'demarrer'), point('bloque', 'nolio'), point('sante', 'commentaire'), point('bloque', 'semaine'), point('bloque', 'profil'), point('arrive', 'suite')];
  // Reliée à Nolio (« nolio » fait) : un éventuel point « nolio » n'est pas dans la carte, il reste ; « accord » et « démarrer » y sont, ils partent.
  assert.deepEqual(pointsDeSaPage(points, entree).map((p) => p.genre), ['nolio', 'commentaire', 'semaine', 'profil', 'suite']);
  // Une entrée complète n'est pas affichée : tous ses points restent.
  const complete = { complete: true, etapes: entree.etapes.map((e) => ({ ...e, fait: true })) };
  assert.deepEqual(pointsDeSaPage(points, complete), points);
  // Sans compte Nolio associé : la carte dit « Associer », le point « nolio » part.
  const sansNolio = entreeDe({ athleteId: 'a1', nolio: false, accord: false, programmation: 'auto', objectif: null, dimanchesJusqua: null, aujourdhui: '2026-11-24' });
  assert.ok(!pointsDeSaPage([point('bloque', 'nolio'), point('sante', 'mot')], sansNolio).some((p) => p.genre === 'nolio'));
  assert.deepEqual(pointsDeSaPage([], entree), []);
});

test('la semaine pas partie n’a son bouton « Réessayer » qu’une fois sur la page : dans « À faire pour lui » quand elle y est, dans « Sa semaine qui arrive » sinon', () => {
  assert.deepEqual(semainesDansSesPoints([point('bloque', 'semaine', { planId: 'p1' }), point('sante', 'mot'), point('bloque', 'semaine'), point('bloque', 'semaine', { planId: 'p2' })]), ['p1', 'p2']);
  assert.deepEqual(semainesDansSesPoints([]), []);
  const c = source('components/app/SemaineQuiArrive.tsx');
  assert.match(c, /export default function SemainesQuiArrivent\(\{ semaines, prevision, vers, aLaMain, v9 = false, dansSesPoints = \[\] \}/);
  assert.match(c, /\) : v9 && dansSesPoints\.includes\(s\.planId\) \? null : s\.ceSoir \? \(/);
  // Le « Réessayer » de la carte et son texte de la 8.x sont toujours là, mot pour mot.
  assert.match(c, /\) : \(\s*<ReessayerSemaine planId=\{s\.planId\} \/>\s*\)\}/);
  assert.ok(c.includes('Ce soir, elle se refait aux reprises de 20 h et 22 h ; lundi, ce qui manque encore est dans « Urgent », avec « Réessayer ».'));
  const page = source('app/app/coach/athlete/[id]/page.tsx');
  assert.match(page, /const pointsIci = v9 \? pointsDeSaPage\(points, entree\) : points;/);
  assert.match(page, /\{pointsIci\.length === 0 \? <p className="text-sm text-teal font-semibold">Rien à faire pour lui pour l’instant\.<\/p> : \(/);
  assert.match(page, /\{pointsIci\.map\(\(p\) => \(/);
  assert.match(page, /v9=\{v9\} dansSesPoints=\{v9 \? semainesDansSesPoints\(pointsIci\) : \[\]\}/);
  // Un seul bloc « À faire pour lui », un seul « Réglé » par point.
  assert.equal((page.match(/<Regle cles=/g) ?? []).length, 1);
  assert.equal((page.match(/Surtitre>À faire pour lui</g) ?? []).length, 1);
  // La page ne reprend pas la section de l'accueil, et n'est pas restructurée (l'étape 2 viendra).
  assert.ok(!page.includes('<AFaire'));
  assert.ok(page.includes('Sa revue du dimanche') && page.includes('Ses 7 jours') && page.includes('Ses objectifs') && page.includes('Réglages'));
});

// ─── La page « Urgent » et ses liens ───────────────────────────────────────────────────────────────────────────────────

test('« Urgent » sous la 9.x renvoie à « Mes athlètes » avant de rien lire ; sous la 8.x la page est celle d’avant', () => {
  const u = source('app/app/coach/urgent/page.tsx');
  assert.match(u, /import \{ notFound, redirect \} from 'next\/navigation';/);
  const garde = u.indexOf("if (await moteurEstV9().catch(() => false)) redirect('/app/coach');");
  assert.ok(garde > -1, 'la redirection');
  assert.ok(garde > u.indexOf('const coach = await exigerCoach();'), 'après la connexion du coach');
  assert.ok(garde < u.indexOf('await equipeNolio()') && garde < u.indexOf('await espaceDuCoach('), 'avant toute lecture');
  assert.ok(!/try \{[^}]*redirect\(/.test(u), 'redirect() lève son exception : jamais dans un try');
  // La page de la 8.x : ses quatre groupes, ses boutons, son « Réglé », ses messages.
  for (const mot of ['<h1 className="text-[1.75rem] font-extrabold tracking-tight">Urgent</h1>', 'Rien d’urgent aujourd’hui.', '<Geste r={point} />', '<Regle cles={[point.cle]} />',
    'ce qui ne peut pas attendre ta revue du dimanche', 'reprises de 20 h et 22 h', 'la migration']) assert.ok(u.includes(mot), mot);
});

test('l’ancienne adresse « À regarder » va droit à « Mes athlètes » sous la 9.x, à « Urgent » sous la 8.x', () => {
  const a = source('app/app/coach/a-regarder/page.tsx');
  assert.match(a, /export default async function ARegarderPage\(\)/);
  assert.match(a, /redirect\(\(await moteurEstV9\(\)\.catch\(\(\) => false\)\) \? '\/app\/coach' : '\/app\/coach\/urgent'\);/);
});

test('les liens qui mènent à « Urgent » : chacun est derrière la 8.x, ou renvoyé par la redirection ; aucun autre', () => {
  const trouves = execFileSync('grep', ['-rn', '/app/coach/urgent', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => !/^[^:]+:\d+:\s*(\/\/|\*|\{\/\*)/.test(l)).map((l) => l.split(':')[0]).sort();
  assert.deepEqual(trouves, [
    'app/api/ecriture/dimanche/route.ts',   // le courriel au coach : « Urgent » sous la 8.x, « À faire » sous la 9.x
    'app/app/coach/a-regarder/page.tsx',    // redirection : « Urgent » sous la 8.x
    'app/app/coach/page.tsx',               // le bandeau du dimanche, `bilan && !v9`
    'lib/app/ecriture.ts',                  // le courriel de reprise du lundi : sa fonction ne tourne pas sous la 9.x (reprendreLesSemainesDues)
    'lib/app/espaceCoachSimple.ts',         // le menu de la 8.x
  ]);
  const e = source('lib/app/ecriture.ts');
  assert.ok(e.indexOf('export async function reprendreLesSemainesDues') < e.indexOf('/app/coach/urgent'));
  assert.match(e.slice(e.indexOf('export async function reprendreLesSemainesDues')), /^[^]*?if \(await moteurEstV9\(\)\) return \[\];[^]*?\/app\/coach\/urgent/);
  const r = source('app/api/ecriture/dimanche/route.ts');
  assert.ok(r.includes('« Urgent » (${site.url}/app/coach/urgent)'), 'la 8.x : le courriel d’avant, mot pour mot');
  assert.match(r, /\(await moteurEstV9\(\)\.catch\(\(\) => false\)\) \? TEXTES_A_FAIRE\.ouReessayer\(site\.url\) :/);
  assert.equal(TEXTES_A_FAIRE.ouReessayer('https://exemple.test'), '« À faire », sur « Mes athlètes » (https://exemple.test/app/coach)');
});

// ─── Les messages d'infrastructure ────────────────────────────────────────────────────────────────────────────────────────

test('un message pour le développeur : lu sous la 8.x, au journal du serveur sous la 9.x', () => {
  const journal = [];
  assert.equal(montrerLInfra(false, 'la clé manque', (m) => journal.push(m)), true);
  assert.deepEqual(journal, [], 'sous la 8.x, rien au journal');
  assert.equal(montrerLInfra(true, 'la clé manque', (m) => journal.push(m)), false);
  assert.deepEqual(journal, ['la clé manque']);
  // Le journal par défaut est console.error.
  const reel = console.error;
  const lignesJournal = [];
  console.error = (m) => lignesJournal.push(m);
  try {
    montrerLInfra(true, 'migration à passer');
    montrerLInfra(false, 'migration à passer');
  } finally {
    console.error = reel;
  }
  assert.deepEqual(lignesJournal, ['migration à passer']);
});

test('l’accueil : ni la clé de l’API Nolio ni la migration de Supabase sous la 9.x ; sous la 8.x, les deux messages d’avant, mot pour mot', () => {
  const p = source('app/app/coach/page.tsx');
  // La 8.x : les deux messages sont toujours là, mot pour mot.
  assert.ok(p.includes('<p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>'));
  assert.ok(/Les signaux de la semaine \(commentaires, sensations, Hooper, rien de remonté\) ne sont pas encore gardés : la migration\s+du 04\/11\/2026 est à passer dans Supabase\./.test(p));
  // La 9.x : le message de la migration n'est dit que si montrerLInfra le permet (et le journalise sinon).
  assert.match(p, /\{!espace\.signaux && montrerLInfra\(v9, '[^']*migration du 04\/11\/2026 est à passer dans Supabase\.'\) && \(\s*<p className="text-xs text-\[#5E5C78\]">/);
  // La clé : sa carte « Dans Nolio » n'est pas affichée sous la 9.x quand la clé manque, une ligne au journal à la place.
  assert.match(p, /const carteNolio = !\(!nolioConfigure\(\) && !montrerLInfra\(v9, 'La clé de l’API Nolio manque dans Vercel \(NOLIO_API_KEY\)\.'\)\);/);
  assert.match(p, /\{carteNolio && \(\s*<Carte className="!p-5 space-y-2">\s*<Surtitre>Dans Nolio<\/Surtitre>/);
  // Un Nolio qui ne répond pas : sous la 9.x, une phrase simple ; le message technique reste au journal (equipeNolio).
  assert.match(p, /<p className="text-sm text-\[#4A4866\]">\{v9 \? TEXTES_A_FAIRE\.nolioMuet : erreur\}<\/p>/);
  assert.match(source('lib/app/espaceCoach.ts'), /console\.error\('Athlètes Nolio :', message\);/);
  assert.equal(TEXTES_A_FAIRE.nolioMuet, 'Nolio ne répond pas pour l’instant : réessaie dans un moment.');
  assert.ok(!TEXTES_A_FAIRE.nolioMuet.includes('NOLIO') && !/Vercel|Supabase|clé|migration/.test(Object.values(TEXTES_A_FAIRE).filter((t) => typeof t === 'string').join(' ')));
});

test('sous la 9.x, la semaine du dimanche soir pas partie ne parle plus des « reprises de 20 h et 22 h » (celles de la 8.x) ; sous la 8.x, ses mots d’avant', () => {
  const m = source('lib/app/mesAthletes.ts');
  assert.match(m, /detail: v9 \? TEXTES_A_FAIRE\.pasPartieDetail : 'Reprises ce soir à 20 h et 22 h ; sinon « Réessayer »',/);
  assert.match(m, /sous: v9 \? TEXTES_A_FAIRE\.pasPartieSous : 'Ce soir, elle se refait aux reprises de 20 h et 22 h\.',/);
  for (const t of [TEXTES_A_FAIRE.pasPartieDetail, TEXTES_A_FAIRE.pasPartieSous, TEXTES_A_FAIRE.pasPartieCarte]) assert.ok(!/20 h|22 h|reprise|Urgent/.test(t), t);
  assert.equal(TEXTES_A_FAIRE.pasPartieSous, 'Lundi, le bouton « Réessayer » apparaîtra.');
  // Le moteur v1 est lu une fois, au même endroit que les heures du passage.
  assert.match(m, /const v9 = await moteurEstV9\(\)\.catch\(\(\) => false\);/);
});

test('la page de l’athlète : ni la clé de l’API Nolio ni la migration sous la 9.x ; sous la 8.x, les messages d’avant, mot pour mot', () => {
  const page = source('app/app/coach/athlete/[id]/page.tsx');
  assert.ok(page.includes('Ses signaux ne sont pas encore gardés : la migration du 04/11/2026 est à passer.'));
  assert.ok(page.includes('<p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>'));
  assert.match(page, /const septJoursVisibles = !\(gardesManquent && !montrerLInfra\(v9, '[^']*migration du 04\/11\/2026 est à passer dans Supabase\.'\)\);/);
  assert.match(page, /\{accord && a\.nolio_athlete_id && septJoursVisibles && \(/);
  assert.match(page, /montrerLInfra\(v9, 'La clé de l’API Nolio manque dans Vercel \(NOLIO_API_KEY\)\.'\)\s*\? <p className="text-sm text-\[#4A4866\]">La clé de l’API Nolio manque dans Vercel \(NOLIO_API_KEY\)\.<\/p>\s*: <p className="text-sm text-\[#4A4866\]">\{TEXTES_A_FAIRE\.nolioMuet\}<\/p>/);
  assert.match(page, /<p className="text-sm text-\[#4A4866\]">\{v9 \? TEXTES_A_FAIRE\.nolioMuet : erreur\}<\/p>/);
  const c = source('components/app/SemaineQuiArrive.tsx');
  assert.ok(c.includes('Son « pourquoi » et ce qu’il a lu ne sont pas encore gardés au passage : la migration du 08/11/2026 est à passer.'));
  assert.match(c, /\{\(s\.revueGardee \|\| montrerLInfra\(v9, '[^']*migration du 08\/11\/2026 est à passer dans Supabase\.'\)\) && \(\s*<p className="text-\[0\.8125rem\] text-\[#5E5C78\]">/);
});

// ─── Les textes : pour le coach seul, en mots simples ─────────────────────────────────────────────────────────────────

test('les textes nouveaux : apostrophe typographique, mots simples, rien du jargon du moteur', () => {
  const textes = Object.entries(TEXTES_A_FAIRE).flatMap(([cle, t]) => (typeof t === 'string' ? [[cle, t]] : [[cle, t('https://exemple.test')]]));
  for (const [cle, t] of textes) {
    assert.ok(!/\w'\w/.test(t), `${cle} : apostrophe droite dans « ${t} »`);
    assert.ok(!/trame|pilier|charge tenue|\bmarche\b|\bdose\b|Hooper|RPE|\bEF\b/i.test(t), `${cle} : jargon dans « ${t} »`);
    assert.ok(t.length < 90, `${cle} : phrase courte`);
  }
  assert.deepEqual(textes.map(([cle]) => cle), ['titre', 'rien', 'sousTitre', 'nolioMuet', 'pasPartieDetail', 'pasPartieSous', 'pasPartieCarte', 'ouReessayer']);
});

test('aucun texte nouveau n’est lu par un athlète : le fichier n’est lu que par l’espace coach', () => {
  const lecteurs = execFileSync('grep', ['-rlE', 'espaceCoachSimple', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  assert.deepEqual(lecteurs, [
    'app/api/ecriture/dimanche/route.ts',
    'app/app/coach/athlete/[id]/page.tsx',
    // Étape 5 : « Chiffres » (la clé Stripe) et « Demandes » (la migration) réutilisent `montrerLInfra` : le journal du serveur, plus l'écran.
    'app/app/coach/chiffres/page.tsx',
    'app/app/coach/demandes/page.tsx',
    'app/app/coach/page.tsx',
    'components/app/AFaire.tsx',
    'components/app/CadreCoach.tsx',
    'components/app/SemaineQuiArrive.tsx',
    'components/app/TableauAthletes.tsx',
    'lib/app/mesAthletes.ts',
  ]);
  // Ces composants ne sont montrés qu'à l'espace coach.
  for (const nom of ['AFaire', 'CadreCoach', 'SemaineQuiArrive', 'TableauAthletes']) {
    const dehors = execFileSync('grep', ['-rlE', `components/app/${nom}'`, 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
    assert.ok(dehors.every((f) => f.startsWith('app/app/coach/')), `${nom} : ${dehors.join(', ')}`);
  }
  // Les textes de la 9.x ne passent pas par le moteur ni par ce que l'athlète lit (courriels, app).
  const e = execFileSync('grep', ['-rlE', 'TEXTES_A_FAIRE', 'lib', 'components/app'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  assert.deepEqual(e, ['components/app/AFaire.tsx', 'components/app/SemaineQuiArrive.tsx', 'lib/app/espaceCoachSimple.ts', 'lib/app/mesAthletes.ts']);
});

test('la garde : chaque page lit le moteur comme les autres composants serveur, et ce qui change est derrière `v9`', () => {
  for (const f of ['app/app/coach/page.tsx', 'app/app/coach/urgent/page.tsx', 'app/app/coach/a-regarder/page.tsx', 'components/app/CadreCoach.tsx']) {
    assert.match(source(f), /moteurEstV9\(\)\.catch\(\(\) => false\)/, f);
  }
  // Les gestes d'« Urgent » restent ceux de PointsCoach.tsx (un seul « Réglé » dans le code), partagés par les trois écrans.
  assert.equal((source('components/app/PointsCoach.tsx').match(/export function Regle/g) ?? []).length, 1);
});
