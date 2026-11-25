// Aucun réseau ni base : « Ses courses » et la vue d'ensemble de la page d'un athlète sous la 9.x (scripts/test-ses-courses.mjs).
/**
 * « SES COURSES » ET LA VUE D'ENSEMBLE (décision 241 du coach, 25/11/2026 : « il faut que je puisse tous les rentrer […] qu'on ait une vue d'ensemble sur son profil »). Tous ses objectifs majeurs à venir, dans l'ordre des dates,
 * avec date, distance, D+, chrono visé et trace ; ses courses de préparation, chacune sous l'objectif qu'elle prépare ; une course dans la récupération d'un majeur est dite sous lui (C3, lib/app/mineursDesMajeurs.ts). En haut
 * de la page, en lecture : le coureur (côte, tapis, critères, vitesse critique, repères) et ses courses sur une ligne de temps. Les textes sont lus par le coach seul.
 */
import { coteEnClair } from '@/lib/cote';
import { titreReponse } from '@/lib/criteres';
import { heuresDuTemps } from './jonction';
import { listeDesPoints, TEXTES_TRAIL, type ValeursTrail } from './pointsTrail';
import { classerLesCourses } from './mineursDesMajeurs';

export const TEXTES_COURSES = {
  vueDEnsemble: 'Vue d’ensemble',
  cote: 'Côte',
  tapis: 'Tapis',
  intensite: 'Intensité',
  mecanique: 'Mécanique',
  // L'indice tiré des deux efforts de son test (demande du coach du 25/11/2026) : sous 0,90, « plutôt rapide », sinon « plutôt endurant » (lib/app/zones.ts, profilCoureur).
  indice: 'Indice d’endurance',
  inconnu: '—',
  sansCourse: 'Aucune course à venir.',
  majeur: 'Objectif',
  preparation: 'Préparation',
  recuperation: 'Pendant la récupération',
  toutes: 'Toutes ses courses, dans l’ordre',
  sesCourses: 'Ses courses',
  prochaine: 'Sa prochaine course',
  sansTrace: 'sans trace GPX',
  avecTrace: 'trace GPX donnée',
} as const;

export type ObjectifLu = {
  planId: string; nom: string; date: string; temps_cible: string; format: string; distance_km: string; dplus_m: string; route: boolean; trace: boolean;
  preparations: { nom: string; date: string }[];
};

// Une course en une ligne : « 42 km · 2400 m D+ · chrono visé 5h30 · trace GPX donnée » ; sur route, ni D+ ni trace.
export function detailsDeLaCourse(o: Pick<ObjectifLu, 'distance_km' | 'dplus_m' | 'temps_cible' | 'route' | 'trace'>): string {
  return [
    o.distance_km ? `${o.distance_km} km` : null,
    !o.route && o.dplus_m ? `${o.dplus_m} m D+` : null,
    o.temps_cible ? `chrono visé ${o.temps_cible}` : null,
    o.route ? null : o.trace ? TEXTES_COURSES.avecTrace : TEXTES_COURSES.sansTrace,
  ].filter(Boolean).join(' · ');
}

// Ses objectifs rangés : les majeurs dans l'ordre des dates, chacun avec les courses qui tombent dans sa récupération (elles ne sont pas des majeurs).
export function rangerSesCourses<T extends ObjectifLu>(objectifs: T[]): { majeur: T; mineures: T[] }[] {
  const classees = classerLesCourses(objectifs.map((o) => ({ id: o.planId, course_nom: o.nom, course_date: o.date, temps_h: heuresDuTemps(o.temps_cible), format: o.format, objectif: o })));
  const lignes = classees.filter((x) => !x.mineureDe).map((x) => ({ majeur: x.course.objectif, mineures: [] as T[] }));
  for (const x of classees) if (x.mineureDe) lignes.find((l) => l.majeur.planId === x.mineureDe!.id)?.mineures.push(x.course.objectif);
  return lignes;
}

export type Evenement = { date: string; nom: string; genre: string };
// La ligne de temps : ses majeurs, leurs courses de préparation, les courses pendant une récupération, dans l'ordre des dates.
export function ligneDeTemps(objectifs: ObjectifLu[], aujourdhui: string): Evenement[] {
  const t = TEXTES_COURSES;
  return rangerSesCourses(objectifs).flatMap(({ majeur, mineures }) => [
    { date: majeur.date, nom: majeur.nom, genre: t.majeur },
    ...majeur.preparations.map((p) => ({ date: p.date, nom: p.nom, genre: t.preparation })),
    ...mineures.map((m) => ({ date: m.date, nom: m.nom, genre: t.recuperation })),
  ]).filter((e) => e.date >= aujourdhui).sort((a, b) => a.date.localeCompare(b.date));
}

// Le nouvel objectif reprend la semaine de l'objectif en cours (241) : ses jours, son jour de sortie longue, son nombre de séances, quand l'objectif les a ; sinon rien (la fiche, comme avant).
export function semaineReprise(champs: Record<string, unknown> | null | undefined): Record<string, string | string[]> {
  const jours = Array.isArray(champs?.jours_disponibles) ? (champs.jours_disponibles as unknown[]).map(String).filter(Boolean) : [];
  const jourSl = String(champs?.jour_sl ?? '');
  const freq = String(champs?.freq_hebdo ?? '');
  return { ...(jours.length ? { jours_disponibles: jours } : {}), ...(jourSl ? { jour_sl: jourSl } : {}), ...(freq ? { freq_hebdo: freq } : {}) };
}

// « 0,93 · plutôt endurant ». Coupé à deux chiffres, pas arrondi : 0,896 se dit 0,89, du même côté de 0,90 que son mot.
export function indiceDEndurance(style: { coefficient: number; nom: string } | null): string | null {
  return style ? `${(Math.floor(style.coefficient * 100 + 1e-9) / 100).toFixed(2).replace('.', ',')} · ${style.nom.toLowerCase()}` : null;
}

// Le coureur en lecture : sa côte, son tapis, ses deux critères, sa vitesse critique et ses repères (les titres et valeurs de la page) ; puis, quand la page donne son style (null sans les deux efforts), son indice
// d'endurance et ses points forts et faibles en trail.
export function vueDuCoureur(v: { cote_min: string; tapis: string; critere_intensite: string; critere_denivele: string } & Partial<ValeursTrail>, reperes: [string, string | null, string | null][], style?: { coefficient: number; nom: string } | null): [string, string][] {
  const t = TEXTES_COURSES;
  return [
    [t.cote, coteEnClair(v.cote_min) ?? t.inconnu],
    [t.tapis, v.tapis || t.inconnu],
    [t.intensite, v.critere_intensite ? titreReponse(v.critere_intensite) : t.inconnu],
    [t.mecanique, v.critere_denivele ? titreReponse(v.critere_denivele) : t.inconnu],
    ...reperes.map(([titre, valeur]): [string, string] => [titre, valeur ?? t.inconnu]),
    ...(style === undefined ? [] : [
      [t.indice, indiceDEndurance(style) ?? t.inconnu],
      [TEXTES_TRAIL.forts, listeDesPoints(v, 'fort') || t.inconnu],
      [TEXTES_TRAIL.faibles, listeDesPoints(v, 'faible') || t.inconnu],
    ] as [string, string][]),
  ];
}
