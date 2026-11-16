/**
 * LA PASSE DU LUNDI (lot 0 du 16/11/2026, décisions D5 du moteur 8.466 et décisions 3 et 4 du coach du 16/11/2026) : le
 * calcul seul, sans Nolio ni base ; la lecture et l'écriture sont dans lib/app/ecriture.ts (passageDuLundi). Sondé à part
 * (scripts/test-lundi.mjs).
 *
 * - Elle relit TOUTE la semaine écoulée, comme le dimanche (la même fenêtre), et ne rappelle le moteur que si quelque chose
 *   de nouveau est remonté depuis l'écriture : une séance de la fenêtre (pas seulement du week-end) ou une réponse au
 *   questionnaire de la semaine. Ce qui avait été lu le dimanche se garde avec la revue (`vus`) ;
 * - elle ne rappelle jamais le moteur sur une semaine que le coach a déjà touchée dans l'app depuis dimanche (« Annuler »,
 *   « Réessayer », les corrections de l'aperçu) ; le moteur vérifie lui-même les retouches dans Nolio ;
 * - la NOTE DU LUNDI (« Ta semaine ») part avec elle, après la lecture, et plus avec l'écriture du dimanche soir.
 */
import { ajouterJours } from './plan';

// Ce que le moteur rend avec chaque semaine (8.466) : le contrôle « demandé / écrit » de l'espace coach.
export type Demande = {
  reponse: { jours: string[] | null; jour_sl: string | null; nb_seances: number | null; source: 'fraiche' | 'derniere' | 'profil' | string;
    du?: string | null; champs_repli?: string[] } | null;
  ecrit: { jours: string[] | null; jour_sl: string | null; nb_seances: number | null } | null;
  ecarts: { type: string; detail: string; note: string | null }[];
};

// Ce que le site avait lu à l'écriture : les identifiants des activités de la fenêtre et de la réponse du samedi.
export type Vus = { reels: string[]; reponse: string | null };

// La réponse de POST /v1/semaine/lundi, sous la forme fixée par le contrat du moteur 8.468 (CONTRAT_API_CTS.md, « Les décisions
// du 16/11/2026 ») : `detail` est une phrase prête à afficher, SANS le jour (ligneDe met « jour : detail ») ; « repos » quand le
// jour n'a pas de séance. Rien de relu ce lundi : `changements`, `retouches` et `pourquoi` vides, `resultat` null.
export type ChangementDuLundi = { jour: string; avant: string; apres: string; detail: string };
export type TypeDeRetouche = 'deja_faite' | 'supprimee' | 'duree' | 'contenu' | 'deplacee' | 'posee' | 'courue';
export type RetoucheDuLundi = { jour: string; type: TypeDeRetouche; detail: string };
export type ReponseDuLundi = {
  reecrire: boolean; raison?: string | null; changements?: ChangementDuLundi[]; retouches?: RetoucheDuLundi[];
  pourquoi?: ('reponse' | 'seance')[]; resultat?: unknown;
};

// Ce que la passe a décidé, gardé avec la revue (pour le coach) : « reecrite », « non_reecrite » (ce qui aurait changé).
export type LundiGarde = {
  etat: 'reecrite' | 'non_reecrite'; le: string; raison?: string | null; changements?: ReponseDuLundi['changements'];
  retouches?: ReponseDuLundi['retouches']; resultat?: unknown; appliquee_le?: string;
  // La réponse au questionnaire est arrivée après l'écriture du dimanche (« Réponse arrivée après l'écriture »).
  reponse_tardive?: boolean;
};

export function signatureDesLectures(reels: { id: string }[], reponse: string | null | undefined): Vus {
  return { reels: [...new Set(reels.map((r) => String(r.id)))].sort(), reponse: reponse ? String(reponse) : null };
}

// Quelque chose de nouveau depuis l'écriture : une activité de la fenêtre ou une réponse que le dimanche n'avait pas lues. Sans
// ce que le dimanche avait lu (une revue d'avant le lot 0), tout est à relire.
export function quelqueChoseDeNouveau(avant: Vus | null | undefined, apres: Vus): boolean {
  if (!avant) return true;
  const vus = new Set(avant.reels);
  return apres.reels.some((id) => !vus.has(id)) || (apres.reponse !== null && apres.reponse !== avant.reponse);
}

