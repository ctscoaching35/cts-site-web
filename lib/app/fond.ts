/**
 * La saison de fond, côté site (moteur 8.353, cts_fond ; décisions coach des 21 et 24/10/2026,
 * CTS_COACHING_LONG_COURS_REFLEXION.md §5). Un coaché en programmation automatique sans objectif à préparer court des
 * saisons de 12 semaines (13 avec l'entrée de tests) : sans objectif, avant la préparation d'un objectif lointain, ou
 * entre deux objectifs une fois la récupération faite. Une saison se range comme un objectif de coaching (une ligne
 * de plans reliée à sa fiche, ses paramètres portant « fond ») : le passage du dimanche l'écrit et l'envoie comme les
 * autres. Elle se crée d'elle-même au passage du soir pour le lundi qui vient, et s'arrête quand une préparation prend
 * la suite. Côté serveur seulement.
 */
import type { Plan } from './plan';
import { ajouterJours, joursEntre } from './plan';
import { lireTemps } from '@/lib/plan';
import { chargeDepuisNolio } from './coaching';
import { debutApres, moteur, type Compte, type LigneTrame, type Trame } from './ecriture';
import { profilDeLaFiche } from './profilEntrainement';
import { clientService } from './supabase';
import { coefficientRiegel } from './zones';
import { ACCENTS } from './accentFond';

// Ce que le moteur rend d'une saison (POST /v1/trame).
export type InfosFond = { saison: number; themes: string[]; debut: string; fin: string; tests_le: string; tests_les?: string[] };
type ParamsFond = { saison: number; debut: string; entree?: boolean };

export const estFond = (parametres: unknown): boolean => Boolean((parametres as { fond?: unknown } | null)?.fond);
export const saisonDe = (parametres: unknown): ParamsFond | null =>
  ((parametres as { fond?: ParamsFond } | null)?.fond ?? null);

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
// Le premier lundi strictement après ce jour.
const lundiApres = (jour: string) => ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
// Un test plus vieux que ça se refait à l'entrée de la saison (décision du 21/10/2026, « l'entrée »).
const TESTS_ENTREE_JOURS = 91;
// La saison suivante suit la précédente si elle a fini il y a moins de deux semaines ; sinon elle repart de 1.
const ENCHAINEMENT_JOURS = 14;

type PlanFiche = { id: string; course_date: string; demarre_le: string | null; depart_prevu: string | null;
  parametres: Record<string, unknown> | null; trame: Trame | null; donnees?: Plan | null };

// Le lundi `lundi` est-il déjà pris par une préparation (en route, ou qui part cette semaine-là), par sa récupération
// après la course, ou par une saison ?
function couvert(plans: PlanFiche[], lundi: string): boolean {
  const dimanche = ajouterJours(lundi, 6);
  for (const p of plans) {
    if (!p.parametres) continue;
    if (estFond(p.parametres)) {
      if (p.course_date >= lundi) return true;
      continue;
    }
    if (p.demarre_le && p.course_date >= lundi) return true;
    if (!p.demarre_le && p.depart_prevu && p.depart_prevu <= dimanche) return true;
    // Sa récupération, jusqu'au lundi de reprise (cts_semaine.semaine_de_recuperation, décision coach du 23/10/2026).
    if (p.demarre_le && p.course_date < lundi && joursEntre(p.course_date, lundi) <= 42) {
      const champs = (p.parametres.champs ?? {}) as Record<string, unknown>;
      const fin = debutApres({ course_date: p.course_date, temps_h: lireTemps(String(champs.temps_cible ?? '')) ?? 2,
        format: String(champs.format ?? '') });
      if (lundi < fin) return true;
    }
  }
  return false;
}

// La dernière préparation courue avant ce lundi : ses semaines de charge de développement (le volume de référence) et
// sa plus longue sortie (décision 6).
async function references(prep: PlanFiche | undefined): Promise<{ sl_reference_h: number | null; volume_reference_h: number | null }> {
  if (!prep?.parametres) return { sl_reference_h: null, volume_reference_h: null };
  const trame = prep.trame ?? await moteur<Trame>('/v1/trame', { parametres: prep.parametres }).catch(() => null);
  const lignes = (trame?.semaines ?? []) as LigneTrame[];
  const dev = lignes.filter((l) => l.bloc === 'Bloc développement' && l.type === 'Charge' && l.volume_h > 0);
  const sl = Math.max(0, ...lignes.map((l) => l.sl_min ?? 0));
  return {
    volume_reference_h: dev.length ? Math.round((dev.reduce((t, l) => t + l.volume_h, 0) / dev.length) * 100) / 100 : null,
    sl_reference_h: sl ? Math.round((sl / 60) * 100) / 100 : null,
  };
}

