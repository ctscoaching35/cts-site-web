/**
 * Ce que le tableau de bord et « Mon plan » lisent d'un plan (lib/app/tableau.ts) : sa trame et ses fiches à leur
 * moment, ce qui a été fait chaque semaine écoulée, où en est l'athlète dans Nolio. Côté serveur seulement. Le plan
 * est celui que le contexte a choisi parmi ceux du compte connecté.
 */
import type { Contexte } from './contexte';
import { trameDuPlan, type LigneTrame, type Realise } from './ecriture';
import { ajouterJours } from './plan';
import { clientService } from './supabase';
import { trameDesDonnees, type Fiche } from './tableau';

// Où en est l'athlète dans Nolio (P1 à P4) ; « coache » : un objectif de son coach ; null : un plan d'avant le
// 19/10/2026, sans Nolio.
export type EtatNolio = 'a_inviter' | 'en_cours' | 'invite' | 'actif' | 'refuse' | 'sorti' | 'coache' | null;
export type DonneesTableau = {
  trame: LigneTrame[]; realises: Realise[]; fiches: Fiche[]; nolio: EtatNolio; accord: boolean; ecrit: boolean;
  // Avec la charge visée de la trame (un plan écrit semaine par semaine) : le graphique de charge a un sens.
  avecCharge: boolean;
  // Les courses secondaires ajoutées (O2).
  courses: CourseSecondaire[];
};
export type CourseSecondaire = { nom: string; date: string; distance_km: number; dplus_m: number };

export async function donneesTableau(ctx: Contexte): Promise<DonneesTableau> {
  if (ctx.demonstration) return demonstration(ctx);
  const service = clientService();
  const { data: p } = await service.from('plans').select('parametres, nolio_statut, accord_lecture_le').eq('id', ctx.cle).maybeSingle();
  if (!p?.parametres) {
    return { trame: trameDesDonnees(ctx.plan), realises: [], fiches: [], nolio: null, accord: false, ecrit: false, avecCharge: false, courses: [] };
  }
  const trame = await trameDuPlan(ctx.cle);
  const { data: lignes } = await service.from('semaines_ecrites').select('numero, realise').eq('plan_id', ctx.cle).not('realise', 'is', null);
  const realises = (lignes ?? []).map((l) => l.realise as Realise)
    .sort((a, b) => Number(a.numero.slice(1)) - Number(b.numero.slice(1)));
  return {
    trame: trame?.semaines ?? trameDesDonnees(ctx.plan), realises, fiches: trame?.fiches ?? [],
    nolio: (p.nolio_statut ?? null) as EtatNolio, accord: Boolean(p.accord_lecture_le), ecrit: true, avecCharge: Boolean(trame),
    courses: (((p.parametres as Record<string, unknown>).courses_secondaires ?? []) as CourseSecondaire[])
      .slice().sort((a, b) => a.date.localeCompare(b.date)),
  };
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
  return { trame, realises, fiches: [], nolio: 'actif', accord: true, ecrit: true, avecCharge: true, courses: [] };
}
