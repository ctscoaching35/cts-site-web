/**
 * Le tableau de bord de l'athlète (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, T4, T10 ; décisions coach du
 * 18-19/10/2026) : ses séances vivent dans Nolio, l'app montre où il en est. La trame (une ligne par semaine), ce
 * qui a été fait chaque semaine écoulée (moteur 8.327, rangé le dimanche avec la semaine), la jauge par piliers, les
 * barres de volume, le Hooper du dimanche et la fiche du moment. Rien n'est lu dans Nolio à l'ouverture : tout vient
 * de la base, écrit par le passage du dimanche.
 *
 * Choix faits en construisant, à montrer au coach : les seuils du verdict (85 % et 65 % de la moyenne des piliers),
 * la zone habituelle du Hooper (sa moyenne des 4 dernières semaines, à 3 points près : l'écart qui fait un signal de
 * fatigue, REGLES["hooper_ecart"] du moteur), les jalons.
 */
import type { LigneTrame, Realise } from './ecriture';
import { ajouterJours, type Plan } from './plan';

export type Fiche = { cle: string; titre: string; pourquoi: string; date: string; url: string | null };

// Le statut d'une semaine par rapport à aujourd'hui.
export type Moment = 'passee' | 'encours' | 'avenir';
export const momentDe = (lundi: string, aujourdhui: string): Moment =>
  ajouterJours(lundi, 6) < aujourdhui ? 'passee' : lundi <= aujourdhui ? 'encours' : 'avenir';

export const enAffutage = (l: Pick<LigneTrame, 'type' | 'bloc'>) =>
  l.bloc === 'Affûtage' || l.type === 'Affûtage actif' || l.type === 'Décharge';

// « 1h30 », « 45 min », « 2h » : des minutes.
export function minutesDe(duree: string): number {
  const h = /(\d+)\s*h\s*(\d+)?/.exec(duree);
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  const m = /(\d+)\s*min/.exec(duree);
  return m ? Number(m[1]) : 0;
}

