'use server';
/**
 * Déplacer une séance dans la semaine (cadrage §7.2, E1-E6) : échanger deux jours, remettre la semaine
 * comme prévue. La session est vérifiée, les deux jours doivent être de la même semaine du plan de
 * l'athlète et bouger encore ; le serveur écrit avec la clé de service. Le plan lui-même ne change pas.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { aujourdhuiIso, type Plan } from './plan';
import type { Retours } from './journal';
import { blocage, echanger, peutRemettre, ranger, type Deplacements } from './deplacement';
import { clientServeur, clientService } from './supabase';

export type EtatEchange = { message: string } | null;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Aujourd'hui ; en développement, le jour simulé de la page (?jour=), comme contexte().
const aujourdhui = (form?: FormData) => {
  const simule = String(form?.get('jour') ?? '');
  return process.env.NODE_ENV !== 'production' && JOUR.test(simule) ? simule : aujourdhuiIso();
};

async function verifier(planId: string) {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const compteId = session?.claims?.sub;
  if (!compteId) return { erreur: 'Ta session a expiré : reconnecte-toi.' } as const;
  const { data: ligne } = await supabase.from('plans').select('id, donnees').eq('id', planId).maybeSingle();
  if (!ligne) return { erreur: 'Ce plan n’est pas dans ton compte.' } as const;
  const { data: rangees } = await supabase.from('deplacements').select('jour_id, date_iso').eq('plan_id', planId);
  const { data: lignes } = await supabase.from('retours').select('jour_id, statut, rpe, sensations').eq('plan_id', planId);
  const deplacements: Deplacements = Object.fromEntries((rangees ?? []).map((l) => [l.jour_id, l.date_iso]));
  const retours: Retours = Object.fromEntries((lignes ?? []).map((l) => [l.jour_id, l]));
  return { compteId, prevu: ligne.donnees as Plan, deplacements, retours } as const;
}

export async function echangerJours(planId: string, jourId: string, _e: EtatEchange, form: FormData): Promise<EtatEchange> {
  const avec = String(form.get('avec') ?? '');
  if (!avec) return { message: 'Choisis un jour.' };
  const v = await verifier(planId);
  if ('erreur' in v) return { message: v.erreur! };
  const range = ranger(v.prevu, v.deplacements);
  const semaine = range.semaines.find((s) => s.jours.some((j) => j.id === jourId));
  const a = semaine?.jours.find((j) => j.id === jourId);
  const b = semaine?.jours.find((j) => j.id === avec);
  if (!a || !b || a.id === b.id) return { message: 'Choisis un autre jour de la même semaine.' };
  const jour = aujourdhui(form);
  if (blocage(a, range, v.retours, jour) || blocage(b, range, v.retours, jour))
    return { message: 'Ce jour ne bouge plus : choisis-en un autre.' };
  const nouveaux = echanger(v.prevu, v.deplacements, a.id, b.id);
  const service = clientService();
  for (const id of [a.id, b.id]) {
    const { error } = nouveaux[id]
      ? await service.from('deplacements').upsert({
          plan_id: planId, jour_id: id, compte_id: v.compteId, date_iso: nouveaux[id], maj_le: new Date().toISOString(),
        })
      : await service.from('deplacements').delete().eq('plan_id', planId).eq('jour_id', id).eq('compte_id', v.compteId);
    if (error) {
      console.error(`Déplacement ${id}, plan ${planId} :`, error.message);
      return { message: 'L’échange n’a pas abouti. Réessaie dans un moment.' };
    }
  }
  revalidatePath('/app', 'layout');
  // Retour à la fiche de la séance, à son nouveau jour (le lien garde le jour simulé en développement).
  const suite = String(form.get('suite') ?? '');
  redirect(suite.startsWith('/app/seance/') ? suite : `/app/seance/${encodeURIComponent(jourId)}`);
}

// « Remettre la semaine comme prévue » (E5) : toutes les séances de la semaine reprennent leur jour.
export async function remettreSemaine(planId: string, numero: string, form: FormData): Promise<void> {
  const v = await verifier(planId);
  if ('erreur' in v) return;
  const semaine = ranger(v.prevu, v.deplacements).semaines.find((s) => s.numero === numero);
  if (!semaine || !peutRemettre(semaine, v.retours, aujourdhui(form))) return;
  await clientService().from('deplacements').delete()
    .eq('plan_id', planId).eq('compte_id', v.compteId).in('jour_id', semaine.jours.map((j) => j.id));
  revalidatePath('/app', 'layout');
}