// La passe appelle le moteur sur cette semaine ? Le motif quand non (pour le compte rendu). Seulement une semaine du dimanche
// qui n'a pas encore sa note du lundi, du jour même, ni une récupération ni la première d'une saison de fond (le moteur n'a pas
// de passe pour elles), ni une semaine que le coach a touchée depuis (« Annuler »).
export function peutAppelerLeMoteur(s: { quoi?: string | null; premiere?: boolean; sansAjustement?: boolean; aLaMain?: boolean;
  noteDejaPosee: boolean; aLeContexte: boolean }): string | null {
  if (s.noteDejaPosee) return 'déjà passée';
  if (s.aLaMain) return 'programmé à la main';
  if (s.sansAjustement) return 'ajustements annulés par le coach depuis dimanche';
  if (s.premiere) return 'première semaine d’une saison de fond';
  if (s.quoi !== 'Semaine') return s.quoi ? 'semaine de récupération' : 'dimanche d’avant la revue gardée';
  if (!s.aLeContexte) return 'ce que le dimanche avait lu n’est pas gardé';
  return null;
}

// ─── La semaine écrite, telle qu'elle est dans Nolio ce lundi (`semaine_dans_nolio`) ─────────────────────────────────────

type Duree = { value?: number | null } | null | undefined;
export type PrevueLue = { id: string; date_start: string; sport?: string | null; duration?: Duree; rpe?: number | null };
export type ReelLu = { id: string; date_start: string; sport?: string | null; duration?: Duree; planned?: string | null;
  elevation_gain?: { value?: number } | null; debrief?: { rpe?: number | null; feeling?: number | null } | null };
const minutes = (d: Duree) => (typeof d?.value === 'number' ? Math.round(d.value / 60) : null);
const nombre = (x: unknown) => (typeof x === 'number' ? x : null);

// La forme de `retours.nolio` pour LA semaine écrite (du lundi au dimanche) : `prevues` (les séances du moteur encore là,
// par leur identifiant de plan : durée, RPE, date, et la famille quand le coach en a changé le contenu) et `ajoutees` (les
// séances de course, de trail ou de tapis que le coach y a posées ou que l'athlète y a courues, hors jours de course).
// parNolio : l'identifiant Nolio -> l'identifiant de plan des séances que le site a envoyées (celles de cette semaine seulement
// comptent). familles : la famille d'une séance dont le coach a changé le contenu.
export function semaineDansNolio(p: { lundi: string; planifiees: PrevueLue[]; reels: ReelLu[]; parNolio: ReadonlyMap<string, string>;
  numero: string; familles?: ReadonlyMap<string, string>; sports: readonly string[]; joursDeCourse?: ReadonlySet<string>; accordLecture: boolean }) {
  const fin = ajouterJours(p.lundi, 6);
  const dansLaSemaine = (iso: string) => iso.slice(0, 10) >= p.lundi && iso.slice(0, 10) <= fin;
  const course = new Set(p.joursDeCourse ?? []);
  const deCourse = (sport: unknown, date: string) => p.sports.includes(String(sport)) && dansLaSemaine(date) && !course.has(date.slice(0, 10));
  const prevues: Record<string, { duree_min: number | null; rpe: number | null; date: string; famille?: string }> = {};
  for (const x of p.planifiees) {
    const jour = p.parNolio.get(x.id);
    if (!jour || !jour.startsWith(`${p.numero}-`)) continue;
    const famille = p.familles?.get(x.id);
    prevues[jour] = { duree_min: minutes(x.duration), rpe: nombre(x.rpe), date: x.date_start.slice(0, 10), ...(famille ? { famille } : {}) };
  }
  const posees = new Map(p.planifiees.filter((x) => !p.parNolio.has(x.id) && deCourse(x.sport, x.date_start)).map((x) => [x.id, x]));
  const ajoutees: { date: string; prevue_min: number | null; rpe_prevu: number | null; faite: boolean; duree_min?: number | null;
    rpe?: number | null; ressenti?: number | null; dplus_m?: number | null }[] = [];
  for (const r of p.reels) {
    if ((r.planned && p.parNolio.has(r.planned)) || !deCourse(r.sport, r.date_start)) continue;
    const x = r.planned ? posees.get(r.planned) : undefined;
    if (x) posees.delete(x.id);
    ajoutees.push({ date: r.date_start.slice(0, 10), prevue_min: x ? minutes(x.duration) : null, rpe_prevu: x ? nombre(x.rpe) : null, faite: true,
      duree_min: minutes(r.duration), rpe: p.accordLecture ? r.debrief?.rpe ?? null : null, ressenti: p.accordLecture ? r.debrief?.feeling ?? null : null,
      dplus_m: typeof r.elevation_gain?.value === 'number' ? Math.round(r.elevation_gain.value) : null });
  }
  for (const x of posees.values()) {
    ajoutees.push({ date: x.date_start.slice(0, 10), prevue_min: minutes(x.duration), rpe_prevu: nombre(x.rpe), faite: false });
  }
  return { prevues, ajoutees };
}

