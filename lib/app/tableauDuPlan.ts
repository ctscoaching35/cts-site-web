/**
 * Ce que le tableau de bord et « Mon plan » lisent d'un plan (lib/app/tableau.ts) : sa trame et ses fiches à leur
 * moment, ce qui a été fait chaque semaine écoulée, où en est l'athlète dans Nolio. Côté serveur seulement. Le plan
 * est celui que le contexte a choisi parmi ceux du compte connecté.
 */
import type { Contexte } from './contexte';
import { trameDuPlan, type LigneTrame, type Realise } from './ecriture';
import { ajouterJours, type Semaine } from './plan';
import { clientService } from './supabase';
import { trameDesDonnees, type Fiche } from './tableau';

// Où en est l'athlète dans Nolio (P1 à P4) ; « coache » : un objectif de son coach ; null : un plan d'avant le
// 19/10/2026, sans Nolio.
export type EtatNolio = 'a_inviter' | 'en_cours' | 'invite' | 'actif' | 'refuse' | 'sorti' | 'coache' | null;
export type DonneesTableau = {
  trame: LigneTrame[]; realises: Realise[]; fiches: Fiche[]; nolio: EtatNolio; accord: boolean; ecrit: boolean;
  // Les courses secondaires ajoutées (O2).
  courses: CourseSecondaire[];
};
// chrono : le chrono visé (PO3), absent d'une course ajoutée avant le 20/10/2026.
export type CourseSecondaire = { nom: string; date: string; distance_km: number; dplus_m: number; chrono?: string | null };

export async function donneesTableau(ctx: Contexte): Promise<DonneesTableau> {
  if (ctx.demonstration) return demonstration(ctx);
  const service = clientService();
  const { data: p } = await service.from('plans').select('parametres, nolio_statut, accord_lecture_le').eq('id', ctx.cle).maybeSingle();
  // Un coaché : ses séances sont dans Nolio, son accord est celui du Suivi de son coach (T5).
  const accordCoache = ctx.coache ? await accordDuCoache(ctx.cle) : false;
  if (!p?.parametres) {
    return { trame: trameDesDonnees(ctx.plan), realises: [], fiches: [], nolio: ctx.coache ? 'coache' : null, accord: false, ecrit: false,
      courses: [] };
  }
  const trame = await trameDuPlan(ctx.cle);
  const { data: lignes } = await service.from('semaines_ecrites').select('numero, realise').eq('plan_id', ctx.cle).not('realise', 'is', null);
  const realises = (lignes ?? []).map((l) => l.realise as Realise)
    .sort((a, b) => Number(a.numero.slice(1)) - Number(b.numero.slice(1)));
  return {
    trame: trame?.semaines ?? trameDesDonnees(ctx.plan), realises, fiches: trame?.fiches ?? [],
    nolio: ctx.coache ? 'coache' : (p.nolio_statut ?? null) as EtatNolio, accord: ctx.coache ? accordCoache : Boolean(p.accord_lecture_le),
    ecrit: true,
    courses: (((p.parametres as Record<string, unknown>).courses_secondaires ?? []) as CourseSecondaire[])
      .slice().sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function accordDuCoache(planId: string): Promise<boolean> {
  const service = clientService();
  const { data: c } = await service.from('coaching').select('coach_id, athlete_id').eq('plan_id', planId).maybeSingle();
  const { data: a } = c ? await service.from('athletes_coaches').select('nolio_athlete_id').eq('id', c.athlete_id).maybeSingle() : { data: null };
  if (!c || !a?.nolio_athlete_id) return false;
  const { data } = await service.from('nolio_accords').select('accord_le').eq('coach_id', c.coach_id).eq('nolio_athlete_id', a.nolio_athlete_id).maybeSingle();
  return Boolean(data);
}

// La démonstration (développement seulement) : la trame tirée des données, une charge visée simulée (le volume à un
// RPE moyen de 4) et, avec ?retours=exemple, des semaines écoulées simulées pour voir la jauge et les graphiques.
function demonstration(ctx: Contexte): DonneesTableau {
  const trame = trameDesDonnees(ctx.plan).map((l) => ({ ...l, charge: Math.round(l.volume_h * 60 * 4) }));
  const realises: Realise[] = !ctx.exemple ? [] : trame.filter((l) => l.lundi && ajouterJours(l.lundi, 6) < ctx.jour)
    .map((l, i) => {
      const prevues = l.seances_cles.length + 2;
      const manquee = i % 5 === 4 ? 1 : 0;
      const prevue = l.charge ?? 0;
      return {
        numero: l.numero, lundi: l.lundi, type: l.type, charge_prevue: prevue, charge_faite: Math.round(prevue * (manquee ? 0.8 : 1.08)),
        charge_tenue: Math.round(prevue * (manquee ? 0.8 : 0.97)), rpe_lu: true, seances_prevues: prevues, seances_faites: prevues - manquee,
        duree_prevue_min: Math.round(l.volume_h * 60), duree_faite_min: Math.round(l.volume_h * 60 * (manquee ? 0.8 : 1)),
        sl_prevue_min: l.sl_min, sl_faite_min: l.sl_min, cles_prevues: l.seances_cles.length, cles_reussies: l.seances_cles.length - (i % 4 === 3 ? 1 : 0),
        dplus_m: null, hooper: 8 + (i % 3) + (i % 7 === 6 ? 3 : 0),
      };
    });
  return { trame, realises, fiches: [], nolio: 'actif', accord: true, ecrit: true, courses: [] };
}

// La semaine telle qu'elle est partie dans Nolio (semaines_ecrites, ajustements compris) ; sinon celle du plan
// (un plan envoyé en entier, la démonstration, une semaine pas encore écrite).
export async function semaineEcrite(ctx: Contexte, numero: string): Promise<Semaine | null> {
  const duPlan = ctx.plan.semaines.find((s) => s.numero === numero) ?? null;
  if (ctx.demonstration) return duPlan;
  const { data } = await clientService().from('semaines_ecrites').select('donnees').eq('plan_id', ctx.cle).eq('numero', numero).maybeSingle();
  return (data?.donnees as Semaine | undefined) ?? duPlan;
}

// Les courses de préparation qui ont leur fiche de course (PO3), par leur date ; vide avant la migration du 20/10/2026.
export async function fichesDePreparation(planId: string): Promise<Set<string>> {
  const { data, error } = await clientService().from('plans').select('fiches_preparation').eq('id', planId).maybeSingle();
  if (error || !data) return new Set();
  return new Set(Object.keys(((data as { fiches_preparation?: Record<string, unknown> }).fiches_preparation ?? {})));
}
