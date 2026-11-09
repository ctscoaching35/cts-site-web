/**
 * Les repères déjà saisis dans Nolio (décision coach du 24/10/2026, « la plus récente l'emporte ») : chaque nuit, pour
 * chaque coaché en mode coaching qui a donné son accord de lecture, la dernière valeur des métriques Nolio « Vitesse
 * critique Running » (en secondes par km) et « FC seuil 2 » (en bpm). L'app n'en a pas : elle la prend, quel que soit
 * son âge (décision coach du 26/10/2026, « rentre les données Nolio de chaque athlète dans l'app si tu n'as pas
 * mieux ») ; l'app en a une : la valeur de Nolio la remplace si elle a moins de 6 mois et qu'elle est plus récente.
 * Source « nolio », sa date (la fiche la montre). Un repère de
 * l'app sans date (d'avant le 19/10/2026) reste. Les zones de l'app suivent, elles se calculent depuis sa fiche. Les
 * métriques sont celles du catalogue de Nolio (lues le 24/10/2026 sur le compte du coach : `is_nolio`, la même pour tous).
 * Côté serveur seulement.
 *
 * La FC au seuil 1 aussi (moteur 8.462, décision 10 du coach du 09/11/2026 : « on ne prescrit pas avec une valeur qu'on n'a
 * pas dans Nolio » ; la métrique que le coach a créée le 26/10/2026) ; une valeur égale à celle de l'app ne change ni sa
 * source ni sa date : la règle, reperesLus.ts.
 */
import { destinataire } from './coaching';
import { appelNolio } from './nolio';
import { ajouterJours } from './plan';
import { METRIQUES_LUES as METRIQUES, reprendreDeNolio } from './reperesLus';
import { clientService } from './supabase';

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
      const maj: Record<string, number | null> = {};
      for (const m of METRIQUES) {
        const r = await appelNolio('GET', `metrics/values/?item=${m.item}&limit=1${qui}`);
        if (r.statut !== 200) throw new Error(`Nolio ${r.statut} sur ${m.cle}`);
        const v = ((r.corps?.data ?? []) as { date_start?: string; value?: number | null; restriction?: unknown }[])[0];
        const le = String(v?.date_start ?? '').slice(0, 10);
        const valeur = v && v.value !== null && v.value !== undefined && !v.restriction ? m.valeur(Number(v.value)) : null;
        if (valeur === null || !reprendreDeNolio(m, f[m.cle], sources[m.cle]?.le, valeur, le, limite)) continue;
        maj[m.cle] = valeur;
        sources[m.cle] = { le, source: 'nolio' };
        // Une FC au seuil 1 venue de Nolio n'a pas l'allure de son palier : celle de l'ancien test ne la recoupe plus.
        if (m.cle === 'fc_seuil1') maj.v_seuil1_ms = null;
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
