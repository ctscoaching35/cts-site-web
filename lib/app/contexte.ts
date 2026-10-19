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
import { clientServeur, supabaseConfigure } from './supabase';
import { PROFIL_VIDE, type Profil } from './zones';

// profil : « Tes zones » pour ce plan (cadrage §7.1) ; vide tant qu'aucun test n'est saisi.
// exemple : en démonstration, des semaines écoulées simulées (?retours=exemple) pour voir la jauge et les graphiques.
// Le journal de séance, le déplacement et les ajustements de l'app ont quitté l'app avec la vue jour par jour
// (CTS_NOLIO_CADRAGE.md, T1, 18/10/2026) : les séances vivent dans Nolio, les ajustements s'y écrivent le dimanche.
export type Contexte = { cle: string; plan: Plan; jour: string; demonstration: boolean; profil: Profil; exemple: boolean };
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
    return { cle, plan, jour, demonstration: true, profil: profilDemonstration(r), exemple: r.retours === 'exemple' };
  }

  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims?.sub) redirect('/app/connexion');
  // Un plan par course (cadrage, 3.6) : celui que l'athlète a choisi sur cet appareil (« Tes plans »,
  // ou le dernier acheté), sinon celui de la prochaine course, sinon le dernier couru.
  const aujourdhui = aujourdhuiIso();
  // Les plans des athlètes coachés, rangés dans le compte du coach, ne sont pas les siens (CTS_NOLIO_CADRAGE.md).
  const { data: tous } = await supabase.from('plans').select('id, course_date').order('course_date');
  const { data: coaches } = await supabase.from('coaching').select('plan_id');
  const exclus = new Set((coaches ?? []).map((c) => c.plan_id));
  const plans = (tous ?? []).filter((p) => !exclus.has(p.id));
  const voulu = (await cookies()).get(COOKIE_PLAN)?.value;
  const choisi = plans?.find((p) => p.id === voulu)
    ?? plans?.find((p) => p.course_date >= aujourdhui) ?? plans?.[plans.length - 1];
  if (!choisi) redirect('/app/sans-plan');
  const { data: ligne, error } = await supabase.from('plans').select('donnees').eq('id', choisi.id).single();
  if (error || !ligne) throw new Error(`Plan ${choisi.id} illisible : ${error?.message ?? 'introuvable'}`);
  const jour = process.env.NODE_ENV !== 'production' && jourDemande ? jourDemande : aujourdhui;
  // Le profil « Tes zones » du plan ; sans la table (pas encore créée), le profil reste vide.
  const { data: zones } = await supabase.from('zones').select('*').eq('plan_id', choisi.id).maybeSingle();
  const profil: Profil = zones ? { ...PROFIL_VIDE, ...pick(zones) } : PROFIL_VIDE;
  return { cle: choisi.id, plan: verifierSchema(ligne.donnees as Plan), jour, demonstration: false, profil, exemple: false };
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
