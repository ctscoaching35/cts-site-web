/**
 * LE DOSSIER DE COURSE SANS PLAN (app gratuite, lot B, décision du coach du 16/11/2026) : l'appel au moteur
 * (`POST {API_URL}/v1/course-libre`, route publique, rien conservé côté moteur), la forme de sa réponse (CONTRAT_API_CTS.md,
 * moteur 8.470), les repères envoyés (ceux du profil gratuit, la FC seulement quand le profil la garde), et ce que le site
 * range : la réponse, allégée de ses points de profil. Pur : aucune lecture de session ni de base, le même code tourne dans
 * le navigateur (l'appel, le visiteur) et sur le serveur (la lecture et l'enregistrement du compte).
 *
 * Les textes du dossier sont ceux que le moteur rend (CTS_TEXTES_A_VALIDER.md, AF) : le site les affiche, il ne les recopie pas.
 */
import type { Plan } from './plan';
import { requeteCalculateurNutrition } from './plan';
import { parametresCalculateur, type Strategie } from './strategiePure';
import type { Experience, TestsGratuits } from './profilGratuit';
import { API_URL } from '@/lib/plan';

// L'identifiant du dossier d'un visiteur : celui de son onglet (les dossiers d'un compte ont celui de leur ligne).
export const ID_VISITEUR = 'ici';

// LES QUATRE CLASSES DE COURSE (doctrine du 18/11/2026, consigne App du 21/11) : roulant (moins de 10 m de D+ par km),
// vallonné (10 à 30), montagne (30 à 50), montagne raide (50 et plus), les mêmes noms partout (moteur, app, carte de
// course, communication). Avant : roulante (moins de 20), vallonnée (20 à 40), montagne (plus de 40).
export type Classe = 'roulant' | 'vallonne' | 'montagne' | 'montagne_raide';
export const CLASSES: Classe[] = ['roulant', 'vallonne', 'montagne', 'montagne_raide'];
export type CleZone = 'ef' | 'seuil1' | 'tempo' | 'seuil2' | 'vo2max';

export type LigneZone = {
  zone: CleZone; libelle: string;
  fc: { bas: number | null; haut: number | null } | null;
  allure: { lente: string; rapide: string; unite: string; pct_vc: [number, number] } | null;
};
export type ChiffreZone = { zone: CleZone; fc: { bas: number | null; haut: number | null } | null; allure: LigneZone['allure'] };
export type EtapeSeance = { role?: string; duree_s?: number; rpe?: number; repetitions?: number; etapes?: EtapeSeance[] };
export type SeanceType = {
  zone: CleZone; terrain: string; code: string; exemple: boolean; consigne: string; duree_min: number; etapes: EtapeSeance[];
};
export type PartieDossier = { titre: string; puces: string[] };

export type ReponseCourseLibre = {
  calcule_le: string;
  version_moteur: string;
  course: {
    nom: string | null; date: string; distance_km: number; dplus_m: number; dmoins_m: number; dmoins_estime: boolean;
    densite_mkm: number; classe: Classe; classe_libelle: string; temps_cible_h: number; temps_cible: string;
    experience: Experience; experience_supposee: boolean; trace: boolean; trace_ignoree: boolean;
  };
  profil: { troncons: Plan['profil']['troncons']; points: Plan['profil']['points']; sans_trace: string | null };
  pentes: { categorie: string; libelle: string; pct: number }[] | null;
  secteurs: { km_debut: number; km_fin: number; type: string; distance_km: number; dplus_m: number; dmoins_m: number; pente_moy_pct: number }[];
  determinants: { titre: string; physio: PartieDossier; mecanique: PartieDossier | null; sans_trace: string | null };
  texte_physio: string;
  zones: { reperes: { vc_ms?: number | null; fc_seuil1?: number | null; fc_seuil2?: number | null }; lignes: LigneZone[]; manque: string[] } | null;
  effort_jour_j: {
    duree_h: number; duree: string; debutant: boolean;
    plat: { zones: CleZone[]; libelle: string };
    cote: { zones: CleZone[]; forme: string; libelle: string; marche: boolean };
    descente: string; note: string | null;
    chiffres: { plat: ChiffreZone[]; cote: ChiffreZone[] } | null;
  };
  seances_types: SeanceType[];
};

// Ce qui part au moteur (le corps JSON de la demande) : la course, le temps visé, l'expérience et les repères du profil.
export type DemandeCourseLibre = {
  date_course: string; temps_cible: string;
  distance_km?: number | string; dplus_m?: number | string;
  experience?: Experience;
  reperes?: { vc_ms?: number; fc_seuil1?: number; fc_seuil2?: number };
  course_nom?: string;
};

