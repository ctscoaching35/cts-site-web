/**
 * LA SEMAINE ÉCRITE, LUE DANS SES DEUX FORMES (décision du coach du 24/11/2026 : les écrans de la semaine lisent la forme du moteur v1 ; l'ancien lecteur reste pour
 * l'historique de la 8.x). `semaines_ecrites.donnees` garde ce que le moteur a rendu, tel quel, sans la copier ni la convertir dans la base : une semaine de
 * la 8.x (`jours[].seance` est un texte) et une semaine du moteur v1 (`jours[].seance` est un objet : titre, famille, durée, RPE, étapes, consignes ; `jours[].renfo`).
 * Les écrans et les lecteurs prennent la semaine par CETTE fonction, à l'endroit où ils la lisent dans la base, et ne reçoivent que ce qu'ils affichent : les jours
 * (nom, date, famille, durée, RPE), le lundi, le type et le bloc, la phrase « 4 séances + la course ». Ce qui n'existe que dans l'ancienne forme (la carte du
 * jour, les repères, les ajustements d'une règle) n'est pas rendu pour une semaine du moteur v1 : le type `SemaineLue` ne l'a pas, le compilateur le dit.
 *
 * Fonctions pures, sans réseau ni base.
 */
import type { LigneTrame } from './ecriture';
import type { Jour, Semaine } from './plan';
import { enHeures } from './tableau';

// Ce que les écrans lisent d'un jour ; une `Jour` de la 8.x l'a (c'est un sous-ensemble de ses champs), un jour du moteur v1 aussi.
export type JourLu = Pick<Jour, 'id' | 'jour' | 'date' | 'date_iso' | 'seance' | 'duree' | 'rpe' | 'famille'>
  & Partial<Pick<Jour, 'nom' | 'couleur' | 'terrain' | 'reperes' | 'placement' | 'ajuste' | 'adaptation'>>;
export type SemaineLue = Pick<Semaine, 'numero' | 'numero_int' | 'type' | 'bloc' | 'volume' | 'seances' | 'dates' | 'progression' | 'passee' | 'lundi'>
  & Partial<Pick<Semaine, 'theme' | 'reprise_apres_course' | 'reprise_arret' | 'pourquoi'>> & { jours: JourLu[]; moteur?: string };

type SeanceV9 = { id?: string; famille?: string; terrain?: string | null; titre?: string; dose_min?: number; duree_min?: number; rpe?: number };
type JourV9 = { jour?: string; date?: string; seance?: SeanceV9 | null; renfo?: SeanceV9 | null };

// Une semaine du moteur v1 : ses jours portent tous `renfo` (nul ou non), et leur séance est un objet ou rien, jamais un texte.
export function estSemaineV9(donnees: unknown): boolean {
  const jours = (donnees as { jours?: unknown } | null | undefined)?.jours;
  return Array.isArray(jours) && jours.length > 0 && jours.every((j) => j && typeof j === 'object' && 'renfo' in j && typeof (j as { seance?: unknown }).seance !== 'string');
}

// Les familles du moteur v1 (endurance, seuil1, tempo, seuil2, vo2max, mecanique, sl, wec, renfo, test, recuperation, veille, course) dans celles que les écrans connaissent.
export const FAMILLE: Record<string, Jour['famille']> = {
  endurance: 'ef', recuperation: 'ef', veille: 'ef', renfo: 'ef', seuil1: 'qualite', tempo: 'qualite', seuil2: 'qualite', vo2max: 'qualite', test: 'qualite',
  mecanique: 'mecanique', sl: 'sl', wec: 'sl', course: 'course',
};
// Les types du moteur v1 (charge, assimilation, affutage_debut, affutage, affutage_1, course, recuperation) dans les noms que l'app donne aux types d'une semaine.
export const TYPE: Record<string, string> = { charge: 'Charge', assimilation: 'Assimilation', affutage: 'Affûtage actif', affutage_debut: 'Affûtage actif', affutage_1: 'Affûtage actif',
  course: 'Course', recuperation: 'Récupération' };
// LE NOM D'UNE SEMAINE DU MOTEUR v1 (correction du moteur du 24/11/2026, B4 de la revue Fable, eed2d74) : il suit `legere`, ce que la semaine écrite est, et non plus le `type` du
// squelette. Une semaine de fatigue est « allégée » (type « Assimilation », que les écrans disent « Semaine allégée ») ; une semaine de charge qui ne monte pas ne l'est pas : elle
// garde son nom de charge, et son bloc se lit à côté. Seuls « charge » et « assimilation » changent de nom, et seulement si `legere` est dit ; l'affûtage, la course et la
// récupération gardent leur type. Sans `legere` (une semaine d'avant la correction), le type d'avant.
export function typeDeLaSemaineV9(d: { type?: unknown; legere?: unknown }): string {
  const brut = String(d.type ?? '');
  if ((brut === 'charge' || brut === 'assimilation') && typeof d.legere === 'boolean') return TYPE[d.legere ? 'assimilation' : 'charge'];
  return TYPE[brut] ?? brut;
}
const JOURS_COURTS: Record<string, string> = { lundi: 'Lun.', mardi: 'Mar.', mercredi: 'Mer.', jeudi: 'Jeu.', vendredi: 'Ven.', samedi: 'Sam.', dimanche: 'Dim.' };
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const jourLong = (iso: string) => `${Number(iso.slice(8, 10))} ${MOIS[Number(iso.slice(5, 7)) - 1]}`;
const ajouterJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function jourLuV9(numero: number, j: JourV9): JourLu {
  const jour = String(j.jour ?? '').toLowerCase();
  // Un jour sans autre séance qui porte un renfo (244 : il peut tomber un jour non donné pour courir) : c'est le renfo qu'on lit, pas « Repos ». L'identifiant reste celui du jour (« S9-jeudi »),
  // que la comparaison avec Nolio retrouve depuis « S9-jeudi:renfo ». Un jour qui a une séance la montre seule, comme avant.
  const s = j.seance ?? (j.renfo?.titre ? j.renfo : null);
  const iso = typeof j.date === 'string' ? j.date : null;
  const minutes = s ? Math.round(s.duree_min ?? s.dose_min ?? 0) : 0;
  return {
    id: j.seance?.id ?? `S${numero}-${jour}`, jour: jour ? jour[0].toUpperCase() + jour.slice(1) : '', date_iso: iso,
    date: iso ? `${JOURS_COURTS[jour] ?? ''} ${jjmm(iso)}`.trim() : '', seance: s ? String(s.titre ?? '') : 'Repos', nom: s ? String(s.titre ?? '') : undefined,
    duree: s && minutes ? enHeures(minutes) : '—', rpe: s && typeof s.rpe === 'number' ? String(s.rpe) : '—',
    famille: s ? FAMILLE[String(s.famille)] ?? 'ef' : 'repos', terrain: s?.terrain ? String(s.terrain) : '',
  };
}

