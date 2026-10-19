/**
 * Le contexte d'une page de l'app : quel plan, quel jour.
 * - Supabase configuré : le plan du compte connecté (sans session : la connexion), aujourd'hui ;
 *   en développement, ?jour= simule un autre jour.
 * - Sinon, la démonstration (développement seulement) : un plan du corpus (?plan=) et un jour
 *   simulé (?jour=).
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EXEMPLES, jourParDefaut } from './demonstration';
import { COOKIE_PLAN } from './planChoisi';
import { SCHEMA_PLAN, aujourdhuiIso, type Plan } from './plan';
import { clientServeur, clientService, supabaseConfigure } from './supabase';
import { PROFIL_VIDE, type Profil } from './zones';

// profil : « Tes zones » pour ce plan (cadrage §7.1) ; vide tant qu'aucun test n'est saisi.
// exemple : en démonstration, des semaines écoulées simulées (?retours=exemple) pour voir la jauge et les graphiques.
// coache : un objectif de son coach (T6) ; ses repères sont ceux que le coach a posés sur sa fiche, en lecture seule (T8).
// Le journal de séance, le déplacement et les ajustements de l'app ont quitté l'app avec la vue jour par jour
// (CTS_NOLIO_CADRAGE.md, T1, 18/10/2026) : les séances vivent dans Nolio, les ajustements s'y écrivent le dimanche.
export type Contexte = {
  cle: string; plan: Plan; jour: string; demonstration: boolean; profil: Profil; exemple: boolean; coache: boolean;
};

export type PlanDuCompte = { id: string; course_nom: string; course_date: string; coache: boolean };

// Les plans d'un compte : les siens (les règles de la base ne lui montrent qu'eux), sans les objectifs coachés que
// le compte d'un coach range pour ses athlètes ; et, pour un athlète que son coach a invité dans l'app (T6), les
// objectifs de sa fiche.
export async function plansDuCompte(compteId: string): Promise<PlanDuCompte[]> {
  const supabase = await clientServeur();
  const { data: tous } = await supabase.from('plans').select('id, course_nom, course_date');
  const { data: coaches } = await supabase.from('coaching').select('plan_id');
  const exclus = new Set((coaches ?? []).map((c) => c.plan_id));
  const propres = (tous ?? []).filter((p) => !exclus.has(p.id)).map((p) => ({ ...p, coache: false }));
  const service = clientService();
  const { data: fiches } = await service.from('athletes_coaches').select('id').eq('compte_id', compteId);
  const { data: lignes } = fiches?.length
    ? await service.from('coaching').select('plan_id, plans(course_nom, course_date)').in('athlete_id', fiches.map((f) => f.id))
    : { data: [] };
  const suivis = (lignes ?? []).map((l) => {
    const p = (Array.isArray(l.plans) ? l.plans[0] : l.plans) as { course_nom: string; course_date: string } | null;
    return { id: l.plan_id as string, course_nom: p?.course_nom ?? '', course_date: p?.course_date ?? '', coache: true };
  });
  return [...propres, ...suivis].sort((a, b) => a.course_date.localeCompare(b.course_date));
}
export type Recherche = Promise<Record<string, string | string[] | undefined>>;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function verifierSchema(plan: Plan) {
  if (plan.schema !== SCHEMA_PLAN) throw new Error(`Plan au schéma ${plan.schema}, l'app lit le ${SCHEMA_PLAN}`);
  return plan;
}

export async function contexte(recherche: Recherche): Promise<Contexte> {
  const r = await recherche;
  const jourDemande = typeof r.jour === 'string' && JOUR.test(r.jour) ? r.jour : null;

  if (!supabaseConfigure()) {
    const cle = typeof r.plan === 'string' && r.plan in EXEMPLES ? r.plan : 'L4';
    const plan = verifierSchema(EXEMPLES[cle].plan);
    const jour = jourDemande ?? jourParDefaut(plan);
    return { cle, plan, jour, demonstration: true, profil: profilDemonstration(r), exemple: r.retours === 'exemple', coache: false };
  }

  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims?.sub) redirect('/app/connexion');
  // Un plan par course (cadrage, 3.6) : celui que l'athlète a choisi sur cet appareil (« Tes plans »,
  // ou le dernier acheté), sinon celui de la prochaine course, sinon le dernier couru.
  const aujourdhui = aujourdhuiIso();
  const plans = await plansDuCompte(session.claims.sub as string);
  const voulu = (await cookies()).get(COOKIE_PLAN)?.value;
  const choisi = plans.find((p) => p.id === voulu) ?? plans.find((p) => p.course_date >= aujourdhui) ?? plans[plans.length - 1];
  if (!choisi) redirect('/app/sans-plan');
  // Un objectif coaché est rangé dans le compte du coach : lu avec la clé de service, une fois vérifié qu'il est à lui.
  const lecteur = choisi.coache ? clientService() : supabase;
  const { data: ligne, error } = await lecteur.from('plans').select('donnees').eq('id', choisi.id).single();
  if (error || !ligne) throw new Error(`Plan ${choisi.id} illisible : ${error?.message ?? 'introuvable'}`);
  const jour = process.env.NODE_ENV !== 'production' && jourDemande ? jourDemande : aujourdhui;
  const profil = choisi.coache ? await profilDuCoache(choisi.id) : await profilDuPlan(choisi.id);
  return {
    cle: choisi.id, plan: verifierSchema(ligne.donnees as Plan), jour, demonstration: false, profil, exemple: false, coache: choisi.coache,
  };
}

// Le profil « Tes zones » du plan ; sans la table (pas encore créée), le profil reste vide.
async function profilDuPlan(planId: string): Promise<Profil> {
  const { data: zones } = await (await clientServeur()).from('zones').select('*').eq('plan_id', planId).maybeSingle();
  return zones ? { ...PROFIL_VIDE, ...pick(zones) } : PROFIL_VIDE;
}

// Les repères d'un coaché : ceux de sa fiche, posés par son coach (T8).
async function profilDuCoache(planId: string): Promise<Profil> {
  const service = clientService();
  const { data: c } = await service.from('coaching').select('athlete_id').eq('plan_id', planId).maybeSingle();
  const { data: a } = c ? await service.from('athletes_coaches').select('fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms').eq('id', c.athlete_id).maybeSingle()
    : { data: null };
  return a ? { ...PROFIL_VIDE, fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2, v_seuil1_ms: a.v_seuil1_ms ?? null } : PROFIL_VIDE;
}

const CHAMPS_PROFIL = ['fc_seuil1', 'fc_seuil1_le', 'vc_ms', 'd_prime_m', 'vc_le', 'fc_seuil2', 'fc_seuil2_le', 'v_seuil1_ms'] as const;
const pick = (ligne: Record<string, unknown>) =>
  Object.fromEntries(CHAMPS_PROFIL.map((k) => [k, ligne[k] ?? null])) as Partial<Profil>;

// En démonstration (développement seulement), un profil simulé : ?fc1=152&vc=15&fc2=172&v1=11 (vc, v1 en km/h).
function profilDemonstration(r: Record<string, string | string[] | undefined>): Profil {
  const n = (k: string) => (typeof r[k] === 'string' && Number.isFinite(Number(r[k])) ? Number(r[k]) : null);
  const vc = n('vc');
  const v1 = n('v1');
  return { ...PROFIL_VIDE, fc_seuil1: n('fc1'), vc_ms: vc === null ? null : vc / 3.6, d_prime_m: vc === null ? null : 200, fc_seuil2: n('fc2'),
    v_seuil1_ms: v1 === null ? null : v1 / 3.6 };
}

// Un lien de l'app ; en démonstration, il garde le plan, le jour et le profil simulés.
export const lien = (chemin: string, ctx: Contexte, extra: Record<string, string> = {}) => {
  const simule = ctx.demonstration
    ? {
        plan: ctx.cle, jour: ctx.jour,
        ...(ctx.profil.fc_seuil1 !== null ? { fc1: String(ctx.profil.fc_seuil1) } : {}),
        ...(ctx.profil.vc_ms !== null ? { vc: (ctx.profil.vc_ms * 3.6).toFixed(1) } : {}),
        ...(ctx.profil.fc_seuil2 !== null ? { fc2: String(ctx.profil.fc_seuil2) } : {}),
        ...(ctx.profil.v_seuil1_ms !== null ? { v1: (ctx.profil.v_seuil1_ms * 3.6).toFixed(1) } : {}),
        ...(ctx.exemple ? { retours: 'exemple' } : {}),
      }
    : {};
  const params = new URLSearchParams({ ...simule, ...extra });
  const requete = params.toString();
  return requete ? `${chemin}?${requete}` : chemin;
};
