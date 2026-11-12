/**
 * Le tableau de bord de l'athlète (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1, T4, T10 ; décisions coach du
 * 18-19/10/2026) : ses séances vivent dans Nolio, l'app montre où il en est. La trame (une ligne par semaine), ce
 * qui a été fait chaque semaine écoulée (moteur 8.327, rangé le dimanche avec la semaine), la jauge par piliers, les
 * barres de volume, le Hooper du dimanche et la fiche du moment. Rien n'est lu dans Nolio à l'ouverture : tout vient
 * de la base, écrit par le passage du dimanche.
 *
 * Choix faits en construisant, à montrer au coach : les seuils du verdict (85 % et 65 % de la moyenne des piliers),
 * la zone habituelle du Hooper (sa moyenne des 4 dernières semaines, à 3 points près : l'écart qui fait un signal de
 * fatigue, REGLES["hooper_ecart"] du moteur). Plus de jalons (Q9, décision coach du 05/11/2026 au soir, « A ») : la
 * montagne et les piliers disent l'avancée, les badges la célèbrent.
 */
import type { LigneTrame, Realise } from './ecriture';
import { ajouterJours, type Plan } from './plan';

const jourEnLettres = (iso: string) => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^1 /, '1er ');

export type Fiche = { cle: string; titre: string; pourquoi: string; date: string; url: string | null };

// Le statut d'une semaine par rapport à aujourd'hui.
export type Moment = 'passee' | 'encours' | 'avenir';
export const momentDe = (lundi: string, aujourdhui: string): Moment =>
  ajouterJours(lundi, 6) < aujourdhui ? 'passee' : lundi <= aujourdhui ? 'encours' : 'avenir';

// « Ta préparation », semaine par semaine (décision coach du 07/11/2026) : les semaines faites, telles qu'elles ont été
// faites ; la semaine en cours et la suivante, détaillées ; celles d'après, résumées à leur type et à leur volume.
export type DetailDeSemaine = 'faite' | 'encours' | 'suivante' | 'resumee';
export function detailDeLaSemaine(lundi: string, aujourdhui: string): DetailDeSemaine {
  const moment = momentDe(lundi, aujourdhui);
  if (moment !== 'avenir') return moment === 'passee' ? 'faite' : 'encours';
  return lundi <= ajouterJours(aujourdhui, 7) ? 'suivante' : 'resumee';
}

// « environ 8 h », « environ 8 h 30 » : le volume d'une semaine résumée, à la demi-heure près (décision coach du
// 07/11/2026) ; null sans volume.
export function environ(minutes: number): string | null {
  if (!(minutes > 0)) return null;
  const arrondi = Math.max(30, Math.round(minutes / 30) * 30);
  const heures = Math.floor(arrondi / 60);
  return heures ? `environ ${heures} h${arrondi % 60 ? ' 30' : ''}` : 'environ 30 min';
}

// LE WEEK-END CHOC DE TROIS JOURS DIT À L'AVANCE (D3, cas fictifs du 09/11/2026, décision coach du 08/11/2026, « A ») :
// le second week-end choc d'une course de plus de 24 h (moteur, FT1-6) court du vendredi au dimanche, et l'athlète peut
// ne pas avoir coché ce vendredi (voulu) ; sa semaine dans « Ta préparation » le dit dès qu'elle est à venir, sans la
// déplier (components/app/SemainesDuPlan.tsx). La séance du vendredi le dit aussi en tête (moteur 8.459). Pas au
// questionnaire (règle du coach du 01/11/2026). Texte validé par le coach le 08/11/2026 (« pose ta journée » refusé).
// null pour toute autre semaine.
const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const jourEtMoisDe = (iso: string) => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^1 /, '1er ');
export function ligneTroisJours(l: Pick<LigneTrame, 'lundi' | 'seances_cles'>): string | null {
  const jours = l.seances_cles.filter((s) => s.famille === 'sl').map((s) => JOURS_SEMAINE.indexOf(s.jour.toLowerCase()))
    .filter((i) => i >= 0).sort((a, b) => a - b);
  if (jours.length < 3 || !l.lundi) return null;
  const [premier, dernier] = [jours[0], jours[jours.length - 1]];
  const de = ajouterJours(l.lundi, premier);
  const a = ajouterJours(l.lundi, dernier);
  const debut = de.slice(0, 7) === a.slice(0, 7) ? jourEtMoisDe(de).split(' ')[0] : jourEtMoisDe(de);
  return `Ton week-end choc se court sur trois jours, du ${JOURS_SEMAINE[premier]} ${debut} au ${JOURS_SEMAINE[dernier]} `
    + `${jourEtMoisDe(a)} : fais au mieux selon ton emploi du temps.`;
}

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
// LA MONTÉE (la montagne de l'accueil, ou la route ; lot 2 de l'app, maquette validée « tout A » par le coach le
// 12/11/2026) : à la place du verdict des piliers, plus de couleur qui juge. fait : la charge vraiment faite depuis le
// début (la charge tenue des semaines lues), sur toute la charge que la trame prévoit jusqu'à la course (son total, fixé
// au départ : les creux voulus, assimilation, affûtage, reprise, y sont déjà) ; elle ne redescend jamais, et vaut 1 le
// jour J si tout est fait. prevu : la charge que la trame prévoyait jusqu'à la semaine passée, sur le même total (le
// pointillé « prévu aujourd'hui »). dansLesTemps : fait ≥ 90 % de prevu. mesure : la charge des semaines (celle du
// moteur), ou, quand la trame n'en a pas (un plan d'avant, la démonstration ancienne), les minutes des deux côtés.
// null avant deux semaines lues (C17 : la montagne garde son remplissage neutre, sans message).
export type Montee = { fait: number; prevu: number; dansLesTemps: boolean; mesure: 'charge' | 'minutes' };
export const DANS_LES_TEMPS = 0.9;
// score : la moyenne des piliers, de 0 à 1 ; null avant deux semaines. Le verdict n'est plus montré à l'athlète (la
// montée le remplace, 12/11/2026) ; l'espace coach le lit encore.
export type Jauge = { semaine: number | null; total: number; piliers: Pilier[]; verdict: Verdict | null; score: number | null;
  montee: Montee | null };

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

