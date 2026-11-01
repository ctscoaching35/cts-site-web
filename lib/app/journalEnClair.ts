// Le journal du moteur en clair pour le coach (les règles du dimanche, cts_ajustements), et les doses lues : partagés par
// l'aperçu du dimanche et le rapport du dimanche.
import type { FamilleLue } from './classement';
import { jourMois } from './plan';

export const FAMILLE: Record<FamilleLue, string> = {
  ef: 'EF', seuil1: 'Seuil 1', tempo: 'Tempo', seuil2: 'Seuil 2', vo2max: 'VO2max', allure: 'Allure', sprint: 'Sprint',
  mecanique: 'Mécanique',
};

export type Entree = Record<string, unknown>;
export type Dose = { date?: string; minutes?: number; reps?: number; bloc_min?: number; monte?: boolean };

// Une dose lue, en clair : « 3 × 12 min », ou « 25 min » d'un seul bloc.
export const dose = (d: Dose) => (d.reps && d.reps > 1 ? `${d.reps} × ${d.bloc_min} min` : `${Math.round(d.minutes ?? 0)} min`);

// Une ligne du journal du moteur, en clair pour le coach.
export function enClair(e: Entree): string[] {
  const effet = typeof e.effet === 'string' ? e.effet : null;
  switch (e.regle) {
    case 'R1': return [`Moins de 60 % de la semaine faite (${e.charge_faite_pct} % de la charge) : rien ne se rattrape, les séances clés refont la même marche.`];
    case 'R2': return [`Séance ${String(e.seance ?? '')} ${[e.trop_dur && 'plus dure que prévu', e.ecourtee && 'écourtée'].filter(Boolean).join(' et ')} : sa marche est refaite, sous une autre forme.`];
    case 'R3': return [`Fatigue : ${effet ?? 'semaine allégée'}${Array.isArray(e.signaux) && e.signaux.length ? ` (${(e.signaux as string[]).join(' ; ')})` : ''}.`];
    case 'R4': return [`Arrêt${typeof e.jours === 'number' ? ` de ${e.jours} jours` : ''} : ${effet ?? ''}.`];
    case 'C1':
      if (e.doses && typeof e.doses === 'object') {
        return Object.entries(e.doses as Record<string, Dose>).map(([f, d]) => `${FAMILLE[f as FamilleLue] ?? f} : la marche part de la séance du ${d.date ? jourMois(d.date) : '?'} (${dose(d)}) ; ${d.monte ? 'la suivante monte d’une marche' : 'la suivante la refait (RPE au-dessus du prévu)'}.`);
      }
      return [`Sortie longue : la tienne (${e.duree_coach_min} min${e.faite ? ', courue' : ', pas courue'}) fixe la suivante, ${e.plafond_min} min au plus.`];
    default: return [`${String(e.regle ?? '')} : ${effet ?? JSON.stringify(e)}`];
  }
}

