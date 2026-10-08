'use server';
/**
 * S'adapter aux retours (cadrage §7.2, étape 3) : appliquer ou refuser la proposition du moment, annuler
 * un ajustement. La session est vérifiée ; la proposition est recalculée sur les données du compte et
 * doit être celle que l'athlète a vue ; le serveur écrit avec la clé de service. Tout vit sous le
 * consentement du journal (« seulement pour suivre et ajuster mon plan ») : sans journal, pas de retour,
 * donc pas de proposition.
 */
import { revalidatePath } from 'next/cache';
import { aujourdhuiIso, jourParId, type Plan } from './plan';
import type { Retours } from './journal';
import { ranger, type Deplacements } from './deplacement';
import { ajuster, peutAnnuler, proposition, type Ajustement, type Regle } from './adaptation';
import { clientServeur, clientService } from './supabase';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Aujourd'hui ; en développement, le jour simulé de la page (?jour=), comme contexte().
const aujourdhui = (form?: FormData) => {
  const simule = String(form?.get('jour') ?? '');
  return process.env.NODE_ENV !== 'production' && JOUR.test(simule) ? simule : aujourdhuiIso();
};

async function etat(planId: string) {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const compteId = session?.claims?.sub;
  if (!compteId) return null;
  const { data: ligne } = await supabase.from('plans').select('id, donnees').eq('id', planId).maybeSingle();
  const { data: journal } = await supabase.from('journaux').select('plan_id').eq('plan_id', planId).maybeSingle();
  if (!ligne || !journal) return null;
  const [{ data: lignes }, { data: decisions }, { data: rangees }] = await Promise.all([
    supabase.from('retours').select('jour_id, statut, rpe, sensations').eq('plan_id', planId),
    supabase.from('ajustements').select('regle, cible, source, statut, decide_le').eq('plan_id', planId),
    supabase.from('deplacements').select('jour_id, date_iso').eq('plan_id', planId),
  ]);
  const retours: Retours = Object.fromEntries((lignes ?? []).map((l) => [l.jour_id, l]));
  const ajustements = (decisions ?? []) as Ajustement[];
  const deplacements: Deplacements = Object.fromEntries((rangees ?? []).map((l) => [l.jour_id, l.date_iso]));
  const plan = ranger(ajuster(ligne.donnees as Plan, ajustements), deplacements);
  return { compteId, plan, retours, ajustements };
}

// « Appliquer » ou « Non merci » : seulement la proposition du moment, telle que l'athlète l'a vue.
export async function deciderAjustement(
  planId: string, regle: Regle, cible: string, source: string | null, statut: 'applique' | 'refuse', form: FormData,
): Promise<void> {
  const e = await etat(planId);
  if (!e) return;
  const jour = aujourdhui(form);
  const p = proposition(e.plan, e.retours, e.ajustements, jour);
  if (!p || p.regle !== regle || p.cible.id !== cible || (p.regle === 'marche' ? p.source.id : null) !== source) return;
  const { error } = await clientService().from('ajustements').upsert({
    plan_id: planId, regle, cible, source, statut, decide_le: jour, compte_id: e.compteId, maj_le: new Date().toISOString(),
  });
  if (error) console.error(`Ajustement ${regle} ${cible}, plan ${planId} :`, error.message);
  revalidatePath('/app', 'layout');
}

// « Annuler l'ajustement » : la séance reprend son contenu prévu, et la proposition ne revient pas.
export async function annulerAjustement(planId: string, regle: Regle, cible: string, form: FormData): Promise<void> {
  const e = await etat(planId);
  if (!e) return;
  const j = jourParId(e.plan, cible);
  if (!j || !peutAnnuler(j, e.retours, aujourdhui(form))) return;
  const { error } = await clientService().from('ajustements').update({ statut: 'refuse', maj_le: new Date().toISOString() })
    .eq('plan_id', planId).eq('regle', regle).eq('cible', cible).eq('compte_id', e.compteId);
  if (error) console.error(`Annulation ${regle} ${cible}, plan ${planId} :`, error.message);
  revalidatePath('/app', 'layout');
}
