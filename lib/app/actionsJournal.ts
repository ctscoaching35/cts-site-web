'use server';
/**
 * Le journal de séance (cadrage §7.2) : enregistrer, corriger ou effacer un retour, effacer tout le
 * journal, ignorer l'encart « Et hier ? ». La session est vérifiée, la séance doit être une séance du
 * plan de l'athlète ; le serveur écrit avec la clé de service. Rien n'est gardé sans le consentement
 * explicite au journal (J3), donné une fois par plan. Jamais de douleur (J6).
 */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { Plan } from './plan';
import { tousLesJours } from './plan';
import { COOKIE_HIER, seanceDuJournal, type Statut } from './journal';
import { clientServeur, clientService } from './supabase';

export type EtatRetour = { message: string; ok: boolean } | null;

async function verifier(planId: string, jourId?: string) {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const compteId = session?.claims?.sub;
  if (!compteId) return { erreur: 'Ta session a expiré : reconnecte-toi.' } as const;
  const { data: plan } = await supabase.from('plans').select('id, donnees').eq('id', planId).maybeSingle();
  if (!plan) return { erreur: 'Ce plan n’est pas dans ton compte.' } as const;
  if (jourId) {
    const jour = tousLesJours(plan.donnees as Plan).find((j) => j.id === jourId);
    if (!jour || !seanceDuJournal(jour)) return { erreur: 'Cette séance n’est pas dans ton plan.' } as const;
  }
  return { compteId, supabase } as const;
}

export async function enregistrerRetour(planId: string, jourId: string, _e: EtatRetour, form: FormData): Promise<EtatRetour> {
  const statut = String(form.get('statut') ?? '') as Statut;
  if (!['faite', 'raccourcie', 'pas_faite'].includes(statut)) return { ok: false, message: 'Dis si la séance est faite, raccourcie ou pas faite.' };
  const v = await verifier(planId, jourId);
  if ('erreur' in v) return { ok: false, message: v.erreur! };
  const { data: journal } = await v.supabase.from('journaux').select('plan_id').eq('plan_id', planId).maybeSingle();
  const service = clientService();
  if (!journal) {
    if (form.get('consentement') !== 'on')
      return { ok: false, message: 'Coche la case pour que CTS garde tes retours : sans ton accord, rien n’est enregistré.' };
    const { error } = await service.from('journaux').insert({ plan_id: planId, compte_id: v.compteId });
    if (error && error.code !== '23505') {
      console.error(`Journal, plan ${planId} :`, error.message);
      return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
    }
  }
  const nombre = (cle: string, min: number, max: number) => {
    const n = Number(form.get(cle));
    return form.get(cle) !== null && form.get(cle) !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const faite = statut !== 'pas_faite';
  const { error } = await service.from('retours').upsert({
    plan_id: planId, jour_id: jourId, compte_id: v.compteId, statut,
    rpe: faite ? nombre('rpe', 0, 10) : null,
    sensations: faite ? nombre('sensations', 1, 5) : null,
    maj_le: new Date().toISOString(),
  });
  if (error) {
    console.error(`Retour ${jourId}, plan ${planId} :`, error.message);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'C’est noté.' };
}

export async function effacerRetour(planId: string, jourId: string): Promise<void> {
  const v = await verifier(planId);
  if ('erreur' in v) return;
  await clientService().from('retours').delete().eq('plan_id', planId).eq('jour_id', jourId).eq('compte_id', v.compteId);
  revalidatePath('/app', 'layout');
}

// Le journal entier, consentement compris : les retours partent avec lui (on delete cascade).
export async function effacerJournal(planId: string): Promise<void> {
  const v = await verifier(planId);
  if ('erreur' in v) return;
  await clientService().from('journaux').delete().eq('plan_id', planId).eq('compte_id', v.compteId);
  revalidatePath('/app', 'layout');
}

// « Ignorer » l'encart « Et hier ? » : retenu sur l'appareil pour cette séance-là.
export async function ignorerHier(jourId: string): Promise<void> {
  (await cookies()).set(COOKIE_HIER, jourId, { path: '/', maxAge: 3 * 24 * 60 * 60, sameSite: 'lax' });
  revalidatePath('/app');
}
