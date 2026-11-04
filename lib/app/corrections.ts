/**
 * LES CORRECTIONS D'UNE SEMAINE AVANT SON ENVOI (EC3, audit de l'app coach du 03/11/2026 ; décision coach du 04/11/2026,
 * « A ») : sur l'aperçu d'une semaine (/app/coach/plan/[id]/apercu), le coach choisit une ou plusieurs corrections et
 * pourquoi ; le choix est gardé (table corrections_semaine) jusqu'au passage du dimanche, qui l'envoie au moteur
 * (POST /v1/semaine, champ « corrections ») puis le marque appliqué ; il s'annule d'un clic avant. Chaque correction se
 * compte avec sa raison dans « Chiffres » : ce que le coach corrige, et pourquoi, sans avoir à retoucher dans Nolio.
 * Côté serveur seulement.
 */
import { CORRECTIONS, RAISONS, type Choix, type Correction, type Raison } from './correctionsTextes';
import { clientService } from './supabase';

// L'interrupteur : éteint tant que le moteur ne lit pas « corrections » (une tâche du moteur l'ajoute ; à allumer avec
// sa version). Éteint, ni les boutons ni l'envoi : l'aperçu et le dimanche marchent comme avant.
export const CORRECTIONS_ACTIVES = false;

export { CORRECTIONS, RAISONS, type Choix, type Correction, type Raison } from './correctionsTextes';

const lire = (l: { corrections?: unknown; raison?: unknown; appliquee_le?: unknown }): Choix => ({
  corrections: ((l.corrections ?? []) as string[]).filter((c): c is Correction => c in CORRECTIONS),
  raison: typeof l.raison === 'string' && l.raison in RAISONS ? (l.raison as Raison) : null, appliquee: Boolean(l.appliquee_le),
});

// Le choix gardé pour la semaine de ce lundi ; null sans choix, ou sans la migration du 04/11/2026.
export async function choixDeLaSemaine(planId: string, lundi: string): Promise<Choix | null> {
  const { data, error } = await clientService().from('corrections_semaine').select('corrections, raison, appliquee_le')
    .eq('plan_id', planId).eq('lundi', lundi).maybeSingle();
  return error || !data ? null : lire(data);
}

// Ce que le passage envoie au moteur : les corrections d'une semaine pas encore appliquées ; [] sinon, ou éteint.
export async function correctionsAEnvoyer(planId: string, lundi: string | null | undefined): Promise<Correction[]> {
  if (!CORRECTIONS_ACTIVES || !lundi) return [];
  const choix = await choixDeLaSemaine(planId, lundi).catch(() => null);
  return choix && !choix.appliquee ? choix.corrections : [];
}

export async function marquerAppliquees(planId: string, lundi: string): Promise<void> {
  await clientService().from('corrections_semaine').update({ appliquee_le: new Date().toISOString() })
    .eq('plan_id', planId).eq('lundi', lundi).is('appliquee_le', null);
}

export async function garderLeChoix(coachId: string, planId: string, lundi: string, corrections: Correction[], raison: Raison | null) {
  const { error } = await clientService().from('corrections_semaine').upsert({
    plan_id: planId, lundi, coach_id: coachId, corrections, raison, choisi_le: new Date().toISOString(), appliquee_le: null,
  });
  if (error) throw new Error('Les corrections ne s’enregistrent pas encore (la migration du 04/11/2026 est à passer).');
}

export async function annulerLeChoix(planId: string, lundi: string) {
  await clientService().from('corrections_semaine').delete().eq('plan_id', planId).eq('lundi', lundi).is('appliquee_le', null);
}

// « Chiffres » : les corrections appliquées depuis une date, comptées par correction et par raison ; null sans la
// migration.
export async function correctionsComptees(coachId: string, depuis: string): Promise<{ parCorrection: Record<string, number>;
  parRaison: Record<string, number>; semaines: number } | null> {
  const { data, error } = await clientService().from('corrections_semaine').select('corrections, raison')
    .eq('coach_id', coachId).not('appliquee_le', 'is', null).gte('lundi', depuis);
  if (error) return null;
  const parCorrection: Record<string, number> = {};
  const parRaison: Record<string, number> = {};
  for (const l of data ?? []) {
    const c = lire(l);
    for (const x of c.corrections) parCorrection[x] = (parCorrection[x] ?? 0) + 1;
    const r = c.raison ?? 'sans';
    parRaison[r] = (parRaison[r] ?? 0) + 1;
  }
  return { parCorrection, parRaison, semaines: (data ?? []).length };
}
