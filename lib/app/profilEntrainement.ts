/**
 * Le profil d'entraînement d'un coaché (PO1, décisions coach des 19 et 20/10/2026) : niveau, terrain, jours disponibles,
 * jour de la sortie longue, séances par semaine. Rempli d'abord, à part des objectifs (décision coach du 23/10/2026) ;
 * son niveau tiré de deux faits (lib/app/niveau.ts), ou choisi par le coach (niveau_coach), qui l'emporte. Celui de sa fiche s'il a été modifié (par lui ou son coach), sinon celui
 * de son dernier objectif. Il ne sert qu'à ses prochains objectifs ; sa semaine s'ajuste chaque dimanche par son
 * questionnaire. Une seule règle de lecture et de vérification, pour le coach et pour l'athlète. Côté serveur seulement.
 */
import { textes } from '@/lib/plan';
import { niveauDesFaits, texteDesFaits } from './niveau';
import { ACCENTS } from './accentFond';
import { ficheDuCompte } from './demandes';
import { clientServeur, clientService } from './supabase';

export type ProfilEntrainement = Record<string, string | string[]>;
// Les réponses qui partent au questionnaire d'un objectif ; les deux faits du niveau et le choix du coach restent ici.
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

// Le profil tel que le questionnaire d'un objectif le reprend.
export function profilPourLeQuestionnaire(profil: ProfilEntrainement | null | undefined): ProfilEntrainement {
  return Object.fromEntries(CLES.filter((k) => profil?.[k] !== undefined).map((k) => [k, (profil as ProfilEntrainement)[k]]));
}

const titreNiveau = (n: unknown) => textes.niveau.options.find((o) => o.valeur === n)?.titre;

// Le profil en clair : « Niveau », « Terrain », « Semaine habituelle ». pourCoach : le niveau qu'il a choisi, à côté
// de celui des faits.
export function lignesDuProfil(profil: ProfilEntrainement, pourCoach = false): [string, string][] {
  const jours = Array.isArray(profil.jours_disponibles) ? profil.jours_disponibles : [];
  const faits = texteDesFaits(profil.anciennete, profil.entrainement);
  const desFaits = titreNiveau(niveauDesFaits(profil.anciennete, profil.entrainement));
  const niveau = titreNiveau(profil.niveau) ?? '—';
  return [
    ['Niveau', profil.niveau_coach && pourCoach
      ? `${niveau}, choisi par toi${desFaits ? ` · d’après ses réponses : ${desFaits.toLowerCase()} (${faits})` : ''}`
      : profil.niveau_coach ? `${niveau}, choisi par ton coach`
      : faits && pourCoach ? `${niveau}, proposé d’après ses réponses (${faits})`
      : faits ? `${niveau} · ${faits}` : niveau],
    ['Terrain', textes.terrain.options.find((o) => o.valeur === profil.terrain)?.titre ?? '—'],
    ['Semaine habituelle', profil.freq_hebdo
      ? `${profil.freq_hebdo} séances · ${jours.map((j) => j.slice(0, 3)).join(', ')} · sortie longue le ${String(profil.jour_sl ?? '—')}`
      : '—'],
    ...(profil.cout_trail ? [['Ce qui coûte le plus', ACCENTS.find(([cle]) => cle === profil.cout_trail)?.[1] ?? '—'] as [string, string]] : []),
  ];
}

// Le profil d'un formulaire, vérifié : le profil, ou la phrase de ce qui manque. pour : « son » (le coach, qui peut
// choisir le niveau : niveau_coach, vide pour celui des faits), « ton » (l'athlète, qui garde le choix de son coach,
// pris dans ancien).
export function lireProfil(form: FormData, pour: 'son' | 'ton', ancien?: ProfilEntrainement | null): { profil: ProfilEntrainement } | { erreur: string } {
  const anciennete = String(form.get('anciennete') ?? '');
  const entrainement = String(form.get('entrainement') ?? '');
  const choix = pour === 'son' ? String(form.get('niveau_coach') ?? '') : String(ancien?.niveau_coach ?? '');
  const niveauCoach = textes.niveau.options.some((o) => o.valeur === choix) ? choix : '';
  const faits = niveauDesFaits(anciennete, entrainement);
  const niveau = niveauCoach || faits || '';
  const terrain = String(form.get('terrain') ?? '');
  const jours = form.getAll('jours_disponibles').map(String).filter((j) => JOURS_SEMAINE.includes(j));
  const jourSl = String(form.get('jour_sl') ?? '');
  const freq = Number(form.get('freq_hebdo'));
  // Ce qui lui coûte le plus en trail (décisions coach du 24/10/2026) : facultatif.
  const cout = String(form.get('cout_trail') ?? '');
  const ses = pour === 'son' ? 'ses' : 'tes';
  if (!niveau) return { erreur: pour === 'son'
    ? 'Réponds aux deux questions de son niveau, ou choisis-le.'
    : 'Réponds aux deux questions de ton niveau.' };
  if (!textes.terrain.options.some((o) => o.valeur === terrain)) return { erreur: `Choisis ${pour} terrain.` };
  if (!jours.length || !jours.includes(jourSl)) return { erreur: `Coche ${ses} jours disponibles, dont celui de ${pour === 'son' ? 'sa' : 'ta'} sortie longue.` };
  if (!Number.isInteger(freq) || freq < 1 || freq > Math.min(7, jours.length))
    return { erreur: `Le nombre de séances doit tenir dans ${ses} jours disponibles.` };
  // Le plafond du débutant (second audit, D4 : 4 séances au plus), que le moteur refuserait à l'objectif.
  if (niveau === 'debutant' && freq > 4) return { erreur: pour === 'son'
    ? 'Au niveau débutant, 4 séances par semaine au plus : choisis-en 4, ou change son niveau.'
    : 'Au niveau débutant, 4 séances par semaine au plus : choisis-en 4. Ton coach peut revoir ton niveau.' };
  return { profil: {
    niveau, ...(faits ? { anciennete, entrainement } : {}), ...(niveauCoach ? { niveau_coach: niveauCoach } : {}),
    terrain, jours_disponibles: jours, jour_sl: jourSl, freq_hebdo: String(freq),
    ...(ACCENTS.some(([cle]) => cle === cout) ? { cout_trail: cout } : {}),
  } };
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
  niveau: 'confirme', anciennete: 'plus_5', entrainement: 'structure', terrain: 'tres_pentu', jours_disponibles: ['mardi', 'mercredi', 'jeudi', 'samedi', 'dimanche'], jour_sl: 'samedi', freq_hebdo: '5',
};