// Les textes de la montée, validés par le coach le 12/11/2026 (maquette « tout A ») : X et Y en pour cent de toute la
// montée ; dans les temps à 90 % du prévu au moins. Les mêmes pour l'athlète et pour son coach (la page de l'objectif,
// « Mes athlètes » ; réponse du coach du 12/11/2026).
export function texteDeLaMontee(m: Montee, route = false): string {
  const [x, y] = [Math.round(100 * m.fait), Math.round(100 * m.prevu)];
  const debut = route ? `Tu as parcouru ${x}\u00a0% de ta route` : `Tu as gravi ${x}\u00a0% de ta montée`;
  return m.dansLesTemps ? `${debut}, le plan en prévoyait ${y}\u00a0% : tu es dans les temps.`
    : `${debut}, le plan en prévoyait ${y}\u00a0%. Un peu de retard : ta préparation s’adapte.`;
}
const SUITE = ', c’est l’entraînement que tu as vraiment fait depuis le début, sur tout ce que ton plan prévoit jusqu’à la course. '
  + 'Elle ne redescend jamais. Le pointillé : où ton plan te voyait aujourd’hui.';
export const phraseDeLaMontee = (route = false) => `${route ? 'La longueur' : 'La hauteur'}${SUITE}`;
// Un objectif sur route (décision coach du 25/10/2026) : la route à la place de la montagne.
export const estRoute = (format: string | null | undefined) => /^R(10|21|42)$/.test(String(format ?? ''));

// La montée depuis `depuis` : pour un coaché, le début de son objectif en cours (debutDeLObjectif) ; sinon toute la trame.
export function monteeDuPlan(trame: LigneTrame[], realises: Realise[], aujourdhui: string, depuis: string | null = null): Montee | null {
  const semaines = trame.filter((l) => l.lundi && (!depuis || l.lundi >= depuis));
  const parCharge = semaines.length > 0 && semaines.every((l) => typeof l.charge === 'number' && l.charge > 0);
  const prevue = (l: LigneTrame) => (parCharge ? l.charge as number : l.volume_h * 60);
  const total = somme(semaines.map(prevue));
  if (total <= 0) return null;
  const numeros = new Set(semaines.map((l) => l.numero));
  const lues = realises.filter((r) => numeros.has(r.numero));
  if (lues.filter((r) => r.seances_prevues > 0).length < 2) return null;
  const fait = Math.min(1, somme(lues.map((r) => Math.max(0, parCharge ? r.charge_tenue : r.duree_faite_min))) / total);
  const prevu = Math.min(1, somme(semaines.filter((l) => ajouterJours(l.lundi, 6) < aujourdhui).map(prevue)) / total);
  return { fait, prevu, dansLesTemps: fait >= DANS_LES_TEMPS * prevu, mesure: parCharge ? 'charge' : 'minutes' };
}

