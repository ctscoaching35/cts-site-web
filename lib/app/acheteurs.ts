/**
 * Les acheteurs de plans (décision coach du 22/10/2026 : « les acheteurs de plans ne sont pas au même endroit que les
 * coachings individualisés ») : reconnus à leur plan acheté, qui suit son invitation dans l'équipe Nolio
 * (nolio_statut) ; sortis des listes du coaching (Suivi › Sans accord, athlètes de Nolio sans fiche) et listés à part
 * dans « Chiffres de la vente ». Leur accord de lecture est le leur (la case à l'achat, ou « Donner mon accord » dans le
 * Compte), jamais « Accord reçu ». Quelqu'un qui a aussi une fiche de coaché reste un coaché. Côté serveur seulement.
 */
import { clientService } from './supabase';
import type { Vente } from './comptabilite';

export type Acheteur = {
  id: string; nom: string; course: string; date: string; statut: string | null; demarre: string | null; accord: boolean;
  usr: string | null;
};

// Sans les achats simulés par le coach (décision coach du 24/10/2026) : hors des Chiffres.
export async function acheteursDesPlans(): Promise<Acheteur[]> {
  const service = clientService();
  const { data } = await service.from('plans')
    .select('id, achat_id, course_nom, course_date, nolio_statut, demarre_le, accord_lecture_le, nolio_athlete_id, nom:donnees->athlete->>nom')
    .not('nolio_statut', 'is', null).order('course_date');
  const { data: simules } = await service.from('achats').select('id').like('stripe_session', 'coach\\_%');
  const horsChiffres = new Set((simules ?? []).map((a) => String(a.id)));
  return (data ?? []).filter((p) => !horsChiffres.has(String(p.achat_id))).map((p) => ({
    id: String(p.id), nom: String(p.nom ?? '').trim() || 'Acheteur', course: String(p.course_nom ?? ''),
    date: String(p.course_date ?? ''), statut: (p.nolio_statut as string | null) ?? null,
    demarre: p.demarre_le ? String(p.demarre_le).slice(0, 10) : null, accord: Boolean(p.accord_lecture_le),
    usr: (p.nolio_athlete_id as string | null) ?? null,
  }));
}

// LES VENTES DE PLANS (« Chiffres », la comptabilité, maquette du 08/11/2026) : chaque achat payé, son montant réellement
// payé (code promo déduit) et le plan rangé avec lui (formule, acheteur, statut Nolio, arrêtée). Sans les achats simulés par
// le coach (décision coach du 24/10/2026). Sans la migration du 05/11/2026 (arretee_le), rien n'est dit arrêté.
export async function ventesDesPlans(): Promise<Vente[]> {
  const service = clientService();
  const { data: achats } = await service.from('achats').select('id, paye_le, montant_centimes, stripe_session')
    .not('stripe_session', 'like', 'coach\\_%').order('paye_le');
  if (!achats?.length) return [];
  const champs = 'id, achat_id, course_nom, intake, nolio_statut, nom:donnees->athlete->>nom';
  const ids = achats.map((a) => String(a.id));
  const avec = await service.from('plans').select(`${champs}, arretee_le`).in('achat_id', ids);
  const plans = avec.error ? (await service.from('plans').select(champs).in('achat_id', ids)).data : avec.data;
  const parAchat = new Map((plans ?? []).map((p) => [String(p.achat_id), p as Record<string, unknown>]));
  return achats.filter((a) => a.paye_le).map((a) => {
    const p = parAchat.get(String(a.id));
    const mois = Number((p?.intake as Record<string, unknown> | null)?.duree_mois);
    return {
      id: String(a.id), payeLe: String(a.paye_le), centimes: Number(a.montant_centimes ?? 0),
      nom: p ? String(p.nom ?? '').trim() || null : null, course: p ? String(p.course_nom ?? '') || null : null,
      formule: Number.isFinite(mois) && mois > 0 ? mois : null, statut: (p?.nolio_statut as string | null) ?? null,
      arretee: Boolean(p?.arretee_le),
    };
  });
}

// Les comptes Nolio des acheteurs, hors ceux qui ont aussi une fiche de coaché chez ce coach.
export async function usrAcheteurs(coachId: string): Promise<Set<string>> {
  const service = clientService();
  const [{ data: plans }, { data: fiches }] = await Promise.all([
    service.from('plans').select('nolio_athlete_id').not('nolio_statut', 'is', null).not('nolio_athlete_id', 'is', null),
    service.from('athletes_coaches').select('*').eq('coach_id', coachId).not('nolio_athlete_id', 'is', null),
  ]);
  // Une fiche en mode plan (décision coach du 23/10/2026) ne fait plus de lui un coaché.
  const coaches = new Set((fiches ?? []).filter((f) => f.mode !== 'plan').map((f) => String(f.nolio_athlete_id)));
  return new Set((plans ?? []).map((p) => String(p.nolio_athlete_id)).filter((u) => u && !coaches.has(u)));
}

// « MODIFIER L'OBJECTIF » D'UN PLAN ACHETÉ (PL6, décision coach du 04/11/2026 au soir, « A ») : la règle des coachés
// (décision coach du 22/10/2026) : tout se modifie avant le départ ; une fois parti, ni la date ni la distance, et rien
// de nouveau ici (le coach voit au cas par cas). Le plan d'un acheteur : écrit semaine par semaine, invité dans l'équipe
// (nolio_statut), sans fiche de coaché ; null sinon. Le coach y entre depuis « Chiffres › Plans › Les acheteurs ».
export type PlanAchete = {
  id: string; course_nom: string; intake: Record<string, unknown>; parametres: Record<string, unknown>; demarre_le: string | null;
  nolio_statut: string; nolio_athlete_id: string | null; nom: string;
};
export async function planAchete(planId: string): Promise<PlanAchete | null> {
  const service = clientService();
  const { data: p } = await service.from('plans')
    .select('id, course_nom, intake, parametres, demarre_le, nolio_statut, nolio_athlete_id, nom:donnees->athlete->>nom')
    .eq('id', planId).not('nolio_statut', 'is', null).not('parametres', 'is', null).maybeSingle();
  if (!p || p.nolio_statut === 'coaching') return null;
  const { data: c } = await service.from('coaching').select('plan_id').eq('plan_id', planId).maybeSingle();
  if (c) return null;
  return {
    id: String(p.id), course_nom: String(p.course_nom ?? ''), intake: (p.intake ?? {}) as Record<string, unknown>,
    parametres: (p.parametres ?? {}) as Record<string, unknown>, demarre_le: (p.demarre_le as string | null) ?? null,
    nolio_statut: String(p.nolio_statut), nolio_athlete_id: (p.nolio_athlete_id as string | null) ?? null,
    nom: String(p.nom ?? '').trim(),
  };
}
