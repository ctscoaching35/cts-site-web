/**
 * Le profil d'entraînement d'un coaché (PO1, décisions coach des 19 et 20/10/2026) : niveau, terrain, jours disponibles,
 * jour de la sortie longue, séances par semaine. Rempli d'abord, à part des objectifs (décision coach du 23/10/2026) ;
 * son niveau tiré de deux faits (lib/app/niveau.ts), ou choisi par le coach (niveau_coach), qui l'emporte. Celui de sa fiche s'il a été modifié (par lui ou son coach), sinon celui
 * de son dernier objectif. Il ne sert qu'à ses prochains objectifs ; sa semaine s'ajuste chaque dimanche par son
 * questionnaire. Une seule règle de lecture et de vérification, pour le coach et pour l'athlète. Côté serveur seulement.
 */
import { coteEnClair, lireCote, terrainDeLaCote, TEXTES_COTE } from '@/lib/cote';
import { CRITERES, estReponseCritere, titreReponse } from '@/lib/criteres';
import { API_URL, textes } from '@/lib/plan';
import { enTetesMoteur } from './cleMoteur';
import { niveauDesFaits, texteDesFaits } from './niveau';
import { ACCENTS } from './accentFond';
import { ficheDuCompte } from './demandes';
import { clientServeur, clientService } from './supabase';
import { enHeures } from './tableau';

export type ProfilEntrainement = Record<string, string | string[]>;
// Les réponses qui partent au questionnaire d'un objectif ; les deux faits du niveau et le choix du coach restent ici.
// Le tapis qui monte (FT3-1, décision coach du 01/11/2026) part aussi : facultatif, dans le profil (jsonb), sans migration.
// La côte en minutes (décision du coach du 23/11/2026, entrée 188) aussi : `cote_min`, à côté de `terrain`, l'ancien terrain à quatre
// valeurs qu'elle donne et que lit encore le moteur en ligne (lib/cote.ts).
// Les deux critères que le coach remplit sur la fiche (entrée 183 du 23/11/2026, lib/criteres.ts) suivent aussi, sous les clés du questionnaire.
const CLES = ['niveau', 'terrain', 'cote_min', 'tapis', 'critere_intensite', 'critere_denivele', 'jours_disponibles', 'jour_sl', 'freq_hebdo'];
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

// La côte en une ligne : ses minutes quand elles sont données (« 12 min », « Pas de côte »), sinon la réponse d'avant, à quatre
// cases (un profil d'avant le 23/11/2026). TEXTE : BROUILLON (« Plus longue côte »).
function ligneDeLaCote(profil: ProfilEntrainement): [string, string | undefined] {
  const minutes = coteEnClair(profil.cote_min);
  return minutes ? ['Plus longue côte', minutes] : ['Terrain', textes.terrain.options.find((o) => o.valeur === profil.terrain)?.titre];
}

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
    // Ses deux critères, pour le coach, quand il les a remplis (sans réponse, ils valent « jamais »).
    ...(pourCoach ? CRITERES.filter((q) => estReponseCritere(profil[q.champ])).map((q) => [q.fiche, titreReponse(String(profil[q.champ]))] as [string, string]) : []),
    [ligneDeLaCote(profil)[0], (ligneDeLaCote(profil)[1] ?? '—') + (profil.tapis === 'oui' ? ' · un tapis qui monte' : '')],
    ['Semaine habituelle', profil.freq_hebdo
      ? `${profil.freq_hebdo} séances · ${jours.map((j) => j.slice(0, 3)).join(', ')} · sortie longue le ${String(profil.jour_sl ?? '—')}`
      : '—'],
    ...(profil.cout_trail ? [['Ce qui coûte le plus', ACCENTS.find(([cle]) => cle === profil.cout_trail)?.[1] ?? '—'] as [string, string]] : []),
  ];
}