// « 2h10 », « 45 min ».
export const enHeures = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`;

// La trame d'un plan envoyé en entier (avant le 19/10/2026) ou de la démonstration, tirée de ses données : sa charge
// visée n'y est pas (le moteur ne la rend qu'avec la trame).
export function trameDesDonnees(plan: Plan): LigneTrame[] {
  return plan.semaines.map((s, i) => {
    const sl = s.jours.filter((j) => j.famille === 'sl');
    return {
      numero: s.numero, type: s.type, bloc: s.bloc, lundi: s.lundi ?? '', dates: s.dates,
      volume_h: plan.architecture.semaines[i]?.volume_h ?? 0, charge: null,
      seances_cles: s.jours.filter((j) => ['qualite', 'mecanique', 'sl'].includes(j.famille))
        .map((j) => ({ jour: j.jour, seance: j.seance, famille: j.famille })),
      week_end_choc: sl.length >= 2, sl_min: sl.length ? Math.max(...sl.map((j) => minutesDe(j.duree))) : null,
      passee: s.passee,
    };
  });
}

// ─── La jauge (T4) ────────────────────────────────────────────────────────

export type Pilier = { cle: 'assiduite' | 'sorties_longues' | 'cles' | 'fraicheur'; titre: string; valeur: number; detail: string };
export type Verdict = { libelle: string; ton: 'bien' | 'retrait' | 'retard' };
export type Jalon = { titre: string; atteint: boolean };
// score : la moyenne des piliers, de 0 à 1 (la montagne de l'accueil se remplit d'autant, AP2) ; null avant deux semaines.
export type Jauge = { semaine: number | null; total: number; piliers: Pilier[]; verdict: Verdict | null; score: number | null; jalons: Jalon[] };

const ECART_HOOPER = 3;
const VERDICT_BIEN = 0.85;
const VERDICT_RETRAIT = 0.65;

const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const moyenne = (xs: number[]) => (xs.length ? somme(xs) / xs.length : null);
const pct = (x: number) => `${Math.round(100 * x)} %`;

// La zone habituelle du Hooper d'une semaine : la moyenne des 4 semaines d'avant (au moins 2 valeurs).
export function zoneHooper(valeurs: (number | null)[], rang: number): number | null {
  const avant = valeurs.slice(Math.max(0, rang - 4), rang).filter((v): v is number => v !== null);
  return avant.length >= 2 ? (moyenne(avant) as number) : null;
}

export function jaugeDuPlan(trame: LigneTrame[], realises: Realise[], aujourdhui: string): Jauge {
  const rang = trame.findIndex((l) => l.lundi && momentDe(l.lundi, aujourdhui) === 'encours');
  const faits = realises.filter((r) => r.seances_prevues > 0);
  const piliers: Pilier[] = [];
  const prevue = somme(faits.map((r) => r.charge_prevue));
  if (faits.length && prevue > 0) {
    const tenue = somme(faits.map((r) => r.charge_tenue));
    piliers.push({ cle: 'assiduite', titre: 'Assiduité', valeur: Math.min(1, tenue / prevue),
      detail: `${pct(tenue / prevue)} de la charge prévue · ${somme(faits.map((r) => r.seances_faites))} séances faites sur ${somme(faits.map((r) => r.seances_prevues))}` });
  }
  // Les sorties longues tenues, comme les autres piliers (décision coach du 19/10/2026 : rien de l'avenir, plus de « la
  // plus longue du plan ») : celles demandées les semaines écoulées, faites à 90 % au moins de leur durée.
  const slDemandees = faits.filter((r) => r.sl_prevue_min !== null && r.sl_prevue_min > 0);
  if (slDemandees.length) {
    const tenues = slDemandees.filter((r) => (r.sl_faite_min ?? 0) >= 0.9 * (r.sl_prevue_min as number)).length;
    const faite = Math.max(0, ...faits.map((r) => r.sl_faite_min ?? 0));
    piliers.push({ cle: 'sorties_longues', titre: 'Sorties longues', valeur: tenues / slDemandees.length,
      detail: `${tenues} tenue${tenues > 1 ? 's' : ''} sur ${slDemandees.length} · ta plus longue : ${faite ? enHeures(faite) : 'pas encore'}` });
  }
  const clesPrevues = somme(faits.map((r) => r.cles_prevues));
  if (clesPrevues > 0) {
    const reussies = somme(faits.map((r) => r.cles_reussies));
    piliers.push({ cle: 'cles', titre: 'Séances clés', valeur: reussies / clesPrevues,
      detail: `${reussies} réussie${reussies > 1 ? 's' : ''} sur ${clesPrevues}${faits.some((r) => r.rpe_lu) ? ', au bon effort' : ''}` });
  }
  // La fraîcheur, en affûtage : le Hooper revenu dans sa zone habituelle d'avant l'affûtage.
  const debutAffutage = trame.findIndex(enAffutage);
  if (rang >= 0 && debutAffutage >= 0 && rang >= debutAffutage) {
    const parNumero = new Map(realises.map((r) => [r.numero, r.hooper]));
    const valeurs = trame.map((l) => parNumero.get(l.numero) ?? null);
    const zone = zoneHooper(valeurs, debutAffutage);
    const dernier = [...valeurs.slice(0, rang + 1)].reverse().find((v) => v !== null) ?? null;
    if (zone !== null && dernier !== null) {
      const frais = dernier <= zone + ECART_HOOPER;
      piliers.push({ cle: 'fraicheur', titre: 'Fraîcheur', valeur: frais ? 1 : 0.5,
        detail: frais ? `Ton Hooper (${dernier}) est revenu dans ta zone habituelle.` : `Ton Hooper (${dernier}) reste au-dessus de ta zone habituelle (autour de ${Math.round(zone)}) : dors, mange, garde l'affûtage tel quel.` });
    }
  }
  const comptes = piliers.filter((p) => p.cle !== 'fraicheur');
  const score = faits.length >= 2 ? moyenne(comptes.map((p) => p.valeur)) : null;
  const verdict: Verdict | null = score === null ? null
    : score >= VERDICT_BIEN ? { libelle: 'Sur la bonne voie', ton: 'bien' }
      : score >= VERDICT_RETRAIT ? { libelle: 'Un peu en retrait', ton: 'retrait' } : { libelle: 'En retard sur la trame', ton: 'retard' };
  return { semaine: rang >= 0 ? rang + 1 : null, total: trame.length, piliers, verdict, score, jalons: jalons(trame, faits, rang) };
}

