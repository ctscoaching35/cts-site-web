// Essais de la coachée fictive prête à partir dans la démonstration (lib/app/demonstrationCoachPrete.ts) : sous la v1, sa carte est complète et « Lancer sa préparation » est actif. node --test scripts/test-demonstration-prete.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
// lib/app/ecriture.ts ne se charge pas sous `node` seul : les données de la démonstration n'en lisent que le questionnaire du samedi, remplacé ici.
const QUESTIONNAIRE = 'data:text/javascript,export const QUESTIONNAIRE_SEMAINE = { name: "q", items: [{ question: "1" }, { question: "2" }, { question: "3" }, { question: "4" }] };';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './ecriture' && context.parentURL?.endsWith('demonstrationCoachDonnees.ts')) return { url: QUESTIONNAIRE, shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href, context);
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const charge = (f) => import(pathToFileURL(`${RACINE}lib/app/${f}.ts`).href);
const P = await charge('demonstrationCoachPrete');
const page = await charge('pageAthleteSimple');
const { lireGpx } = await charge('gpxV9');
const lues = () => JSON.parse(readFileSync(`${RACINE}lib/app/exemples/coach.json`, 'utf8'));

test('elle s’ajoute aux dix coachés fictifs, sans rien changer à eux ; une seule fois', () => {
  const avant = lues();
  const apres = P.avecLaCoacheePrete(lues());
  assert.equal(apres.athletes.length, avant.athletes.length + 1);
  assert.deepEqual(apres.athletes.slice(0, -1), avant.athletes);
  assert.deepEqual(apres.plans.slice(0, -1), avant.plans);
  assert.deepEqual(apres.nolio[P.ID_PRETE], { prevues: [], reelles: [], hooper: [] });
  assert.equal(P.avecLaCoacheePrete(apres), apres, 'déjà là');
  assert.ok(!apres.semaines_ecrites.some((s) => s.plan_id === P.PLAN_PRET));
});

test('sa carte est complète comme la page la vérifie, son objectif n’a pas démarré : « Lancer sa préparation » est actif', () => {
  const d = P.avecLaCoacheePrete(lues());
  const a = d.athletes.at(-1);
  const plan = d.plans.at(-1);
  assert.equal(a.sans_accord, false);
  assert.ok(a.reperes.length === 4 && a.reperes.every((x) => x > 0));
  assert.deepEqual([plan.athlete_id, plan.demarre_le, plan.depart_prevu], [P.ID_PRETE, null, null]);
  assert.ok(plan.course_date > d.lundi, 'sa course est à venir');
  assert.equal(plan.parametres._demonstration, P.PLAN_PRET);
  assert.ok(lireGpx(plan.parametres.champs.gpx), 'sa trace se lit');
  const fiche = P.profilDeDemonstration(a.champs);
  assert.deepEqual([fiche.cote_min, fiche.tapis, fiche.critere_intensite, fiche.critere_denivele], ['12', 'non', 'parfois', 'regulier']);
  // Ses points forts et faibles en trail sont sur sa fiche, pas dans les réponses de son objectif.
  assert.deepEqual([fiche.trail_montees, fiche.trail_descentes], ['faible', 'fort']);
  const etat = page.etatDeLaCarte({ champs: plan.parametres.champs }, fiche);
  assert.deepEqual([etat.complet, etat.manquants], [true, []]);
  assert.deepEqual(page.etatDuLancement({ objectif: { ecrit: true, demarre: false, prevu: null }, complet: etat.complet, nolio: true, accord: true, aLaMain: false }), { actif: true, pourquoi: null });
  // La fiche d'un autre coaché fictif ne gagne rien.
  assert.deepEqual(Object.keys(P.profilDeDemonstration(d.athletes[0].champs)), ['niveau', 'terrain', 'jours_disponibles', 'jour_sl', 'freq_hebdo']);
});

test('en développement seulement : rien ne la lit hors de la démonstration', () => {
  const donnees = readFileSync(`${RACINE}lib/app/demonstrationCoachDonnees.ts`, 'utf8');
  assert.ok(donnees.includes('lues = avecLaCoacheePrete(d);') && donnees.includes('profil: profilDeDemonstration(c),'));
  const porte = readFileSync(`${RACINE}lib/app/demonstrationCoach.ts`, 'utf8');
  assert.ok(porte.includes("process.env.NODE_ENV !== 'production' ? import('./demonstrationCoachDonnees')"));
  assert.ok(!porte.includes('demonstrationCoachPrete'));
});