/**
 * La semaine telle que les écrans la lisent : celle de la 8.x rendue telle quelle, celle du moteur v1 réduite à ce qu'ils affichent. null sans semaine.
 * pourquoi : « Pourquoi cette semaine » du moteur v1, gardé à côté (semaines_ecrites.pourquoi), à y poser.
 */
export function lireLaSemaine(donnees: unknown, { pourquoi }: { pourquoi?: unknown } = {}): SemaineLue | null {
  if (!donnees || typeof donnees !== 'object') return null;
  if (!estSemaineV9(donnees)) return donnees as Semaine;
  const d = donnees as { numero?: number; lundi?: string; type?: string; legere?: boolean; bloc?: string; nombre?: number; volume_min?: number; jours: JourV9[] };
  const numero = Number(d.numero) || 0;
  const lundi = typeof d.lundi === 'string' ? d.lundi : null;
  const avecCourse = d.jours.some((j) => j.seance?.famille === 'course');
  const seances = typeof d.nombre === 'number' ? `${d.nombre} séance${d.nombre > 1 ? 's' : ''}${avecCourse ? ' + la course' : ''}` : '';
  return {
    numero: `S${numero}`, numero_int: numero, type: typeDeLaSemaineV9(d), bloc: d.bloc ? `Bloc ${d.bloc}` : '',
    volume: typeof d.volume_min === 'number' ? enHeures(Math.round(d.volume_min)) : '', seances,
    dates: lundi ? `${jourLong(lundi)} — ${jourLong(ajouterJours(lundi, 6))}` : '', progression: '', passee: false, lundi,
    jours: d.jours.map((j) => jourLuV9(numero, j)), moteur: '9.0',
    ...(Array.isArray(pourquoi) && pourquoi.length ? { pourquoi: pourquoi as Semaine['pourquoi'] } : {}),
  };
}

// ─── La trame : le plan déplié, une ligne par semaine ───────────────────────────────────────────────

type LigneTrameV9 = { numero?: number; lundi?: string; type?: string; bloc?: string; volume_h?: number; sl_min?: number | null; week_end_choc?: boolean;
  seances_cles?: { jour?: string; titre?: string; famille?: string }[] };

/**
 * La trame que rend `POST /v1/trame` du moteur v1, dans la forme que lisent « Mon plan », le tableau de bord et l'espace du coach (une ligne par semaine : son
 * numéro « S2 », son type et son bloc en mots de l'app, ses dates, son volume, ses séances clés). Sa charge visée n'y est pas : null, comme pour une trame tirée
 * des données d'un plan d'avant. aujourdhui : pour dire quelle semaine est passée. `moteur` marque la trame : une trame gardée par l'autre moteur se redemande.
 */
export function trameLue(lignes: LigneTrameV9[], course: { date: string }, aujourdhui: string): { course: { date: string }; semaines: LigneTrame[]; moteur: string } {
  return { course, moteur: '9.0', semaines: lignes.map((l): LigneTrame => {
    const lundi = String(l.lundi ?? '');
    return {
      numero: `S${l.numero}`, type: TYPE[String(l.type)] ?? String(l.type ?? ''), bloc: l.bloc ? `Bloc ${l.bloc}` : '', lundi,
      dates: lundi ? `${jourLong(lundi)} — ${jourLong(ajouterJours(lundi, 6))}` : '', volume_h: typeof l.volume_h === 'number' ? l.volume_h : 0, charge: null,
      seances_cles: (l.seances_cles ?? []).map((x) => ({ jour: x.jour ? x.jour[0].toUpperCase() + x.jour.slice(1) : '', seance: String(x.titre ?? ''), nom: String(x.titre ?? ''),
        famille: FAMILLE[String(x.famille)] ?? 'ef' })),
      week_end_choc: Boolean(l.week_end_choc), sl_min: typeof l.sl_min === 'number' ? l.sl_min : null,
      passee: lundi ? ajouterJours(lundi, 6) < aujourdhui : false,
    };
  }) };
}

// Une trame gardée avec le plan est la bonne si elle vient du même moteur que celui qui est en ligne : celle du moteur v1 porte `moteur: '9.0'`, celle de la 8.x non.
export const trameDuBonMoteur = (trame: unknown, v9: boolean): boolean => Boolean(trame) && ((trame as { moteur?: unknown }).moteur === '9.0') === v9;