// ─── Le contrôle « demandé / écrit » en clair (l'espace coach, point 5) ──────────────────────────────────────────────────

const COURT = (j: string) => j.slice(0, 3);
const jm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const jourLong = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
const jours = (j: string[] | null | undefined) => (j?.length ? j.map(COURT).join(', ') : null);
const seances = (n: number | null | undefined) => (n ? `${n} séance${n > 1 ? 's' : ''}` : null);

// « Demandé : mar, jeu, sam, dim ; sortie longue dim ; 4 séances (réponse du samedi 14/11, lue) » ; quand le moteur est parti de
// sa dernière réponse : « (sa dernière réponse, du 07/11 : la réponse de samedi n'a pas été lue) ». null avant toute réponse
// (le profil).
export function demandeEnClair(d: Demande | null | undefined): { demande: string | null; ecrit: string | null; ecarts: { texte: string; sansPhrase: boolean }[] } {
  if (!d) return { demande: null, ecrit: null, ecarts: [] };
  const r = d.reponse;
  let demande: string | null = null;
  if (r) {
    const corps = [jours(r.jours), r.jour_sl ? `sortie longue ${COURT(r.jour_sl)}` : null, seances(r.nb_seances)].filter(Boolean).join(' ; ') || 'rien de lisible';
    const du = r.du ? String(r.du).slice(0, 10) : null;
    const repli = r.champs_repli?.length ? `, lue en partie : ${r.champs_repli.join(', ')} repris de sa dernière réponse` : '';
    demande = `Demandé : ${corps} ${r.source === 'derniere'
      ? `(sa dernière réponse${du ? `, du ${jm(du)}` : ''} : la réponse de samedi n’a pas été lue)`
      : r.source === 'profil' ? '(son profil, sans réponse lue)'
        : `(réponse du ${du ? `${jourLong(du)} ${jm(du)}` : 'samedi'}, lue${repli})`}`;
  }
  const e = d.ecrit;
  const ecrit = e ? `Écrit : ${[seances(e.nb_seances), jours(e.jours)].filter(Boolean).join(', ')}${e.jour_sl ? ` ; sortie longue ${COURT(e.jour_sl)}` : ''}` : null;
  return { demande, ecrit, ecarts: (d.ecarts ?? []).map((x) => ({ texte: x.note ? `${x.detail} — ${x.note}` : x.detail, sansPhrase: !x.note })) };
}

// Les écarts sans phrase dans la note (« À regarder », point 5) : l'écart que la note ne dit pas.
export const ecartsSansPhrase = (d: Demande | null | undefined) => (d?.ecarts ?? []).filter((x) => !x.note);

// Un changement ou une retouche du moteur, en une ligne : « mardi : EF plate (0h45) devient Seuil 2 … (0h44) ». Depuis 8.468, des
// objets {jour, detail, …} ; une phrase seule ou des objets d'avant (avant / après, date) se lisent encore ; on dit ce qu'on lit,
// jamais rien d'inventé.
export function ligneDe(x: unknown): string {
  if (typeof x === 'string') return x;
  if (!x || typeof x !== 'object') return '';
  const o = x as Record<string, unknown>;
  const dit = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
  const corps = dit(o.detail) || dit(o.texte) || [dit(o.avant), dit(o.apres)].filter(Boolean).join(' → ');
  return [dit(o.jour) || dit(o.date), corps].filter(Boolean).join(' : ');
}