// Ce que le visiteur a rempli dans le formulaire, tel quel (des textes).
export type SaisieCourse = { nom: string; date: string; temps: string; distance: string; dplus: string };
export const SAISIE_COURSE_VIDE: SaisieCourse = { nom: '', date: '', temps: '', distance: '', dplus: '' };

// Un dossier : ce qui est parti, ce que le moteur a rendu, la stratégie de nutrition gardée (une par dossier).
export type EntreesDossier = DemandeCourseLibre & { trace: boolean };
export type Dossier = {
  id: string | null; entrees: EntreesDossier; reponse: ReponseCourseLibre; strategie: Strategie | null; cree_le: string;
};

// ─── Les repères envoyés ───────────────────────────────────────────────────────────────────────

// Les repères du profil gratuit, dans les bornes du moteur (vc_ms de 1,5 à 8 ; FC de 80 à 230, le seuil 1 sous le seuil 2).
// La FC ne part que si le profil la garde : `avecFc` est vrai pour un compte qui a donné son accord (consentement FC),
// jamais pour un visiteur. Sans repère : pas de zones, le moteur le dit.
export function reperesDuProfil(tests: TestsGratuits, avecFc: boolean): NonNullable<DemandeCourseLibre['reperes']> | null {
  const r: NonNullable<DemandeCourseLibre['reperes']> = {};
  const vc = tests.vc?.vc_ms;
  if (typeof vc === 'number' && vc >= 1.5 && vc <= 8) r.vc_ms = Math.round(vc * 1000) / 1000;
  if (avecFc) {
    const s1 = tests.parole?.fc_seuil1;
    const s2 = tests.fc2?.fc_seuil2;
    const bon = (x: unknown): x is number => typeof x === 'number' && x >= 80 && x <= 230;
    // Deux seuils qui se contredisent : aucun des deux ne part (le moteur refuserait la demande entière).
    if (bon(s1) && bon(s2) && s1 >= s2) return Object.keys(r).length ? r : null;
    if (bon(s1)) r.fc_seuil1 = s1;
    if (bon(s2)) r.fc_seuil2 = s2;
  }
  return Object.keys(r).length ? r : null;
}

const nombre = (t: string): number | string => {
  const n = Number(t.trim().replace(',', '.'));
  return t.trim() !== '' && Number.isFinite(n) ? n : t.trim();
};

// Le corps de la demande : ce qui est vide ne part pas ; avec une trace, la distance et le D+ donnés font foi (le moteur).
export function construireDemande(s: SaisieCourse, profil: { reperes: DemandeCourseLibre['reperes'] | null }): DemandeCourseLibre {
  const d: DemandeCourseLibre = { date_course: s.date.trim(), temps_cible: s.temps.trim() };
  if (s.distance.trim()) d.distance_km = nombre(s.distance);
  if (s.dplus.trim()) d.dplus_m = nombre(s.dplus);
  if (profil.reperes && Object.keys(profil.reperes).length) d.reperes = profil.reperes;
  if (s.nom.trim()) d.course_nom = s.nom.trim().slice(0, 120);
  return d;
}

// ─── L'appel au moteur ─────────────────────────────────────────────────────────────────────────

// Le message d'un incident (AF.1, brouillon du moteur) ; 429 : un texte du site, à valider avec les autres.
export const MESSAGE_INCIDENT = 'Le dossier de course n’est pas disponible pour l’instant.';
export const MESSAGE_TROP_DE_DEMANDES = 'Trop de demandes d’un coup : attends une minute, puis recommence.';
export const MESSAGE_SANS_RESEAU = 'La connexion n’a pas abouti. Vérifie ton réseau, puis recommence.';

export type ResultatAppel = { ok: true; reponse: ReponseCourseLibre } | { ok: false; message: string; raison?: string };