// Le début de l'objectif en cours d'un coaché (lot 2, 12/11/2026 ; la règle de la continuité, lib/app/ecriture.ts,
// continuiteDe) : son départ programmé, sinon, parti, sa première semaine écrite ; à défaut, la semaine qu'il a rejointe.
// Ni sa montée ni ses blocs ne partent d'avant (un objectif enchaîné après une course, un objectif court qui commence en
// développement ou en spécifique, un coaché qui rejoint).
export function debutDeLObjectif(x: { depart_prevu?: string | null; demarre_le?: string | null; lundis: (string | null | undefined)[];
  rejoint?: string | null }): string | null {
  const premiere = x.lundis.filter((l): l is string => Boolean(l)).sort()[0] ?? null;
  return (x.depart_prevu ? String(x.depart_prevu).slice(0, 10) : null) ?? (x.demarre_le ? premiere : null) ?? x.rejoint ?? null;
}

export function jaugeDuPlan(trame: LigneTrame[], realises: Realise[], aujourdhui: string, depuis: string | null = null): Jauge {
  const rang = trame.findIndex((l) => l.lundi && momentDe(l.lundi, aujourdhui) === 'encours');
  const faits = realises.filter((r) => r.seances_prevues > 0);
  const piliers: Pilier[] = [];
  const prevue = somme(faits.map((r) => r.charge_prevue));
  if (faits.length && prevue > 0) {
    const tenue = somme(faits.map((r) => r.charge_tenue));
    piliers.push({ cle: 'assiduite', titre: 'Assiduité', valeur: Math.min(1, tenue / prevue),
      // C22 (audits du 05/11/2026) : « charge tenue », le mot décidé le 04/11/2026 pour la semaine passée.
      detail: `charge tenue : ${pct(tenue / prevue)} de la prévue · ${somme(faits.map((r) => r.seances_faites))} séances faites sur ${somme(faits.map((r) => r.seances_prevues))}` });
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
        // C22 : sans le chiffre du Hooper, qui ne dit rien seul. Validé par le coach le 05/11/2026 (1A ; la seconde phrase).
        detail: frais ? 'Ta forme du dimanche est revenue dans ta zone habituelle.'
          : 'Ta forme du dimanche reste au-dessus de ta zone habituelle : dors, mange, garde l’affûtage tel quel.' });
    }
  }
  const comptes = piliers.filter((p) => p.cle !== 'fraicheur');
  const score = faits.length >= 2 ? moyenne(comptes.map((p) => p.valeur)) : null;
  const verdict: Verdict | null = score === null ? null
    : score >= VERDICT_BIEN ? { libelle: 'Sur la bonne voie', ton: 'bien' }
      : score >= VERDICT_RETRAIT ? { libelle: 'Un peu en retrait', ton: 'retrait' } : { libelle: 'En retard sur ton plan', ton: 'retard' };
  return { semaine: rang >= 0 ? rang + 1 : null, total: trame.length, piliers, verdict, score,
    montee: monteeDuPlan(trame, realises, aujourdhui, depuis) };
}

// Le prochain week-end choc à venir, d'après la trame du moteur, qui marque ses semaines (week_end_choc) : le coach est
// prévenu un mois avant pour l'annoncer à son athlète (FT1-3, décision coach du 01/11/2026).
export type WeekEndChoc = { samedi: string; dimanche: string };
export function weekEndChoc(trame: LigneTrame[], aujourdhui: string): WeekEndChoc | null {
  const l = trame.find((x) => x.week_end_choc && x.lundi && ajouterJours(x.lundi, 6) >= aujourdhui);
  return l ? { samedi: ajouterJours(l.lundi, 5), dimanche: ajouterJours(l.lundi, 6) } : null;
}

// ─── Les graphiques (T10) ─────────────────────────────────────────────────

// Une barre par semaine, en minutes de course (décision coach du 19/10/2026 : les durées, la même mesure des deux
// côtés ; la charge prévue se compte par segments et le RPE de l'athlète vaut pour toute la séance, elles ne se
// comparent pas) : les 10 dernières faites à côté de leur prévue (celle de la semaine écrite), la semaine en cours et
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
  // Q15 (décision coach du 05/11/2026 au soir, « A ») : les 10 dernières semaines faites (avant : 8), comme la charge et
  // le Hooper, puis la semaine en cours et celles à venir.
  return [...(premiere < 0 ? [] : passees.slice(premiere)).slice(-10), ...barres.filter((b) => b.moment !== 'passee')];
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

