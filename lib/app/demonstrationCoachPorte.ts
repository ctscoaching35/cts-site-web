/**
 * La porte de la démonstration de l'espace coach (lib/app/demonstrationCoach.ts) et son jour simulé : à part, sans
 * rien d'autre, pour que proxy.ts la lise sans charger la démonstration.
 */

export const demonstrationCoachOuverte = () => process.env.NODE_ENV !== 'production' && !process.env.VERCEL
  && !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Le coach fictif de la démonstration.
export const COACH_DEMONSTRATION = { compteId: 'demo-coach', email: 'coach@demonstration.test' };

// ─── Le jour simulé ───────────────────────────────────────────────────────────────────────────────────────────────

export const COOKIE_JOUR = 'cts_demo_jour';
// La semaine de démonstration (scripts/demonstration-coach.py, LUNDI) et ses moments, heure de Paris.
export const LUNDI_DEMONSTRATION = '2026-11-09';
export const JOUR_PAR_DEFAUT = '2026-11-11T10:00';
export const MOMENTS: [string, string][] = [
  ['2026-11-11T10:00', 'Mercredi 11, la semaine en cours'],
  ['2026-11-14T10:00', 'Samedi 14, avant dimanche'],
  ['2026-11-15T20:30', 'Dimanche 15, après le passage'],
  ['2026-11-16T09:00', 'Lundi 16, ce qui est parti'],
];
const FORME_JOUR = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/;
export const jourValide = (v: string | null | undefined) => Boolean(v && FORME_JOUR.test(v));