// Le navigateur appelle le moteur directement, sans clé : la trace peut dépasser les 4,5 Mo que le serveur du site relaie.
// Sans trace, le même JSON en corps de requête ; avec, un envoi multipart (`corps` et `gpx`).
export async function appelerCourseLibre(demande: DemandeCourseLibre, gpx: Blob | null = null, appel: typeof fetch = fetch): Promise<ResultatAppel> {
  let r: Response;
  try {
    r = await appel(`${API_URL}/v1/course-libre`, gpx
      ? { method: 'POST', body: (() => { const f = new FormData(); f.append('corps', JSON.stringify(demande)); f.append('gpx', gpx, 'course.gpx'); return f; })() }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(demande) });
  } catch {
    return { ok: false, message: MESSAGE_SANS_RESEAU };
  }
  let corps: unknown = null;
  try {
    corps = await r.json();
  } catch {
    corps = null;
  }
  if (r.status === 429) return { ok: false, message: MESSAGE_TROP_DE_DEMANDES, raison: 'limite' };
  if (!r.ok) {
    const o = (corps && typeof corps === 'object' ? corps : {}) as { message?: unknown; raison?: unknown };
    // Les refus du moteur (422, 400) portent leur phrase, que le site affiche telle quelle.
    return { ok: false, message: r.status < 500 && typeof o.message === 'string' && o.message ? o.message : MESSAGE_INCIDENT,
      raison: typeof o.raison === 'string' ? o.raison : undefined };
  }
  const reponse = reponseSure(corps);
  return reponse ? { ok: true, reponse } : { ok: false, message: MESSAGE_INCIDENT };
}

// ─── Lire une réponse (du moteur, de l'onglet, de la base) ─────────────────────────────────────────

const estObjet = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
// La classe d'une réponse ou d'une ligne de base, quelle que soit l'orthographe de sa clé : celles d'avant (roulante,
// vallonnee) et la raide du moteur (raide, montagne raide, très raide) se ramènent aux quatre clés ci-dessus. Les clés exactes du
// nouveau contrat sont à confirmer avec le moteur ; une classe inconnue reste inconnue (null), jamais devinée.
export function lireClasse(x: unknown): Classe | null {
  if (typeof x !== 'string') return null;
  const k = x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s-]+/g, '_');
  if (k === 'roulant' || k === 'roulante') return 'roulant';
  if (k === 'vallonne' || k === 'vallonnee') return 'vallonne';
  if (k === 'montagne') return 'montagne';
  if (k === 'montagne_raide' || k === 'raide' || k === 'tres_raide') return 'montagne_raide';
  return null;
}
export const estClasse = (x: unknown): x is Classe => CLASSES.includes(x as Classe);

// La réponse relue : seulement ce qui a la forme dont l'écran se sert. Jamais crue sur parole (elle revient d'un navigateur
// ou d'une ligne que le compte écrit lui-même).
export function reponseSure(brut: unknown): ReponseCourseLibre | null {
  if (!estObjet(brut)) return null;
  const { course, determinants, effort_jour_j: e, profil } = brut as Record<string, any>;
  if (!estObjet(course) || lireClasse(course.classe) === null || !num(course.distance_km) || !num(course.dplus_m) || typeof course.date !== 'string'
    || typeof course.temps_cible !== 'string' || !num(course.temps_cible_h) || typeof course.classe_libelle !== 'string') return null;
  if (!estObjet(determinants) || !estObjet(determinants.physio) || !Array.isArray(determinants.physio.puces)) return null;
  if (!estObjet(e) || !estObjet(e.plat) || !estObjet(e.cote) || typeof e.plat.libelle !== 'string' || typeof e.cote.libelle !== 'string'
    || typeof e.descente !== 'string') return null;
  if (!estObjet(profil) || !Array.isArray(brut.seances_types)) return null;
  // La classe se range sous sa clé d'aujourd'hui : un dossier gardé avant le changement de noms se lit comme les autres.
  return { ...brut, course: { ...course, classe: lireClasse(course.classe) } } as unknown as ReponseCourseLibre;
}

export function dossierSur(brut: unknown): Omit<Dossier, 'id' | 'cree_le' | 'strategie'> | null {
  if (!estObjet(brut) || !estObjet(brut.entrees)) return null;
  const reponse = reponseSure(brut.reponse);
  const e = brut.entrees as Record<string, unknown>;
  if (!reponse || typeof e.date_course !== 'string' || typeof e.temps_cible !== 'string') return null;
  return { entrees: e as unknown as EntreesDossier, reponse };
}

// ─── Allégement du profil ──────────────────────────────────────────────────────────────────────────

// Un ultra rend plus de 11 000 points d'altitude : le dessin n'en montre que 700. Le site range, et envoie, un profil
// allégé (au plus `max` points, les limites des plages gardées), pour que l'onglet, la base et l'envoi au serveur restent légers.
export function allegerPoints(points: NonNullable<Plan['profil']['points']>, max = 800): NonNullable<Plan['profil']['points']> {
  const alt = points.altitude_m;
  if (!alt || alt.length <= max) return points;
  const pas = Math.ceil(alt.length / max);
  const gardes = new Set<number>([0, alt.length - 1]);
  for (let i = 0; i < alt.length; i += pas) gardes.add(i);
  for (const [a, b] of points.plages ?? []) { gardes.add(a); gardes.add(b); }
  const indices = [...gardes].filter((i) => i >= 0 && i < alt.length).sort((a, b) => a - b);
  const nouvel = new Map(indices.map((ancien, k) => [ancien, k]));
  const km = indices.map((i) => Math.round((points.km?.[i] ?? i * (points.pas_km ?? 0)) * 1000) / 1000);
  return {
    ...points,
    km, pas_km: null,
    altitude_m: indices.map((i) => alt[i]!),
    plages: points.plages ? points.plages.map(([a, b, c]) => [nouvel.get(a) ?? 0, nouvel.get(b) ?? indices.length - 1, c] as [number, number, string]) : null,
  };
}