// Les fiches de la semaine (décision coach du 21/10/2026 : « aiguiller la lecture des fiches par l'athlète » dans
// l'app, plus de notes de fiches dans Nolio) : celles de la semaine en cours, du lundi au dimanche ; aucune les semaines
// sans fiche, la bibliothèque reste dans son onglet.
export function fichesDeLaSemaine(fiches: Fiche[], aujourdhui: string): Fiche[] {
  const lundi = ajouterJours(aujourdhui, -((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7));
  return fiches.filter((f) => f.date >= lundi && f.date <= ajouterJours(lundi, 6));
}

// ─── La préparation, bloc par bloc ────────────────────────────────────────

// Les blocs de la préparation (décision coach du 19/10/2026 : « juste les blocs avec les qualités qu'on va travailler »,
// sans volumes ni sorties longues, en J- jusqu'à l'objectif, pour tous) : les semaines de la trame regroupées par bloc,
// de son premier lundi à son dernier dimanche (la veille de la course au plus tard), avec ce que le bloc développe et ce
// qu'il entretient, lus dans le tableau du plan (« Ce que tu travailles », « En rappel »).
// texte : la ligne de l'étape de récupération d'un objectif enchaîné (à la place de « Tu travailles »).
export type BlocDuPlan = { nom: string; du: string; au: string; moment: 'fait' | 'encours' | 'avenir'; travail: string[]; rappel: string[];
  texte?: string };

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

// depuis : pour un coaché, le début de son objectif en cours (debutDeLObjectif ; lot 2, décision du coach du 12/11/2026 :
// tous les cas de coaching, pas seulement un coaché qui rejoint) : les blocs d'avant, qu'il n'a pas faits, ne s'affichent
// pas, et le bloc en cours commence à son début (décision coach du 20/10/2026 : « parler du bloc actuel sans parler des
// blocs antérieurs » ; le coaching part de l'objectif, à reculons). Les plans des acheteurs : tous leurs blocs.
// recuperation : un objectif enchaîné après une course (lib/app/jonction.ts, partApres) : sa récupération, du lendemain
// de la course à la veille du début, en première étape.
export function blocsDuPlan(trame: LigneTrame[], plan: Plan, aujourdhui: string, depuis: string | null = null,
  recuperation: { date: string; jusqua: string } | null = null): BlocDuPlan[] {
  const veille = ajouterJours(plan.course.date, -1);
  const blocs: BlocDuPlan[] = [];
  if (recuperation && recuperation.jusqua > recuperation.date) {
    // Brouillon, à valider par le coach (lot 2, 12/11/2026).
    blocs.push({ nom: 'Récupération de ta course', du: ajouterJours(recuperation.date, 1), au: recuperation.jusqua, moment: 'avenir',
      travail: [], rappel: [], texte: `Après ta course du ${jourEnLettres(recuperation.date)} : du facile, pour repartir frais.` });
  }
  for (const l of trame.filter((x) => x.lundi && (!depuis || x.lundi >= depuis))) {
    const fin = ajouterJours(l.lundi, 6) < veille ? ajouterJours(l.lundi, 6) : veille;
    const dernier = blocs[blocs.length - 1];
    if (dernier && dernier.nom === l.bloc) dernier.au = fin;
    else blocs.push({ nom: l.bloc, du: l.lundi, au: fin, moment: 'avenir', ...qualitesDuBloc(plan, l.bloc) });
  }
  return blocs.map((b) => ({ ...b, moment: b.au < aujourdhui ? 'fait' : b.du <= aujourdhui ? 'encours' : 'avenir' }));
}

// La semaine ajustée (Q7) : les règles du journal qui la disent ajustée (lib/app/tableauDuPlan.ts, ajustementDeLaSemaine).
// Plus de « coach » (décision 11 du coach du 09/11/2026) : l'app de l'athlète ne marque plus les retouches de son coach,
// elle montre la semaine telle qu'elle est dans Nolio.
export const REGLES_AJUSTEMENT = new Set(['R1', 'R2', 'R3', 'R4', 'R5', 'R8', 'CH', 'C5', 'O3', 'OM4']);
export type Ajustement = 'moteur' | null;
export function ajustementDuJournal(journal: unknown): Ajustement {
  const lignes = (Array.isArray(journal) ? journal : []) as { regle?: unknown }[];
  return lignes.some((l) => REGLES_AJUSTEMENT.has(String(l?.regle ?? ''))) ? 'moteur' : null;
}

// Le volume d'une semaine lue dans Nolio (décision 11 du coach du 09/11/2026, « Ta préparation ») : ses séances de course,
// trail et tapis, comme le volume que le moteur écrit (le renfo et les autres sports n'y comptent pas).
export const volumeDeNolio = (seances: { minutes: number | null; course?: boolean }[]) =>
  seances.reduce((t, x) => t + (x.course === false ? 0 : x.minutes ?? 0), 0);
