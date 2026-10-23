/**
 * Les acheteurs de plans (décision coach du 22/10/2026 : « les acheteurs de plans ne sont pas au même endroit que les
 * coachings individualisés ») : reconnus à leur plan acheté, qui suit son invitation dans l'équipe Nolio
 * (nolio_statut) ; sortis des listes du coaching (Suivi › Sans accord, athlètes de Nolio sans fiche) et listés à part
 * dans « Chiffres de la vente ». Leur accord de lecture est le leur (la case à l'achat, ou « Donner mon accord » dans le
 * Compte), jamais « Accord reçu ». Quelqu'un qui a aussi une fiche de coaché reste un coaché. Côté serveur seulement.
 */
import { clientService } from './supabase';

export type Acheteur = {
  id: string; nom: string; course: string; date: string; statut: string | null; demarre: string | null; accord: boolean;
  usr: string | null;
};

export async function acheteursDesPlans(): Promise<Acheteur[]> {
  const { data } = await clientService().from('plans')
    .select('id, course_nom, course_date, nolio_statut, demarre_le, accord_lecture_le, nolio_athlete_id, nom:donnees->athlete->>nom')
    .not('nolio_statut', 'is', null).order('course_date');
  return (data ?? []).map((p) => ({
    id: String(p.id), nom: String(p.nom ?? '').trim() || 'Acheteur', course: String(p.course_nom ?? ''),
    date: String(p.course_date ?? ''), statut: (p.nolio_statut as string | null) ?? null,
    demarre: p.demarre_le ? String(p.demarre_le).slice(0, 10) : null, accord: Boolean(p.accord_lecture_le),
    usr: (p.nolio_athlete_id as string | null) ?? null,
  }));
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