// ─── « À regarder » (point 5) ────────────────────────────────────────────────────────────────────────────────────────────

// Les points d'une semaine écrite : une semaine écrite sur un repli (journal `REPONSE`), une réponse illisible, un écart sans phrase
// dans la note, une passe du lundi qui n'a pas réécrit (« ce qui aurait changé »), une semaine standard (moteur 8.468 : rien de
// lu de sa semaine passée, journal `STANDARD`). Chacun pour la semaine, un seul par genre. BROUILLONS (les textes, à valider par
// le coach).
export type PointDeLaReponse = { genre: 'standard' | 'reponse' | 'illisible' | 'ecart' | 'lundi'; texte: string };
export function pointsDeLaReponse(p: { journal: { regle?: string; du?: string; source?: string }[];
  revue: { lu?: { questionnaire_etat?: string; reponse?: { illisibles?: string[] } }; demande?: Demande | null; lundi?: Pick<LundiGarde, 'etat' | 'changements'> } | null }): PointDeLaReponse[] {
  const points: PointDeLaReponse[] = [];
  if (p.journal.some((j) => j.regle === 'STANDARD')) points.push({ genre: 'standard', texte: 'rien n’est remonté de sa semaine (ni séance, ni réponse, ni Hooper) : semaine prévue.' });
  const repli = p.journal.find((j) => j.regle === 'REPONSE');
  const partielle = p.revue?.lu?.questionnaire_etat === 'partielle';
  if (partielle || p.revue?.lu?.questionnaire_etat === 'illisible') {
    const en = (p.revue?.lu?.reponse?.illisibles ?? []).map((c) => ({ jours: 'des jours', jour_sl: 'du jour de sortie longue', nb_seances: 'du nombre de séances' }[c] ?? c));
    points.push({ genre: 'illisible', texte: partielle ? `sa réponse du samedi est en partie lue${en.length ? ` (la question ${en.join(' et ')} est illisible)` : ''} : le reste de la semaine suit sa réponse d’avant.`
      : `sa réponse du samedi est illisible${en.length ? ` (la question ${en.join(' et ')})` : ''} : la semaine suit sa réponse d’avant.` });
  } else if (repli) {
    points.push({ genre: 'reponse', texte: `sa semaine est écrite sur un repli : sa réponse du samedi n’a pas été lue${repli.du ? ` (elle suit celle du ${jm(String(repli.du))})` : ''}.` });
  }
  const sans = ecartsSansPhrase(p.revue?.demande);
  if (sans.length) points.push({ genre: 'ecart', texte: `la semaine s’écarte de sa demande sans que la note le dise : ${sans.map((x) => x.detail).join(' ; ')}.` });
  const n = p.revue?.lundi?.changements?.length ?? 0;
  if (p.revue?.lundi?.etat === 'non_reecrite') points.push({ genre: 'lundi', texte: `la passe du lundi n’a pas réécrit sa semaine : ${n} changement${n > 1 ? 's' : ''} à voir.` });
  return points;
}

// Après « Appliquer » (décision du coach du 16/11/2026) : la note « Ta semaine » du dimanche est REMPLACÉE par `resultat.bilan`,
// la note que le moteur a réécrite. Rend l'identifiant Nolio de la note déjà posée pour cette semaine (clé « S14:bilan »), ou null
// quand il n'y a pas de bilan (la note ne se touche pas) ou pas de note posée (l'écriture de la semaine la pose alors).
export function noteARemplacer(envois: { semaine: string; seances: { nolio_id: string | number | null }[] }[], numero: string,
  bilan: string | null | undefined): string | null {
  if (!bilan || !bilan.trim()) return null;
  const id = envois.find((e) => e.semaine === `${numero}:bilan`)?.seances.find((x) => x.nolio_id !== null && String(x.nolio_id) !== '')?.nolio_id;
  return id === undefined || id === null ? null : String(id);
}
