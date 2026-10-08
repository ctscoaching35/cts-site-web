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
import { seanceDuJournal, type Retours, type Statut } from './journal';
import { ranger, type Deplacements } from './deplacement';
import { tousLesJours } from './plan';

// profil : « Tes zones » pour ce plan (cadrage §7.1) ; vide tant qu'aucun test n'est saisi.
// retours, journal : le journal de séance (§7.2) et le consentement qui l'ouvre.
// plan : rangé selon les séances que l'athlète a déplacées (§7.2, E1-E6) ; prevu : tel que généré.
export type Contexte = {
  cle: string; plan: Plan; prevu: Plan; deplacements: Deplacements; jour: string; demonstration: boolean;
  profil: Profil; retours: Retours; journal: boolean;
};
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
    const retours = r.retours === 'exemple' ? retoursExemple(plan, jour) : {};
    return {
      cle, plan, prevu: plan, deplacements: {}, jour, demonstration: true, profil: profilDemonstration(r), retours,
      journal: Object.keys(retours).length > 0,
    };
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
  // Le profil « Tes zones » du plan ; sans la table (pas encore créée), le profil reste vide.
  const { data: zones } = await supabase.from('zones').select('*').eq('plan_id', choisi.id).maybeSingle();
  const profil: Profil = zones ? { ...PROFIL_VIDE, ...pick(zones) } : PROFIL_VIDE;
  // Le journal de séance ; sans ses tables (pas encore créées), il reste vide.
  const { data: journal } = await supabase.from('journaux').select('plan_id').eq('plan_id', choisi.id).maybeSingle();
  const { data: lignes } = journal
    ? await supabase.from('retours').select('jour_id, statut, rpe, sensations').eq('plan_id', choisi.id)
    : { data: [] };
  const retours: Retours = Object.fromEntries((lignes ?? []).map((l) => [l.jour_id, l]));
  // Les séances déplacées ; sans la table (pas encore créée), le plan reste comme prévu.
  const { data: rangees } = await supabase.from('deplacements').select('jour_id, date_iso').eq('plan_id', choisi.id);
  const deplacements: Deplacements = Object.fromEntries((rangees ?? []).map((l) => [l.jour_id, l.date_iso]));
  const prevu = verifierSchema(ligne.donnees as Plan);
  return {
    cle: choisi.id, plan: ranger(prevu, deplacements), prevu, deplacements, jour, demonstration: false, profil, retours,
    journal: !!journal,
  };
}

const CHAMPS_PROFIL = ['fc_seuil1', 'fc_seuil1_le', 'vc_ms', 'd_prime_m', 'vc_le', 'fc_seuil2', 'fc_seuil2_le'] as const;
const pick = (ligne: Record<string, unknown>) =>
  Object.fromEntries(CHAMPS_PROFIL.map((k) => [k, ligne[k] ?? null])) as Partial<Profil>;

// En démonstration (développement seulement), un profil simulé : ?fc1=152&vc=15&fc2=172 (vc en km/h).
function profilDemonstration(r: Record<string, string | string[] | undefined>): Profil {
  const n = (k: string) => (typeof r[k] === 'string' && Number.isFinite(Number(r[k])) ? Number(r[k]) : null);
  const vc = n('vc');
  return { ...PROFIL_VIDE, fc_seuil1: n('fc1'), vc_ms: vc === null ? null : vc / 3.6, d_prime_m: vc === null ? null : 200, fc_seuil2: n('fc2') };
}

// En démonstration, ?retours=exemple : un journal simulé sur les séances passées, pour voir la jauge et
// les marques du calendrier (une séance sur huit pas faite, une sur six raccourcie, une sur dix sans retour).
function retoursExemple(plan: Plan, jour: string): Retours {
  const out: Retours = {};
  tousLesJours(plan)
    .filter((j) => seanceDuJournal(j) && j.date_iso && j.date_iso < jour)
    .forEach((j, i) => {
      const statut: Statut | null = i % 10 === 9 ? null : i % 8 === 7 ? 'pas_faite' : i % 6 === 5 ? 'raccourcie' : 'faite';
      if (statut) out[j.id] = { jour_id: j.id, statut, rpe: statut === 'pas_faite' ? null : 5, sensations: 3 + (i % 3) };
    });
  return out;
}

// Un lien de l'app ; en démonstration, il garde le plan, le jour et le profil simulés.
export const lien = (chemin: string, ctx: Contexte, extra: Record<string, string> = {}) => {
  const simule = ctx.demonstration
    ? {
        plan: ctx.cle, jour: ctx.jour,
        ...(ctx.profil.fc_seuil1 !== null ? { fc1: String(ctx.profil.fc_seuil1) } : {}),
        ...(ctx.profil.vc_ms !== null ? { vc: (ctx.profil.vc_ms * 3.6).toFixed(1) } : {}),
        ...(ctx.profil.fc_seuil2 !== null ? { fc2: String(ctx.profil.fc_seuil2) } : {}),
        ...(ctx.journal ? { retours: 'exemple' } : {}),
      }
    : {};
  const params = new URLSearchParams({ ...simule, ...extra });
  const requete = params.toString();
  return requete ? `${chemin}?${requete}` : chemin;
};
