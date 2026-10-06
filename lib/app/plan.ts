/**
 * L'app CTS — le plan en données, tel que l'API le rend (GET /v1/plans/{id}/donnees,
 * cts_contenu.plan_en_donnees() dans le dépôt du moteur ; CONTRAT_API_CTS.md).
 *
 * Aucune logique d'entraînement ici : l'app affiche ce que le moteur a décidé, et ne sait
 * que lire des dates. Le texte vient du moteur, une seule fois (cadrage de l'app, D3) :
 * l'app n'écrit pas de phrase d'entraînement à elle. Texte riche : <b>…</b> seulement.
 */

export const SCHEMA_PLAN = 1;

export type Famille = 'repos' | 'ef' | 'qualite' | 'mecanique' | 'sl' | 'course';

// Une ligne de la carte en codes (cts_notation) : libellé (« Échauf. », « Corps », « Retour »,
// « À retenir », « Ravito »), "" pour la suite du corps, null pour une ligne pleine largeur.
export type PartieCarte = [libelle: string | null, texte: string];

export type Jour = {
  id: string;
  jour: string;
  date: string;
  date_iso: string | null;
  seance: string;
  terrain: string;
  duree: string;
  rpe: string;
  famille: Famille;
  lignes: string[];
  terrain_detail: string | null;
  carte: { entete: Record<string, string>; parties: PartieCarte[] } | null;
  definition: string | null;
};

export type Semaine = {
  numero: string;
  numero_int: number;
  type: string;
  bloc: string;
  volume: string;
  seances: string;
  dates: string;
  progression: string;
  passee: boolean;
  lundi: string | null;
  jours: Jour[];
};

// Une partie de texte : un titre et ses puces (Jour J, mode d'emploi, déterminants).
export type Partie = { titre: string; puces: string[] };

export type Plan = {
  schema: number;
  version_moteur: string | null;
  athlete: { nom: string };
  course: {
    nom: string;
    date: string;
    date_lettres: string;
    distance_km: number;
    dplus_m: number;
    dmoins_m: number;
    dmoins_estime: boolean;
    densite_mkm: number;
    format: string;
    format_clair: string;
    temps_cible: string;
    date_debut_plan: string;
    date_debut_plan_lettres: string;
    duree_semaines: number;
    rejoint: { semaine: number; lundi: string } | null;
  };
  couverture: { surtitre: string; reperes: [string, string][]; debut: string; rendez_vous: string };
  demarche: { titre: string; piliers: [string, string][] };
  avertissement: { surtitre: string; paragraphes: string[] };
  ta_course: { titre: string; lignes: [string, string][] };
  profil: {
    titre: string;
    sans_trace: string | null;
    pentes: [cle: string, libelle: string, pourcentage: number][] | null;
    troncons: { titre: string; sous_titre: string; homogene: string | null; tableau: string[][] | null } | null;
    points: {
      pas_km: number | null;
      km: number[] | null;
      altitude_m: number[] | null;
      plages: [debut: number, fin: number, categorie: string][] | null;
      secteurs: { distance_km: number; dplus_m: number; dmoins_m: number; type: string; categorie: string }[] | null;
    } | null;
  };
  determinants: {
    titre: string;
    physio: Partie;
    mecanique: Partie | null;
    secteurs_cles: Partie | null;
    sans_trace: string | null;
  };
  terrain: { titre: string; texte: string } | null;
  architecture: {
    titre: string;
    types_semaine: [string, string][];
    legende_graphique: string;
    tableau: string[][];
    note: string;
    roles: { titre: string; blocs: [string, string][] };
    semaines: { numero: number; type: string; nature: string; bloc: number; volume_h: number }[];
  };
  point_de_depart: { titre: string; texte: string | null; puces: string[] } | null;
  mode_emploi: {
    titre: string;
    effort: { titre: string; intro: string; zones: string[][]; note: string };
    lire_semaine: { titre: string; texte: string; familles: [Famille, string][] };
    lire_seance: { titre: string; texte: string; codes: [string, string][] };
    seances: { titre: string; glossaire: [string, string][] };
    adapter: Partie;
    fatigue: Partie;
    renforcement: { titre: string; texte: string };
  };
  jour_j: {
    titre: string;
    nutrition: { titre: string; lignes: [string, string][]; fiche: [string, string] };
    parties: Partie[];
    fiche_ultra: [string, string] | null;
  };
  pour_aller_plus_loin: {
    titre: string;
    intro: string;
    qr: string;
    app: string;
    fiches: { cle: string; titre: string; url: string }[];
  };
  semaines: Semaine[];
};

export type JourDuPlan = Jour & { semaine: Semaine };

// Le nom de page d'une fiche citée par le plan (« renforcement »), tiré de son adresse sur le site.
export const slugFiche = (url: string) => new URL(url).pathname.split('/').pop() ?? '';

// Une fiche citée par le plan s'ouvre dans l'app, dans la bibliothèque.
export const cheminFiche = (plan: Plan, cle: string) => {
  const fiche = plan.pour_aller_plus_loin.fiches.find((f) => f.cle === cle);
  return fiche ? `/app/bibliotheque/${slugFiche(fiche.url)}` : null;
};

export const tousLesJours = (plan: Plan): JourDuPlan[] =>
  plan.semaines.flatMap((semaine) => semaine.jours.map((j) => ({ ...j, semaine })));

export const jourParId = (plan: Plan, id: string) => tousLesJours(plan).find((j) => j.id === id);

export const jourParDate = (plan: Plan, iso: string) => tousLesJours(plan).find((j) => j.date_iso === iso);

export const semaineDeDate = (plan: Plan, iso: string) =>
  plan.semaines.find((s) => s.jours.some((j) => j.date_iso === iso));

// Où en est l'athlète : avant la première semaine, pendant le plan, après la course.
export function moment(plan: Plan, iso: string): 'avant' | 'pendant' | 'apres' {
  if (iso < plan.course.date_debut_plan) return 'avant';
  if (iso > plan.course.date) return 'apres';
  return 'pendant';
}

// ─── Dates ────────────────────────────────────────────────────────────────
// Les dates du plan sont des jours, sans heure : elles se lisent en UTC pour ne jamais
// glisser d'un jour selon le fuseau de l'appareil. « Aujourd'hui » se prend à Paris.

const enDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const ajouterJours = (iso: string, n: number) => {
  const d = enDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const joursEntre = (de: string, a: string) =>
  Math.round((enDate(a).getTime() - enDate(de).getTime()) / 86_400_000);

export const aujourdhuiIso = () =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// « mardi 16 mars », « le 1er février » (audit du 27/09/2026, K2 : jamais « le 1 février »).
export const dateLongue = (iso: string, avecAnnee = false) =>
  enDate(iso)
    .toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
      ...(avecAnnee ? { year: 'numeric' } : {}),
    })
    .replace(/ 1 /, ' 1er ');

export const moisLong = (iso: string) =>
  enDate(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const jourDuMois = (iso: string) => enDate(iso).getUTCDate();

// Lundi = 0 … dimanche = 6.
export const rangDansSemaine = (iso: string) => (enDate(iso).getUTCDay() + 6) % 7;
