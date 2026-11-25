// Aucun réseau ni base : les courses d'un coaché qui tombent dans la récupération d'une autre (scripts/test-mineurs-des-majeurs.mjs).
/**
 * UNE COURSE 2 DANS LA RÉCUPÉRATION DE LA COURSE 1 EST UN OBJECTIF MINEUR (décision 241 du coach, 25/11/2026 ; doctrine C3, tranchée avec le moteur). « Dans la récupération » : sa date tombe avant le lundi de reprise que
 * le site calcule après la course 1 (lib/app/jonction.ts, debutApres : le `depart_prevu` qu'il lui donnerait). Sous la 9.x, elle ne se lance pas comme un majeur : le site l'envoie dans `courses_mineures` du plan de la
 * course 1 (sa durée : son chrono visé), et l'écran du coach le dit sous elle. Une course mineure n'ouvre pas sa propre récupération : la suivante se juge contre le dernier majeur.
 */
import { debutApres } from './jonction';

export type MajeurDuCoache = { id: string; course_nom: string; course_date: string; temps_h: number; format?: string; fond?: boolean };

// La ligne dite sous la course (texte de la session du moteur, 25/11/2026).
export const TEXTE_DANS_LA_RECUPERATION = (course: string) => `Elle tombe dans ta récupération après ${course} : je la prépare comme une course de préparation.`;

export const tombeDansLaRecuperation = (date: string, avant: Pick<MajeurDuCoache, 'course_date' | 'temps_h' | 'format'>): boolean =>
  date > avant.course_date && date < debutApres(avant);

// Ses courses (sans les saisons de fond) dans l'ordre des dates, chacune majeure, ou mineure du majeur dont la récupération la contient.
export function classerLesCourses<T extends MajeurDuCoache>(courses: T[]): { course: T; mineureDe: T | null }[] {
  let majeur: T | null = null;
  return courses.filter((c) => !c.fond).slice().sort((a, b) => a.course_date.localeCompare(b.course_date) || a.id.localeCompare(b.id)).map((course) => {
    if (majeur && tombeDansLaRecuperation(course.course_date, majeur)) return { course, mineureDe: majeur };
    majeur = course;
    return { course, mineureDe: null };
  });
}

// Le majeur qui fait de la course `id` une course de préparation ; null : un majeur.
export function majeurQuiCouvre<T extends MajeurDuCoache>(id: string, courses: T[]): T | null {
  return classerLesCourses(courses).find((x) => x.course.id === id)?.mineureDe ?? null;
}

// Les courses qui tombent dans la récupération du majeur `id`, sous la forme des courses de préparation du site (`courses_secondaires` : date, chrono visé en heures, nom).
export function mineursDuMajeur<T extends MajeurDuCoache>(id: string, courses: T[]): { date: string; temps_h: number | null; nom: string }[] {
  return classerLesCourses(courses).filter((x) => x.mineureDe?.id === id)
    .map((x) => ({ date: x.course.course_date, temps_h: x.course.temps_h > 0 ? x.course.temps_h : null, nom: x.course.course_nom }));
}
