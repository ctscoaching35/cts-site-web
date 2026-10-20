/**
 * Le profil d'entraînement d'un coaché (PO1, décisions coach des 19 et 20/10/2026) : niveau, terrain, jours disponibles,
 * jour de la sortie longue, séances par semaine. Celui de sa fiche s'il a été modifié (par lui ou son coach), sinon celui
 * de son dernier objectif. Il ne sert qu'à ses prochains objectifs ; sa semaine s'ajuste chaque dimanche par son
 * questionnaire. Une seule règle de lecture et de vérification, pour le coach et pour l'athlète. Côté serveur seulement.
 */
import { textes } from '@/lib/plan';
import { ficheDuCompte } from './demandes';
import { clientServeur, clientService } from './supabase';

export type ProfilEntrainement = Record<string, string | string[]>;
const CLES = ['niveau', 'terrain', 'jours_disponibles', 'jour_sl', 'freq_hebdo'];
const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export async function profilDeLaFiche(athleteId: string): Promise<ProfilEntrainement> {
  const service = clientService();
  const { data: a } = await service.from('athletes_coaches').select('profil').eq('id', athleteId).maybeSingle();
  if (a?.profil) return a.profil as ProfilEntrainement;
  const { data: liens } = await service.from('coaching').select('plan_id, plans(cree_le, intake)').eq('athlete_id', athleteId);
  type Lien = { plans: { cree_le: string; intake: Record<string, string | string[]> | null } | null };
  const dernier = ((liens ?? []) as unknown as Lien[]).filter((l) => l.plans)
    .sort((x, y) => String(x.plans?.cree_le).localeCompare(String(y.plans?.cree_le))).pop();
  const intake = dernier?.plans?.intake ?? {};
  return Object.fromEntries(CLES.filter((k) => intake[k] !== undefined).map((k) => [k, intake[k]]));
}

// Le profil en clair : « Niveau », « Terrain », « Disponibilités ».
export function lignesDuProfil(profil: ProfilEntrainement): [string, string][] {
  const jours = Array.isArray(profil.jours_disponibles) ? profil.jours_disponibles : [];
  return [
    ['Niveau', textes.niveau.options.find((o) => o.valeur === profil.niveau)?.titre ?? '—'],
    ['Terrain', textes.terrain.options.find((o) => o.valeur === profil.terrain)?.titre ?? '—'],
    ['Disponibilités', profil.freq_hebdo
      ? `${profil.freq_hebdo} séances · ${jours.map((j) => j.slice(0, 3)).join(', ')} · sortie longue le ${String(profil.jour_sl ?? '—')}`
      : '—'],
  ];
}

// Le profil d'un formulaire, vérifié : le profil, ou la phrase de ce qui manque. pour : « son » (le coach), « ton »
// (l'athlète).
export function lireProfil(form: FormData, pour: 'son' | 'ton'): { profil: ProfilEntrainement } | { erreur: string } {
  const niveau = String(form.get('niveau') ?? '');
  const terrain = String(form.get('terrain') ?? '');
  const jours = form.getAll('jours_disponibles').map(String).filter((j) => JOURS_SEMAINE.includes(j));
  const jourSl = String(form.get('jour_sl') ?? '');
  const freq = Number(form.get('freq_hebdo'));
  const ses = pour === 'son' ? 'ses' : 'tes';
  if (!textes.niveau.options.some((o) => o.valeur === niveau) || !textes.terrain.options.some((o) => o.valeur === terrain))
    return { erreur: `Choisis ${pour} niveau et ${pour} terrain.` };
  if (!jours.length || !jours.includes(jourSl)) return { erreur: `Coche ${ses} jours disponibles, dont celui de ${pour === 'son' ? 'sa' : 'ta'} sortie longue.` };
  if (!Number.isInteger(freq) || freq < 1 || freq > Math.min(7, jours.length))
    return { erreur: `Le nombre de séances doit tenir dans ${ses} jours disponibles.` };
  return { profil: { niveau, terrain, jours_disponibles: jours, jour_sl: jourSl, freq_hebdo: String(freq) } };
}

// Le profil d'entraînement du coaché connecté (son onglet Profil, le questionnaire d'un nouvel objectif) ; null sans fiche.
export async function monProfilDEntrainement(): Promise<ProfilEntrainement | null> {
  const { data } = await (await clientServeur()).auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const fiche = await ficheDuCompte(String(id));
  return fiche ? profilDeLaFiche(fiche.id) : null;
}

export const PROFIL_DE_DEMONSTRATION: ProfilEntrainement = {
  niveau: 'confirme', terrain: 'tres_pentu', jours_disponibles: ['mardi', 'mercredi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'samedi', freq_hebdo: '5',
};
