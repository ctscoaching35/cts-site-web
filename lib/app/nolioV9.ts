// Fonctions pures, sans réseau ni base (scripts/test-nolio-v9.mjs).
/**
 * CE QUE NOLIO MONTRE, POUR LE MOTEUR v1 (CONTRAT_API_CTS.md, « MOTEUR v1 », entrée `nolio` de `POST /v1/semaine`, `/v1/questionnaire` et
 * `/v1/reponse-tardive`) : jusqu'à 13 semaines, de la plus ancienne à la plus récente, chacune avec ses séances (identifiant posé par le
 * moteur, titre, durées, étapes à plat, faite ou non, RPE et ressenti), son Hooper et le nombre d'activités vues.
 *
 * Ce module ne lit rien : il range ce que lib/app/ecriture.ts a déjà lu dans Nolio (les séances prévues, les activités réelles, le Hooper), dans
 * les formes que le site connaît. Quatre règles viennent du moteur (moteur/adaptation.py, historique_effectif) et ne se contournent pas :
 *   - UNE SEMAINE PRÉSENTE VAUT « LUE » : une semaine écrite, présente avec zéro séance, dit au moteur que le coach les a TOUTES supprimées ;
 *     une semaine pas lue (échec, pas de lecture) ne s'envoie pas, ni `nolio` entier : le caller passe `null`, la clé disparaît ;
 *   - une séance du moteur porte son `id` (« S9-mardi », retrouvé par `parNolio`) ; une séance du coach n'en a pas, le moteur la lit par sa
 *     date et son titre : seules les séances de course, de trail et de tapis comptent, jamais un renfo ou un autre sport (il remplacerait
 *     à tort une séance du moteur du même jour) ;
 *   - `faite` : vrai quand une activité est reliée à la séance ; jamais `false` (confirmé par le moteur v1, 24/11/2026 : c'est permis ; une séance non
 *     lue compte comme faite, R5 ; « pas faite » vient de `reponses.cles_pas_faites` et de /v1/reponse-tardive) ; sinon `null` ;
 *   - le RPE et le ressenti ne se lisent qu'avec l'accord de lecture ; la durée faite, sans.
 * SOUS LE 9.1 (261 et 262, 26/11/2026) : une séance de course qui ne remonte pas est manquée, le moteur le lit lui-même ; une activité que Nolio n'a reliée à rien est donc reliée ici à la séance prévue sans
 * activité la plus proche (A2). Et la réponse à « Séance tenue ? » part en `tenue` (lib/app/seanceTenue.ts), avec l'accord de lecture.
 */
import { nolioPourLeMoteur, SEMAINES_LUES_AU_PLUS, type EtapeAPlat, type NolioVu, type SeanceVue, type SemaineVue } from './moteurV9';
import { relier } from './realiseV9';
import { tenueDeLaSeance, type QuestionDeDebrief } from './seanceTenue';

export type NoeudPlanifie = {
  kind?: string; intensity?: string; duration?: { value?: number; unit?: string } | null;
  targets?: { type?: string; rpe?: number }[] | null; times?: number; steps?: NoeudPlanifie[] | null;
};
export type PlanifieeLue = {
  id: string; name?: string | null; date_start: string; sport?: string | null; duration?: { value?: number } | null; workout?: NoeudPlanifie[] | null;
};
export type ReelleLue = {
  id: string; date_start: string; planned?: string | null; sport?: string | null; duration?: { value?: number } | null;
  debrief?: { rpe?: number | null; feeling?: number | null; questions?: QuestionDeDebrief[] | null } | null;
};
export type HooperLu = { date_start: string; value: number | null };

// Une étape de Nolio, à plat : sa durée en secondes (rien sans durée), son RPE cible, son rôle (une montée de rampe est du travail, une
// descente de rampe de la récupération : la lecture de lib/app/classement.ts).
const TYPE_DE_PAS: Record<string, EtapeAPlat['type']> = {
  warmup: 'warmup', cooldown: 'cooldown', work: 'work', rest: 'rest', ramp_up: 'work', ramp_down: 'rest',
};
export function aplatirLesEtapes(workout: NoeudPlanifie[] | null | undefined): EtapeAPlat[] {
  const sortie: EtapeAPlat[] = [];
  const parcourir = (noeuds: NoeudPlanifie[]) => {
    for (const n of noeuds) {
      if (n.kind === 'repeat') {
        // Une répétition se déplie tour par tour : le moteur compte les blocs.
        for (let i = 0; i < Math.max(1, Math.floor(n.times ?? 1)); i += 1) parcourir(n.steps ?? []);
        continue;
      }
      const type = TYPE_DE_PAS[String(n.intensity)];
      const s = typeof n.duration?.value === 'number' && n.duration.value > 0
        ? Math.round(n.duration.value * (String(n.duration.unit ?? 's').startsWith('min') ? 60 : 1)) : 0;
      if (!type || !s) continue;
      const rpe = n.targets?.find((c) => c.type === 'rpe' && typeof c.rpe === 'number')?.rpe;
      sortie.push({ s, rpe: typeof rpe === 'number' ? rpe : null, type });
    }
  };
  parcourir(workout ?? []);
  return sortie;
}