// « TA CARTE DE COUREUR » (lot 2 de l'app, décision A du coach du 12/11/2026), en tête du Profil, la même pour un acheteur
// et un coaché : ce qu'il a rempli, en clair — son niveau, sa semaine habituelle, son terrain, ce qui lui coûte le plus
// (au trail) ; une réponse absente n'a pas de ligne.
export function lignesDeLaCarte(profil: ProfilEntrainement | null | undefined): [string, string][] {
  if (!profil) return [];
  const jours = Array.isArray(profil.jours_disponibles) ? profil.jours_disponibles : [];
  const n = Number(profil.freq_hebdo);
  const semaine = n > 0 ? [`${n} séance${n > 1 ? 's' : ''}`, jours.length ? jours.map((j) => j.slice(0, 3)).join(', ') : '',
    profil.jour_sl ? `sortie longue le ${String(profil.jour_sl)}` : ''].filter(Boolean).join(' · ') : '';
  const [titreCote, cote] = ligneDeLaCote(profil);
  const lignes: [string, string | undefined][] = [
    ['Niveau', titreNiveau(profil.niveau)],
    ['Semaine habituelle', semaine],
    [titreCote, cote && `${cote}${profil.tapis === 'oui' ? ' · un tapis qui monte' : ''}`],
    ['Ce qui te coûte le plus', ACCENTS.find(([cle]) => cle === profil.cout_trail)?.[1]],
  ];
  return lignes.filter((l): l is [string, string] => Boolean(l[1]));
}

// Ce qu'un acheteur a rempli : les réponses du questionnaire de son plan (il n'a pas de fiche), lues avec ses droits.
export async function profilDuPlanAchete(planId: string): Promise<ProfilEntrainement> {
  const { data } = await (await clientServeur()).from('plans').select('intake').eq('id', planId).maybeSingle();
  return profilPourLeQuestionnaire((data?.intake ?? null) as ProfilEntrainement | null);
}

// Ce qui se mesure sur la carte (réponse du coach du 12/11/2026) : le niveau habituel que le moteur a calculé à la
// dernière semaine écrite (son état, plans.etat_ecriture ; moteur 8.460, décision 8 du 09/11/2026), seulement s'il est lu
// dans Nolio (pas la déclaration du questionnaire) ; son volume par semaine et sa sortie la plus longue. Une lecture de
// plus ; null sans semaine écrite, sans niveau lu dans Nolio, ou si la base ne répond pas.
export type NiveauLu = { volume_min: number; sl_min: number | null };
export async function niveauHabituelDuPlan(planId: string): Promise<NiveauLu | null> {
  const { data } = await clientService().from('plans').select('niveau:etat_ecriture->niveau_habituel').eq('id', planId).maybeSingle();
  const n = (data?.niveau ?? null) as { volume_min?: unknown; sl_min?: unknown; source?: unknown } | null;
  if (!n || n.source !== 'nolio' || typeof n.volume_min !== 'number' || n.volume_min <= 0) return null;
  return { volume_min: n.volume_min, sl_min: typeof n.sl_min === 'number' && n.sl_min > 0 ? n.sl_min : null };
}
// Ses lignes, en clair (brouillon) ; une donnée absente n'a pas de ligne.
export function lignesDuNiveau(n: NiveauLu | null | undefined): [string, string][] {
  if (!n) return [];
  return [['Volume habituel', `${enHeures(Math.round(n.volume_min))} par semaine`],
    ...(n.sl_min ? [['Plus longue sortie récente', enHeures(Math.round(n.sl_min))] as [string, string]] : [])];
}

// Le plafond de séances par semaine de chaque niveau, tel que /v1/config le rend (freq_max_par_niveau, moteur 8.471 : 7 pour
// les trois). Aucune valeur en dur : sans la valeur (config injoignable, niveau absent), 7.
export async function plafondsDeSeances(): Promise<Record<string, number>> {
  try {
    const r = await fetch(`${API_URL}/v1/config`, { cache: 'no-store', headers: enTetesMoteur() });
    const j = r.ok ? await r.json() : null;
    return (j?.freq_max_par_niveau ?? {}) as Record<string, number>;
  } catch { return {}; }
}