// Les jalons : ce que l'athlète accomplit, sans durée fixée d'avance (décision coach du 19/10/2026 : plus de « première
// sortie de 2 h » ni de « plus longue sortie du plan ») — une semaine complète, quatre semaines assidues d'affilée, un
// bloc bouclé (toutes ses semaines assidues), dix séances clés réussies (quand la préparation en compte au moins dix),
// un week-end choc bouclé (s'il y en a), l'affûtage.
function jalons(trame: LigneTrame[], faits: Realise[], rang: number): Jalon[] {
  const choc = new Set(trame.filter((l) => l.week_end_choc).map((l) => l.numero));
  const assidue = (r: Realise) => r.charge_prevue > 0 && r.charge_tenue >= 0.9 * r.charge_prevue;
  let suite = 0;
  let quatre = false;
  for (const r of faits) {
    suite = assidue(r) ? suite + 1 : 0;
    quatre ||= suite >= 4;
  }
  const parNumero = new Map(faits.map((r) => [r.numero, r]));
  const blocs = [...new Set(trame.map((l) => l.bloc))].map((b) => trame.filter((l) => l.bloc === b));
  const blocBoucle = blocs.some((semaines) => semaines.every((l) => {
    const r = parNumero.get(l.numero);
    return r !== undefined && assidue(r);
  }));
  const clesPrevues = trame.reduce((n, l) => n + l.seances_cles.length, 0);
  const clesReussies = faits.reduce((n, r) => n + r.cles_reussies, 0);
  const debutAffutage = trame.findIndex(enAffutage);
  return [
    { titre: 'Une première semaine complète', atteint: faits.some((r) => r.seances_faites >= r.seances_prevues) },
    { titre: 'Quatre semaines assidues d’affilée', atteint: quatre },
    { titre: 'Un bloc bouclé', atteint: blocBoucle },
    ...(clesPrevues >= 10 ? [{ titre: 'Dix séances clés réussies', atteint: clesReussies >= 10 }] : []),
    ...(choc.size ? [{ titre: 'Un week-end choc bouclé', atteint: faits.some((r) => choc.has(r.numero) && r.seances_faites >= r.seances_prevues) }] : []),
    ...(debutAffutage >= 0 ? [{ titre: 'L’affûtage', atteint: rang >= debutAffutage }] : []),
  ];
}

// ─── Les graphiques (T10) ─────────────────────────────────────────────────

// Une barre par semaine, en minutes de course (décision coach du 19/10/2026 : les durées, la même mesure des deux
// côtés ; la charge prévue se compte par segments et le RPE de l'athlète vaut pour toute la séance, elles ne se
// comparent pas) : les 8 dernières faites à côté de leur prévue (celle de la semaine écrite), la semaine en cours et
// celles à venir en pointillés (la trame), le week-end choc et l'affûtage marqués.
// Une semaine se range par son lundi : les semaines d'un coaché se suivent d'un objectif à l'autre (décision coach du
// 20/10/2026, « toute sa saison »), leurs numéros (S1, S2…) recommençant à chaque objectif. course : la course de la
// semaine (un objectif ou une course de préparation), son repère sur les graphiques.
export type CourseDuGraphique = { date: string; nom: string };
export const courseDeLaSemaine = (lundi: string, courses: CourseDuGraphique[]) =>
  courses.find((c) => c.date >= lundi && c.date <= ajouterJours(lundi, 6))?.nom ?? null;

export type Barre = {
  numero: string; lundi: string; prevue: number; faite: number | null; moment: Moment; choc: boolean; affutage: boolean; type: string;
  course: string | null;
};
export function barresDeVolume(trame: LigneTrame[], realises: Realise[], aujourdhui: string, courses: CourseDuGraphique[] = []): Barre[] {
  const parLundi = new Map(realises.map((r) => [r.lundi, r]));
  const deLaTrame = trame.filter((l) => l.lundi).map((l) => {
    const r = parLundi.get(l.lundi);
    return { numero: l.numero, lundi: l.lundi, prevue: r?.duree_prevue_min ?? Math.round(l.volume_h * 60), faite: r ? r.duree_faite_min : null,
      moment: momentDe(l.lundi, aujourdhui), choc: l.week_end_choc, affutage: enAffutage(l), type: l.type, course: courseDeLaSemaine(l.lundi, courses) };
  });
  // Les semaines faites des objectifs d'avant (la saison d'un coaché).
  const vues = new Set(deLaTrame.map((b) => b.lundi));
  const avant = realises.filter((r) => r.lundi && !vues.has(r.lundi)).map((r) => ({
    numero: r.numero, lundi: r.lundi, prevue: r.duree_prevue_min, faite: r.duree_faite_min, moment: momentDe(r.lundi, aujourdhui),
    choc: false, affutage: /affûtage|décharge/i.test(r.type ?? ''), type: r.type ?? '', course: courseDeLaSemaine(r.lundi, courses),
  }));
  const barres = [...avant, ...deLaTrame].sort((a, b) => a.lundi.localeCompare(b.lundi));
  // Les semaines passées sans rien de lu avant la première qui l'est (les séances que le coach posait avant le départ
  // de l'objectif dans l'app) ne s'affichent pas : elles ressemblaient à des semaines prévues (retour du coach du 20/10).
  const passees = barres.filter((b) => b.moment === 'passee');
  const premiere = passees.findIndex((b) => b.faite !== null);
  return [...(premiere < 0 ? [] : passees.slice(premiere)).slice(-8), ...barres.filter((b) => b.moment !== 'passee')];
}