// ─── Les étapes d'une séance prévue ────────────────────────────────────────────────────────────

// Une séance prévue part-elle au moteur : dans une des semaines lues, et de la course (ou une des nôtres) ? La même règle que `nolioDepuisNolio`.
export const estEnvoyee = (p: PlanifieeLue, lundis: readonly string[], parNolio: ReadonlyMap<string, string>, sportsDeCourse: readonly string[]): boolean =>
  lundis.some((l) => JOUR(p.date_start) >= l && JOUR(p.date_start) <= ajouterJours(l, 6)) && (parNolio.has(p.id) || sportsDeCourse.includes(String(p.sport)));

export const aSesEtapes = (p: Pick<PlanifieeLue, 'workout'>): boolean => Array.isArray(p.workout) && p.workout.length > 0;

// Ce que rend le détail d'une séance prévue (`GET planned/trainings/{id}/`).
export type DetailDeSeance = { statut: number; workout?: NoeudPlanifie[] | null };

/**
 * LES ÉTAPES DES SÉANCES ENVOYÉES (240 du coach, 25/11/2026 ; défaut bloquant : la liste `planned/trainings/` de Nolio ne rend pas, ou pas toujours, les étapes, et la 8.x les relit séance par séance, lib/app/continuite.ts).
 * Le coach corrige depuis la barre de Nolio, dont les titres n'ont pas de dose : sans les étapes, la v1 ne relit pas ses corrections. Chaque séance prévue qui part au moteur et dont la liste ne rend pas les étapes est
 * relue en détail, à tous les passages : par petits groupes, avec la pause de la 8.x (les quotas de Nolio sont à l'heure et au jour, pas à la seconde : trois à la fois divisent par trois le temps du passage). Une
 * séance déjà complète dans la liste n'est pas relue. Un détail introuvable (404 : retirée entre-temps) garde la séance telle quelle ; toute autre réponse fait échouer la lecture entière : plutôt pas de `nolio` qu'une
 * semaine à moitié lue, que le moteur prendrait pour des séances sans contenu.
 */
export async function completerLesEtapes(planifiees: PlanifieeLue[], aRelire: (p: PlanifieeLue) => boolean, lireLeDetail: (id: string) => Promise<DetailDeSeance>,
  { parGroupe = 3, pause = () => new Promise<void>((ok) => setTimeout(ok, 150)) }: { parGroupe?: number; pause?: () => Promise<void> } = {}): Promise<PlanifieeLue[]> {
  const sans = planifiees.filter((p) => aRelire(p) && !aSesEtapes(p));
  const lues = new Map<string, NoeudPlanifie[]>();
  for (let i = 0; i < sans.length; i += parGroupe) {
    await pause();
    await Promise.all(sans.slice(i, i + parGroupe).map(async (p) => {
      const d = await lireLeDetail(p.id);
      if (d.statut === 404) return;
      if (d.statut !== 200) throw new Error(`Nolio : une séance prévue n’a pas pu être relue (statut ${d.statut}).`);
      if (Array.isArray(d.workout)) lues.set(p.id, d.workout);
    }));
  }
  return planifiees.map((p) => (lues.has(p.id) ? { ...p, workout: lues.get(p.id) as NoeudPlanifie[] } : p));
}

const minutes = (d: { value?: number } | null | undefined): number | null => (typeof d?.value === 'number' && d.value > 0 ? Math.round(d.value / 60) : null);
const JOUR = (iso: string) => iso.slice(0, 10);
const ajouterJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * La vue de ces semaines. lundis : les lundis des semaines LUES (un lundi par semaine réellement relue dans Nolio) ; planifiees, reelles et
 * hooper : tout ce qui a été lu sur leur fenêtre ; parNolio : l'identifiant Nolio d'une séance du moteur vers son id (« S9-mardi ») ;
 * sportsDeCourse : les sports qui comptent comme de la course ; joursDeCourse : les dates des courses.
 */
