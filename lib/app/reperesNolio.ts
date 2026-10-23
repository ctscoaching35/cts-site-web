/**
 * Les repères déjà saisis dans Nolio (décision coach du 24/10/2026, « la plus récente l'emporte ») : chaque nuit, pour
 * chaque coaché en mode coaching qui a donné son accord de lecture, la dernière valeur des métriques Nolio « Vitesse
 * critique Running » (en secondes par km) et « FC seuil 2 » (en bpm). Si elle a moins de 6 mois et qu'elle est plus
 * récente que le repère de l'app, ou que l'app n'en a pas, elle le remplace : source « nolio », sa date. Un repère de
 * l'app sans date (d'avant le 19/10/2026) reste. Les zones de l'app suivent, elles se calculent depuis sa fiche. Les
 * métriques sont celles du catalogue de Nolio (lues le 24/10/2026 sur le compte du coach : `is_nolio`, la même pour tous).
 * Côté serveur seulement.
 */
import { destinataire } from './coaching';
import { appelNolio } from './nolio';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

const METRIQUES = [
  { cle: 'vc_ms', item: 'mti_AUit0R4USmTdyFZ', valeur: (s: number) => (s >= 120 && s <= 600 ? Math.round((1000 / s) * 1000) / 1000 : null) },
  { cle: 'fc_seuil2', item: 'mti_zBpan6mEubaMh4i', valeur: (b: number) => (b >= 100 && b <= 230 ? Math.round(b) : null) },
] as const;

export type CompteReperes = { athlete: string; quoi: string; erreur?: string };

export async function reperesDeNolio(budgetMs = 60_000): Promise<CompteReperes[]> {
  const debut = Date.now();
  const service = clientService();
  const { data: fiches } = await service.from('athletes_coaches').select('*').not('nolio_athlete_id', 'is', null);
  const { data: accords } = await service.from('nolio_accords').select('coach_id, nolio_athlete_id');
  const avecAccord = new Set((accords ?? []).map((a) => `${a.coach_id}:${a.nolio_athlete_id}`));
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const limite = ajouterJours(aujourdhui, -183);
  const comptes: CompteReperes[] = [];
  for (const f of (fiches ?? []).filter((x) => x.mode !== 'plan' && avecAccord.has(`${x.coach_id}:${x.nolio_athlete_id}`))) {
    const usr = String(f.nolio_athlete_id);
    if (!/^usr_/.test(usr) || Date.now() - debut > budgetMs) continue;
    try {
      const d = await destinataire(usr);
      const qui = d.moi ? '' : `&athlete=${d.usr}`;
      const sources = { ...((f.reperes_sources ?? {}) as Record<string, { le?: string; source?: string }>) };
      const maj: Record<string, number> = {};
      for (const m of METRIQUES) {
        const r = await appelNolio('GET', `metrics/values/?item=${m.item}&limit=1${qui}`);
        if (r.statut !== 200) throw new Error(`Nolio ${r.statut} sur ${m.cle}`);
        const v = ((r.corps?.data ?? []) as { date_start?: string; value?: number | null; restriction?: unknown }[])[0];
        const le = String(v?.date_start ?? '').slice(0, 10);
        const valeur = v && v.value !== null && v.value !== undefined && !v.restriction ? m.valeur(Number(v.value)) : null;
        if (valeur === null || !le || le < limite) continue;
        const avant = sources[m.cle]?.le;
        if (f[m.cle] !== null && f[m.cle] !== undefined && (!avant || avant >= le)) continue;
        maj[m.cle] = valeur;
        sources[m.cle] = { le, source: 'nolio' };
      }
      if (!Object.keys(maj).length) continue;
      const { error } = await service.from('athletes_coaches').update({ ...maj, reperes_sources: sources }).eq('id', f.id);
      if (error) throw new Error(error.message);
      comptes.push({ athlete: usr, quoi: `repris de Nolio : ${Object.keys(maj).join(', ')}` });
    } catch (e) {
      comptes.push({ athlete: usr, quoi: 'repères de Nolio non lus', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}
