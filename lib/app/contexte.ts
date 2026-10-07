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

export type Contexte = { cle: string; plan: Plan; jour: string; demonstration: boolean };
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
    return { cle, plan, jour: jourDemande ?? jourParDefaut(plan), demonstration: true };
  }

  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims?.sub) redirect('/app/connexion');
  // Un plan par course (cadrage, 3.6) : celui que l'athlète a choisi sur cet appareil (« Tes plans »,
  // ou le dernier acheté), sinon celui de la prochaine course, sinon le dernier couru.
  const aujourdhui = aujourdhuiIso();
  const { data: plans } = await supabase.from('plans').select('id, course_date').order('course_date');
  const voulu = (await cookies()).get(COOKIE_PLAN)?.value;
  const choisi = plans?.find((p) => p.id === voulu)
    ?? plans?.find((p) => p.course_date >= aujourdhui) ?? plans?.[plans.length - 1];
  if (!choisi) redirect('/app/sans-plan');
  const { data: ligne, error } = await supabase.from('plans').select('donnees').eq('id', choisi.id).single();
  if (error || !ligne) throw new Error(`Plan ${choisi.id} illisible : ${error?.message ?? 'introuvable'}`);
  const jour = process.env.NODE_ENV !== 'production' && jourDemande ? jourDemande : aujourdhui;
  return { cle: choisi.id, plan: verifierSchema(ligne.donnees as Plan), jour, demonstration: false };
}

// Un lien de l'app ; en démonstration, il garde le plan et le jour simulés.
export const lien = (chemin: string, ctx: Contexte, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ ...(ctx.demonstration ? { plan: ctx.cle, jour: ctx.jour } : {}), ...extra });
  const requete = params.toString();
  return requete ? `${chemin}?${requete}` : chemin;
};
