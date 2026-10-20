/**
 * Le résumé d'une semaine lue dans Nolio (semainesNolio.ts ; décision coach du 20/10/2026, « tableau de bord
 * complet »), dans la forme de semaines_ecrites.realise. Sans appel : une fonction pure.
 */
import type { Realise } from './ecriture';

export type Prevue = { id: string; date_start: string; sport?: string | null; duration?: { value?: number } | null; rpe?: number | null };
export type Reelle = {
  id: string; date_start: string; sport?: string | null; duration?: { value?: number } | null; elevation_gain?: { value?: number } | null;
  planned?: string | null; debrief?: { rpe?: number | null } | null;
};

const minutes = (d: { value?: number } | null | undefined) => (typeof d?.value === 'number' ? Math.round(d.value / 60) : null);

// Le résumé d'une semaine lue dans Nolio. Prévue : une séance du calendrier qui a une durée (pas une note) ; faite :
// une séance réalisée. La charge (RPE × durée) ne compte que les séances dont l'athlète a donné le RPE ; prévue, celle
// des séances qui ont un RPE prévu. Ni séances clés ni type de semaine : le coach les écrit à sa façon.
export function resumeDeLaSemaine(lundi: string, prevues: Prevue[], reelles: Reelle[], hooper: number | null): Realise {
  const p = prevues.filter((x) => (minutes(x.duration) ?? 0) > 0);
  const durees = reelles.map((r) => minutes(r.duration) ?? 0);
  const avecRpe = reelles.filter((r) => typeof r.debrief?.rpe === 'number' && (minutes(r.duration) ?? 0) > 0);
  const charge = Math.round(avecRpe.reduce((n, r) => n + (r.debrief?.rpe as number) * (minutes(r.duration) as number), 0));
  const dplus = reelles.filter((r) => typeof r.elevation_gain?.value === 'number');
  return {
    numero: lundi, lundi, type: null,
    charge_prevue: Math.round(p.reduce((n, x) => n + (typeof x.rpe === 'number' ? x.rpe * (minutes(x.duration) as number) : 0), 0)),
    charge_faite: charge, charge_tenue: charge, rpe_lu: avecRpe.length > 0,
    seances_prevues: p.length, seances_faites: reelles.length,
    duree_prevue_min: p.reduce((n, x) => n + (minutes(x.duration) as number), 0), duree_faite_min: durees.reduce((n, x) => n + x, 0),
    sl_prevue_min: p.length ? Math.max(...p.map((x) => minutes(x.duration) as number)) : null,
    sl_faite_min: durees.length ? Math.max(...durees) : null,
    cles_prevues: 0, cles_reussies: 0,
    dplus_m: dplus.length ? Math.round(dplus.reduce((n, r) => n + (r.elevation_gain?.value as number), 0)) : null,
    hooper,
  };
}
