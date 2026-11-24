// Aucun réseau, aucune base : ce que le site garde du dimanche d'un athlète quand il ne pose que le Hooper (scripts/test-hooper-du-dimanche.mjs).
/**
 * LE HOOPER DU DIMANCHE SOUS LE MOTEUR v1 (décision 52 du coach, 20/11/2026 : sans Hooper, l'alerte fatigue ne part jamais ; reprise le 24/11/2026) : sous la 9.x, « Ton point du
 * dimanche » remplace « Ta semaine prochaine » du samedi, mais le Hooper reste posé chaque dimanche, à midi avec lui (décision 211 ; à 8 h sous la 8.x) : un seul, pour le dimanche qui vient, sans
 * récurrence, d'un coaché relié à Nolio et d'un acheteur d'accord pour la lecture. Ce fichier dit ce que la base garde alors, pour que le Hooper seul ne fasse pas disparaître
 * la trace de la série du samedi que la 8.x a déjà posée (la page « Séries du samedi à retirer », lib/app/seriesDuSamedi.ts, la lit) : tant que le week-end est le même, elle
 * reste notée ; au week-end suivant, elle est passée.
 */
import { ajouterJours } from './plan';

// L'heure du Hooper sous la v1 (décision 211 du coach, 24/11/2026) : midi, heure de Paris, au même moment que « Ton point du dimanche » (lib/app/dimancheV9.ts, HEURE_D_ENVOI) : un seul
// moment de réponse, plus de Hooper à 8 h. Sous la 8.x il reste à 8 h (lib/app/dimanchesCoaches.ts).
export const HEURE_DU_HOOPER_V9 = '12:00';

// Le premier dimanche strictement après cette date (comme lib/app/dimanchesCoaches.ts, qui pose le dimanche qui vient).
export const dimancheApres = (iso: string): string => ajouterJours(iso, 7 - ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) - 1 || 7);
export const jourDeParis = (instant: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(instant));

// Ce que la fiche d'un coaché garde de son dimanche (`athletes_coaches.questionnaires`).
export type DimanchesCoache = { dimanche?: string; semaine?: string | null; hooper?: string | null; jusqua?: string; mot_le?: string | null; mot_note?: string | null };

/**
 * La fiche après la pose du dimanche. Sous la 8.x (seulementLeHooper faux) : le dimanche posé, son questionnaire du samedi et son Hooper. Sous la 9.x : le Hooper et le dimanche ;
 * le questionnaire du samedi n'est pas posé, mais celui que la 8.x a posé pour CE week-end reste noté (l'écran « Séries du samedi à retirer » le liste) ; celui d'un week-end passé,
 * non. `jusqua` (sa date d'entrée) ne bouge que par un questionnaire posé.
 */
export function suiteDeLaFiche(avant: DimanchesCoache | null, r: { dimanche: string; semaine: string | null; hooper: string | null }, seulementLeHooper: boolean): DimanchesCoache {
  const memeWeekEnd = avant?.dimanche === r.dimanche;
  return {
    dimanche: r.dimanche,
    jusqua: seulementLeHooper ? avant?.jusqua : r.semaine ? r.dimanche : avant?.jusqua,
    semaine: seulementLeHooper ? (memeWeekEnd ? avant?.semaine ?? null : null) : r.semaine,
    hooper: r.hooper,
    mot_le: avant?.mot_le ?? null, mot_note: avant?.mot_note ?? null,
  };
}

export type PoseNolio = { jour_id: string; nolio_id: string | null; genre: 'note' };
export type EnvoiQuestionnaires = { seances?: { jour_id?: string; nolio_id?: string | null }[] | null; envoye_le?: string | null } | null;

/**
 * Ce que le plan d'un acheteur garde (`nolio_envois`, semaine « questionnaires »). Sous la 9.x : le Hooper seul, plus celui du samedi que la 8.x a posé pour CE week-end (son dimanche
 * se lit sur le jour où la ligne a été écrite : posée le soir, pour le dimanche qui vient).
 */
export function posesDuPlan(r: { dimanche: string; semaine: string | null; hooper: string | null }, avant: EnvoiQuestionnaires, seulementLeHooper: boolean): PoseNolio[] {
  const serie = seulementLeHooper && avant?.envoye_le && dimancheApres(jourDeParis(avant.envoye_le)) === r.dimanche
    ? (avant.seances ?? []).find((s) => s.jour_id === 'questionnaire:semaine' && s.nolio_id) : undefined;
  return [
    ...(r.semaine ? [{ jour_id: 'questionnaire:semaine', nolio_id: r.semaine, genre: 'note' as const }]
      : serie ? [{ jour_id: 'questionnaire:semaine', nolio_id: String(serie.nolio_id), genre: 'note' as const }] : []),
    ...(r.hooper ? [{ jour_id: 'questionnaire:hooper', nolio_id: r.hooper, genre: 'note' as const }] : []),
  ];
}
