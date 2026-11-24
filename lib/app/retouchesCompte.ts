/**
 * Le calcul pur du compteur des retouches (lib/app/retouches.ts pour la lecture de Nolio la nuit, lib/app/chiffresCoaching.ts
 * pour « Chiffres ») : les familles, les comptes d'une semaine envoyée, la part des semaines sans retouche et la cible. Sans
 * Next, ni Nolio, ni base : sondé à part (scripts/test-retouches.mjs).
 */
import type { SeanceEnvoyee } from './coaching';
import type { JourLu, SemaineLue } from './semaineLue';
import { minutesDe } from './tableau';

export const FAMILLES_RETOUCHE = ['ef', 'seuil1', 'seuil2', 'vo2max', 'allure', 'sl', 'mecanique', 'renfo'] as const;
export type FamilleRetouche = (typeof FAMILLES_RETOUCHE)[number];
// min_avant, min_apres : la durée prévue et celle de Nolio des séances modifiées dont la durée se lit (pas le renfo).
// deplacees : parmi les modifiées, celles qui ont aussi changé de jour ; absent des comptes d'avant le 16/11/2026 (lu comme 0).
export type CompteFamille = { envoyees: number; modifiees: number; deplacees?: number; supprimees: number; min_avant: number; min_apres: number };
export type Familles = Partial<Record<FamilleRetouche, CompteFamille>>;

const RENFO = ':renfo';

// La famille d'une séance envoyée, d'après le jour écrit par le moteur ; null pour ce qui ne se compte pas (repos,
// course, notes).
export function familleRetouche(jourId: string, j: Pick<JourLu, 'famille' | 'seance'> | undefined): FamilleRetouche | null {
  if (jourId.endsWith(RENFO)) return 'renfo';
  if (!j) return null;
  if (j.famille === 'ef' || j.famille === 'sl' || j.famille === 'mecanique') return j.famille;
  if (j.famille !== 'qualite') return null;
  if (j.seance.includes('Seuil 1')) return 'seuil1';
  if (j.seance.includes('Seuil 2')) return 'seuil2';
  if (j.seance.startsWith('Allure')) return 'allure';
  // VO2max, VO2max courte, côtes, course test.
  return 'vo2max';
}

export type DansNolio = { id: string; date_start: string; sport?: string | null; revision?: string | null; duration?: { value?: number } | null };

// Les comptes d'une semaine envoyée, d'après ce qui est dans Nolio.
export function compterLaSemaine(semaine: Pick<SemaineLue, 'jours'>, envoyees: SeanceEnvoyee[], nolio: Map<string, DansNolio>): Familles {
  const familles: Familles = {};
  for (const s of envoyees) {
    if ((s.genre ?? 'seance') !== 'seance' || s.nolio_id === null || s.jour_id.startsWith('fiche:')) continue;
    const jour = semaine.jours.find((j) => j.id === s.jour_id.replace(RENFO, ''));
    const f = familleRetouche(s.jour_id, jour);
    if (!f) continue;
    const c = (familles[f] ??= { envoyees: 0, modifiees: 0, deplacees: 0, supprimees: 0, min_avant: 0, min_apres: 0 });
    c.envoyees += 1;
    const la = s.supprimee ? undefined : nolio.get(String(s.nolio_id));
    if (!la) {
      c.supprimees += 1;
      continue;
    }
    // Sans révision à l'envoi (un envoi de la v1), rien à comparer. Nolio change la révision d'une séance seulement déplacée
    // (lib/app/semaineDansNolio.ts) : une séance déplacée est donc déjà une modifiée ; `deplacees` compte, PARMI les modifiées,
    // celles qui ont aussi changé de jour (décision du coach du 16/11/2026 : une séance déplacée est une retouche).
    if (!s.revision || !la.revision || la.revision === s.revision) continue;
    c.modifiees += 1;
    if (jour?.date_iso && la.date_start && la.date_start.slice(0, 10) !== jour.date_iso.slice(0, 10)) c.deplacees = (c.deplacees ?? 0) + 1;
    const avant = f === 'renfo' || !jour ? 0 : minutesDe(jour.duree);
    const apres = Math.round((la.duration?.value ?? 0) / 60);
    if (avant && apres) {
      c.min_avant += avant;
      c.min_apres += apres;
    }
  }
  return familles;
}

export type PartSansRetouche = { intactes: number; semaines: number; part: number | null };

// La cible : au plus 15 % de semaines retouchées.
export const CIBLE_RETOUCHEES = 0.15;
export const cibleTenue = (p: PartSansRetouche) => (p.part === null ? null : p.semaines - p.intactes <= CIBLE_RETOUCHEES * p.semaines + 1e-9);

export type Cle = 'envoyees' | 'modifiees' | 'deplacees' | 'supprimees';
export const total = (f: Familles, k: Cle) => Object.values(f).reduce((t, x) => t + (x?.[k] ?? 0), 0);
// Une semaine envoyée (au moins une séance comptée), et intacte : rien de modifié, déplacé, supprimé ni ajouté.
const envoyee = (x: { familles: Familles }) => total(x.familles, 'envoyees') > 0;
// (Les déplacées sont parmi les modifiées.)
const intacte = (x: { familles: Familles; ajoutees: number }) => total(x.familles, 'modifiees') + total(x.familles, 'supprimees') + x.ajoutees === 0;
export const partDe = (lignes: { familles: Familles; ajoutees: number }[]): PartSansRetouche => {
  const envoyees = lignes.filter(envoyee);
  const intactes = envoyees.filter(intacte).length;
  return { intactes, semaines: envoyees.length, part: envoyees.length ? intactes / envoyees.length : null };
};

