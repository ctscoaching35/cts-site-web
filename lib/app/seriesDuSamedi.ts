/**
 * LES SÉRIES DU SAMEDI À RETIRER DE NOLIO (entrée 198 du coach, 24/11/2026) : sous le moteur 9.0, le questionnaire du dimanche s'appelle
 * « Ton point du dimanche » (lib/app/dimancheV9.ts) et « Ta semaine prochaine » du samedi n'est plus lu. Celles que le site a déjà posées
 * dans Nolio restent en place jusqu'à ce que le coach les retire lui-même : le site ne lit pas Nolio et n'y supprime rien. Cette liste se
 * construit par la base du site seule, jamais par Nolio :
 *   - un coaché : `athletes_coaches.questionnaires` ({ dimanche, semaine }, posés par lib/app/dimanchesCoaches.ts, un week-end à la fois) ;
 *   - un acheteur : `nolio_envois` (semaine « questionnaires », la ligne `questionnaire:semaine`, avec le jour où elle a été posée).
 * Une ligne par athlète, avec le week-end où la série tombe. Le Hooper n'est pas dans cette liste : il reste en place.
 *
 * Ce que la base ne sait pas : si le coach l'a déjà retirée (la liste ne s'en vide qu'une fois le week-end passé) ni, pour une série posée le samedi
 * même, si elle est au samedi ou au dimanche : la ligne dit les deux jours.
 *
 * La construction est pure (seriesARetirer) ; la lecture de la base, côté serveur, est à part (lireLesSeriesDuSamedi).
 */
import { ajouterJours } from './plan';

export type FicheSerie = {
  id: string; nom?: string | null; nolio_athlete_id?: string | null; ancien_le?: string | null;
  questionnaires?: { dimanche?: string | null; semaine?: string | null } | null;
};
export type EnvoiSerie = { plan_id: string; envoye_le?: string | null; seances?: { jour_id?: string; nolio_id?: string | null }[] | null };
export type PlanSerie = { id: string; nolio_athlete_id?: string | null; parametres?: { champs?: { nom?: unknown } } | null };

export type SerieARetirer = {
  cle: string; nom: string; athleteId: string | null; planId: string | null; usr: string | null;
  // Le week-end où la série tombe : son samedi (8 h) et son dimanche.
  samedi: string; dimanche: string;
};

// Le premier dimanche strictement après cette date (comme lib/app/dimanchesCoaches.ts, qui pose le dimanche qui vient).
const dimancheApres = (iso: string) => ajouterJours(iso, 7 - ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) - 1 || 7);
const jourParis = (instant: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(instant));
const estUnJour = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Les séries encore à venir : un week-end dont le dimanche n'est pas passé (aujourdhui : la date de Paris). Un athlète une seule fois (sa fiche d'abord,
 * puis son plan acheté), le plus proche en tête, puis par nom. Rend [] sans rien : ni erreur ni nom inventé.
 */
export function seriesARetirer({ fiches, envois, plans, aujourdhui }: { fiches: FicheSerie[]; envois: EnvoiSerie[]; plans: PlanSerie[]; aujourdhui: string }): SerieARetirer[] {
  const lignes: SerieARetirer[] = [];
  const vus = new Set<string>();
  const poser = (l: SerieARetirer) => {
    if (l.dimanche < aujourdhui) return;
    const qui = l.usr ?? l.cle;
    if (vus.has(qui)) return;
    vus.add(qui);
    lignes.push(l);
  };
  for (const f of fiches) {
    const q = f.questionnaires;
    // Un athlète sorti de l'équipe Nolio n'a plus de série à retirer chez lui.
    if (f.ancien_le || !q?.semaine || !estUnJour(q.dimanche)) continue;
    poser({ cle: `fiche:${f.id}`, nom: String(f.nom ?? '').trim() || 'Athlète sans nom', athleteId: f.id, planId: null, usr: f.nolio_athlete_id ?? null,
      samedi: ajouterJours(q.dimanche, -1), dimanche: q.dimanche });
  }
  const planDe = new Map(plans.map((p) => [p.id, p]));
  for (const e of envois) {
    const pose = (e.seances ?? []).find((s) => s.jour_id === 'questionnaire:semaine' && s.nolio_id);
    if (!pose || !e.envoye_le) continue;
    // Posée le soir, pour le dimanche qui vient (dimanchesCoaches.dimancheDuPlan) : celui qui suit le jour où elle a été posée.
    const dimanche = dimancheApres(jourParis(e.envoye_le));
    const p = planDe.get(e.plan_id);
    const nom = typeof p?.parametres?.champs?.nom === 'string' ? p.parametres.champs.nom.trim() : '';
    poser({ cle: `plan:${e.plan_id}`, nom: nom || 'Acheteur d’un plan', athleteId: null, planId: e.plan_id, usr: p?.nolio_athlete_id ?? null,
      samedi: ajouterJours(dimanche, -1), dimanche });
  }
  return lignes.sort((a, b) => a.dimanche.localeCompare(b.dimanche) || a.nom.localeCompare(b.nom, 'fr'));
}

// Les textes de l'écran (NOUVEAUX, à valider par le coach en regardant l'écran le 28/11/2026).
export const TEXTES_SERIES = {
  titre: 'Séries du samedi à retirer',
  sousTitre: 'Le questionnaire du samedi n’est plus lu depuis le moteur 9.0 : « Ton point du dimanche » le remplace. Celles que le site a déjà posées dans Nolio restent en place tant que tu ne les retires pas : le site ne supprime rien dans Nolio.',
  marche: [
    'Ouvre Nolio, l’agenda de l’athlète.',
    'Au jour indiqué, ouvre le questionnaire « Ta semaine prochaine » et supprime-le, lui seul.',
    'Ne retire pas « Ton point du dimanche » ni le Hooper : ils restent.',
  ],
  vide: 'Rien à retirer : aucune série du samedi n’est en place pour un week-end à venir.',
  pasEncore: 'Le moteur 9.0 n’est pas encore en ligne : « Ta semaine prochaine » du samedi sert encore. Ne retire rien pour l’instant.',
  ouvrirNolio: 'Ouvrir Nolio ›',
  pasLue: 'Elle n’a pas pu être lue : réessaie dans un instant.',
  carte: (n: number) => `${n} série${n > 1 ? 's' : ''} du samedi à retirer dans Nolio`,
} as const;

// Côté serveur : ce que la base du site garde pour ce coach, jamais Nolio. null si la base ne se lit pas.
export async function lireLesSeriesDuSamedi(coachId: string, aujourdhui: string): Promise<SerieARetirer[] | null> {
  const { clientService } = await import('./supabase');
  const service = clientService();
  const [fiches, envois] = await Promise.all([
    service.from('athletes_coaches').select('id, nom, nolio_athlete_id, ancien_le, questionnaires').eq('coach_id', coachId).not('questionnaires', 'is', null),
    service.from('nolio_envois').select('plan_id, envoye_le, seances').eq('coach_id', coachId).eq('semaine', 'questionnaires'),
  ]);
  if (fiches.error || envois.error) return null;
  const ids = [...new Set((envois.data ?? []).map((e) => String(e.plan_id)))];
  const plans = ids.length ? await service.from('plans').select('id, nolio_athlete_id, parametres').in('id', ids) : { data: [], error: null };
  if (plans.error) return null;
  return seriesARetirer({ fiches: (fiches.data ?? []) as FicheSerie[], envois: (envois.data ?? []) as EnvoiSerie[], plans: (plans.data ?? []) as PlanSerie[], aujourdhui });
}
