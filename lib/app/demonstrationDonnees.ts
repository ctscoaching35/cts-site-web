/**
 * Les données de la démonstration de l'app des athlètes (lib/app/demonstration.ts), en développement seulement :
 * lib/app/exemples/app.json (scripts/demonstration-app.py : quatre plans fictifs faits par le moteur, leur trame et
 * leurs fiches, les semaines que le moteur écrit pour les états montrés, une course de préparation et sa fiche), lu sur
 * le disque. Jamais importé en production : demonstration.ts ne le charge que la porte ouverte.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CourseSecondaire } from './tableauDuPlan';
import type { Trame } from './ecriture';
import type { FichePrep } from '@/components/app/FichePreparation';
import type { Plan, Semaine } from './plan';

// Une semaine écrite par le moteur pour un état : ce que l'app lit (semaines_ecrites.donnees), ses notes Nolio et son
// journal (ce que le moteur a changé, pour le bandeau).
export type SemaineMontree = {
  numero: string; semaine?: Semaine; notes?: { regle?: string; texte: string }[]; journal?: Record<string, unknown>[];
};
export type PlanDeDemonstration = {
  titre: string; achat: string; niveau: string; plan: Plan; trame: Trame;
  profil_entrainement: Record<string, string | string[]>;
  semaines: Partial<Record<'fatigue' | 'manquee' | 'test' | 'choc', SemaineMontree>>;
  preparation: { course: CourseSecondaire & { temps_h?: number }; trame: Trame['semaines']; fiche: FichePrep; semaine: SemaineMontree } | null;
};
export type DonneesApp = { genere_le: string; version_moteur: string; plans: Record<string, PlanDeDemonstration> };

let lues: DonneesApp | null = null;
export function donneesApp(): DonneesApp {
  lues ??= JSON.parse(readFileSync(join(process.cwd(), 'lib', 'app', 'exemples', 'app.json'), 'utf8')) as DonneesApp;
  return lues;
}