export function nolioDepuisNolio({ lundis, planifiees, reelles, hooper = [], parNolio, accordLecture, sportsDeCourse, joursDeCourse = new Set(), relierSansLien = false, lireTenue = false }: {
  lundis: string[]; planifiees: PlanifieeLue[]; reelles: ReelleLue[]; hooper?: HooperLu[]; parNolio: Map<string, string>;
  accordLecture: boolean; sportsDeCourse: readonly string[]; joursDeCourse?: Set<string>;
  // relierSansLien : sous le 9.1 (261). lireTenue : « Séance tenue ? » (262), à l'essai sur « (toi) » puis partout.
  relierSansLien?: boolean; lireTenue?: boolean;
}): NolioVu {
  const dansLaSemaine = (iso: string, lundi: string) => JOUR(iso) >= lundi && JOUR(iso) <= ajouterJours(lundi, 6);
  const semaines: SemaineVue[] = [...new Set(lundis)].map((lundi) => {
    const reellesDeLaSemaine = reelles.filter((r) => dansLaSemaine(r.date_start, lundi));
    const prevues = planifiees.filter((p) => estEnvoyee(p, [lundi], parNolio, sportsDeCourse));
    const reliees = relierSansLien ? relier(prevues, reellesDeLaSemaine.filter((r) => r.planned || sportsDeCourse.includes(String(r.sport)))) : null;
    const seances: SeanceVue[] = prevues
      .map((p) => {
        const reelle = reliees ? reliees.get(p.id) : reellesDeLaSemaine.find((r) => r.planned === p.id);
        const rpe = accordLecture ? reelle?.debrief?.rpe : null;
        const ressenti = accordLecture ? reelle?.debrief?.feeling : null;
        return {
          ...(parNolio.has(p.id) ? { id: parNolio.get(p.id) as string } : {}),
          date: JOUR(p.date_start), titre: String(p.name ?? ''), duree_min: minutes(p.duration), etapes: aplatirLesEtapes(p.workout),
          faite: reelle ? true : null, duree_faite_min: reelle ? minutes(reelle.duration) : null,
          rpe: typeof rpe === 'number' ? rpe : null, ressenti: typeof ressenti === 'number' ? ressenti : null,
          course: joursDeCourse.has(JOUR(p.date_start)),
          ...(lireTenue && accordLecture && tenueDeLaSeance(reelle?.debrief?.questions) ? { tenue: tenueDeLaSeance(reelle?.debrief?.questions)! } : {}),
        };
      });
    return {
      lundi, seances,
      hooper: accordLecture ? hooper.filter((h) => typeof h.value === 'number' && dansLaSemaine(h.date_start, lundi))
        .map((h) => ({ date: JOUR(h.date_start), valeur: h.value as number })) : [],
      activites_vues: reellesDeLaSemaine.length,
    };
  });
  return nolioPourLeMoteur(semaines);
}

// Les lundis des semaines à lire : celles du plan d'avant le lundi de la semaine à écrire, les 13 dernières au plus.
// LE PREMIER PASSAGE D'UN COACHÉ (240 du coach, 25/11/2026) : les 4 lundis d'avant le lundi à écrire, c'est-à-dire avant son entrée. Le même format `nolio` qu'aux passages suivants.
export const SEMAINES_DU_DEPART = 4;
export const lundisDuDepart = (lundiDeLaSemaineAEcrire: string): string[] => lundisALire(lundiDeLaSemaineAEcrire, ajouterJours(lundiDeLaSemaineAEcrire, -7 * SEMAINES_DU_DEPART));

// Au premier passage, une semaine sans séance prévue n'est pas envoyée (`seances: []` dirait au moteur que le coach les a toutes supprimées) ; sans aucune semaine à séances, pas de `nolio`.
export function vueDuDepart(vu: NolioVu): NolioVu | null {
  const semaines = vu.semaines.filter((s) => s.seances?.length);
  return semaines.length ? { semaines } : null;
}

export function lundisALire(lundiDeLaSemaineAEcrire: string, debutDuPlan: string): string[] {
  const lundis: string[] = [];
  for (let l = ajouterJours(lundiDeLaSemaineAEcrire, -7); l >= debutDuPlan && lundis.length < SEMAINES_LUES_AU_PLUS; l = ajouterJours(l, -7)) lundis.unshift(l);
  return lundis;
}
