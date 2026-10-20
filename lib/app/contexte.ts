/**
 * Le contexte d'une page de l'app : quel plan, quel jour.
 * - Supabase configuré : le plan du compte connecté (sans session : la connexion), aujourd'hui ;
 *   en développement, ?jour= simule un autre jour.
 * - Sinon, la démonstration (développement seulement) : un plan du corpus (?plan=) et un jour
 *   simulé (?jour=).
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ficheDuCompte } from './demandes';
import { EXEMPLES, jourParDefaut } from './demonstration';
import { planSansObjectif, reperesDeBase } from './reperes';
import { COOKIE_PLAN } from './planChoisi';
import { SCHEMA_PLAN, aujourdhuiIso, type Plan } from './plan';
import { clientServeur, clientService, supabaseConfigure } from './supabase';
import { PROFIL_VIDE, type Profil } from './zones';

// profil : « Tes zones » pour ce plan (cadrage §7.1) ; vide tant qu'aucun test n'est saisi.
// exemple : en démonstration, des semaines écoulées simulées (?retours=exemple) pour voir la jauge et les graphiques.
// coache : un objectif de son coach (T6) ; ses repères sont ceux de sa fiche (T8). aLaMain : un coaché que son coach
// programme à la main dans Nolio (décision coach du 20/10/2026, « tableau de bord complet ») : rien de la trame du moteur
// (blocs, jalons, piliers, jauge) ; sa semaine et ses données viennent de Nolio.
// Le journal de séance, le déplacement et les ajustements de l'app ont quitté l'app avec la vue jour par jour
// (CTS_NOLIO_CADRAGE.md, T1, 18/10/2026) : les séances vivent dans Nolio, les ajustements s'y écrivent le dimanche.
export type Contexte = {
  cle: string; plan: Plan; jour: string; demonstration: boolean; profil: Profil; exemple: boolean; coache: boolean; aLaMain: boolean;
  // sansObjectif : un coaché sans aucun objectif (décision coach du 20/10/2026, « tableau de bord complet ») ; plan n'a
  // alors que son nom et ses repères (reperes.ts), cle est vide, fiche dit qui il est.
  sansObjectif: boolean; fiche: FicheDuContexte | null;
};
export type FicheDuContexte = { id: string; coach_id: string; nolio: string | null; accord: boolean };

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
// Un objectif à venir sur le compte connecté (l'accueil d'entre-deux d'un coaché : aucun, son prochain se prépare).
export async function objectifAVenir(): Promise<boolean> {
  const { data } = await (await clientServeur()).auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return false;
  const aujourdhui = aujourdhuiIso();
  return (await plansDuCompte(String(id))).some((p) => p.course_date >= aujourdhui);
}
export type Recherche = Promise<Record<string, string | string[] | undefined>>;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function verifierSchema(plan: Plan) {
  if (plan.schema !== SCHEMA_PLAN) throw new Error(`Plan au schéma ${plan.schema}, l'app lit le ${SCHEMA_PLAN}`);
  return plan;
}

// options.sansObjectif : la page accepte un coaché sans objectif (son accueil, ses données, son profil, ses tests, la
// bibliothèque, son compte) ; les autres le renvoient à l'accueil.
export async function contexte(recherche: Recherche, options: { sansObjectif?: boolean } = {}): Promise<Contexte> {
  const r = await recherche;
  const jourDemande = typeof r.jour === 'string' && JOUR.test(r.jour) ? r.jour : null;

  if (!supabaseConfigure()) {
    const cle = typeof r.plan === 'string' && r.plan in EXEMPLES ? r.plan : 'L4';
    const plan = verifierSchema(EXEMPLES[cle].plan);
    const jour = jourDemande ?? jourParDefaut(plan);
    // ?coache=1 : la version d'un coaché (ses repères posés par son coach), en démonstration seulement.
    // ?main=1 : un coaché programmé à la main ; ?sansobjectif=1 : un coaché sans objectif.
    const sansObjectif = r.sansobjectif === '1';
    if (sansObjectif && !options.sansObjectif) redirect('/app?sansobjectif=1');
    return {
      cle: sansObjectif ? '' : cle, demonstration: true, profil: profilDemonstration(r), exemple: r.retours === 'exemple',
      plan: sansObjectif && plan.zones ? planSansObjectif(plan.athlete.nom, { zones: plan.zones, effort: plan.mode_emploi.effort }) : plan,
      jour: sansObjectif ? new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date()) : jour,
      coache: r.coache === '1' || r.main === '1' || sansObjectif, aLaMain: r.main === '1' || sansObjectif,
      sansObjectif, fiche: null,
    };
  }

  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims?.sub) redirect('/app/connexion');
  // Un plan par course (cadrage, 3.6) : celui que l'athlète a choisi sur cet appareil (« Tes plans »,
  // ou le dernier acheté), sinon celui de la prochaine course, sinon le dernier couru.
  const aujourdhui = aujourdhuiIso();
  const plans = await plansDuCompte(session.claims.sub as string);
  const [voulu, choisiLe] = ((await cookies()).get(COOKIE_PLAN)?.value ?? '').split('@');
  const prochain = plans.find((p) => p.course_date >= aujourdhui);
  // Un coaché (décision coach du 20/10/2026, « toujours le prochain ») : un objectif choisi reste affiché jusqu'à sa
  // course ; passé, seulement le jour où il l'a choisi pour le regarder ; ensuite, l'app revient d'elle-même au prochain.
  const epingle = plans.find((p) => p.id === voulu);
  const tenu = epingle && (!epingle.coache || !prochain || epingle.course_date >= aujourdhui || choisiLe === aujourdhui) ? epingle : undefined;
  const choisi = tenu ?? prochain ?? plans[plans.length - 1];
  if (!choisi) return sansObjectif(String(session.claims.sub), options, process.env.NODE_ENV !== 'production' && jourDemande ? jourDemande : aujourdhui);
  // Un objectif coaché est rangé dans le compte du coach : lu avec la clé de service, une fois vérifié qu'il est à lui.
  const lecteur = choisi.coache ? clientService() : supabase;
  const { data: ligne, error } = await lecteur.from('plans').select('donnees').eq('id', choisi.id).single();
  if (error || !ligne) throw new Error(`Plan ${choisi.id} illisible : ${error?.message ?? 'introuvable'}`);
  const jour = process.env.NODE_ENV !== 'production' && jourDemande ? jourDemande : aujourdhui;
  const profil = choisi.coache ? await profilDuCoache(choisi.id) : await profilDuPlan(choisi.id);
  return {
    cle: choisi.id, plan: verifierSchema(ligne.donnees as Plan), jour, demonstration: false, profil, exemple: false, coache: choisi.coache,
    aLaMain: choisi.coache && await programmeALaMain(choisi.id), sansObjectif: false, fiche: null,
  };
}

// Un compte sans objectif : un coaché (sa fiche), dans les pages qui l'acceptent ; ailleurs, son accueil. Sans fiche,
// un compte sans plan.
async function sansObjectif(compteId: string, options: { sansObjectif?: boolean }, jour: string): Promise<Contexte> {
  const fiche = await ficheDuCompte(compteId);
  if (!fiche) redirect('/app/sans-plan');
  if (!options.sansObjectif) redirect('/app');
  const service = clientService();
  const { data: a } = await service.from('athletes_coaches').select('*').eq('id', fiche.id).maybeSingle();
  const nolio = (a?.nolio_athlete_id ?? null) as string | null;
  const { data: accord } = nolio
    ? await service.from('nolio_accords').select('accord_le').eq('coach_id', fiche.coach_id).eq('nolio_athlete_id', nolio).maybeSingle()
    : { data: null };
  return {
    cle: '', plan: planSansObjectif(fiche.nom, await reperesDeBase()), jour, demonstration: false, profil: profilDeLaFiche(a),
    exemple: false, coache: true, aLaMain: true, sansObjectif: true,
    fiche: { id: fiche.id, coach_id: fiche.coach_id, nolio, accord: Boolean(accord) },
  };
}

// Un objectif coaché dont la fiche est programmée à la main ; non avant la migration du 20/10/2026.
async function programmeALaMain(planId: string): Promise<boolean> {
  const service = clientService();
  const { data: c } = await service.from('coaching').select('athlete_id').eq('plan_id', planId).maybeSingle();
  const { data: a } = c ? await service.from('athletes_coaches').select('*').eq('id', c.athlete_id).maybeSingle() : { data: null };
  return (a as { programmation?: string } | null)?.programmation === 'main';
}

// Le profil « Tes zones » du plan ; sans la table (pas encore créée), le profil reste vide.
async function profilDuPlan(planId: string): Promise<Profil> {
  const { data: zones } = await (await clientServeur()).from('zones').select('*').eq('plan_id', planId).maybeSingle();
  return zones ? { ...PROFIL_VIDE, ...pick(zones) } : PROFIL_VIDE;
}

// Les repères d'un coaché : ceux de sa fiche, lus dans ses tests, posés par son coach (T8) ou saisis par lui.
async function profilDuCoache(planId: string): Promise<Profil> {
  const service = clientService();
  const { data: c } = await service.from('coaching').select('athlete_id').eq('plan_id', planId).maybeSingle();
  // « * » : la D′ (AP4, pour son profil de coureur) n'existe qu'après la migration du 19/10/2026.
  const { data: a } = c ? await service.from('athletes_coaches').select('*').eq('id', c.athlete_id).maybeSingle()
    : { data: null };
  return profilDeLaFiche(a);
}

function profilDeLaFiche(a: Record<string, unknown> | null): Profil {
  if (!a) return PROFIL_VIDE;
  // La date de chaque repère, celle de sa source (lu dans un test, saisi par le coach ou par lui).
  const le = (cle: string) => ((a.reperes_sources ?? {}) as Record<string, { le?: string } | undefined>)[cle]?.le ?? null;
  const n = (cle: string) => (a[cle] ?? null) as number | null;
  return { ...PROFIL_VIDE, fc_seuil1: n('fc_seuil1'), vc_ms: n('vc_ms'), fc_seuil2: n('fc_seuil2'), v_seuil1_ms: n('v_seuil1_ms'),
    d_prime_m: n('d_prime_m'), fc_seuil1_le: le('fc_seuil1'), vc_le: le('vc_ms'), fc_seuil2_le: le('fc_seuil2') };
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

// Le prénom de l'athlète (le premier mot du nom donné au questionnaire) et ses initiales, pour l'accueil et l'en-tête.
export const prenom = (nom: string | undefined) => (nom ?? '').trim().split(/\s+/)[0] ?? '';
export const initiales = (nom: string | undefined) =>
  (nom ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase() ?? '').join('') || 'CTS';

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
        ...(ctx.coache ? { coache: '1' } : {}),
        ...(ctx.aLaMain && !ctx.sansObjectif ? { main: '1' } : {}),
        ...(ctx.sansObjectif ? { sansobjectif: '1' } : {}),
      }
    : {};
  const params = new URLSearchParams({ ...simule, ...extra });
  const requete = params.toString();
  return requete ? `${chemin}?${requete}` : chemin;
};