test('les tables de la démonstration la portent : sa fiche, son accord, son objectif pas démarré', async () => {
  process.chdir(RACINE);
  const D = await charge('demonstrationCoachDonnees');
  const t = D.tables();
  const fiche = t.athletes_coaches.find((x) => x.id === P.ID_PRETE);
  assert.equal(fiche.nom, 'Chloé Garnier');
  assert.equal(fiche.profil.cote_min, '12');
  assert.ok(t.nolio_accords.some((x) => x.nolio_athlete_id === fiche.nolio_athlete_id));
  assert.ok(t.coaching.some((x) => x.athlete_id === P.ID_PRETE && x.plan_id === P.PLAN_PRET));
  assert.equal(t.plans.find((x) => x.id === P.PLAN_PRET).demarre_le, null);
  assert.ok(D.nolio('GET', 'me/athletes/').corps.data.some((x) => x.id === fiche.nolio_athlete_id));
  assert.deepEqual(D.nolio('GET', `planned/trainings/?athlete=${fiche.nolio_athlete_id}`).corps.data, []);
});

test('en démonstration seulement, les liens qui sortent vers les vrais sites sont fermés et le disent', () => {
  const lire = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
  const cadre = lire('components/app/CadreCoach.tsx');
  assert.ok(cadre.includes('{demonstrationCoachOuverte() && <><LiensFermesEnDemonstration /><Demonstration /></>}'));
  assert.equal((cadre.match(/<LiensFermesEnDemonstration/g) ?? []).length, 1);
  const l = lire('components/app/LiensFermesEnDemonstration.tsx');
  assert.ok(l.startsWith("'use client';"));
  assert.ok(l.includes(`const SORTANT = 'a[href^="http"]';`), 'un lien du site est relatif');
  for (const e of ['click', 'auxclick']) assert.ok(l.includes(`document.addEventListener('${e}', retenir, true);`), e);
  assert.ok(l.includes('e.preventDefault();') && l.includes("content: 'en démonstration'"));
  // Les liens que le coach nous a nommés sortent bien en « http » : Nolio et la fiche de course.
  assert.match(lire('lib/app/liensNolio.ts'), /NOLIO_ACCUEIL_COACH = 'https:\/\/www\.nolio\.io\/calendar\/';/);
  assert.ok(lire('lib/app/ficheCourse.ts').includes('export const lienFicheCourse = (planId: string) => `${site.url}/fiche-course/'), 'la fiche de course : l’adresse du site en ligne');
});

test('en démonstration, le nom du coaché ouvre toujours sa page dans « Mes athlètes » ; seul un mot qui sort est fermé ; hors démonstration, la ligne ne change pas', () => {
  const liste = readFileSync(`${RACINE}components/app/ListeSimple.tsx`, 'utf8');
  assert.ok(liste.includes('const page = `/app/coach/athlete/${l.id}`;'));
  const i = liste.indexOf('if (demonstrationCoachOuverte() && !l.un.href.startsWith(page)) {');
  assert.ok(i > 0, 'une ligne qui mène ailleurs que sa page : un vrai site, ou sa demande');
  const branche = liste.slice(i, liste.indexOf('\n          return (', i + 10));
  assert.ok(branche.includes('<li key={l.id} className={classe}>'));
  assert.ok(branche.includes('<Link href={page} className="min-w-0 flex-1 min-h-11 flex items-center">{nom}</Link>'), 'le nom ouvre sa page');
  assert.ok(branche.includes('{l.un.externe ? <a href={l.un.href} target="_blank" rel="noopener" className={classeDuMot}>{mot}</a> : <Link href={l.un.href} className={classeDuMot}>{mot}</Link>}'), 'le mot seul mène à son geste');
  // Hors démonstration : toute la ligne ouvre le geste, comme avant.
  assert.ok(liste.includes('{l.un.externe ? <a href={l.un.href} target="_blank" rel="noopener" className={classe}>{contenu}</a> : <Link href={l.un.href} className={classe}>{contenu}</Link>}'));
  assert.ok(liste.includes('const contenu = <>{nom}{mot}{fleche}</>;'));
  assert.ok(liste.includes("from '@/lib/app/demonstrationCoachPorte';"), 'la porte seule, fermée en production');
});