// Le profil d'un formulaire, vérifié : le profil, ou la phrase de ce qui manque. pour : « son » (le coach, qui peut
// choisir le niveau : niveau_coach, vide pour celui des faits), « ton » (l'athlète, qui garde le choix de son coach,
// pris dans ancien).
export function lireProfil(form: FormData, pour: 'son' | 'ton', ancien?: ProfilEntrainement | null, plafonds: Record<string, number> = {}): { profil: ProfilEntrainement } | { erreur: string } {
  const anciennete = String(form.get('anciennete') ?? '');
  const entrainement = String(form.get('entrainement') ?? '');
  const choix = pour === 'son' ? String(form.get('niveau_coach') ?? '') : String(ancien?.niveau_coach ?? '');
  const niveauCoach = textes.niveau.options.some((o) => o.valeur === choix) ? choix : '';
  const faits = niveauDesFaits(anciennete, entrainement);
  const niveau = niveauCoach || faits || '';
  // La plus longue côte, en minutes (23/11/2026), d'au moins 1 (24/11/2026) ; l'ancien terrain, que lit le moteur en ligne, s'en déduit.
  const cote = lireCote(form.get('cote_min'));
  const terrain = terrainDeLaCote(cote);
  // Le tapis qui monte (FT3-1) : facultatif, « oui » ou rien.
  const tapis = form.get('tapis') === 'oui';
  const jours = form.getAll('jours_disponibles').map(String).filter((j) => JOURS_SEMAINE.includes(j));
  const jourSl = String(form.get('jour_sl') ?? '');
  const freq = Number(form.get('freq_hebdo'));
  // Ce qui lui coûte le plus en trail (décisions coach du 24/10/2026) : facultatif.
  const cout = String(form.get('cout_trail') ?? '');
  const ses = pour === 'son' ? 'ses' : 'tes';
  // Les deux critères : le coach les remplit (« son »), l'athlète garde ceux de son coach (« ton »). Sans réponse lue, la clé manque,
  // et le critère vaut « jamais ».
  const criteres = Object.fromEntries(CRITERES.flatMap((q) => {
    const v = pour === 'son' ? form.get(q.champ) : ancien?.[q.champ];
    return estReponseCritere(v) ? [[q.champ, v]] : [];
  }));
  if (!niveau) return { erreur: pour === 'son'
    ? 'Réponds aux deux questions de son niveau, ou choisis-le.'
    : 'Réponds aux deux questions de ton niveau.' };
  if (cote === null || !terrain) return { erreur: pour === 'son' ? TEXTES_COTE.illisibleSa : TEXTES_COTE.illisible };
  if (!jours.length || !jours.includes(jourSl)) return { erreur: `Coche ${ses} jours disponibles, dont celui de ${pour === 'son' ? 'sa' : 'ta'} sortie longue.` };
  if (!Number.isInteger(freq) || freq < 1 || freq > Math.min(7, jours.length))
    return { erreur: `Le nombre de séances doit tenir dans ${ses} jours disponibles.` };
  // Le plafond de séances du niveau, lu dans /v1/config (7 sans la valeur) : le moteur l'aurait refusé à l'objectif.
  const plafond = Math.min(7, plafonds[niveau] ?? 7);
  if (freq > plafond) return { erreur: pour === 'son'
    ? `À ce niveau, ${plafond} séances par semaine au plus : choisis-en ${plafond}, ou change son niveau.`
    : `À ton niveau, ${plafond} séances par semaine au plus : choisis-en ${plafond}. Ton coach peut revoir ton niveau.` };
  return { profil: {
    niveau, ...(faits ? { anciennete, entrainement } : {}), ...(niveauCoach ? { niveau_coach: niveauCoach } : {}),
    terrain, cote_min: String(cote), tapis: tapis ? 'oui' : 'non', ...criteres, jours_disponibles: jours, jour_sl: jourSl, freq_hebdo: String(freq),
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

