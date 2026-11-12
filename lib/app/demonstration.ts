/**
 * LA DÉMONSTRATION DE L'APP DES ATHLÈTES (cadrage, étape 1c ; complétée le 05/11/2026 pour la revue écran par écran) :
 * quatre plans fictifs faits par le moteur (lib/app/exemples/app.json, scripts/demonstration-app.py), un jour simulé
 * (?jour=) et des états choisis par l'adresse (lib/app/demonstrationPorte.ts, PARAMETRES_DEMONSTRATION), pour lire les
 * deux versions de l'app, « Préparation CTS » et « Coaching individualisé », à chaque moment d'une préparation. Le
 * bandeau de démonstration (components/app/BarreDemonstration.tsx) liste ces états et passe de l'un à l'autre.
 *
 * Elle ne s'ouvre qu'en développement et sans Supabase (la porte de demonstrationPorte.ts, celle de l'espace coach).
 * Ce module n'est qu'un passage : ce qu'elle montre (lib/app/demonstrationEtats.ts) et ses données
 * (lib/app/demonstrationDonnees.ts) ne sont chargés que par l'import ci-dessous, sous une condition que `next build`
 * rend fausse : ni l'un ni les autres ne sont dans le paquet servi. Ouverte, rien ne s'écrit ni ne part : aucun cookie
 * (la bienvenue et « Pour bien démarrer » se disent par l'adresse), les gestes répondent « rien ne s'enregistre »
 * (demonstrationPorte.ts, estPlanDeDemonstration). Les écrans sont ceux des athlètes, tels quels ; seules leurs données
 * viennent d'ici.
 */
import type { Contexte } from './contexte';
import type { CourseSecondaire } from './tableauDuPlan';

export { demonstrationOuverte } from './demonstrationPorte';
export type { EtatDemo, GroupeDuBandeau } from './demonstrationEtats';

const etats = () => (process.env.NODE_ENV !== 'production' ? import('./demonstrationEtats')
  : Promise.reject(new Error('La démonstration de l’app est fermée en production.')));

export const planDemo = async (voulu: string) => (await etats()).planDemo(voulu);
export const plansDeDemonstration = async () => (await etats()).plansDeDemonstration();
export const tableauDeDemonstration = async (ctx: Contexte) => (await etats()).tableauDeDemonstration(ctx);
export const semaineDeDemonstration = async (ctx: Contexte, numero: string) => (await etats()).semaineDeDemonstration(ctx, numero);
export const lectureDeDemonstration = async (ctx: Contexte, lundi: string, numero?: string) =>
  (await etats()).lectureDeDemonstration(ctx, lundi, numero);
export const ajustementDeDemonstration = async (ctx: Contexte, numero: string) => (await etats()).ajustementDeDemonstration(ctx, numero);
export const notesDeLaSemaine = async (ctx: Contexte) => (await etats()).notesDeLaSemaine(ctx);
export const ficheDeDemonstration = async (ctx: Contexte, date: string) => (await etats()).ficheDeDemonstration(ctx, date);
export const datesDesFiches = async (ctx: Contexte) => (await etats()).datesDesFiches(ctx);
export const objectifsDeDemonstration = async (ctx: Contexte, courses: CourseSecondaire[]) =>
  (await etats()).objectifsDeDemonstration(ctx, courses);
export const profilDEntrainementDeDemonstration = async (ctx: Contexte) => (await etats()).profilDEntrainementDeDemonstration(ctx);
export const niveauDeDemonstration = async (ctx: Contexte) => (await etats()).niveauDeDemonstration(ctx);
export const etatsDuBandeau = async () => (await etats()).etatsDuBandeau();
export const recuperationDeDemonstration = async (ctx: Contexte) => (await etats()).recuperationDeDemonstration(ctx);