// Un test daté de plus de 3 mois, ou absent : la saison s'ouvre sur l'entrée. Le débutant n'a que le test de la parole
// au départ (décision 3).
function testsPerimes(sources: Record<string, { le?: string } | undefined>, debutant: boolean, lundi: string): boolean {
  const perime = (cle: string) => !sources[cle]?.le || joursEntre(String(sources[cle]?.le).slice(0, 10), lundi) > TESTS_ENTREE_JOURS;
  return perime('fc_seuil1') || (!debutant && perime('vc_ms'));
}

// La saison d'un coaché qui commence ce lundi : rangée comme un objectif de coaching, déjà en route.
async function creerSaison(fiche: Record<string, unknown>, plans: PlanFiche[], lundi: string): Promise<string> {
  const service = clientService();
  const objectifs = plans.filter((p) => p.parametres && !estFond(p.parametres)).sort((a, b) => a.course_date.localeCompare(b.course_date));
  const prochain = objectifs.find((p) => p.course_date >= lundi);
  const dernier = [...objectifs].reverse().find((p) => p.course_date < lundi && p.demarre_le);
  const precedente = plans.filter((p) => estFond(p.parametres)).sort((a, b) => b.course_date.localeCompare(a.course_date))[0];
  const saison = precedente && joursEntre(precedente.course_date, lundi) <= ENCHAINEMENT_JOURS
    ? (saisonDe(precedente.parametres)?.saison ?? 0) + 1 : 1;
  const base = (prochain ?? dernier ?? objectifs[objectifs.length - 1])?.parametres ?? null;
  // Les champs de sa course de référence (son prochain objectif, sinon le dernier) ; sans objectif, ceux de son
  // profil de coureur, et le moteur prend la course type de son niveau.
  const profil = await profilDeLaFiche(String(fiche.id));
  const champsBase = ((base?.champs ?? {}) as Record<string, unknown>);
  const charge = await chargeDepuisNolio(String(fiche.coach_id), (fiche.nolio_athlete_id as string | null) ?? null).catch(() => null);
  const champs: Record<string, unknown> = {
    coupure: 'non', blessure: 'non', ...champsBase,
    ...Object.fromEntries(['niveau', 'terrain', 'jours_disponibles', 'jour_sl', 'freq_hebdo']
      .filter((k) => (profil as Record<string, unknown>)[k] !== undefined).map((k) => [k, (profil as Record<string, unknown>)[k]])),
    ...(charge?.champs ?? {}),
  };
  const niveau = String(champs.niveau ?? 'intermediaire');
  const vc = fiche.vc_ms as number | null;
  const dPrime = fiche.d_prime_m as number | null;
  const profilCoureur = vc && dPrime ? (coefficientRiegel(vc, dPrime) < 0.9 ? 'rapide' : 'endurant') : null;
  const accent = (profil as Record<string, unknown>).cout_trail;
  const parametres: Record<string, unknown> = {
    schema: 1, champs, declaree_le: lundi,
    plage_dominante: base?.plage_dominante ?? null, bande_majeure: base?.bande_majeure ?? null,
    ...(profilCoureur ? { profil_coureur: profilCoureur } : {}),
    fond: {
      debut: lundi, saison,
      entree: testsPerimes((fiche.reperes_sources ?? {}) as Record<string, { le?: string }>, niveau === 'debutant', lundi),
      ...(await references(dernier)),
      accent: ACCENTS.some(([cle]) => cle === accent) ? accent : null,
    },
  };
  const trame = await moteur<Trame & { fond: InfosFond }>('/v1/trame', { parametres });
  const donneesBrutes = await moteur<Plan>('/v1/donnees', { parametres, donnees_avant: null });
  const nom = `Saison de fond ${saison}`;
  const donnees = { ...donneesBrutes, course: { ...donneesBrutes.course, nom, date: trame.fond.fin, date_debut_plan: trame.fond.debut },
    athlete: { ...donneesBrutes.athlete, nom: String(fiche.nom) }, fond: trame.fond } as Plan;
  const { data: plan, error } = await service.from('plans').insert({
    compte_id: fiche.coach_id, course_nom: nom, course_date: trame.fond.fin, debut_plan: trame.fond.debut,
    schema: donnees.schema, version_moteur: donnees.version_moteur, donnees, intake: {}, parametres, trame,
    coach_id: fiche.coach_id, demarre_le: lundi,
  }).select('id').single();
  if (error || !plan) throw new Error(`saison : ${error?.message ?? 'non rangée'}`);
  const { error: erreurLien } = await service.from('coaching').insert({
    plan_id: plan.id, coach_id: fiche.coach_id, athlete_nom: fiche.nom, athlete_id: fiche.id,
  });
  if (erreurLien) {
    await service.from('plans').delete().eq('id', plan.id);
    throw new Error(`saison : ${erreurLien.message}`);
  }
  return plan.id as string;
}

