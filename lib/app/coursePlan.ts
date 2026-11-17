/**
 * LE DOSSIER DE L'OBJECTIF d'un acheteur ou d'un coaché (refonte de l'app payante, étape (c), décisions du coach du 16/11/2026) :
 * ce que la page de la fiche de course prend à `POST /v1/course-libre` pour les blocs du dossier du gratuit que le plan n'a pas
 * (le type de la course, la grille de l'effort du jour J), et la carte à partager de l'objectif.
 *
 * L'appel se fait CÔTÉ SERVEUR, avec le code du site (X-CTS-Cle, lib/app/cleMoteur.ts : la valeur ne se lit jamais ici, elle
 * passe par process.env), SANS trace (ni GPX, ni points : les blocs de profil gardent ceux du plan), avec la distance, le D+,
 * la date, le temps visé et l'expérience de l'objectif, rien d'autre. Au plus 5 s : sans réponse, les blocs ne s'affichent pas
 * et le reste du dossier s'affiche. Pur : aucune lecture de session ni de base ; le dossier (la page) choisit quand l'appeler.
 */
import { enTetesMoteur } from './cleMoteur';
import type { LigneTrame } from './ecriture';
import {
  appelerCourseLibre, modeleCarteDe, type Classe, type DemandeCourseLibre, type ModeleCarte, type ReponseCourseLibre,
} from './courseLibre';
import type { Plan } from './plan';
import { momentDe } from './tableau';
import { estExperience } from './profilGratuit';
import { lireTemps } from '@/lib/plan';

export const DELAI_COURSE_LIBRE_MS = 5000;

// Le temps visé du plan (« 6h30 », « 2 h 15 »), dans la forme que le moteur lit (« 6h30 ») ; null s'il est illisible ou hors des
// bornes du moteur (de 15 min à 48 h).
export function tempsPourLeMoteur(brut: string | null | undefined): string | null {
  const h = lireTemps(String(brut ?? ''));
  if (h === null || !Number.isFinite(h) || h < 0.25 || h > 48) return null;
  let heures = Math.floor(h);
  let minutes = Math.round((h - heures) * 60);
  if (minutes === 60) { heures += 1; minutes = 0; }
  return `${heures}h${String(minutes).padStart(2, '0')}`;
}

/**
 * Ce qui part au moteur pour l'objectif d'un plan, ou null quand le dossier du gratuit n'a rien à y ajouter : une saison de fond,
 * une course sur route (sans dénivelé), une course passée (le moteur refuse une date d'hier), un temps visé illisible.
 * Ni nom, ni repère, ni trace : la course et l'expérience seulement.
 */
export function demandeDuPlan(
  plan: { course: Pick<Plan['course'], 'date' | 'distance_km' | 'dplus_m' | 'temps_cible'>; fond?: unknown },
  niveau: unknown,
  jour: string,
): DemandeCourseLibre | null {
  if (plan.fond) return null;
  const { course } = plan;
  if (!(course.date >= jour)) return null;
  if (!(Number(course.distance_km) > 0) || !(Number(course.dplus_m) > 0)) return null;
  const temps = tempsPourLeMoteur(course.temps_cible);
  if (!temps) return null;
  const demande: DemandeCourseLibre = {
    date_course: course.date, temps_cible: temps, distance_km: Number(course.distance_km), dplus_m: Number(course.dplus_m),
  };
  if (estExperience(niveau)) demande.experience = niveau;
  return demande;
}

// L'appel, depuis le serveur : la réponse du moteur, ou null (réseau, délai, refus, réponse illisible). Jamais d'exception, rien de
// gardé, aucune trace dans les journaux. `appel` : le fetch à utiliser (les tests y mettent le leur).
export async function lireCourseLibre(
  demande: DemandeCourseLibre,
  options: { appel?: typeof fetch; delai?: number } = {},
): Promise<ReponseCourseLibre | null> {
  const appel = options.appel ?? fetch;
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), options.delai ?? DELAI_COURSE_LIBRE_MS);
  try {
    const r = await appelerCourseLibre(demande, null, (url, init) => appel(url, {
      ...init, headers: enTetesMoteur((init?.headers ?? {}) as Record<string, string>), signal: ctrl.signal, cache: 'no-store',
    }));
    return r.ok ? r.reponse : null;
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

// La carte à partager de l'objectif : la course seule (nom, date, distance, D+, type, profil), aucune donnée personnelle
// (ModeleCarte n'en porte pas). Le type vient du moteur : sans lui, pas de carte.
export function modeleCarteDuPlan(plan: Pick<Plan, 'course' | 'profil'>, classe: Classe): ModeleCarte {
  const secteurs: { km_fin: number; dplus_m: number; dmoins_m: number }[] = [];
  let fin = 0;
  for (const s of plan.profil.points?.secteurs ?? []) {
    fin += s.distance_km;
    secteurs.push({ km_fin: Math.round(fin * 1000) / 1000, dplus_m: s.dplus_m, dmoins_m: s.dmoins_m });
  }
  return modeleCarteDe({
    nom: plan.course.nom, date: plan.course.date, distance_km: plan.course.distance_km, dplus_m: plan.course.dplus_m, classe,
    points: plan.profil.points, secteurs,
  });
}

/**
 * Où il en est dans sa préparation, pour la carte « Dans ta préparation » du dossier : le numéro de la semaine en cours et le
 * nombre de semaines, comptés comme « Ta semaine » (SemainesDuPlan : depuis le début de l'objectif d'un coaché, sinon toute la
 * trame). null sans semaine en cours (avant le départ, après la course, programmé à la main : pas de trame).
 */
export function placeDansLaPreparation(trame: Pick<LigneTrame, 'lundi' | 'numero'>[], jour: string, depuis: string | null = null): { numero: number; total: number } | null {
  const semaines = trame.filter((l) => l.lundi && (!depuis || l.lundi >= depuis));
  const rang = semaines.findIndex((l) => momentDe(l.lundi, jour) === 'encours');
  if (rang < 0) return null;
  // Comme « Ta semaine » : un coaché compte depuis le début de son objectif, un acheteur garde le numéro du plan.
  const duPlan = Number(String(semaines[rang]!.numero).replace('S', ''));
  return { numero: depuis || !Number.isFinite(duPlan) ? rang + 1 : duPlan, total: semaines.length };
}