// Le Hooper du dimanche, semaine par semaine, et sa zone habituelle.
export type PointHooper = { numero: string; lundi: string; valeur: number | null; zone: number | null; course: string | null };
export function pointsHooper(trame: LigneTrame[], realises: Realise[], aujourdhui: string, courses: CourseDuGraphique[] = []): PointHooper[] {
  const parLundi = new Map(realises.map((r) => [r.lundi, r]));
  const numeros = new Map([...trame.map((l) => [l.lundi, l.numero] as [string, string]), ...realises.map((r) => [r.lundi, r.numero] as [string, string])]);
  const lundis = [...new Set([...trame.map((l) => l.lundi), ...realises.map((r) => r.lundi)])]
    .filter((l) => l && momentDe(l, aujourdhui) === 'passee').sort();
  const valeurs = lundis.map((l) => parLundi.get(l)?.hooper ?? null);
  return lundis.map((l, i) => ({ numero: numeros.get(l) ?? '', lundi: l, valeur: valeurs[i], zone: zoneHooper(valeurs, i),
    course: courseDeLaSemaine(l, courses) })).slice(-12);
}
export const ECART_ZONE_HOOPER = ECART_HOOPER;

// La fiche du moment : la dernière arrivée (dans les 14 derniers jours), sinon la prochaine.
export function ficheDuMoment(fiches: Fiche[], aujourdhui: string): { fiche: Fiche; avenir: boolean } | null {
  const passees = fiches.filter((f) => f.date <= aujourdhui && f.date >= ajouterJours(aujourdhui, -13));
  if (passees.length) return { fiche: passees[passees.length - 1], avenir: false };
  const prochaine = fiches.find((f) => f.date > aujourdhui);
  return prochaine ? { fiche: prochaine, avenir: true } : null;
}

// ─── La préparation, bloc par bloc ────────────────────────────────────────

// Les blocs de la préparation (décision coach du 19/10/2026 : « juste les blocs avec les qualités qu'on va travailler »,
// sans volumes ni sorties longues, en J- jusqu'à l'objectif, pour tous) : les semaines de la trame regroupées par bloc,
// de son premier lundi à son dernier dimanche (la veille de la course au plus tard), avec ce que le bloc développe et ce
// qu'il entretient, lus dans le tableau du plan (« Ce que tu travailles », « En rappel »).
export type BlocDuPlan = { nom: string; du: string; au: string; moment: 'fait' | 'encours' | 'avenir'; travail: string[]; rappel: string[] };
// depuis : pour un coaché qui a rejoint la préparation en cours de route (course.rejoint), son lundi d'arrivée : les blocs
// d'avant, qu'il n'a pas faits, ne s'affichent pas, et le bloc en cours commence à son arrivée (décision coach du
// 20/10/2026 : « parler du bloc actuel sans parler des blocs antérieurs » ; le coaching part de l'objectif, à reculons).
// Ce qu'un bloc travaille et entretient, d'après la vue d'ensemble du plan (« Ce que tu travailles », « En rappel ») :
// pour « Ta préparation, bloc par bloc » et la description du bandeau Nolio de chaque semaine (décision coach du
// 21/10/2026).
export function qualitesDuBloc(plan: Plan, bloc: string): { travail: string[]; rappel: string[] } {
  const [entete = [], ...lignes] = plan.architecture.tableau;
  const col = (titre: string) => entete.findIndex((e) => e.toLowerCase().startsWith(titre));
  const [cBloc, cTravail, cRappel] = [col('bloc'), col('ce que tu travailles'), col('en rappel')];
  const qualites = (c: number) => [...new Set(lignes.filter((l) => l[cBloc] === bloc)
    .flatMap((l) => (c >= 0 ? String(l[c] ?? '') : '').split(',').map((q) => q.trim()).filter((q) => q && q !== '—')))];
  return { travail: qualites(cTravail), rappel: qualites(cRappel) };
}

export function blocsDuPlan(trame: LigneTrame[], plan: Plan, aujourdhui: string, depuis: string | null = null): BlocDuPlan[] {
  const veille = ajouterJours(plan.course.date, -1);
  const blocs: BlocDuPlan[] = [];
  for (const l of trame.filter((x) => x.lundi && (!depuis || x.lundi >= depuis))) {
    const fin = ajouterJours(l.lundi, 6) < veille ? ajouterJours(l.lundi, 6) : veille;
    const dernier = blocs[blocs.length - 1];
    if (dernier && dernier.nom === l.bloc) dernier.au = fin;
    else blocs.push({ nom: l.bloc, du: l.lundi, au: fin, moment: 'avenir', ...qualitesDuBloc(plan, l.bloc) });
  }
  return blocs.map((b) => ({ ...b, moment: b.au < aujourdhui ? 'fait' : b.du <= aujourdhui ? 'encours' : 'avenir' }));
}