export function allegerReponse(r: ReponseCourseLibre): ReponseCourseLibre {
  return r.profil?.points ? { ...r, profil: { ...r.profil, points: allegerPoints(r.profil.points) } } : r;
}

// ─── Ce que l'écran en tire ────────────────────────────────────────────────────────────────────────

// La répartition des pentes, dans la forme de RepartitionPentes (celle de l'app des acheteurs).
export const pentesPourBarres = (r: ReponseCourseLibre): [string, string, number][] | null =>
  r.pentes ? r.pentes.map((p) => [p.categorie, p.libelle, p.pct]) : null;

// Le nom de la course : celui qu'elle porte, sinon une ligne qui la décrit.
export const nomDeLaCourse = (r: ReponseCourseLibre) => r.course.nom?.trim() || `Course de ${String(r.course.distance_km).replace('.', ',')} km`;

// L'adresse du calculateur de nutrition : la durée visée, le niveau de l'expérience du profil (le moteur la rend dans la
// réponse), puis la stratégie gardée ; `garder` : le calculateur renvoie ses réponses à la page qui l'ouvre.
export function parametresNutrition(r: ReponseCourseLibre, strategie: Strategie | null, garder = true): Record<string, string> {
  return parametresCalculateur(r.course.temps_cible, r.course.experience, strategie, garder ? 'objectif' : undefined);
}
export const niveauDuCalculateur = (e: Experience | null | undefined) =>
  new URLSearchParams(requeteCalculateurNutrition('', e ?? null)).get('niveau') ?? 'int';

// Le temps visé en secondes (la colonne temps_vise_s), du temps que le moteur a lu.
export const tempsViseSecondes = (r: ReponseCourseLibre) => Math.round(r.course.temps_cible_h * 3600);

// La carte à partager : la course seule. Ce type ne porte, volontairement, AUCUNE donnée personnelle (ni FC, ni allure,
// ni temps visé) : rien d'autre ne peut y entrer.
export type ModeleCarte = {
  nom: string; date: string; distance_km: number; dplus_m: number; classe: Classe;
  profil: { km: number[]; altitude_m: number[]; plages: [number, number, string][] | null } | null;
};
export function modeleCarte(r: ReponseCourseLibre): ModeleCarte {
  return modeleCarteDe({
    nom: nomDeLaCourse(r), date: r.course.date, distance_km: r.course.distance_km, dplus_m: r.course.dplus_m, classe: r.course.classe,
    points: r.profil?.points, secteurs: r.secteurs,
  });
}

// La même carte, depuis les morceaux de la course (celle du dossier de l'objectif d'un acheteur ou d'un coaché : la course de son plan,
// seule). Sans points fins : le dénivelé cumulé, secteur par secteur (comme ProfilCourse) ; `km_fin` est la fin du secteur, en km.
export function modeleCarteDe(c: {
  nom: string; date: string; distance_km: number; dplus_m: number; classe: Classe;
  points?: Plan['profil']['points'] | null; secteurs?: { km_fin: number; dplus_m: number; dmoins_m: number }[] | null;
}): ModeleCarte {
  const p = c.points;
  let profil: ModeleCarte['profil'] = null;
  if (p?.altitude_m && p.altitude_m.length > 1) {
    const a = allegerPoints(p, 400);
    const alt = a.altitude_m!;
    profil = { km: a.km ?? alt.map((_, i) => i * (a.pas_km ?? 0)), altitude_m: alt, plages: a.plages ?? null };
  } else if (c.secteurs?.length) {
    const km = [0];
    const altitude_m = [0];
    for (const s of c.secteurs) { km.push(s.km_fin); altitude_m.push(altitude_m[altitude_m.length - 1]! + s.dplus_m - s.dmoins_m); }
    profil = { km, altitude_m, plages: null };
  }
  return { nom: c.nom, date: c.date, distance_km: c.distance_km, dplus_m: c.dplus_m, classe: c.classe, profil };
}