// Chaque soir (le passage quotidien) : la saison de chaque coaché en programmation automatique, relié à Nolio et en
// mode coaching, dont le lundi qui vient n'est pris par rien. Ce qui n'est pas fait l'est le soir suivant.
export async function saisonsDuJour(budgetMs = 90_000): Promise<Compte[]> {
  const debut = Date.now();
  const service = clientService();
  const lundi = lundiApres(aujourdhuiParis());
  const { data: toutes, error } = await service.from('athletes_coaches').select('*').not('nolio_athlete_id', 'is', null);
  if (error) return [{ plan: '', quoi: 'saisons de fond non lues', erreur: error.message }];
  const fiches = (toutes ?? []).filter((f) => f.mode !== 'plan' && f.programmation !== 'main');
  if (!fiches.length) return [];
  const { data: liens } = await service.from('coaching').select('plan_id, athlete_id').in('athlete_id', fiches.map((f) => f.id));
  const ids = (liens ?? []).map((l) => l.plan_id as string);
  const { data: plans } = ids.length
    ? await service.from('plans').select('id, course_date, demarre_le, depart_prevu, parametres, trame').in('id', ids)
    : { data: [] };
  const comptes: Compte[] = [];
  for (const f of fiches) {
    const siens = ((plans ?? []) as PlanFiche[]).filter((p) => (liens ?? []).some((l) => l.plan_id === p.id && l.athlete_id === f.id));
    if (couvert(siens, lundi)) continue;
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: '', quoi: 'saison de fond remise au soir suivant', coache: true });
      continue;
    }
    try {
      const planId = await creerSaison(f, siens, lundi);
      comptes.push({ plan: planId, quoi: `saison de fond du ${lundi} créée`, coache: true });
    } catch (e) {
      comptes.push({ plan: '', quoi: 'saison de fond non créée', erreur: e instanceof Error ? e.message : String(e), coache: true });
    }
  }
  return comptes;
}

// Une préparation prend la suite (un départ, ou une semaine déjà prise) : la saison s'arrête la veille de ce lundi.
export async function arreterLaSaison(athleteId: string, lundi: string): Promise<string[]> {
  const service = clientService();
  const { data: liens } = await service.from('coaching').select('plan_id').eq('athlete_id', athleteId);
  const ids = (liens ?? []).map((l) => l.plan_id as string);
  if (!ids.length) return [];
  const { data: plans } = await service.from('plans').select('id, course_date, parametres').in('id', ids).gte('course_date', lundi);
  const arretees: string[] = [];
  for (const p of (plans ?? []).filter((x) => estFond(x.parametres))) {
    await service.from('plans').update({ course_date: ajouterJours(lundi, -1) }).eq('id', p.id);
    arretees.push(p.id as string);
  }
  return arretees;
}

// La semaine `lundi` d'une saison est-elle prise par une préparation du même coaché (en route, ou qui part) ?
export async function semainePriseParUnObjectif(planId: string, lundi: string): Promise<string | null> {
  const service = clientService();
  const { data: lien } = await service.from('coaching').select('athlete_id').eq('plan_id', planId).maybeSingle();
  if (!lien) return null;
  const { data: liens } = await service.from('coaching').select('plan_id').eq('athlete_id', lien.athlete_id);
  const ids = (liens ?? []).map((l) => l.plan_id as string).filter((id) => id !== planId);
  if (!ids.length) return null;
  const { data: plans } = await service.from('plans').select('id, course_date, demarre_le, depart_prevu, parametres').in('id', ids);
  const prise = ((plans ?? []) as PlanFiche[]).some((p) => p.parametres && !estFond(p.parametres) && (
    (p.demarre_le && p.course_date >= lundi) || (!p.demarre_le && p.depart_prevu && p.depart_prevu <= ajouterJours(lundi, 6))));
  return prise ? String(lien.athlete_id) : null;
}
