/**
 * LA CONTINUITÉ, CÔTÉ SITE (décisions coach du 26/10/2026, CTS_CONTINUITE_REFLEXION.md dans le dépôt du moteur ; audit du
 * 30/10/2026, CTS_AUDIT_AUTOMATISATION_30_10.md) : le dimanche, avant d'écrire la semaine, les séances de course faites
 * des 4 dernières semaines, quel qu'en soit l'auteur (le moteur, le coach qui a réécrit, avant l'automatisation), lues
 * dans Nolio et classées par leur structure (lib/app/classement.ts), la famille d'une séance de la barre par son nom (C1). Le moteur en tire la marche de chaque famille
 * (cts_ajustements.continuite, règle C1). Seules les séances dont le RPE prévu dit une qualité (5 ou plus, ou sans RPE)
 * sont ouvertes une à une. Côté serveur seulement.
 */
import { classerSeanceNommee, type FamilleLue, type NoeudNolio, type ProfilLu } from './classement';
import type { SeanceEnvoyee } from './coaching';
import { appelNolio, SPORTS_COURSE } from './nolio';
import { ajouterJours } from './plan';
import { empreinteSeance } from './trameNolio';

// L'interrupteur : activé par le coach le 30/10/2026 (« active pour tous et pousse »), après l'audit de la nuit.
export const CONTINUITE_ACTIVE = true;
// Les séances lues : les 4 dernières semaines.
const SEMAINES_LUES = 4;

export type SeanceLue = { date: string; famille: FamilleLue; minutes: number; reps: number; bloc_min: number;
  rpe_prevu: number | null; rpe: number | null; moteur: boolean };
type Prevue = { id: string; date_start: string; name?: string | null; sport?: string | null; rpe?: number | null; duration?: { value?: number } | null;
  revision?: string | null };
// Le corps d'une séance lue dans Nolio (GET planned/trainings/{id}/), null quand la lecture a échoué.
export type CorpsLu = Record<string, unknown> | null;
type Reelle = { planned?: string | null; debrief?: { rpe?: number | null } | null };

const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const lire = async (id: string, athlete: string): Promise<CorpsLu> => {
  await pause(150);
  const r = await appelNolio('GET', `planned/trainings/${id}/${athlete ? `?athlete=${athlete}` : ''}`);
  return r.statut === 200 ? ((r.corps ?? null) as CorpsLu) : null;
};

// LES RETOUCHES DU COACH, JUGÉES SUR LE CONTENU (D4 et D1, décisions coach du 04/11/2026, « A ») : une séance du moteur
// est intacte quand sa révision Nolio n'a pas changé depuis l'envoi, ou, si elle a changé, quand son contenu est le même
// (l'empreinte gardée à l'envoi, trameNolio.empreinteSeance) : une séance seulement déplacée reste celle du moteur, sa
// progression continue. Avant, toute révision changée en faisait la séance du coach, sa dose relue (une VO2max de 15 min
// déplacée d'un jour : la suivante à 16 min au lieu de 18). Une séance retouchée de la période (son contenu a changé)
// est lue dans Nolio et classée : sa famille va au moteur, qui refait la marche d'une séance clé remplacée par une autre
// famille (R8). Sans empreinte (un envoi d'avant le 04/11/2026) ou la séance illisible : la règle de la révision.
export async function lireLesRetouches(args: { planifiees: Prevue[]; envoyees: SeanceEnvoyee[]; profil: ProfilLu;
  athlete: string; du: string; au: string }): Promise<{ intactes: Set<string>; familles: Map<string, FamilleLue>; corps: Map<string, CorpsLu> }> {
  const parId = new Map(args.envoyees.filter((x) => x.nolio_id).map((x) => [String(x.nolio_id), x]));
  const intactes = new Set<string>();
  const familles = new Map<string, FamilleLue>();
  const corps = new Map<string, CorpsLu>();
  for (const p of args.planifiees) {
    const x = parId.get(p.id);
    if (!x) continue;
    if (!x.revision || !p.revision || x.revision === p.revision) {
      intactes.add(p.id);
      continue;
    }
    const jour = p.date_start.slice(0, 10);
    if (jour < args.du || jour > args.au) continue;
    const c = await lire(p.id, args.athlete);
    corps.set(p.id, c);
    if (!c) continue;
    if (x.contenu && x.contenu === empreinteSeance(c)) {
      intactes.add(p.id);
      continue;
    }
    const duree = typeof (c.duration as { value?: number } | null | undefined)?.value === 'number'
      ? Math.round((c.duration as { value: number }).value / 60) : null;
    const k = classerSeanceNommee((typeof c.name === 'string' ? c.name : null) ?? p.name ?? null, (c.workout ?? []) as NoeudNolio[],
      args.profil, typeof c.rpe === 'number' ? c.rpe : p.rpe ?? null, duree);
    familles.set(p.id, k?.famille ?? 'ef');
  }
  return { intactes, familles, corps };
}

// planifiees, reelles : ce que lireRetours a déjà lu ; moteur : les identifiants Nolio des séances qu'il a envoyées,
// intactes ; athlete : le paramètre d'athlète des requêtes (vide pour le coach lui-même) ; au : la veille du lundi écrit ;
// corps : les séances déjà lues (lireLesRetouches), pas relues.
// semaines : la fenêtre lue (4 le dimanche ; 12 à la première semaine d'un départ, D1 du 10/11/2026).
export async function seancesLues(args: { planifiees: Prevue[]; reelles: Reelle[]; moteur: Set<string>; profil: ProfilLu;
  accordLecture: boolean; athlete: string; au: string; corps?: Map<string, CorpsLu>; semaines?: number }): Promise<SeanceLue[]> {
  const du = ajouterJours(args.au, -7 * (args.semaines ?? SEMAINES_LUES) + 1);
  const faites = new Map(args.reelles.filter((r) => r.planned).map((r) => [String(r.planned), r]));
  const candidates = args.planifiees.filter((p) => SPORTS_COURSE.includes(String(p.sport)) && faites.has(p.id)
    && p.date_start.slice(0, 10) >= du && p.date_start.slice(0, 10) <= args.au && (p.rpe == null || p.rpe >= 5));
  const lues: SeanceLue[] = [];
  for (const p of candidates) {
    const lu = args.corps?.has(p.id) ? (args.corps.get(p.id) ?? null) : await lire(p.id, args.athlete);
    // Une séance illisible (un refus, un quota) se classe à son RPE prévu, sans structure.
    const workout = lu ? ((lu.workout ?? []) as NoeudNolio[]) : [];
    const duree = typeof p.duration?.value === 'number' ? Math.round(p.duration.value / 60) : null;
    const nom = (lu && typeof lu.name === 'string' ? lu.name : undefined) ?? p.name ?? null;
    const c = classerSeanceNommee(nom, workout, args.profil, p.rpe ?? null, duree);
    if (!c) continue;
    const reelle = faites.get(p.id);
    lues.push({ date: p.date_start.slice(0, 10), famille: c.famille, minutes: c.minutes, reps: c.reps, bloc_min: c.bloc_min,
      rpe_prevu: typeof p.rpe === 'number' ? p.rpe : null,
      rpe: args.accordLecture && typeof reelle?.debrief?.rpe === 'number' ? reelle.debrief.rpe : null,
      moteur: args.moteur.has(p.id) });
  }
  return lues;
}
