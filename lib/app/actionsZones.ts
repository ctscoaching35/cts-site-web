'use server';
/**
 * « Tes zones » : enregistrer ou effacer le profil d'un plan (cadrage §7.1). La session est vérifiée,
 * le plan doit être à l'athlète (les règles de la base ne lui montrent que les siens), puis le serveur
 * écrit avec la clé de service, comme pour le reste. La FC n'est gardée qu'avec le consentement
 * explicite de l'athlète (Z2) ; un consentement déjà donné pour ce plan vaut pour les tests suivants.
 */
import { revalidatePath } from 'next/cache';
import { clientServeur, clientService } from './supabase';
import { lireDistance, lireDuree, vitesseCritique } from './zones';

export type EtatZones = { message: string; ok: boolean } | null;

const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

async function enregistrer(planId: string, consentement: boolean, valeurs: Record<string, unknown>): Promise<EtatZones> {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const compteId = session?.claims?.sub;
  if (!compteId) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { data: plan } = await supabase.from('plans').select('id').eq('id', planId).maybeSingle();
  if (!plan) return { ok: false, message: 'Ce plan n’est pas dans ton compte.' };
  const { data: existant } = await supabase.from('zones').select('plan_id').eq('plan_id', planId).maybeSingle();
  if (!existant && !consentement)
    return { ok: false, message: 'Coche la case pour que CTS garde tes valeurs : sans ton accord, rien n’est enregistré.' };
  const { error } = await clientService()
    .from('zones')
    .upsert({ plan_id: planId, compte_id: compteId, ...valeurs, maj_le: new Date().toISOString() });
  if (error) {
    console.error(`Tes zones, plan ${planId} :`, error.message);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'C’est enregistré : tes séances affichent leurs nouveaux repères.' };
}

const lireFc = (brut: FormDataEntryValue | null) => {
  const fc = Number(String(brut ?? '').trim());
  return Number.isInteger(fc) && fc >= 80 && fc <= 220 ? fc : null;
};

export async function enregistrerParole(planId: string, _e: EtatZones, form: FormData): Promise<EtatZones> {
  const fc = lireFc(form.get('fc'));
  if (fc === null) return { ok: false, message: 'Entre ta FC en battements par minute, entre 80 et 220.' };
  return enregistrer(planId, form.get('consentement') === 'on', { fc_seuil1: fc, fc_seuil1_le: aujourdhui() });
}

export async function enregistrerFcSeuil2(planId: string, _e: EtatZones, form: FormData): Promise<EtatZones> {
  const fc = lireFc(form.get('fc'));
  if (fc === null) return { ok: false, message: 'Entre ta FC en battements par minute, entre 80 et 220.' };
  return enregistrer(planId, form.get('consentement') === 'on', { fc_seuil2: fc, fc_seuil2_le: aujourdhui() });
}

export async function enregistrerVitesseCritique(planId: string, _e: EtatZones, form: FormData): Promise<EtatZones> {
  const efforts = [1, 2].map((i) => ({
    duree_s: lireDuree(String(form.get(`duree${i}`) ?? '')),
    distance_m: lireDistance(String(form.get(`distance${i}`) ?? '')),
  }));
  if (efforts.some((e) => e.duree_s === null || e.distance_m === null))
    return { ok: false, message: 'Entre la durée (12 ou 12:00) et la distance (3150 m ou 3,15 km) de chaque effort.' };
  const [a, b] = efforts as { duree_s: number; distance_m: number }[];
  const vc = vitesseCritique(a, b);
  if ('erreur' in vc) return { ok: false, message: vc.erreur };
  return enregistrer(planId, form.get('consentement') === 'on', {
    vc_ms: vc.vc_ms, d_prime_m: vc.d_prime_m, vc_efforts: [a, b], vc_le: aujourdhui(),
  });
}

export async function effacerZones(planId: string): Promise<void> {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const { data: plan } = await supabase.from('plans').select('id').eq('id', planId).maybeSingle();
  if (!session?.claims?.sub || !plan) return;
  await clientService().from('zones').delete().eq('plan_id', planId).eq('compte_id', session.claims.sub);
  revalidatePath('/app', 'layout');
}
