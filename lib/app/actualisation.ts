import { API_URL } from '@/lib/plan';
import { realignerTrame } from './coaching';
import { objectifEcrit, TRAME } from './ecriture';
import { aujourdhuiIso, SCHEMA_PLAN, type Plan } from './plan';
import { clientService } from './supabase';

// Les plans en cours suivent les règles du jour (CTS_NOLIO_CADRAGE.md ; décision coach du 19/10/2026 : « si je change
// des règles, je ne veux pas que ce qui a été vu avant reste figé », la nuit qui suit). Chaque nuit, un plan dont la
// course est à venir et qu'une autre version du moteur a produit est refait par le moteur du jour (POST /v1/donnees,
// moteur 8.331) : ses zones, ses textes, ses fiches, sa course, son jour J ; la trace et le nom restent les siens. Sa
// trame dans Nolio (bandeaux et rappels de fiches des semaines à venir) se réaligne d'abord (décision coach du
// 19/10/2026) ; les semaines écrites ne bougent pas ; la trame de l'app (une ligne par semaine) se recalcule. Le plan
// n'est enregistré refait qu'une fois Nolio réaligné : sur un échec, il réessaie la nuit suivante. Un plan sans
// paramètres (d'avant l'écriture semaine par semaine) ne peut pas être refait.
export type Actualisation = { plan: string; quoi: string; erreur?: string };

// Le temps de la fonction (maxDuration, 300 s) moins une marge : ce qui reste se refait la nuit suivante.
const BUDGET_MS = 240_000;

export async function actualiserPlans(): Promise<Actualisation[]> {
  const conf = await fetch(`${API_URL}/v1/config`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const version = typeof conf?.version_moteur === 'string' ? conf.version_moteur : null;
  if (!version) throw new Error('la version du moteur est introuvable');
  const service = clientService();
  const { data: plans, error } = await service.from('plans').select('id, donnees, parametres')
    .not('parametres', 'is', null).gte('course_date', aujourdhuiIso())
    // La version entre guillemets : « 8.331 » porte un point.
    .or(`version_moteur.is.null,version_moteur.neq."${version}"`);
  if (error) throw new Error(`plans : ${error.message}`);
  const debut = Date.now();
  const comptes: Actualisation[] = [];
  for (const p of plans ?? []) {
    if (Date.now() - debut > BUDGET_MS) {
      comptes.push({ plan: p.id as string, quoi: 'remis à la nuit suivante' });
      continue;
    }
    try {
      const r = await fetch(`${API_URL}/v1/donnees`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ parametres: p.parametres, donnees_avant: p.donnees }),
      });
      const donnees = (await r.json().catch(() => null)) as Plan | null;
      if (!r.ok || !donnees) throw new Error(`moteur ${r.status}`);
      // Un schéma que l'app ne lit pas encore (le moteur parti avant le site) : le plan garde son contenu.
      if (donnees.schema !== SCHEMA_PLAN) throw new Error(`schéma ${donnees.schema}, l'app lit le ${SCHEMA_PLAN}`);
      const o = await objectifEcrit(p.id as string);
      const nolio = o ? await realignerTrame({ ...o, plan: donnees }, TRAME, aujourdhuiIso()) : { changes: 0, gardees: 0 };
      const { error: e } = await service.from('plans')
        .update({ donnees, version_moteur: donnees.version_moteur, schema: donnees.schema, trame: null }).eq('id', p.id);
      if (e) throw new Error(e.message);
      comptes.push({ plan: p.id as string, quoi: `refait en ${donnees.version_moteur} ; Nolio : ${nolio.changes} changé(s), ${nolio.gardees} gardé(s) tel(s) quel(s)` });
    } catch (e) {
      comptes.push({ plan: p.id as string, quoi: 'gardé tel quel', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}
