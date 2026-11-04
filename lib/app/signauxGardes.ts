/**
 * LES SIGNAUX DE LA SEMAINE, GARDÉS (EC2, audit de l'app coach du 03/11/2026 ; décision coach du 04/11/2026, « A ») :
 * calculés chaque soir par le passage quotidien (lib/app/ecriture.ts, fatigueDuJour), avec ce qu'il lit déjà dans Nolio,
 * et gardés en base (table signaux_suivi), pour l'accueil « Cette semaine » et le dimanche, sans appel de plus à Nolio.
 * Les drapeaux seulement (signauxSuivi.ts : genre, jour, détail chiffré), jamais le contenu d'une séance ni le texte
 * d'un commentaire ; « Relire maintenant » les refait pour un athlète. Ils s'effacent avec son accord. Côté serveur.
 */
import { clientService } from './supabase';
import type { GenreSignal, Suivi } from './signauxSuivi';

export type SignalGarde = { genre: GenreSignal; jour: string; detail: string };
export type SignauxGardes = {
  calcule_le: string; prevues: number; faites: number; hooper: Suivi['hooper']; signaux: SignalGarde[];
  derniere_activite: string | null;
};

// Seuils de l'accueil (décision coach du 04/11/2026, point 11 « A ») : rien de remonté depuis 5 jours.
export const SILENCE_JOURS = 5;

export async function garderLesSignaux(coachId: string, usr: string, suivi: Suivi, derniereActivite: string | null): Promise<void> {
  const { error } = await clientService().from('signaux_suivi').upsert({
    coach_id: coachId, nolio_athlete_id: usr, calcule_le: new Date().toISOString(), prevues: suivi.prevues, faites: suivi.faites,
    hooper: suivi.hooper, signaux: suivi.signaux.map(({ genre, jour, detail }) => ({ genre, jour, detail })),
    derniere_activite: derniereActivite,
  });
  // Sans la migration du 04/11/2026, rien n'est gardé : l'accueil le dit.
  if (error) console.error(`Signaux de ${usr} :`, error.message);
}

// { usr : ses signaux gardés } ; null sans la migration (la table n'existe pas encore).
export async function signauxGardes(coachId: string): Promise<Map<string, SignauxGardes> | null> {
  const { data, error } = await clientService().from('signaux_suivi')
    .select('nolio_athlete_id, calcule_le, prevues, faites, hooper, signaux, derniere_activite').eq('coach_id', coachId);
  if (error) return null;
  return new Map((data ?? []).map((l) => [String(l.nolio_athlete_id), {
    calcule_le: String(l.calcule_le), prevues: Number(l.prevues), faites: Number(l.faites), hooper: (l.hooper ?? null) as Suivi['hooper'],
    signaux: (l.signaux ?? []) as SignalGarde[], derniere_activite: (l.derniere_activite ?? null) as string | null,
  }]));
}

export async function effacerSignaux(coachId: string, usr: string): Promise<void> {
  await clientService().from('signaux_suivi').delete().eq('coach_id', coachId).eq('nolio_athlete_id', usr);
}

// Le jour de la dernière activité (tout sport) parmi celles lues, ou null.
export const derniereActivite = (reels: { date_start: string }[]): string | null =>
  reels.map((r) => r.date_start.slice(0, 10)).sort().pop() ?? null;
